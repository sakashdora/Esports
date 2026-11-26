import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('local registration, review, reupload, privacy and admin authorization', async () => {
  // Use a separate child process with an isolated cwd: never touch actual registrations.
  const { spawnSync } = await import('node:child_process');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'efest-workflow-'));
  const result = spawnSync(process.execPath, ['--import', pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href, '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    const { createRegistrationWithProof, trackRegistration, decideRegistrationPayment, resubmitPaymentProof, updateEventConfig, listPublicEvents, issueLocalAdminToken, verifyAdminToken } = await import(${JSON.stringify(new URL('./store.ts', import.meta.url).href)});
    const { createApiApp } = await import(${JSON.stringify(new URL('./app.ts', import.meta.url).href)});
    const { OTHER_ACADEMIC_LEVEL } = await import(${JSON.stringify(new URL('../src/lib/tournamentRules.ts', import.meta.url).href)});
    const { default: jsQR } = await import(${JSON.stringify(pathToFileURL(path.resolve('node_modules/jsqr/dist/jsQR.js')).href)});
    const { PNG } = await import(${JSON.stringify(pathToFileURL(path.resolve('node_modules/pngjs/lib/png.js')).href)});
    const members = ['IGL','P2','P3','P4','SUB'].map((slotRole, index) => ({
      slotRole, fullName: 'Private Student '+index, inGameName: 'Player'+index, characterId: '10000'+index,
      academicLevel: index === 1 ? OTHER_ACADEMIC_LEVEL : 'UG',
      otherAcademicLevel: index === 1 ? ' MBA ' : undefined,
      collegeOverride: ' Private College '+index+' ', wantsLunch: true, dietType: 'VEG',
    }));
    const input = { eventSlug:'kalinga-warriors-bgmi', teamName:'Test Squad', collegeName:'Test College', iglPhone:'9876543210', iglEmail:'captain@example.test', hasSubstitute:true, members, eligibilityConfirmed:true, fairPlayConfirmed:true, utrNumber:'123456789012', upiApp:'UPI', fileBuffer:Buffer.from('89504e470d0a1a0a000000000000','hex') };
    await assert.rejects(createRegistrationWithProof(input), /Payment details/);
    const bgmi = (await listPublicEvents()).find((e) => e.slug === 'kalinga-warriors-bgmi');
    await assert.rejects(updateEventConfig(bgmi.id, { upiVpa: 'not a vpa' }), /valid UPI ID/);
    await updateEventConfig(bgmi.id, { upiVpa: 'college@sbi' });
    const bundle = await createRegistrationWithProof(input);
    assert.equal(bundle.members[1].academicLevel, 'MBA');
    assert.equal(bundle.members[1].collegeOverride, 'Private College 1');
    assert.equal(bundle.registration.totalFee,399);
    assert.equal(bundle.registration.lunchCount,5);
    assert.equal(bundle.event.eventDateLabel,'13 December 2026 · Entry 9:30 AM IST');
    assert.equal(await trackRegistration(bundle.registration.teamCode,'9876543211'),null);
    assert.ok(await trackRegistration(bundle.registration.teamCode,input.iglPhone));
    await assert.rejects(createRegistrationWithProof(input));
    await decideRegistrationPayment({registrationId:bundle.registration.id, decision:'reupload_required', reason:'Please provide a clearer proof', actorEmail:'admin@example.test', actorId:null});
    await resubmitPaymentProof({teamCode:bundle.registration.teamCode,iglPhone:input.iglPhone,utrNumber:'123456789013',upiApp:'UPI',fileBuffer:Buffer.from('89504e470d0a1a0a000000000001','hex')});
    const approved = await decideRegistrationPayment({registrationId:bundle.registration.id,decision:'approve',actorEmail:'admin@example.test',actorId:null});
    assert.equal(approved.registration.status,'verified');
    assert.equal(approved.registration.slotNumber,'A1');
    delete process.env.ADMIN_DEMO_PASSCODE;
    assert.equal((await verifyAdminToken('Bearer invalid')).ok,false);
    assert.throws(()=>issueLocalAdminToken('admin@example.test'));
    process.env.ADMIN_DEMO_PASSCODE='isolated-test-password';
    const token=issueLocalAdminToken('admin@example.test');
    assert.equal((await verifyAdminToken('Bearer '+token)).ok,true);
    assert.equal((await verifyAdminToken('Bearer '+token+'x')).ok,false);
    const app=createApiApp();
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    try {
      assert.equal((await fetch(base+'/api/admin/overview')).status,401);
      assert.equal((await fetch(base+'/api/admin/overview?token='+token)).status,401);
      const allowed=await fetch(base+'/api/admin/overview',{headers:{Authorization:'Bearer '+token}});
      assert.equal(allowed.status,200);
      assert.equal(allowed.headers.get('cache-control'),'no-store');
      assert.equal(allowed.headers.get('x-frame-options'),'DENY');
      const overview = await allowed.json();
      assert.equal(overview.bundles.length,1);
      assert.equal(overview.bundles[0].registration.status,'verified');
      // The dashboard gets no audit history or database details, and the schema download is gone.
      assert.equal('auditLogs' in overview,false);
      assert.equal('auditLogs' in overview.bundles[0],false);
      assert.equal('mode' in overview,false);
      assert.equal((await fetch(base+'/api/admin/schema.sql',{headers:{Authorization:'Bearer '+token}})).status,404);
      const badLogin = await fetch(base+'/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test',password:'wrong-password'})});
      assert.equal(badLogin.status,401);
      const login = await fetch(base+'/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test',password:'isolated-test-password'})});
      assert.equal(login.status,200);
      const loginData = await login.json();
      assert.equal(loginData.role,'admin');
      const adminHeaders = {Authorization:'Bearer '+loginData.token,'Content-Type':'application/json'};
      const jsonHeaders = {'Content-Type':'application/json'};
      const post = (url, body, headers = jsonHeaders, method = 'POST') => fetch(base+url,{method,headers,body:JSON.stringify(body)});
      const volunteerPassword = 'test-volunteer-pass';
      const volunteerBody = {loginId:'Front-Desk',password:volunteerPassword};
      assert.equal((await post('/api/admin/volunteers',volunteerBody)).status,401);
      assert.equal((await post('/api/admin/volunteers',{...volunteerBody,password:'short'},adminHeaders)).status,400);
      const volunteerAccount = await post('/api/admin/volunteers',volunteerBody,adminHeaders);
      assert.equal(volunteerAccount.status,201);
      assert.deepEqual(await volunteerAccount.json(),{loginId:'front-desk'});
      assert.equal((await post('/api/admin/volunteers',volunteerBody,adminHeaders)).status,409);
      const volunteers = await fetch(base+'/api/admin/volunteers',{headers:adminHeaders});
      assert.deepEqual(await volunteers.json(),{volunteers:[{loginId:'front-desk'}]});
      const volunteerSignIn = (password) => post('/api/admin/login',{email:'FRONT-DESK',password});
      assert.equal((await volunteerSignIn('wrong-password')).status,401);
      const volunteerLogin = await volunteerSignIn(volunteerPassword);
      assert.equal(volunteerLogin.status,200);
      const volunteer = await volunteerLogin.json();
      assert.equal(volunteer.role,'volunteer');
      const volunteerHeaders = {...jsonHeaders,Authorization:'Bearer '+volunteer.token};
      for (const route of ['/api/admin/overview','/api/admin/volunteers','/api/admin/proof-image/'+bundle.proofs[0].id]) {
        assert.equal((await fetch(base+route,{headers:volunteerHeaders})).status,401);
      }
      const passRequest = (phone) => post('/api/registrations/check-in-pass',{teamCode:bundle.registration.teamCode,iglPhone:phone});
      assert.equal((await passRequest(undefined)).status,404);
      assert.equal((await passRequest('9876543211')).status,404);
      const pass = await passRequest(input.iglPhone);
      assert.equal(pass.status,200);
      assert.equal(pass.headers.get('cache-control'),'no-store');
      assert.match(pass.headers.get('content-disposition'),new RegExp(bundle.registration.teamCode+'-check-in.png'));
      const passPng = PNG.sync.read(Buffer.from(await pass.arrayBuffer()));
      const scan = jsQR(new Uint8ClampedArray(passPng.data),passPng.width,passPng.height);
      assert.ok(scan,'downloaded QR should be readable');
      assert.equal((await post('/api/check-in/lookup',{code:scan.data})).status,401);
      assert.equal((await fetch(base+'/api/check-in/attendance')).status,401);
      const found = await post('/api/check-in/lookup',{code:scan.data.replace('Test Squad','Untrusted QR Name')},volunteerHeaders);
      assert.equal(found.status,200);
      const {squad:checkedSquad} = await found.json();
      assert.equal(checkedSquad.teamName,input.teamName);
      assert.equal(checkedSquad.players.length,5);
      assert.equal(checkedSquad.players[1].college,'Private College 1');
      assert.equal(checkedSquad.players[0].attendance,null);
      assert.ok(!JSON.stringify(checkedSquad).includes(input.iglEmail));
      assert.ok(!JSON.stringify(checkedSquad).includes(input.iglPhone));
      const presentUrl = '/api/check-in/'+bundle.registration.teamCode+'/present';
      const player = {memberId:checkedSquad.players[0].id};
      assert.equal((await post(presentUrl,player)).status,401);
      assert.equal((await post(presentUrl,{memberId:'cccccccc-ffff-4444-8888-aaaaaaaaaaaa'},volunteerHeaders)).status,404);
      const firstMark = await post(presentUrl,player,volunteerHeaders);
      assert.equal(firstMark.status,200);
      const {mark} = await firstMark.json();
      assert.equal(mark.checkedInBy,'front-desk');
      const repeatMark = await post(presentUrl,player,adminHeaders);
      assert.deepEqual((await repeatMark.json()).mark,mark);
      const adminScan = await post('/api/check-in/lookup',{code:bundle.registration.teamCode},adminHeaders);
      assert.deepEqual((await adminScan.json()).squad.players[0].attendance,mark);
      for (const headers of [adminHeaders,volunteerHeaders]) {
        const attendance = await fetch(base+'/api/check-in/attendance',{headers});
        assert.equal(attendance.status,200);
        assert.deepEqual(await attendance.json(),{entries:[{...mark,fullName:members[0].fullName,teamName:input.teamName,teamCode:bundle.registration.teamCode}],hasMore:false});
      }
      const resetUrl = '/api/admin/volunteers/front-desk/password';
      const reset = {password:'new-test-volunteer-pass'};
      assert.equal((await post(resetUrl,reset,volunteerHeaders,'PATCH')).status,401);
      assert.equal((await post(resetUrl,reset,adminHeaders,'PATCH')).status,200);
      assert.equal((await fetch(base+'/api/check-in/attendance',{headers:volunteerHeaders})).status,401);
      assert.equal((await volunteerSignIn(volunteerPassword)).status,401);
      const freshVolunteer = await (await volunteerSignIn(reset.password)).json();
      const freshHeaders = {...jsonHeaders,Authorization:'Bearer '+freshVolunteer.token};
      assert.equal((await fetch(base+'/api/check-in/attendance',{headers:freshHeaders})).status,200);
      // Removing a volunteer ends their session straight away.
      const removeUrl = base+'/api/admin/volunteers/front-desk';
      assert.equal((await fetch(removeUrl,{method:'DELETE',headers:freshHeaders})).status,401);
      assert.equal((await fetch(removeUrl,{method:'DELETE',headers:adminHeaders})).status,200);
      assert.equal((await fetch(removeUrl,{method:'DELETE',headers:adminHeaders})).status,404);
      assert.equal((await fetch(base+'/api/check-in/attendance',{headers:freshHeaders})).status,401);
      assert.equal((await volunteerSignIn(reset.password)).status,401);
      assert.deepEqual(await (await fetch(base+'/api/admin/volunteers',{headers:adminHeaders})).json(),{volunteers:[]});
      for (const format of ['xlsx','pdf']) {
        const denied = await fetch(base+'/api/admin/export/'+format,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        assert.equal(denied.status,401);
        const exported = await fetch(base+'/api/admin/export/'+format,{method:'POST',headers:adminHeaders,body:JSON.stringify({status:'verified'})});
        assert.equal(exported.status,200);
        assert.equal(exported.headers.get('cache-control'),'no-store');
        const bytes = Buffer.from(await exported.arrayBuffer());
        assert.equal(bytes.subarray(0,format==='xlsx'?2:4).toString(),format==='xlsx'?'PK':'%PDF');
        if (format==='xlsx') {
          const {default: ExcelJS} = await import(${JSON.stringify(pathToFileURL(path.resolve('node_modules/exceljs/excel.js')).href)});
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(bytes);
          assert.equal(workbook.getWorksheet('Registrations').rowCount,2);
          assert.equal(workbook.getWorksheet('Players').rowCount,6);
          assert.equal(workbook.getWorksheet('Players').getCell('I3').value,'Private College 1');
          assert.equal(workbook.getWorksheet('Players').getCell('J3').value,'MBA');
          assert.equal(workbook.getWorksheet('Registrations').getCell('H2').value,'9876543210');
          assert.equal(JSON.stringify(workbook.model).includes(bundle.registration.id),false);
          assert.equal(JSON.stringify(workbook.model).includes(loginData.token),false);
        }
      }
      const createDenied = await fetch(base+'/api/admin/events',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      assert.equal(createDenied.status,401);
      const created = await fetch(base+'/api/admin/events',{method:'POST',headers:adminHeaders,body:JSON.stringify({title:'Workflow Test Event',gameTitle:'BGMI',maxTeams:24,baseFee:299,lunchFee:100,prizePoolTotal:1000})});
      assert.equal(created.status,201);
      const createdEvent = (await created.json()).event;
      const invalidEvent = await fetch(base+'/api/admin/events',{method:'POST',headers:adminHeaders,body:JSON.stringify({title:'Invalid',gameTitle:'BGMI',maxTeams:-1})});
      assert.equal(invalidEvent.status,400);
      const freeEvent = await fetch(base+'/api/admin/events',{method:'POST',headers:adminHeaders,body:JSON.stringify({title:'Free Test',gameTitle:'BGMI',baseFee:0,lunchFee:0,prizePoolTotal:0})});
      assert.equal(freeEvent.status,201);
      const freeData = (await freeEvent.json()).event;
      assert.equal(freeData.baseFee,0);
      assert.equal(freeData.lunchFee,0);
      assert.equal(freeData.prizePoolTotal,0);
      const closed = await fetch(base+'/api/admin/events/'+createdEvent.id,{method:'PATCH',headers:adminHeaders,body:JSON.stringify({isOpen:false})});
      assert.equal(closed.status,200);
      assert.equal((await closed.json()).event.isOpen,false);
      const badPatch = await fetch(base+'/api/admin/events/'+createdEvent.id,{method:'PATCH',headers:adminHeaders,body:JSON.stringify({maxTeams:-5})});
      assert.equal(badPatch.status,400);
      const fieldPatch = await fetch(base+'/api/admin/events/'+createdEvent.id,{method:'PATCH',headers:adminHeaders,body:JSON.stringify({slug:'overwritten',id:'overwritten',venueLabel:'Hall 2'})});
      assert.equal(fieldPatch.status,200);
      const patchedEvent = (await fieldPatch.json()).event;
      assert.equal(patchedEvent.slug,createdEvent.slug);
      assert.equal(patchedEvent.id,createdEvent.id);
      assert.equal(patchedEvent.venueLabel,'Hall 2');
      const lookup = (body) => fetch(base+'/api/registrations/track', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
      for (const body of [{teamCode:bundle.registration.teamCode}, {iglPhone:input.iglPhone}, {iglPhone:'+91 '+input.iglPhone}]) {
        const response = await lookup(body);
        assert.equal(response.status,200);
        assert.equal(response.headers.get('cache-control'),'no-store');
        assert.ok(response.headers.get('server-timing'));
        const summary = await response.json();
        assert.equal(summary.detailsVerified,false);
        assert.equal(summary.matches[0].status,'verified');
        assert.equal(summary.matches[0].teamName,input.teamName);
        const text = JSON.stringify(summary);
        for (const privateValue of [input.iglPhone,input.iglEmail,bundle.registration.teamCode,bundle.registration.id,'123456789013','Private Student','Private College','screenshotPath','100000']) assert.equal(text.includes(privateValue),false);
      }
      assert.equal((await lookup({})).status,400);
      assert.equal((await lookup({iglPhone:'123'})).status,400);
      assert.equal((await lookup({teamCode:'NO-MATCH'})).status,404);
      assert.equal((await lookup({teamCode:bundle.registration.teamCode,iglPhone:'9876543211'})).status,404);
      const privateDetails = await lookup({teamCode:bundle.registration.teamCode,iglPhone:input.iglPhone});
      assert.equal(privateDetails.status,200);
      const privateRoster = (await privateDetails.json()).members;
      assert.equal(privateRoster.length,5);
      assert.equal(privateRoster[1].collegeOverride,'Private College 1');
      assert.equal(privateRoster[1].academicLevel,'MBA');
      const deniedReupload = new FormData();
      deniedReupload.set('teamCode',bundle.registration.teamCode);
      deniedReupload.set('utrNumber','999456789012');
      deniedReupload.set('screenshot',new Blob([input.fileBuffer],{type:'image/png'}),'proof.png');
      assert.equal((await fetch(base+'/api/registrations/reupload',{method:'POST',body:deniedReupload})).status,400);
      const malformed=await fetch(base+'/api/registrations/track',{method:'POST',headers:{'Content-Type':'application/json'},body:'{private-test-body'});
      assert.equal(malformed.status,400);
      assert.deepEqual(await malformed.json(),{error:'Invalid request body.'});
      const proofDenied=await fetch(base+'/api/admin/proof-image/'+bundle.proofs[0].id);
      assert.equal(proofDenied.status,401);
      for (const route of ['/api/live-registrations', '/api/live-registrations/stream']) {
        assert.equal((await fetch(base+route)).status,404);
      }
      for (const route of ['/api/events','/api/events/'+bgmi.slug]) {
        const publicEvents = await fetch(base+route);
        assert.equal(publicEvents.status,200);
        const publicText = await publicEvents.text();
        const payload = JSON.parse(publicText);
        const publicBgmi = payload.event || payload.events.find((event) => event.slug === bgmi.slug);
        assert.equal(publicBgmi.maxTeams,bgmi.maxTeams);
        for (const value of ['registeredCount','verifiedCount','pendingCount',bundle.registration.teamCode,input.teamName,input.collegeName,'Private College',members[0].inGameName,input.iglEmail,input.iglPhone]) {
          assert.equal(publicText.includes(value),false);
        }
      }
      // Latest proof is reported first after a re-upload.
      const tracked = await trackRegistration(bundle.registration.teamCode,input.iglPhone);
      assert.equal(tracked.proofs[0].utrNumber,'123456789013');
      // A flagged team may resubmit a clearer screenshot of the same payment (same UTR).
      const squad = (tag) => members.map((m,i)=>({...m,characterId:tag+i,inGameName:'P'+tag+i}));
      const png = (hex) => Buffer.from('89504e470d0a1a0a0000000000'+hex,'hex');
      const second = await createRegistrationWithProof({...input,teamName:'Second Squad',iglPhone:'9876500001',members:squad('20000'),utrNumber:'223456789012',fileBuffer:png('02')});
      await decideRegistrationPayment({registrationId:second.registration.id,decision:'reupload_required',reason:'Blurry',actorEmail:'admin@example.test',actorId:null});
      const resent = await resubmitPaymentProof({teamCode:second.registration.teamCode,iglPhone:'9876500001',utrNumber:'223456789012',upiApp:'UPI',fileBuffer:png('03')});
      assert.equal(resent.registration.status,'pending');
      assert.equal(resent.proofs[0].reviewStatus,'pending');
      assert.equal((await post('/api/check-in/lookup',{code:second.registration.teamCode},adminHeaders)).status,404);
      assert.equal((await post('/api/registrations/check-in-pass',{teamCode:second.registration.teamCode,iglPhone:'9876500001'})).status,404);
      // Another team still cannot reuse that UTR.
      await assert.rejects(createRegistrationWithProof({...input,teamName:'Copy Squad',iglPhone:'9876500002',members:squad('30000'),utrNumber:'223456789012',fileBuffer:png('04')}));
      // A seat vacated by a rejected team is reused; occupied seats are never duplicated.
      const multi = await createRegistrationWithProof({...input,teamName:'Same Leader Another Squad',members:squad('50000'),utrNumber:'523456789012',fileBuffer:png('06')});
      const multiLookup = await (await lookup({iglPhone:input.iglPhone})).json();
      assert.equal(multiLookup.matches.length,2);
      assert.equal(JSON.stringify(multiLookup).includes(multi.registration.teamCode),false);
      // Admin-only permanent deletion of demo entries; the UTR and players are freed again.
      const demo = await createRegistrationWithProof({...input,teamName:'Demo Entry',iglPhone:'9876500009',members:squad('90000'),utrNumber:'923456789012',fileBuffer:png('09')});
      const deletePost = (headers, body) => fetch(base+'/api/admin/registrations/delete',{method:'POST',headers,body:JSON.stringify(body)});
      assert.equal((await deletePost({'Content-Type':'application/json'},{ids:[demo.registration.id]})).status,401);
      assert.equal((await deletePost(adminHeaders,{})).status,400);
      assert.equal((await deletePost(adminHeaders,{ids:[]})).status,400);
      const deleted = await deletePost(adminHeaders,{ids:[demo.registration.id,'does-not-exist']});
      assert.equal(deleted.status,200);
      assert.equal((await deleted.json()).deleted,1);
      assert.equal(await trackRegistration(demo.registration.teamCode,'9876500009'),null);
      const reused = await createRegistrationWithProof({...input,teamName:'Demo Entry',iglPhone:'9876500009',members:squad('90000'),utrNumber:'923456789012',fileBuffer:png('0a')});
      assert.equal(reused.registration.status,'pending');
      await deletePost(adminHeaders,{ids:[reused.registration.id]});
      // A stalled SMTP greeting must not hold either persisted operation open.
      const net = await import('node:net');
      const sockets = new Set();
      const smtp = net.createServer(socket => { sockets.add(socket); socket.on('error',()=>{}); socket.on('close',()=>sockets.delete(socket)); });
      smtp.listen(0,'127.0.0.1');
      await new Promise(resolve=>smtp.once('listening',resolve));
      process.env.SMTP_HOST='127.0.0.1';
      process.env.SMTP_PORT=String(smtp.address().port);
      process.env.SMTP_SECURE='false';
      process.env.SMTP_USER='test'; process.env.SMTP_PASS='test';
      const tasks = [];
      globalThis[Symbol.for('@vercel/request-context')] = {get:()=>({waitUntil:(promise)=>tasks.push(promise)})};
      try {
        const started=performance.now();
        const decisionResponse = await fetch(base+'/api/admin/registrations/'+multi.registration.id+'/decision',{method:'POST',headers:adminHeaders,body:JSON.stringify({decision:'reupload_required',reason:'Test correction'})});
        assert.equal(decisionResponse.status,200);
        const decisionResult = await decisionResponse.json();
        assert.equal(decisionResult.registration.status,'reupload_required');
        assert.equal(decisionResult.emailDelivery,'background');
        assert.equal(decisionResult.proofs[0].reviewStatus,'reupload_required');
        assert.ok(performance.now()-started<3000,'decision waited for SMTP');
        const form=new FormData();
        form.set('payload',JSON.stringify({...input,teamName:'HTTP Submission',members:squad('60000'),utrNumber:'623456789012'}));
        form.set('screenshot',new Blob([png('07')],{type:'image/png'}),'proof.png');
        const submitStarted=performance.now();
        const submitted=await fetch(base+'/api/registrations',{method:'POST',body:form});
        assert.equal(submitted.status,201);
        const receipt=await submitted.json();
        assert.equal(receipt.emailDelivery,'background');
        assert.equal(receipt.registration.status,'pending');
        assert.ok(performance.now()-submitStarted<3000,'registration waited for SMTP');
        assert.equal(tasks.length,2);
      } finally {
        smtp.close();
        for(const socket of sockets) socket.destroy();
        await Promise.all(tasks);
        delete globalThis[Symbol.for('@vercel/request-context')];
        process.env.SMTP_HOST=''; process.env.SMTP_USER=''; process.env.SMTP_PASS='';
      }
      assert.equal((await trackRegistration(multi.registration.teamCode,input.iglPhone)).registration.lastEmailStatus,'failed_or_unconfigured');
      const secondApproved = await decideRegistrationPayment({registrationId:second.registration.id,decision:'approve',actorEmail:'admin@example.test',actorId:null});
      assert.equal(secondApproved.registration.slotNumber,'A2');
      await decideRegistrationPayment({registrationId:bundle.registration.id,decision:'reject',reason:'Test rejection',actorEmail:'admin@example.test',actorId:null});
      assert.equal((await post('/api/check-in/lookup',{code:scan.data},adminHeaders)).status,404);
      assert.equal((await post(presentUrl,player,adminHeaders)).status,404);
      const third = await createRegistrationWithProof({...input,teamName:'Third Squad',iglPhone:'9876500003',members:squad('40000'),utrNumber:'423456789012',fileBuffer:png('05')});
      const thirdApproved = await decideRegistrationPayment({registrationId:third.registration.id,decision:'approve',actorEmail:'admin@example.test',actorId:null});
      assert.equal(thirdApproved.registration.slotNumber,'A1');

      // Multiple tournaments for one game can share a code prefix. Tracking must still
      // distinguish both teams even when they register with the same leader phone.
      const createSameGameEvent = async (title) => {
        const response = await post('/api/admin/events',{title,gameTitle:'BGMI',maxTeams:2,upiVpa:'college@sbi'},adminHeaders);
        assert.equal(response.status,201);
        return (await response.json()).event;
      };
      const arenaOne = await createSameGameEvent('Same Game Arena One');
      const arenaTwo = await createSameGameEvent('Same Game Arena Two');
      const arenaRegistration = (event, suffix) => createRegistrationWithProof({
        ...input, eventSlug:event.slug, teamName:'Arena Team '+suffix,
        members:squad('700'+suffix), utrNumber:'34012345678'+suffix, fileBuffer:png('1'+suffix),
      });
      const arenaTeamOne = await arenaRegistration(arenaOne,1);
      const arenaTeamTwo = await arenaRegistration(arenaTwo,2);
      assert.notEqual(arenaTeamOne.registration.teamCode,arenaTeamTwo.registration.teamCode);
      for(const {registration} of [arenaTeamOne,arenaTeamTwo]) {
        const trackedTeam = await trackRegistration(registration.teamCode,input.iglPhone);
        assert.equal(trackedTeam.registration.id,registration.id);
      }
      await deletePost(adminHeaders,{ids:[arenaTeamTwo.registration.id]});
      const arenaTeamThree = await arenaRegistration(arenaOne,3);
      assert.notEqual(arenaTeamThree.registration.teamCode,arenaTeamTwo.registration.teamCode);
      const overflow = await arenaRegistration(arenaOne,4);
      assert.equal(overflow.registration.status,'waitlisted');
      const approveArenaTeam = (team) => decideRegistrationPayment({registrationId:team.registration.id,decision:'approve',actorEmail:'admin@example.test',actorId:null});
      await approveArenaTeam(arenaTeamOne);
      await approveArenaTeam(arenaTeamThree);
      const waiting = await approveArenaTeam(overflow);
      assert.equal(waiting.registration.slotNumber,'WL-1');
      assert.equal((await approveArenaTeam(overflow)).registration.slotNumber,'WL-1');
      const overflowPass = {teamCode:overflow.registration.teamCode,iglPhone:input.iglPhone};
      assert.equal((await post('/api/registrations/check-in-pass',overflowPass)).status,404);
      await decideRegistrationPayment({registrationId:arenaTeamOne.registration.id,decision:'reject',reason:'Synthetic team withdrew',actorEmail:'admin@example.test',actorId:null});
      const promoted = await approveArenaTeam(overflow);
      assert.equal(promoted.registration.slotNumber,'A1');
      assert.equal((await post('/api/registrations/check-in-pass',overflowPass)).status,200);
    } finally { server.close(); }
  `], { cwd: fixture, encoding: 'utf8', env: { ...process.env, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', VERCEL: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' } });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  // Only the generated, verified test directory may be removed.
  assert.equal(path.dirname(fixture), os.tmpdir());
  assert.ok(path.basename(fixture).startsWith('efest-workflow-'));
  fs.rmSync(fixture, { recursive: true });
});
