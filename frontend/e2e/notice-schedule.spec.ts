import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const notice = { id: 901, title: '일정 검증 공고', sourceSystem: 'REB_APT', housingCategory: 'APARTMENT', status: 'OPEN', regionCode: '서울', syncedAt: '2026-10-06T00:00:00Z', officialUrl: 'https://example.com/901', specialSupplyStartDate: '2026-10-05', specialSupplyEndDate: '2026-10-05', applyStartDate: '2026-10-06', applyEndDate: '2026-10-08', winnerAnnounceDate: '2026-10-12', contractStartDate: '2026-10-20', contractEndDate: '2026-10-22' };
async function setup(page: Page, detail = notice) {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/notices/901') return route.fulfill({ json: detail });
    if (path === '/api/v1/notices') return route.fulfill({ json: { content: [detail], number: 0, totalElements: 1, totalPages: 1, size: 24 } });
    if (path.endsWith('/facets')) return route.fulfill({ json: { total: 1, open: 1, upcoming: 0, endingToday: 0 } });
    if (path.endsWith('/changes')) return route.fulfill({ json: [] });
    if (path.endsWith('/freshness')) return route.fulfill({ json: {} });
    return route.fulfill({ status: 401, json: { detail: '로그인 필요' } });
  });
  await page.goto('/?notice=901');
  return page.getByRole('region', { name: '핵심 일정 타임라인', exact: true });
}
for (const width of [320, 1280]) test(`상세 일정 ${width}px: 선택한 기간만 저장하고 재열면 선택을 초기화한다`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const writes: string[] = []; page.on('request', r => { if (r.method() !== 'GET') writes.push(r.method()); });
  await page.setViewportSize({ width, height: 844 });
  await page.clock.install({ time: new Date('2026-10-06T00:00:00Z') });
  const panel = await setup(page);
  await expect(panel.locator('li').filter({ hasText: '청약 접수' })).toContainText('진행 중');
  await panel.getByRole('button', { name: '일정 선택 해제', exact: true }).click();
  await expect(panel.getByRole('button', { name: '선택 일정 저장 (.ics)', exact: true })).toBeDisabled();
  await panel.getByRole('checkbox', { name: '계약 기간 일정 선택', exact: true }).check();
  const downloading = page.waitForEvent('download');
  await panel.getByRole('button', { name: '선택 일정 저장 (.ics)', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('cheongyak-notice-901-schedule.ics');
  const text = (await readFile((await download.path())!, 'utf8')).replace(/\r\n /g, '');
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(text).toContain('DTSTART;VALUE=DATE:20261020\r\nDTEND;VALUE=DATE:20261023');
  expect(text).toContain('공고 수집 시각: 2026-10-06T00:00:00Z');
  expect(text).toContain('https://example.com/901');
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.locator('article').filter({ hasText: notice.title }).getByRole('button', { name: /공고 핵심만 보기/ }).click();
  await expect(panel.getByRole('checkbox', { checked: true })).toHaveCount(4);
  expect(errors).toEqual([]); expect(writes).toEqual([]);
});

test('상세 일정: 미확인·잘못된 기간은 저장에서 제외하고 실패 후 선택을 유지한다', async ({ page }) => {
  const panel = await setup(page, { ...notice, specialSupplyStartDate: '', specialSupplyEndDate: '', applyEndDate: '', contractEndDate: '2026-10-19' });
  await expect(panel.getByRole('checkbox', { disabled: true })).toHaveCount(3);
  await expect(panel.getByText('일정 미확인', { exact: true })).toBeVisible();
  await expect(panel.getByText('기간 확인 필요', { exact: true })).toBeVisible();
  await page.evaluate(() => { const original = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { URL.createObjectURL = original; throw new Error('once'); }; });
  await panel.getByRole('button', { name: '선택 일정 저장 (.ics)' }).click();
  await expect(panel.getByRole('alert')).toContainText('선택은 유지');
  await expect(panel.getByRole('checkbox', { name: '당첨자 발표 일정 선택' })).toBeChecked();
  const downloading = page.waitForEvent('download');
  await panel.getByRole('button', { name: '선택 일정 저장 (.ics)' }).click();
  await downloading;
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.getByRole('status')).toContainText('1개');
});

test('상세 일정: 한국 자정이 지나면 열린 화면의 상태를 갱신한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-08T14:59:50Z') });
  const panel = await setup(page);
  const apply = panel.locator('li').filter({ hasText: '청약 접수' });
  await expect(apply).toContainText('오늘 종료');
  await page.clock.fastForward(60_000);
  await expect(panel.getByText(/한국 날짜 2026-10-09 기준/)).toBeVisible();
  await expect(apply).toContainText('종료');
  await expect(apply).not.toContainText('오늘 종료');
});

test('상세 일정: 상세 조회 실패 중에는 요약 날짜로 파일을 만들지 않고 재조회 후 표시한다', async ({ page }) => {
  await setup(page);
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  let fails = true;
  await page.route('**/api/v1/notices/901', route => route.fulfill(fails ? { status: 503, json: { detail: '일시 오류' } } : { json: notice }));
  await page.locator('article').filter({ hasText: notice.title }).getByRole('button', { name: /공고 핵심만 보기/ }).click();
  await expect(page.getByRole('button', { name: '상세 다시 불러오기' })).toBeVisible();
  await expect(page.getByRole('region', { name: '핵심 일정 타임라인' })).toHaveCount(0);
  fails = false;
  await page.getByRole('button', { name: '상세 다시 불러오기' }).click();
  await expect(page.getByRole('region', { name: '핵심 일정 타임라인' }).getByRole('checkbox', { checked: true })).toHaveCount(4);
});
