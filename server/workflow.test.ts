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
    const { createRegistrationWithProof, trackRegistration, decideRegistrationPayment, resubmitPaymentProof, listPublicLiveBoard, updateEventConfig, listPublicEvents, issueLocalAdminToken, verifyAdminToken } = await import(${JSON.stringify(new URL('./store.ts', import.meta.url).href)});
    const { createApiApp } = await import(${JSON.stringify(new URL('./app.ts', import.meta.url).href)});
    const members = ['IGL','P2','P3','P4','SUB'].map((slotRole, index) => ({ slotRole, fullName: 'Private Student '+index, inGameName: 'Player'+index, characterId: '10000'+index, academicLevel: 'UG', wantsLunch: true, dietType: 'VEG' }));
    const input = { eventSlug:'kalinga-warriors-bgmi', teamName:'Test Squad', collegeName:'Test College', iglPhone:'9876543210', iglEmail:'captain@example.test', hasSubstitute:true, members, eligibilityConfirmed:true, fairPlayConfirmed:true, utrNumber:'123456789012', upiApp:'UPI', fileBuffer:Buffer.from('89504e470d0a1a0a000000000000','hex') };
    await assert.rejects(createRegistrationWithProof(input), /Payment details/);
    const bgmi = (await listPublicEvents()).find((e) => e.slug === 'kalinga-warriors-bgmi');
    await assert.rejects(updateEventConfig(bgmi.id, { upiVpa: 'not a vpa' }), /valid UPI ID/);
    await updateEventConfig(bgmi.id, { upiVpa: 'college@sbi' });
    const bundle = await createRegistrationWithProof(input);
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
    const board = JSON.stringify(await listPublicLiveBoard());
    for (const privateValue of ['9876543210','captain@example.test','Private Student','123456789013','screenshotPath']) assert.equal(board.includes(privateValue),false);
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
      const badLogin = await fetch(base+'/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test',password:'wrong-password'})});
      assert.equal(badLogin.status,401);
      const login = await fetch(base+'/api/admin/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'admin@example.test',password:'isolated-test-password'})});
      assert.equal(login.status,200);
      const loginData = await login.json();
      const adminHeaders = {Authorization:'Bearer '+loginData.token,'Content-Type':'application/json'};
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
      const malformed=await fetch(base+'/api/registrations/track',{method:'POST',headers:{'Content-Type':'application/json'},body:'{private-test-body'});
      assert.equal(malformed.status,400);
      assert.deepEqual(await malformed.json(),{error:'Invalid request body.'});
      const proofDenied=await fetch(base+'/api/admin/proof-image/'+bundle.proofs[0].id);
      assert.equal(proofDenied.status,401);
      const publicBoard=await fetch(base+'/api/live-registrations');
      const publicText=await publicBoard.text();
      assert.equal(publicText.includes(input.iglEmail),false);
      assert.equal(publicText.includes(input.iglPhone),false);
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
      // Another team still cannot reuse that UTR.
      await assert.rejects(createRegistrationWithProof({...input,teamName:'Copy Squad',iglPhone:'9876500002',members:squad('30000'),utrNumber:'223456789012',fileBuffer:png('04')}));
      // A seat vacated by a rejected team is reused; occupied seats are never duplicated.
      const secondApproved = await decideRegistrationPayment({registrationId:second.registration.id,decision:'approve',actorEmail:'admin@example.test',actorId:null});
      assert.equal(secondApproved.registration.slotNumber,'A2');
      await decideRegistrationPayment({registrationId:bundle.registration.id,decision:'reject',reason:'Test rejection',actorEmail:'admin@example.test',actorId:null});
      const third = await createRegistrationWithProof({...input,teamName:'Third Squad',iglPhone:'9876500003',members:squad('40000'),utrNumber:'423456789012',fileBuffer:png('05')});
      const thirdApproved = await decideRegistrationPayment({registrationId:third.registration.id,decision:'approve',actorEmail:'admin@example.test',actorId:null});
      assert.equal(thirdApproved.registration.slotNumber,'A1');
    } finally { server.close(); }
  `], { cwd: fixture, encoding: 'utf8', env: { ...process.env, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', VERCEL: '' } });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  // Only the generated, verified test directory may be removed.
  assert.equal(path.dirname(fixture), os.tmpdir());
  assert.ok(path.basename(fixture).startsWith('efest-workflow-'));
  fs.rmSync(fixture, { recursive: true });
});
