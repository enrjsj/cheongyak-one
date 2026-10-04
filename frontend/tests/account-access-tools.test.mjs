import test from "node:test";
import assert from "node:assert/strict";
import { accountDate, checkedSessions, checkedConsents } from "../src/accountAccessTools.ts";

const session = { id: 1, current: false, clientName: "기기", createdAt: "2026-10-01T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z" };
test("session sorting prioritizes current device then recent login without mutation", () => {
  const items = [session, { ...session, id: 2, createdAt: "2026-10-02T00:00:00Z" }, { ...session, id: 3, current: true }];
  const copy = structuredClone(items);
  assert.deepEqual(checkedSessions(items).map(x => x.id), [3, 2, 1]);
  assert.deepEqual(items, copy);
});
test("invalid or ambiguous device responses cannot enable termination", () => {
  for (const value of [{}, null, [session, session], [{ ...session, id: 0 }], [{ ...session, current: "true" }],
    [{ ...session, current: true }, { ...session, id: 2, current: true }], [{ ...session, clientName: null }]]) {
    assert.throws(() => checkedSessions(value));
  }
  assert.deepEqual(checkedSessions([]), []);
});
test("malformed dates stay readable without crashing account view", () => {
  assert.equal(accountDate("bad"), "날짜 확인 불가");
  assert.equal(accountDate(""), "날짜 확인 불가");
  assert.match(accountDate("2026-10-01T15:00:00Z"), /2026/);
  const items = checkedSessions([{ ...session, createdAt: "bad" }, { ...session, id: 2 }]);
  assert.equal(items[0].id, 2);
});
test("consent empty success is different from malformed or failed data", () => {
  assert.deepEqual(checkedConsents([]), []);
  assert.throws(() => checkedConsents({}));
  assert.throws(() => checkedConsents([{ policyType: "UNKNOWN", policyVersion: "v1", agreedAt: "date" }]));
  const records = [{ policyType: "TERMS", policyVersion: "v1", agreedAt: "bad" }];
  assert.deepEqual(checkedConsents(records), records);
});
