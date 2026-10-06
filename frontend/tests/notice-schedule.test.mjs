import test from 'node:test';
import assert from 'node:assert/strict';
import { noticeSchedule, noticeScheduleStatus, buildDetailCalendar } from '../src/noticeTools.ts';
const notice = { id: 4, title: '서울 청약', syncedAt: '2026-10-06T00:00:00Z', officialUrl: 'https://example.com/notice/4', specialSupplyStartDate: '2026-10-05', specialSupplyEndDate: '2026-10-05', applyStartDate: '2026-10-06', applyEndDate: '2026-10-08', winnerAnnounceDate: '2026-10-12', contractStartDate: '2026-10-20', contractEndDate: '2026-10-22' };
const unfold = text => text.replace(/\r\n /g, '');

test('schedule periods include both endpoints, and stages distinguish past, current, today and future', () => {
  const stages = noticeSchedule(notice);
  assert.deepEqual(stages.map(item => noticeScheduleStatus(item, '2026-10-06')), ['종료', '진행 중', '시작 D-6', '시작 D-14']);
  assert.equal(noticeScheduleStatus(stages[1], '2026-10-08'), '오늘 종료');
  assert.equal(noticeScheduleStatus(stages[1], '2026-10-09'), '종료');
  assert.equal(noticeScheduleStatus(stages[2], '2026-10-12'), '오늘');
  assert.equal(noticeScheduleStatus(stages[1], 'bad'), '확인 필요');
});

test('unknown, one-sided, impossible and reversed dates remain visible but cannot be exported', () => {
  const bad = { ...notice, specialSupplyStartDate: undefined, specialSupplyEndDate: undefined, applyEndDate: undefined, winnerAnnounceDate: '2026-02-29', contractStartDate: '2026-10-23' };
  const stages = noticeSchedule(bad);
  assert.deepEqual(stages.map(item => item.issue), ['일정 미확인', '종료일 미확인', '날짜 확인 필요', '기간 확인 필요']);
  assert.ok(stages.every(item => noticeScheduleStatus(item, '2026-10-06') === '확인 필요'));
  assert.throws(() => buildDetailCalendar(bad, ['SPECIAL', 'APPLY', 'WINNER', 'CONTRACT']));
  assert.equal(noticeSchedule({ ...notice, applyStartDate: undefined })[1].issue, '시작일 미확인');
  for (const date of ['2026-13-01', '2026-04-31', '0000-01-01', '9999-12-31', '2026-1-1', '2026-10-06T00:00:00Z']) assert.ok(noticeSchedule({ ...notice, winnerAnnounceDate: date })[2].issue);
});

test('selected periods use exclusive ICS end dates across leap days and year boundaries', () => {
  const leap = { ...notice, applyStartDate: '2028-02-28', applyEndDate: '2028-02-29', contractStartDate: '2028-12-30', contractEndDate: '2028-12-31' };
  const text = unfold(buildDetailCalendar(leap, ['APPLY', 'CONTRACT', 'APPLY'], new Date('2026-10-06T00:00:00Z')));
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.match(text, /DTSTART;VALUE=DATE:20280228\r\nDTEND;VALUE=DATE:20280301/);
  assert.match(text, /DTSTART;VALUE=DATE:20281230\r\nDTEND;VALUE=DATE:20290101/);
  assert.doesNotMatch(text, /특별공급|당첨자 발표|VALARM/);
  assert.match(text, /DTSTAMP:20261006T000000Z/);
  assert.match(text, /https:\/\/example.com\/notice\/4/);
  assert.match(text, /자동 갱신되지/);
  assert.match(text, /공고 수집 시각: 2026-10-06T00:00:00Z/);
  assert.throws(() => buildDetailCalendar(notice, []));
});

test('calendar UIDs survive date changes and early years do not become 1900s', () => {
  const old = buildDetailCalendar(notice, ['WINNER']);
  const updated = buildDetailCalendar({ ...notice, winnerAnnounceDate: '2026-11-01' }, ['WINNER']);
  assert.equal(old.match(/UID:[^\r]+/)[0], updated.match(/UID:[^\r]+/)[0]);
  assert.match(buildDetailCalendar({ ...notice, winnerAnnounceDate: '0099-12-31' }, ['WINNER']), /DTEND;VALUE=DATE:01000101/);
});

test('untrusted text cannot inject calendar properties; Korean lines stay within 75 UTF-8 bytes', () => {
  const text = buildDetailCalendar({ ...notice, title: '가나다'.repeat(100) + '\r\nBEGIN:VEVENT\rATTENDEE:evil;\\,', address: '주소\n줄', officialUrl: 'javascript:alert(1)' }, ['WINNER']);
  assert.equal((text.match(/\r\nBEGIN:VEVENT\r\n/g) ?? []).length, 1);
  assert.ok(text.endsWith('\r\n'));
  assert.ok(text.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  assert.doesNotMatch(text, /javascript:|\r\nATTENDEE:/);
  assert.match(unfold(text), /\\;\\\\\\,/);
});
