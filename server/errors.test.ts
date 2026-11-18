import test from 'node:test';
import assert from 'node:assert/strict';
import { ClientInputError, clientErrorMessage } from './errors';

test('unexpected internal failures never expose their message to clients', () => {
  assert.equal(clientErrorMessage(new Error('private database connection details'), 'Please retry.'), 'Please retry.');
  assert.equal(clientErrorMessage(new SyntaxError('private request body'), 'Invalid input.'), 'Invalid input.');
  assert.equal(clientErrorMessage(new ClientInputError('Please enter a team name.'), 'Failed.'), 'Please enter a team name.');
});
