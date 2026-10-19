import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import type {Download, Page} from '@playwright/test';
import {unzipSync} from 'fflate';
import {expect, test} from './fixtures';

test.use({freshWorkspace: true, mockAi: true});

async function insertMeeting(page: Page): Promise<void> {
  const text = page.locator('.obe-text').first();
  await expect(text).toBeVisible();
  await text.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/meeting');
  await page.locator('.obe-slash-item', {
    has: page.locator('.obe-slash-label', {hasText: /^Meeting$/}),
  }).click();
  await expect(page.getByRole('region', {name: 'Meeting', exact: true})).toBeVisible();
}

async function downloadBytes(download: Download) {
  expect(await download.failure()).toBeNull();
  const bytes = await readFile(await download.path());
  expect(bytes.length).toBeGreaterThan(0);
  return bytes;
}

test.beforeEach(async ({page, request, dataServer}) => {
  const response = await request.post(`${dataServer}/api/pages`, {data: {
    name: 'Meeting epic',
    data: {editor: 'blocks', blockdoc: {blocks: [
      {id: 'intro', type: 'paragraph', text: [{t: 'Meeting agenda'}]},
    ]}, editorjs: {blocks: []}, values: [], names: []},
  }});
  expect(response.ok()).toBeTruthy();
  const {id} = await response.json() as {id: string};
  await page.addInitScript(() => {
    // Chromium's fake-media launch flags do not expose audioinput on every
    // build. Keep the real MediaRecorder and supply a WebAudio audio track.
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {configurable: true, writable: true, value: async () => {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const destination = audio.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      await audio.resume();
      destination.stream.getTracks()[0].addEventListener('ended', () => { void audio.close(); });
      return destination.stream;
    }});
  });
  await page.goto(`/?page=${id}`);
  await insertMeeting(page);
});

test('record, progressively transcribe, summarize, note and export a meeting', {tag: ['@meeting', '@p1']}, async ({page, request, dataServer}, testInfo) => {
  test.setTimeout(90_000);
  const meeting = page.getByRole('region', {name: 'Meeting', exact: true});
  const transcript = meeting.locator('.obe-meeting-transcript p');
  const transcriptions: string[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('/api/ai/transcribe') && response.ok()) transcriptions.push(response.url());
  });
  await meeting.getByRole('button', {name: 'Record', exact: true}).click();
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Recording');
  await expect(meeting.locator('.obe-meeting-header .obe-meeting-elapsed')).toHaveText('0:02');
  // Pause closes a genuine standalone chunk without sleeping for the 45s
  // rollover. Resume proves transcript growth while the session is still live.
  await meeting.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(transcript).toHaveCount(1);
  await expect(transcript.first()).toContainText(/Mock transcription \([1-9]\d* bytes\)/);
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Paused');
  const firstText = await transcript.first().innerText();
  const singleDownload = page.waitForEvent('download');
  await meeting.getByRole('button', {name: 'Export audio', exact: true}).click();
  const single = await singleDownload;
  expect(single.suggestedFilename()).toBe('Meeting-00h00m00s.webm');
  const singleBytes = await downloadBytes(single);

  await meeting.getByRole('button', {name: 'Resume', exact: true}).click();
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Recording');
  await expect(meeting.locator('.obe-meeting-header .obe-meeting-elapsed')).toHaveText('0:04');
  await meeting.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(transcript).toHaveCount(2);
  await expect(transcript.first()).toHaveText(firstText);
  await expect(transcript.nth(1)).toContainText(/Mock transcription \([1-9]\d* bytes\)/);
  expect(transcriptions).toHaveLength(2);
  await meeting.getByRole('tab', {name: 'Transcript', exact: true}).click();
  const player = meeting.getByRole('region', {name: 'Meeting playback', exact: true});
  await expect(player).toHaveCount(1);
  await expect(player.getByRole('slider', {name: 'Playback position'})).toHaveCount(1);
  await expect(player.locator('.obe-meeting-marker-button')).toHaveCount(2);
  await expect(player.locator('audio[controls]')).toHaveCount(0);
  await expect(player.locator('audio[src]')).toHaveCount(0);
  await transcript.nth(1).getByRole('button', {name: /^Seek to /}).click();
  await expect.poll(async () => Number(await player.getByRole('slider').inputValue())).toBeGreaterThan(1000);
  await expect(player.locator('.obe-meeting-elapsed')).not.toHaveText(/^0:00 /);
  await transcript.first().getByRole('button', {name: 'Seek to 0:00'}).click();
  await expect(player.locator('audio[src]')).toHaveCount(2);
  await expect(player.getByRole('alert')).toHaveCount(0);
  const rowPitch = await transcript.evaluateAll((rows) => rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top);
  expect(rowPitch).toBeCloseTo(32, 0);
  await player.getByRole('slider', {name: 'Playback position'}).press('ArrowRight');
  await player.locator('audio').evaluateAll((elements) => elements.forEach((element) => {
    element.addEventListener('playing', () => { (element as HTMLAudioElement).dataset.played = 'true'; });
  }));
  await player.getByRole('button', {name: 'Play', exact: true}).click();
  await expect.poll(() => player.locator('audio[data-played="true"]').count()).toBe(2);
  await expect(player.getByRole('button', {name: 'Play', exact: true})).toBeVisible();
  const playWidth = (await player.getByRole('button', {name: 'Play', exact: true}).boundingBox())!.width;
  expect(playWidth).toBe(24);
  await player.getByRole('button', {name: 'Play', exact: true}).click();
  await expect(player.getByRole('button', {name: 'Pause playback', exact: true})).toBeVisible();
  await expect(meeting.locator('.obe-meeting-transcript-row[data-active="true"]')).toHaveCount(1);
  await expect(meeting.locator('.obe-meeting-timestamp[aria-current="time"]')).toHaveCount(1);
  expect((await player.getByRole('button', {name: 'Pause playback', exact: true}).boundingBox())!.width).toBe(playWidth);
  await expect.poll(() => player.locator('audio').evaluateAll((elements) => elements.some((element) => !(element as HTMLAudioElement).paused))).toBe(true);
  await player.getByRole('button', {name: 'Pause playback', exact: true}).click();
  await expect.poll(() => player.locator('audio').evaluateAll((elements) => elements.every((element) => (element as HTMLAudioElement).paused))).toBe(true);
  await meeting.getByRole('button', {name: 'Stop', exact: true}).click();
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Done');

  await expect(meeting.locator('.obe-meeting-summary')).toHaveCount(0);
  await meeting.getByRole('tab', {name: 'Summary', exact: true}).click();
  const generation = page.waitForResponse((response) => response.url().includes('/api/ai/generate') && response.ok());
  await meeting.getByRole('button', {name: 'Generate summary', exact: true}).click();
  expect((await generation).headers()['content-type']).toContain('text/event-stream');
  await expect(meeting.getByRole('button', {name: 'Regenerate summary'})).toBeVisible();
  const summary = await meeting.locator('.obe-meeting-summary .obe-text').allTextContents();
  expect(summary.join('\n')).toContain('Mock response to:');
  await meeting.getByRole('tab', {name: 'Notes', exact: true}).click();
  const note = 'Ellis will send the meeting follow-up.';
  await meeting.locator('.obe-meeting-notes .obe-text').fill(note);
  const pageId = new URL(page.url()).searchParams.get('page');
  await expect.poll(async () => {
    const stored = await request.get(`${dataServer}/api/pages/${pageId}`);
    expect(stored.ok()).toBeTruthy();
    return JSON.stringify((await stored.json() as {data: {blockdoc: unknown}}).data.blockdoc);
  }).toContain(note);

  const zipDownload = page.waitForEvent('download');
  await meeting.getByRole('button', {name: 'Export audio', exact: true}).click();
  const zip = await zipDownload;
  expect(zip.suggestedFilename()).toMatch(/-audio\.zip$/);
  const files = unzipSync(await downloadBytes(zip));
  expect(Object.keys(files)).toHaveLength(2);
  expect(Object.keys(files)).toEqual([expect.stringMatching(/^001-\d{2}h\d{2}m\d{2}s\.webm$/), expect.stringMatching(/^002-\d{2}h\d{2}m\d{2}s\.webm$/)]);
  expect(files[Object.keys(files)[0]]).toEqual(new Uint8Array(singleBytes));
  for (const bytes of Object.values(files)) expect(bytes.length).toBeGreaterThan(0);

  await page.getByRole('button', {name: 'Page actions'}).click();
  await page.getByRole('menuitem', {name: 'Export', exact: true}).click();
  const markdownDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', {name: 'Markdown (.md)', exact: true}).click();
  const markdown = (await downloadBytes(await markdownDownload)).toString('utf8');
  for (const segment of await transcript.allTextContents()) {
    expect(markdown).toContain(segment.replace(/^\S+\s+/, '').trim());
  }
  for (const line of summary) expect(markdown).toContain(line);
  expect(markdown).toContain(note);

  await page.getByRole('button', {name: 'Page actions'}).click();
  await page.getByRole('menuitem', {name: 'Export', exact: true}).click();
  const htmlDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', {name: 'Interactive HTML', exact: true}).click();
  const htmlPath = testInfo.outputPath('meeting.html');
  await (await htmlDownload).saveAs(htmlPath);
  await page.goto(pathToFileURL(htmlPath).href);
  const viewer = page.locator('.ob-viewer');
  await expect(viewer).toBeVisible();
  await viewer.getByRole('tab', {name: 'Transcript', exact: true}).click();
  await expect(viewer.getByRole('button', {name: 'Record', exact: true})).toBeDisabled();
  await viewer.locator('.obe-meeting-timestamp').nth(1).click();
  await expect.poll(async () => Number(await viewer.getByRole('slider', {name: 'Playback position'}).inputValue())).toBeGreaterThan(1000);
  await viewer.getByRole('button', {name: 'Play', exact: true}).click();
  await expect(viewer.locator('.obe-meeting-timestamp[aria-current="time"]')).toHaveCount(1);
  await expect(viewer.locator('.obe-meeting-transcript-row[data-active="true"]')).toHaveCount(1);

});

test('microphone denial shows recovery copy and leaves the editor usable', {tag: ['@meeting', '@p1']}, async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };
  });
  const meeting = page.getByRole('region', {name: 'Meeting', exact: true});
  await meeting.getByRole('button', {name: 'Record', exact: true}).click();
  await expect(meeting.getByRole('alert')).toHaveText('Microphone access failed. Allow microphone access in browser settings, then try again.');
  await expect(meeting.getByRole('button', {name: 'Record', exact: true})).toBeEnabled();
  await expect(meeting.getByRole('button', {name: 'Stop', exact: true})).toBeDisabled();
  await meeting.locator('.obe-meeting-notes .obe-text').fill('Notes still work without microphone access.');
  await expect(meeting.locator('.obe-meeting-notes')).toContainText('Notes still work without microphone access.');
  await expect(meeting.locator('audio')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('recording survives navigation, rebinds, and saves the final chunk while away', {tag: ['@meeting', '@p1']}, async ({page, request, dataServer}) => {
  test.setTimeout(90_000);
  const pageId = new URL(page.url()).searchParams.get('page');
  const other = await request.post(`${dataServer}/api/pages`, {data: {
    name: 'Other meeting page', data: {editor: 'blocks', blockdoc: {blocks: [{id: 'other', type: 'paragraph', text: [{t: 'Other page'}]}]}, editorjs: {blocks: []}, values: [], names: []},
  }});
  expect(other.ok()).toBeTruthy();
  await expect.poll(async () => JSON.stringify(await (await request.get(`${dataServer}/api/pages/${pageId}`)).json())).toContain('"type":"meeting"');
  // Refresh before capture so the sidebar includes the second page.
  await page.reload();
  const meeting = page.getByRole('region', {name: 'Meeting', exact: true});
  const bubble = page.getByRole('complementary', {name: 'Recording sessions'});
  const otherRow = page.getByRole('treeitem').filter({hasText: 'Other meeting page'});
  await meeting.getByRole('button', {name: 'Record', exact: true}).click();
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Recording');
  await expect(bubble.getByRole('button')).toHaveCount(0);
  await otherRow.click();
  await expect(meeting).toHaveCount(0);
  await expect(bubble.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
  const elapsed = bubble.getByLabel('Elapsed recording time');
  const initialElapsed = await elapsed.innerText();
  await expect(elapsed).not.toHaveText(initialElapsed);
  // Leave capture running through its actual 45s rollover while off-page.
  await expect.poll(async () => {
    const stored = await request.get(`${dataServer}/api/pages/${pageId}`);
    return JSON.stringify(await stored.json());
  }, {timeout: 60_000}).toContain('Mock transcription');
  await bubble.getByRole('button', {name: 'Pause', exact: true}).click();
  await expect(bubble.getByRole('button', {name: 'Resume', exact: true})).toBeVisible();
  await bubble.getByRole('button', {name: 'Resume', exact: true}).click();
  await bubble.getByRole('button', {name: 'Go to meeting'}).click();
  await expect(page.locator('.ob-anchor-flash')).toBeVisible();
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Recording');
  await expect(meeting).not.toContainText('Recording or processing on another client.');
  await expect(bubble.getByRole('button')).toHaveCount(0);
  await expect(meeting.locator('.obe-meeting-transcript p')).toHaveCount(2);
  await otherRow.click();
  await expect(bubble.getByRole('button', {name: 'Pause', exact: true})).toBeVisible();
  await expect(elapsed).not.toHaveText('0:00');
  await bubble.getByRole('button', {name: 'Stop', exact: true}).click();
  await expect.poll(async () => {
    const stored = await request.get(`${dataServer}/api/pages/${pageId}`);
    const value = await stored.json() as {data: {blockdoc: {blocks: {type: string; props?: {status?: string; audioChunks?: unknown[]; transcript?: unknown[]}}[]}}};
    const props = value.data.blockdoc.blocks.find((block) => block.type === 'meeting')?.props;
    return {status: props?.status, chunks: props?.audioChunks?.length, transcript: props?.transcript?.length};
  }).toEqual({status: 'done', chunks: 3, transcript: 3});
  await expect(bubble.getByRole('button')).toHaveCount(0);
  await page.getByRole('treeitem').filter({hasText: 'Meeting epic'}).click();
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Done');
  await expect(meeting.locator('.obe-meeting-transcript p')).toHaveCount(3);
  // A full reload discards the singleton and proves recovery from durable state.
  await page.reload();
  await expect(meeting.locator('.obe-meeting-header')).toContainText('Done');
  await expect(meeting.locator('.obe-meeting-transcript p')).toHaveCount(3);
  await expect(bubble.getByRole('button')).toHaveCount(0);
});
