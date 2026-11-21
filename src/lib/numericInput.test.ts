import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPhoneInput, cleanUtrInput, phoneStatus, utrStatus } from './numericInput.js';

test('phone input keeps only digits and strips a pasted country code', () => {
  assert.equal(cleanPhoneInput('98a76-543 210'), '9876543210');
  assert.equal(cleanPhoneInput('+91 98765 43210'), '9876543210');
  assert.equal(cleanPhoneInput('09876543210'), '9876543210');
  assert.equal(cleanPhoneInput('98765432109999'), '9876543210');
  // A real number that happens to start with 91 is not mistaken for a country code.
  assert.equal(cleanPhoneInput('9198765432'), '9198765432');
  assert.equal(cleanPhoneInput('abc'), '');
});

test('UTR input keeps only digits, up to 12', () => {
  assert.equal(cleanUtrInput('UTR: 4321 9876 5432'), '432198765432');
  assert.equal(cleanUtrInput('4321987654329999'), '432198765432');
  assert.equal(cleanUtrInput('T2312ABC'), '2312');
});

test('phone status explains what is wrong while typing', () => {
  assert.equal(phoneStatus('').tone, 'idle');
  assert.equal(phoneStatus('5').tone, 'error');
  assert.match(phoneStatus('5123').message, /start with 6, 7, 8 or 9/);
  const partial = phoneStatus('98765');
  assert.equal(partial.tone, 'progress');
  assert.match(partial.message, /5 of 10 digits.*5 digits more/);
  assert.match(phoneStatus('987654321').message, /1 digit more/);
  assert.equal(phoneStatus('9876543210').tone, 'ok');
});

test('UTR status counts digits toward 12', () => {
  assert.equal(utrStatus('').tone, 'idle');
  const partial = utrStatus('4321');
  assert.equal(partial.tone, 'progress');
  assert.match(partial.message, /4 of 12 digits.*8 digits more/);
  assert.equal(utrStatus('432198765432').tone, 'ok');
});
