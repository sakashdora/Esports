import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAllColleges, ODISHA_COLLEGES, searchColleges } from './odishaColleges';
import { MAX_COLLEGE_NAME_LENGTH } from './tournamentRules';

test('every college value fits the form limit and is unique', () => {
  const seen = new Set<string>();
  for (const option of ODISHA_COLLEGES) {
    assert.ok(option.value.length <= MAX_COLLEGE_NAME_LENGTH, option.value);
    assert.ok(!seen.has(option.value), `duplicate: ${option.value}`);
    seen.add(option.value);
  }
  assert.ok(ODISHA_COLLEGES.length > 250);
});

test('searchColleges finds colleges by short form, city and level', () => {
  assert.match(searchColleges('kiit')[0].name, /KIIT/);
  assert.match(searchColleges('iter')[0].name, /ITER/);
  assert.match(searchColleges('cet')[0].name, /OUTR/);
  assert.ok(searchColleges('ravenshaw').some((o) => o.value === 'Ravenshaw University, Cuttack'));
  assert.ok(searchColleges('mba rourkela').every((o) => /rourkela/i.test(o.haystack)));
  assert.ok(searchColleges('12th bhubaneswar').length > 3);
  assert.equal(searchColleges('zzz no such college').length, 0);
  assert.equal(searchColleges('sags')[0].value, 'Srusti Academy of Graduate Studies (SAGS), Bhubaneswar');
  assert.equal(searchColleges('srusti graduate')[0].name, 'Srusti Academy of Graduate Studies (SAGS)');
  assert.equal(searchColleges('usbm')[0].value, 'United School of Business Management (USBM), Bhubaneswar');
  assert.equal(searchColleges('united school')[0].name, 'United School of Business Management (USBM)');
});

test('empty search starts with the host academy, and branch groups end with a comma', () => {
  assert.match(searchColleges('')[0].name, /Srusti/);
  const kv = searchColleges('kendriya').find((o) => o.needsBranch);
  assert.equal(kv?.value, 'Kendriya Vidyalaya, ');
});

test('full list adds CHSE +2 and BPUT colleges without duplicating hand-checked ones', async () => {
  const all = await loadAllColleges();
  assert.ok(all.length > 1800, `only ${all.length}`);
  for (const option of all) assert.ok(option.value.length <= MAX_COLLEGE_NAME_LENGTH, option.value);
  assert.equal(all.filter((o) => /^Trident Academy of Technology/.test(o.name)).length, 1);
  assert.equal(all.filter((o) => /^Orissa Engineering College/.test(o.name)).length, 1);
  // "MIT" finds both colleges known by that short form.
  const mit = searchColleges('mit', 40, all).slice(0, 2).map((o) => o.name);
  assert.ok(mit.includes('Maharaja Institute of Technology (MIT)'));
  assert.ok(mit.includes('Modern Institute of Technology and Management (MITM)'));
  // CHSE district lists bring in local +2 colleges.
  assert.ok(searchColleges('bhuban women', 40, all).some((o) => o.category === '+2 Higher Secondary'));
  for (const word of ['arts', 'commerce', '12th', 'btech', 'bca', 'bba', 'imba']) {
    assert.ok(searchColleges(word, 40, all).length > 0, word);
  }
});
