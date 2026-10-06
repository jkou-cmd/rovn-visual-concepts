// Fixture test required by the A-03 contract ("the frontend fixture parses the exact backend examples").
// Run: node --test prototypes/jobs/contract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readRoleList, readRoleDetail, readMatch, readApplication, readError, ContractError } from './contract.js';

const ex = JSON.parse(readFileSync(new URL('./fixtures/a03-contract-examples.synthetic.json', import.meta.url)));
const list = JSON.parse(readFileSync(new URL('./fixtures/job-postings.synthetic.json', import.meta.url)));

test('role detail example parses', () => {
  const r = readRoleDetail(ex.role_detail.success.body);
  assert.equal(r.title, 'Registered Nurse — Night Shift');
  assert.equal(r.reviewedDate, '2026-10-05');
  assert.equal(r.freshness.state, 'confirmed_open');
  assert.equal(r.requirements.length, 2);
});

test('role detail missing reviewed_date is rejected, not guessed', () => {
  const body = structuredClone(ex.role_detail.success.body);
  delete body.reviewed_date;
  assert.throws(() => readRoleDetail(body), ContractError);
});

test('match example parses and is not a score', () => {
  const m = readMatch(ex.match.success.body);
  assert.deepEqual([m.met, m.total], [1, 2]);
  assert.equal(m.lines[1].wouldChangeIf, 'A current BLS source receipt is shared with this application.');
});

test('apply success parses with a receipt', () => {
  const a = readApplication(ex.apply.success.body);
  assert.equal(a.receiptId, '44444444-4444-4444-8444-444444444444');
  assert.equal(a.destination, 'Peachtree Skilled Nursing hiring team');
});

test('exact retry keeps the same receipt', () => {
  const body = { ...structuredClone(ex.apply.success.body), ...ex.apply.exact_retry.body_delta_from_success };
  const a = readApplication(body);
  assert.equal(a.replayed, true);
  assert.equal(a.receiptId, readApplication(ex.apply.success.body).receiptId);
});

test('success without a receipt id is not success', () => {
  const body = structuredClone(ex.apply.success.body);
  body.receipt.receipt_id = '';
  assert.throws(() => readApplication(body), ContractError);
});

test('error bodies map to codes', () => {
  assert.equal(readError(404, ex.role_detail.never_public_or_unknown.body).code, 'role_not_found');
  assert.equal(readError(409, ex.apply.role_no_longer_open.body).code, 'role_not_open');
  assert.equal(readError(409, ex.apply.different_consent_scope_on_retry.body).code, 'application_scope_conflict');
  const ns = readError(503, ex.apply.recoverable_failure.body);
  assert.equal(ns.code, 'application_temporarily_unavailable');
  assert.equal(ex.apply.recoverable_failure.body.detail.receipt_id, null);
});

test('synthetic list (current /job-postings shape) parses', () => {
  const l = readRoleList(list);
  assert.equal(l.roles.length, 5);
  assert.equal(l.roles[0].employer, 'Peachtree Skilled Nursing');
});
