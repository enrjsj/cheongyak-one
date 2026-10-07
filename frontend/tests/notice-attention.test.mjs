import assert from 'node:assert/strict';
import test from 'node:test';
import { noticeAttention } from '../src/noticePresentation.ts';

const today = '2026-10-07';
const base = { status: 'OPEN', applyStartDate: '2026-10-01', applyEndDate: '2026-10-15' };
const view = (patch = {}, day = today) => noticeAttention({ ...base, ...patch }, day);

test('open notices name the deadline and highlight only the final three inclusive calendar days', () => {
  assert.equal(view().countdown, '마감 D-8');
  assert.equal(view().tone, 'open');
  assert.equal(view({ applyEndDate: '2026-10-11' }).near, false);
  assert.equal(view({ applyEndDate: '2026-10-10' }).hint, '마감 임박');
  assert.equal(view({ applyEndDate: '2026-10-10' }).tone, 'urgent');
  assert.equal(view({ applyEndDate: '2026-10-08' }).countdown, '내일 마감');
  assert.equal(view({ applyEndDate: today }).countdown, '오늘 마감');
  assert.equal(view({ applyEndDate: today }).badge, '오늘 마감');
});

test('upcoming notices count down to the start, with emphasis through seven days', () => {
  const upcoming = { status: 'UPCOMING', applyStartDate: '2026-10-14', applyEndDate: '2026-10-25' };
  assert.equal(view(upcoming).countdown, '시작 D-7');
  assert.equal(view(upcoming).date, '2026-10-14');
  assert.equal(view(upcoming).hint, '곧 접수 시작');
  assert.equal(view({ ...upcoming, applyStartDate: '2026-10-15' }).near, false);
  assert.equal(view({ ...upcoming, applyStartDate: '2026-10-08' }).countdown, '내일 시작');
  assert.equal(view({ ...upcoming, applyStartDate: today }).countdown, '오늘 시작');
});

test('missing, invalid, past, reversed and contradictory dates never receive urgency', () => {
  for (const patch of [
    { applyEndDate: undefined }, { applyEndDate: '2026-02-30' }, { applyEndDate: 'bad' },
    { applyEndDate: '2026-10-06' }, { applyStartDate: '2026-10-16' },
    { applyStartDate: '2026-10-08', applyEndDate: '2026-10-09' },
    { status: 'UPCOMING', applyStartDate: '2026-10-06' },
    { status: 'UPCOMING', applyStartDate: undefined, winnerAnnounceDate: '2026-10-08' },
  ]) {
    const result = view(patch);
    assert.equal(result.near, false);
    assert.equal(result.countdown, '공고문 확인');
    assert.equal(result.date, undefined);
  }
});

test('closed and announced notices cannot look open even when their dates are imminent', () => {
  for (const status of ['CLOSED', 'ANNOUNCED']) {
    const result = view({ status, applyEndDate: today, winnerAnnounceDate: '2026-10-08' });
    assert.equal(result.tone, 'neutral');
    assert.equal(result.near, false);
    assert.equal(result.label, '접수 종료');
  }
});

test('calendar arithmetic crosses month, year and leap-day boundaries', () => {
  assert.equal(view({ applyStartDate: '2026-12-20', applyEndDate: '2027-01-02' }, '2026-12-31').countdown, '마감 D-2');
  assert.equal(view({ applyStartDate: '2028-02-20', applyEndDate: '2028-03-01' }, '2028-02-28').countdown, '마감 D-2');
  assert.equal(view({}, 'invalid').near, false);
});

test('the default day changes at Korean midnight, not UTC midnight', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-07T15:01:00Z') });
  assert.equal(noticeAttention({ ...base, applyEndDate: '2026-10-08' }).countdown, '오늘 마감');
});
