import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const baseUrl = process.env.PLAYTHROUGH_URL ?? 'http://127.0.0.1:5174/';
const screenshotDir = path.resolve('.codex/screenshots');
const saveKey = 'midnight-will-case-02:save:v1';

fs.mkdirSync(screenshotDir, { recursive: true });

const allEvidence = [
  'old-draft',
  'redline-note',
  'phone-note',
  'printer-log',
  'file-history',
  'visitor-log',
  'email-draft',
  'scheduled-message',
];

const clearedFlags = [
  'saw_old_draft',
  'saw_redline',
  'saw_phone_note',
  'understood_sentence_risk',
  'saw_printer_log',
  'clerk_alibi',
  'saw_file_history',
  'unlocked_pc_known',
  'saw_visitor_log',
  'client_route_confirmed',
  'client_pressure',
  'client_knows_risk',
  'client_visit_confirmed',
  'saw_email_draft',
  'final_unlocked',
  'analysis_sentence_risk',
  'analysis_time_window',
  'analysis_final_chain',
  'analysis_complete',
  'pressed_no_edit',
  'hearing_pc_contradiction',
  'pressed_later_fear',
  'hearing_cleared',
];

function createState(partial = {}) {
  return {
    episodeId: 'case-02',
    mode: 'move',
    currentLocationId: 'reception',
    narrative: 'Automated QA state.',
    speakerId: 'assistant',
    tone: 'neutral',
    credibility: 5,
    evidenceIds: [],
    flags: [],
    log: ['Automated QA state.'],
    history: [],
    completedInteractionIds: [],
    ...partial,
  };
}

async function launchPage({ viewport, isMobile = false, state, bypassTitle = true } = {}) {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const context = await browser.newContext({
    viewport: viewport ?? { width: 1366, height: 900 },
    isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
  });

  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.clear();
      if (value) window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: saveKey, value: state },
  );

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  if (bypassTitle) await dismissTitle(page);
  return { browser, page };
}

async function close(browser) {
  await browser.close();
}

async function screenshot(page, name) {
  await assertNoOverflow(page, name);
  await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
  }));
  if (metrics.scrollWidth > metrics.innerWidth + 2) {
    throw new Error(`Unexpected ${label} horizontal overflow: ${JSON.stringify(metrics)}`);
  }
  if (metrics.scrollHeight > metrics.innerHeight + 1) {
    throw new Error(`Unexpected ${label} page scroll: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

async function openNotebookTab(page, label) {
  const desktopTab = page.locator('.command-panel .notebook-tab-list button', { hasText: label });
  if (await desktopTab.isVisible().catch(() => false)) {
    await desktopTab.click();
    return;
  }

  const sheet = page.locator('.notebook-sheet');
  if (!(await sheet.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: '手控え' }).click();
    await sheet.waitFor({ state: 'visible' });
  }
  await sheet.locator('.notebook-tab-list button', { hasText: label }).click();
}

async function visibleCommand(page, index) {
  const mobileDock = page.locator('.mobile-dock');
  if (await mobileDock.isVisible().catch(() => false)) {
    return mobileDock.locator('.command').nth(index);
  }
  return page.locator('.command-panel .command').nth(index);
}

async function visibleCommandGrid(page) {
  const mobileDock = page.locator('.mobile-dock');
  if (await mobileDock.isVisible().catch(() => false)) {
    return mobileDock.locator('.command-grid');
  }
  return page.locator('.command-panel .command-grid');
}

async function closeNotebookSheet(page) {
  const sheet = page.locator('.notebook-sheet');
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.getByRole('button', { name: '閉じる' }).click();
    await sheet.waitFor({ state: 'hidden' });
  }
}

async function dismissTitle(page) {
  const title = page.locator('.title-screen');
  await title.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
  if (!(await title.isVisible().catch(() => false))) return;
  const continueButton = page.getByRole('button', { name: 'つづきから' });
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
  } else {
    await page.getByRole('button', { name: 'はじめから' }).click();
  }
  await title.waitFor({ state: 'hidden' });
}

async function clickWorkPrimary(page) {
  await page.locator('.work-panel .primary-button').last().click();
}

async function selectCorrectDeduction(page) {
  await page.locator('input[name="culprit"]').nth(2).check();
  await page.locator('input[name="reason"]').nth(1).check();
  await page.locator('input[name="opportunity"]').nth(1).check();
  await page.locator('input[name="proof"]').nth(2).check();
  await page.getByLabel('deduction-culprit-evidence').selectOption('visitor-log');
  await page.getByLabel('deduction-reason-evidence').selectOption('phone-note');
  await page.getByLabel('deduction-opportunity-evidence').selectOption('file-history');
  await page.getByLabel('deduction-proof-evidence').selectOption('scheduled-message');
}

async function runTitleSmoke() {
  const desktop = await launchPage({ bypassTitle: false });
  await desktop.page.locator('.title-screen').waitFor({ state: 'visible' });
  const noSaveContinueCount = await desktop.page.getByRole('button', { name: 'つづきから' }).count();
  const desktopTitleText = await desktop.page.locator('.title-screen').innerText();
  await screenshot(desktop.page, 'desktop-title.png');
  await desktop.page.locator('.title-screen').getByRole('button', { name: '設定' }).click();
  await desktop.page.locator('.title-settings .audio-controls').waitFor({ state: 'visible' });
  await desktop.page.locator('.title-settings input[type="range"]').fill('0.7');
  const storedVolume = await desktop.page.evaluate(() => {
    const raw = window.localStorage.getItem('midnight-will-case-02:audio:v1');
    return raw ? JSON.parse(raw).volume : null;
  });
  await desktop.page.getByRole('button', { name: 'はじめから' }).click();
  await desktop.page.locator('.title-screen').waitFor({ state: 'hidden' });
  await desktop.page.locator('.story-stage-panel').waitFor({ state: 'visible' });
  await close(desktop.browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    bypassTitle: false,
    state: createState({
      mode: 'materials',
      endingId: 'success',
      evidenceIds: allEvidence,
      flags: [...clearedFlags, 'case_cleared'],
    }),
  });
  await mobile.page.locator('.title-screen').waitFor({ state: 'visible' });
  const mobileTitleText = await mobile.page.locator('.title-screen').innerText();
  await screenshot(mobile.page, 'mobile-title.png');
  await mobile.page.getByRole('button', { name: 'つづきから' }).click();
  await mobile.page.locator('.title-screen').waitFor({ state: 'hidden' });
  await mobile.page.locator('.materials-panel').waitFor({ state: 'visible' });
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile title');
  await close(mobile.browser);

  if (noSaveContinueCount !== 0 || !desktopTitleText.includes('はじめから')) {
    throw new Error(`Expected no-save title without continue, saw count=${noSaveContinueCount}: ${desktopTitleText}`);
  }
  if (!mobileTitleText.includes('つづきから') || !mobileTitleText.includes('設定')) {
    throw new Error(`Expected saved title actions, saw ${mobileTitleText}`);
  }
  if (storedVolume !== 0.7) {
    throw new Error(`Expected title audio settings to persist volume 0.7, saw ${storedVolume}`);
  }

  return { noSaveContinueCount, storedVolume, mobileWidth };
}

async function runDesktopFlow() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      narrative: 'Final deduction ready.',
    }),
  });

  await screenshot(page, 'desktop-start.png');
  await selectCorrectDeduction(page);
  await screenshot(page, 'desktop-deduction-evidence.png');
  await clickWorkPrimary(page);
  await page.locator('.story-stage-panel').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-success.png');
  await page.locator('.story-actions .primary-button').click();
  await page.locator('.story-actions .primary-button').click();
  await page.locator('.ending-result-panel.success').waitFor({ state: 'visible' });
  await page.locator('.verdict-scene-panel').waitFor({ state: 'visible' });
  const endingResultItems = await page.locator('.ending-result-grid section').count();
  const verdictSceneItems = await page.locator('.verdict-scene-grid article').count();
  const verdictSceneText = await page.locator('.verdict-scene-panel').innerText();
  await screenshot(page, 'desktop-ending-final.png');

  const status = await page.locator('.status-strip').innerText();
  const objective = await page.locator('.case-focus').innerText();
  const directorText = await page.locator('.case-director').innerText();
  const directorStages = await page.locator('.case-director-arc button').count();
  const chapterGuideText = await page.locator('.chapter-guide').innerText();
  const chapterGuideSteps = await page.locator('.chapter-guide-grid span').count();
  await openNotebookTab(page, '章');
  await page.locator('.case-map').waitFor({ state: 'visible' });
  const caseMapText = await page.locator('.case-map').innerText();
  const caseMapNodes = await page.locator('.case-map-node').count();
  const caseMapCompleteNodes = await page.locator('.case-map-node.status-complete').count();
  await screenshot(page, 'desktop-case-map.png');
  const endingFinal = await page.locator('.story-progress').innerText();

  await close(browser);
  if (endingResultItems !== 4) {
    throw new Error(`Expected 4 ending result items, saw ${endingResultItems}`);
  }
  if (verdictSceneItems !== 4 || !verdictSceneText.includes('FINAL VERDICT')) {
    throw new Error(`Expected final verdict scene with 4 points, saw ${verdictSceneItems}: ${verdictSceneText}`);
  }
  if (directorStages !== 5 || !directorText.includes('CASE DIRECTOR')) {
    throw new Error(`Expected case director with 5 stages, saw ${directorStages}: ${directorText}`);
  }
  if (chapterGuideSteps !== 3 || !chapterGuideText.includes('CHAPTER GUIDE')) {
    throw new Error(`Expected chapter guide with 3 steps, saw ${chapterGuideSteps}: ${chapterGuideText}`);
  }
  if (caseMapNodes !== 6 || caseMapCompleteNodes < 5 || !caseMapText.includes('CASE MAP')) {
    throw new Error(`Expected desktop case map with completed chapters, saw ${caseMapCompleteNodes}/${caseMapNodes}: ${caseMapText}`);
  }

  return { status, objective, directorStages, endingFinal, endingResultItems, caseMapNodes };
}

async function runMobileSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });

  await screenshot(page, 'mobile-start.png');
  const artBox = await page.locator('.stage-background').boundingBox();
  if (!artBox || artBox.width < 280 || artBox.height < 160) {
    throw new Error(`Unexpected mobile location art size: ${JSON.stringify(artBox)}`);
  }
  const width = await assertNoOverflow(page, 'mobile start');
  await openNotebookTab(page, '焦点');
  const directorStages = await page.locator('.notebook-sheet .case-director-arc button').count();
  const chapterGuideSteps = await page.locator('.notebook-sheet .chapter-guide-grid span').count();
  const chapterGuideText = await page.locator('.notebook-sheet .chapter-guide').innerText();
  await openNotebookTab(page, '章');
  await page.locator('.notebook-sheet .case-map').waitFor({ state: 'visible' });
  const caseMapNodes = await page.locator('.notebook-sheet .case-map-node').count();
  const lockedCaseMapNodes = await page.locator('.notebook-sheet .case-map-node.status-locked').count();
  const mobileCaseMapText = await page.locator('.notebook-sheet .case-map').innerText();
  await screenshot(page, 'mobile-case-map.png');
  await close(browser);
  if (directorStages !== 5) {
    throw new Error(`Expected mobile case director stages, saw ${directorStages}`);
  }
  if (chapterGuideSteps !== 3 || !chapterGuideText.includes('CHAPTER GUIDE')) {
    throw new Error(`Expected mobile chapter guide, saw ${chapterGuideSteps}: ${chapterGuideText}`);
  }
  if (caseMapNodes !== 6 || lockedCaseMapNodes < 3 || !mobileCaseMapText.includes('章の進行')) {
    throw new Error(`Expected mobile case map with locked future chapters, saw ${lockedCaseMapNodes}/${caseMapNodes}: ${mobileCaseMapText}`);
  }
  return { artBox, directorStages, caseMapNodes, width };
}

async function runInvestigationHotspotSmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'inspect',
      currentLocationId: 'conference-room',
      narrative: 'Investigation hotspot QA.',
    }),
  });
  await page.locator('.investigation-board').waitFor({ state: 'visible' });
  await page.locator('.investigation-memo').waitFor({ state: 'visible' });
  const memoText = await page.locator('.investigation-memo').innerText();
  const memoStats = await page.locator('.investigation-memo-stats span').count();
  const ledgerRows = await page.locator('.investigation-ledger-row').count();
  const readyLedgerRows = await page.locator('.investigation-ledger-row.status-ready').count();
  const hotspotCount = await page.locator('.investigation-hotspot').count();
  if (hotspotCount < 2) throw new Error(`Expected investigation hotspots, saw ${hotspotCount}`);
  await screenshot(page, 'desktop-investigation-hotspots.png');
  await page.locator('.investigation-hotspot').first().click();
  await page.locator('.evidence-found-panel').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-evidence-found.png');
  const foundTitle = await page.locator('.evidence-found-panel h3').innerText();
  await page.locator('.evidence-found-panel .secondary-button').click();
  await page.locator('.evidence-detail').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-evidence-found-casefile.png');
  await page.waitForFunction(() => document.querySelector('.status-strip')?.textContent?.includes('1/8'));
  const status = await page.locator('.status-strip').innerText();
  await close(browser);

  const progress = await launchPage({
    state: createState({
      mode: 'inspect',
      currentLocationId: 'conference-room',
      evidenceIds: ['old-draft'],
      flags: ['saw_old_draft'],
      completedInteractionIds: ['inspect-old-draft'],
      narrative: 'Investigation progress memo QA.',
    }),
  });
  await progress.page.locator('.investigation-memo').waitFor({ state: 'visible' });
  const progressMemo = await progress.page.locator('.investigation-memo').innerText();
  const completedLedgerRows = await progress.page.locator('.investigation-ledger-row.status-complete').count();
  await screenshot(progress.page, 'desktop-investigation-memo-progress.png');
  await close(progress.browser);

  if (memoStats < 3 || ledgerRows < 2 || readyLedgerRows < 1) {
    throw new Error(`Expected investigation memo with next action stats, saw ${memoText}`);
  }
  if (!progressMemo.includes('1/3') || completedLedgerRows < 1) {
    throw new Error(`Expected investigation progress memo with found evidence, saw ${progressMemo}`);
  }

  return { hotspotCount, status, foundTitle, memoStats, ledgerRows };
}

async function runMobileInvestigationHotspotSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'inspect',
      currentLocationId: 'conference-room',
      narrative: 'Mobile investigation hotspot QA.',
    }),
  });
  await page.locator('.investigation-board').waitFor({ state: 'visible' });
  await page.locator('.investigation-memo').waitFor({ state: 'visible' });
  const memoText = await page.locator('.investigation-memo').innerText();
  const mobileLedgerRows = await page.locator('.investigation-ledger-row').count();
  await screenshot(page, 'mobile-investigation-hotspots.png');
  await page.locator('.investigation-hotspot').first().click();
  await page.locator('.evidence-found-panel').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-evidence-found.png');
  const width = await assertNoOverflow(page, 'mobile investigation hotspots');
  await close(browser);
  if (!memoText || mobileLedgerRows < 2) {
    throw new Error(`Expected mobile investigation memo, saw ${memoText}`);
  }
  return width;
}

async function runMoveRouteSmoke() {
  const state = createState({
    mode: 'move',
    currentLocationId: 'conference-room',
    narrative: 'Move route QA.',
  });

  const desktop = await launchPage({ state });
  await desktop.page.locator('.move-route-grid').waitFor({ state: 'visible' });
  const routeCards = await desktop.page.locator('.move-route-card').count();
  const currentCards = await desktop.page.locator('.move-route-card.status-current').count();
  const readyCards = await desktop.page.locator('.move-route-card.status-ready').count();
  const blockedCards = await desktop.page.locator('.move-route-card.status-blocked').count();
  await screenshot(desktop.page, 'desktop-move-routes.png');
  const desktopWidth = await assertNoOverflow(desktop.page, 'desktop move routes');
  await close(desktop.browser);

  if (routeCards < 4 || currentCards < 1 || readyCards < 1 || blockedCards < 1) {
    throw new Error(
      `Unexpected move cards route=${routeCards} current=${currentCards} ready=${readyCards} blocked=${blockedCards}`,
    );
  }

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state,
  });
  await mobile.page.locator('.move-route-grid').waitFor({ state: 'visible' });
  await screenshot(mobile.page, 'mobile-move-routes.png');
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile move routes');
  await close(mobile.browser);

  return { routeCards, currentCards, readyCards, blockedCards, desktopWidth, mobileWidth };
}

async function runTalkDossierSmoke() {
  const desktop = await launchPage({
    state: createState({
      mode: 'talk',
      currentLocationId: 'conference-room',
      evidenceIds: ['old-draft', 'redline-note', 'phone-note', 'file-history'],
      flags: ['saw_old_draft', 'saw_redline', 'saw_phone_note', 'saw_file_history'],
      narrative: 'Talk dossier QA.',
    }),
  });
  await desktop.page.locator('.talk-dossier-list').waitFor({ state: 'visible' });
  const desktopDossiers = await desktop.page.locator('.talk-dossier').count();
  const desktopTopics = await desktop.page.locator('.talk-topic').count();
  if (desktopDossiers < 1 || desktopTopics < 2) {
    throw new Error(`Expected desktop talk dossier and topics, saw dossiers=${desktopDossiers}, topics=${desktopTopics}`);
  }
  await screenshot(desktop.page, 'desktop-talk-dossier.png');
  await desktop.page.locator('.talk-topic').first().click();
  await desktop.page.locator('.dialogue-box').waitFor({ state: 'visible' });
  await desktop.page.locator('.talk-followup-panel').waitFor({ state: 'visible' });
  await desktop.page.locator('.impact-burst').waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  await desktop.page.locator('.impact-burst').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  await screenshot(desktop.page, 'desktop-talk-dossier-result.png');
  const desktopFollowupText = await desktop.page.locator('.talk-followup-panel').innerText();
  const desktopFollowupLeads = await desktop.page.locator('.talk-followup-leads em').count();
  await desktop.page.locator('.talk-prep-card').waitFor({ state: 'visible' });
  const desktopPrepSections = await desktop.page.locator('.talk-prep-grid section').count();
  const desktopWidth = await assertNoOverflow(desktop.page, 'desktop talk dossier');
  await close(desktop.browser);
  if (desktopFollowupLeads < 2 || desktopPrepSections !== 3) {
    throw new Error(`Expected desktop talk follow-up leads and prep card, saw ${desktopFollowupText}`);
  }

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'talk',
      currentLocationId: 'reception',
      evidenceIds: ['printer-log', 'visitor-log'],
      flags: ['saw_printer_log', 'clerk_alibi', 'saw_visitor_log'],
      narrative: 'Mobile talk dossier QA.',
    }),
  });
  await mobile.page.locator('.talk-dossier-list').waitFor({ state: 'visible' });
  const mobileDossiers = await mobile.page.locator('.talk-dossier').count();
  const mobileTopics = await mobile.page.locator('.talk-topic').count();
  if (mobileDossiers < 1 || mobileTopics < 2) {
    throw new Error(`Expected mobile talk dossier and topics, saw dossiers=${mobileDossiers}, topics=${mobileTopics}`);
  }
  await screenshot(mobile.page, 'mobile-talk-dossier.png');
  await mobile.page.locator('.talk-topic').first().click();
  await mobile.page.locator('.talk-followup-panel').waitFor({ state: 'visible' });
  await mobile.page.locator('.impact-burst').waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  await mobile.page.locator('.impact-burst').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  await screenshot(mobile.page, 'mobile-talk-followup.png');
  const mobileFollowupText = await mobile.page.locator('.talk-followup-panel').innerText();
  const mobileFollowupActions = await mobile.page.locator('.talk-followup-actions button').count();
  await mobile.page.locator('.talk-prep-card').waitFor({ state: 'visible' });
  const mobilePrepSections = await mobile.page.locator('.talk-prep-grid section').count();
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile talk dossier');
  await close(mobile.browser);
  if (mobileFollowupActions < 2 || mobilePrepSections !== 3) {
    throw new Error(`Expected mobile talk follow-up actions, saw ${mobileFollowupText}`);
  }

  return {
    desktopDossiers,
    desktopTopics,
    desktopFollowupLeads,
    desktopPrepSections,
    mobileDossiers,
    mobileTopics,
    mobileFollowupActions,
    mobilePrepSections,
    desktopWidth,
    mobileWidth,
  };
}

async function runAudioSettingsSmoke() {
  const { browser, page } = await launchPage();
  await openNotebookTab(page, '音響');
  await page.locator('.soundtrack-panel').waitFor({ state: 'visible' });
  const soundtrackText = await page.locator('.soundtrack-panel').innerText();
  const soundtrackMeter = await page.locator('.soundtrack-meter span').count();
  const soundtrackFilled = await page.locator('.soundtrack-meter span.filled').count();
  await page.locator('.soundtrack-audition').click();
  await page.locator('.topbar [aria-label="設定"]').click();
  const settings = page.locator('.settings-panel');
  await settings.waitFor({ state: 'visible' });
  await settings.locator('.tempo-control button', { hasText: 'じっくり' }).click();
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('midnight-will-case-02:audio:v1');
    return raw ? JSON.parse(raw).tempo === 'cinematic' : false;
  });
  const activeTempo = await settings.locator('.tempo-control button.active').innerText();
  await settings.locator('.audio-controls > button.icon-button').click();
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem('midnight-will-case-02:audio:v1');
    return raw ? JSON.parse(raw).enabled === false : false;
  });
  const disabledAfterMute = await settings.locator('.audio-controls input').isDisabled();
  const auditionDisabledAfterMute = await page.locator('.soundtrack-audition').isDisabled();
  await screenshot(page, 'desktop-audio-settings.png');
  await close(browser);

  const hearing = await launchPage({
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter((flag) => !['hearing_cleared'].includes(flag)),
      tone: 'pressure',
    }),
  });
  await openNotebookTab(hearing.page, '音響');
  await hearing.page.locator('.soundtrack-panel.cue-court').waitFor({ state: 'visible' });
  const hearingSoundtrackText = await hearing.page.locator('.soundtrack-panel').innerText();
  await screenshot(hearing.page, 'desktop-soundtrack-hearing.png');
  await close(hearing.browser);

  if (!soundtrackText.includes('SOUNDTRACK') || soundtrackMeter !== 5 || soundtrackFilled < 1) {
    throw new Error(`Expected soundtrack panel with meter, saw ${soundtrackMeter}/${soundtrackFilled}/${soundtrackText}`);
  }
  if (!activeTempo.includes('じっくり')) {
    throw new Error(`Expected cinematic tempo to be active, saw ${activeTempo}`);
  }
  if (!auditionDisabledAfterMute) {
    throw new Error('Expected soundtrack audition to disable when audio is muted');
  }
  if (!hearingSoundtrackText.includes('OBJECTION READY') || !hearingSoundtrackText.includes('128 BPM')) {
    throw new Error(`Expected hearing soundtrack cue, saw ${hearingSoundtrackText}`);
  }

  return { disabledAfterMute, auditionDisabledAfterMute, soundtrackMeter, soundtrackFilled, activeTempo };
}

async function runMobileCaseFileSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'evidence',
      evidenceIds: allEvidence,
      flags: clearedFlags,
    }),
  });
  await screenshot(page, 'mobile-casefile-evidence.png');
  await page.locator('.evidence-card').nth(4).click();
  await page.locator('.evidence-usage').first().waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-casefile-evidence-usage.png');
  const usageCards = await page.locator('.evidence-usage').count();
  if (usageCards < 2) throw new Error(`Expected mobile evidence usage cards, saw ${usageCards}`);
  const tabs = page.locator('.tab-bar .tab');
  await tabs.nth(1).click();
  await page.locator('.person-dossier-grid').first().waitFor({ state: 'visible' });
  const personDossiers = await page.locator('.person-card').count();
  const pressurePeople = await page.locator('.person-card.status-pressure').count();
  await page.locator('.person-card-actions .secondary-button').first().click();
  await page.locator('.present-control-row').waitFor({ state: 'visible' });
  await (await visibleCommand(page, 7)).click();
  await tabs.nth(1).click();
  await screenshot(page, 'mobile-casefile-people.png');
  await tabs.nth(2).click();
  await page.locator('.timeline-brief').waitFor({ state: 'visible' });
  const mobileTimelineText = await page.locator('.timeline-brief').innerText();
  const mobileTimelineEvidence = await page.locator('.timeline-event-evidence em').count();
  await screenshot(page, 'mobile-casefile-timeline.png');
  await tabs.nth(3).click();
  await page.locator('.testimony-file').waitFor({ state: 'visible' });
  const mobileTestimonyText = await page.locator('.testimony-file').innerText();
  const mobileTestimonyCards = await page.locator('.testimony-file-card').count();
  await screenshot(page, 'mobile-casefile-testimony.png');
  await page.locator('.testimony-file-evidence button:has(img[src*="file-history"])').click();
  await page.locator('.evidence-detail img[src*="file-history"]').waitFor({ state: 'visible' });
  await page.locator('.evidence-testimony-link').waitFor({ state: 'visible' });
  const mobileTestimonyEvidenceLink = await page.locator('.evidence-testimony-link').innerText();
  await screenshot(page, 'mobile-casefile-testimony-evidence-link.png');
  await page.locator('.evidence-testimony-link .secondary-button').click();
  await page.locator('.testimony-file').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-casefile-testimony-return.png');
  await tabs.nth(4).click();
  await screenshot(page, 'mobile-casefile-theory.png');
  const theoryCards = await page.locator('.theory-issue-card').count();
  if (theoryCards < 4) throw new Error(`Expected mobile theory cards, saw ${theoryCards}`);
  if (mobileTimelineEvidence < 4) {
    throw new Error(`Expected mobile timeline analysis with evidence chips, saw ${mobileTimelineText}`);
  }
  if (mobileTestimonyCards < 3) {
    throw new Error(`Expected mobile testimony file with updates, saw ${mobileTestimonyText}`);
  }
  if (!mobileTestimonyEvidenceLink) {
    throw new Error(`Expected mobile testimony evidence link panel, saw ${mobileTestimonyEvidenceLink}`);
  }
  if (personDossiers < 3 || pressurePeople < 1) {
    throw new Error(`Expected mobile people dossiers with pressure route, saw ${personDossiers}/${pressurePeople}`);
  }
  const width = await assertNoOverflow(page, 'mobile case file');
  await close(browser);
  return { theoryCards, personDossiers, pressurePeople, width };
}

async function runEvidenceUsageSmoke() {
  const state = createState({
    mode: 'evidence',
    evidenceIds: allEvidence,
    flags: clearedFlags,
  });

  const desktop = await launchPage({ state });
  await desktop.page.locator('.evidence-card').nth(4).click();
  await desktop.page.locator('.evidence-usage').first().waitFor({ state: 'visible' });
  await desktop.page.locator('.evidence-next-use').waitFor({ state: 'visible' });
  await desktop.page.locator('.evidence-role-card').waitFor({ state: 'visible' });
  await desktop.page.locator('.evidence-court-use').waitFor({ state: 'visible' });
  const roleStats = await desktop.page.locator('.evidence-role-stats em').count();
  const courtUseText = await desktop.page.locator('.evidence-court-use').innerText();
  const courtUseCards = await desktop.page.locator('.evidence-court-use-card').count();
  await desktop.page.locator('.comparison-select select').selectOption('visitor-log');
  await desktop.page.locator('.comparison-insight').first().waitFor({ state: 'visible' });
  const hearingUsages = await desktop.page.locator('.evidence-usage.usage-hearing').count();
  const deductionUsages = await desktop.page.locator('.evidence-usage.usage-deduction').count();
  const nextUseButtons = await desktop.page.locator('.evidence-next-list button').count();
  const comparisonInsights = await desktop.page.locator('.comparison-insight').count();
  await desktop.page.locator('.evidence-relation-map').waitFor({ state: 'visible' });
  const relationText = await desktop.page.locator('.evidence-relation-map').innerText();
  await screenshot(desktop.page, 'desktop-casefile-evidence-next-use.png');
  await screenshot(desktop.page, 'desktop-casefile-evidence-court-use.png');
  await screenshot(desktop.page, 'desktop-casefile-evidence-usage.png');
  await screenshot(desktop.page, 'desktop-casefile-evidence-compare.png');
  await screenshot(desktop.page, 'desktop-casefile-evidence-relations.png');
  await desktop.page.locator('.relation-evidence-links button:has(img[src*="visitor-card"])').click();
  await desktop.page.locator('.evidence-detail img[src*="visitor-card"]').waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-casefile-evidence-relation-jump.png');
  await desktop.page.locator('.tab-bar .tab').nth(2).click();
  await desktop.page.locator('.timeline-brief').waitFor({ state: 'visible' });
  const timelineBrief = await desktop.page.locator('.timeline-brief').innerText();
  const timelineRoles = await desktop.page.locator('.timeline-event-roles span').count();
  await screenshot(desktop.page, 'desktop-casefile-timeline.png');
  await desktop.page.locator('.tab-bar .tab').nth(3).click();
  await desktop.page.locator('.testimony-file').waitFor({ state: 'visible' });
  const testimonyText = await desktop.page.locator('.testimony-file').innerText();
  const testimonyCards = await desktop.page.locator('.testimony-file-card').count();
  const testimonyEvidenceButtons = await desktop.page.locator('.testimony-file-evidence button').count();
  await screenshot(desktop.page, 'desktop-casefile-testimony.png');
  await desktop.page.locator('.testimony-file-evidence button:has(img[src*="file-history"])').click();
  await desktop.page.locator('.evidence-detail img[src*="file-history"]').waitFor({ state: 'visible' });
  await desktop.page.locator('.evidence-testimony-link').waitFor({ state: 'visible' });
  const testimonyEvidenceLink = await desktop.page.locator('.evidence-testimony-link').innerText();
  await screenshot(desktop.page, 'desktop-casefile-testimony-evidence-link.png');
  await desktop.page.locator('.evidence-testimony-link .secondary-button').click();
  await desktop.page.locator('.testimony-file').waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-casefile-testimony-return.png');
  await desktop.page.locator('.tab-bar .tab').first().click();
  await desktop.page.locator('.evidence-next-list button:not([disabled])').first().click();
  await desktop.page
    .locator('.testimony-board, .deduction-stage, .analysis-card, .present-control-row')
    .first()
    .waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-casefile-evidence-next-use-jump.png');
  const width = await assertNoOverflow(desktop.page, 'desktop evidence usage');
  await close(desktop.browser);

  if (hearingUsages < 1 || deductionUsages < 1) {
    throw new Error(
      `Expected hearing and deduction usage cards, saw hearing=${hearingUsages}, deduction=${deductionUsages}`,
    );
  }
  if (comparisonInsights < 2) {
    throw new Error(`Expected evidence comparison insights, saw ${comparisonInsights}`);
  }
  if (nextUseButtons < 2) {
    throw new Error(`Expected evidence next-use actions, saw ${nextUseButtons}`);
  }
  if (roleStats !== 3) {
    throw new Error(`Expected evidence role stats, saw ${roleStats}`);
  }
  if (!courtUseText.includes('COURT USE') || courtUseCards < 2) {
    throw new Error(`Expected court-use evidence routes, saw cards=${courtUseCards} text=${courtUseText}`);
  }
  if (!relationText) {
    throw new Error(`Expected evidence relation map with case links, saw ${relationText}`);
  }
  if (timelineRoles < 4) {
    throw new Error(`Expected desktop timeline analysis, saw ${timelineBrief}`);
  }
  if (testimonyCards < 3 || testimonyEvidenceButtons < 2) {
    throw new Error(`Expected desktop testimony file with updates, saw ${testimonyText}`);
  }
  if (!testimonyEvidenceLink) {
    throw new Error(`Expected testimony evidence link panel, saw ${testimonyEvidenceLink}`);
  }

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state,
  });
  await mobile.page.locator('.evidence-card').nth(4).click();
  await mobile.page.locator('.evidence-usage').first().waitFor({ state: 'visible' });
  await mobile.page.locator('.evidence-next-use').waitFor({ state: 'visible' });
  await mobile.page.locator('.evidence-role-card').waitFor({ state: 'visible' });
  await mobile.page.locator('.evidence-court-use').waitFor({ state: 'visible' });
  const mobileRoleStats = await mobile.page.locator('.evidence-role-stats em').count();
  const mobileCourtUseText = await mobile.page.locator('.evidence-court-use').innerText();
  const mobileCourtUseCards = await mobile.page.locator('.evidence-court-use-card').count();
  await mobile.page.locator('.comparison-select select').selectOption('visitor-log');
  await mobile.page.locator('.comparison-insight').first().waitFor({ state: 'visible' });
  await mobile.page.locator('.evidence-relation-map').waitFor({ state: 'visible' });
  const mobileRelationText = await mobile.page.locator('.evidence-relation-map').innerText();
  await screenshot(mobile.page, 'mobile-casefile-evidence-next-use.png');
  await screenshot(mobile.page, 'mobile-casefile-evidence-court-use.png');
  await screenshot(mobile.page, 'mobile-casefile-evidence-usage-focused.png');
  await screenshot(mobile.page, 'mobile-casefile-evidence-compare.png');
  await screenshot(mobile.page, 'mobile-casefile-evidence-relations.png');
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile evidence usage focused');
  await close(mobile.browser);

  if (!mobileRelationText || mobileRoleStats !== 3) {
    throw new Error(`Expected mobile evidence relation map and role stats, saw ${mobileRelationText}`);
  }
  if (!mobileCourtUseText.includes('COURT USE') || mobileCourtUseCards < 2) {
    throw new Error(
      `Expected mobile court-use evidence routes, saw cards=${mobileCourtUseCards} text=${mobileCourtUseText}`,
    );
  }

  return {
    hearingUsages,
    deductionUsages,
    comparisonInsights,
    roleStats,
    courtUseCards,
    mobileCourtUseCards,
    width,
    mobileWidth,
  };
}

async function runTheoryBoardSmoke() {
  const mixedTheoryState = createState({
    mode: 'evidence',
    evidenceIds: allEvidence,
    flags: [
      'saw_old_draft',
      'saw_phone_note',
      'analysis_sentence_risk',
      'saw_visitor_log',
      'saw_file_history',
    ],
  });

  const desktop = await launchPage({ state: mixedTheoryState });
  await desktop.page.locator('.tab-bar .tab').nth(4).click();
  await desktop.page.locator('.theory-board').waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-casefile-theory.png');
  const completeCards = await desktop.page.locator('.theory-issue-card.status-complete').count();
  const lockedCards = await desktop.page.locator('.theory-issue-card.status-locked').count();
  await close(desktop.browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: mixedTheoryState,
  });
  await mobile.page.locator('.tab-bar .tab').nth(4).click();
  await mobile.page.locator('.theory-board').waitFor({ state: 'visible' });
  await screenshot(mobile.page, 'mobile-casefile-theory-focused.png');
  const width = await assertNoOverflow(mobile.page, 'mobile theory board');
  await close(mobile.browser);

  return { completeCards, lockedCards, width };
}

async function runMobileHearingSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) => !['hearing_cleared', 'hearing_pc_contradiction'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await screenshot(page, 'mobile-hearing.png');
  await page.locator('.cross-examination-banner').waitFor({ state: 'visible' });
  const mobileCrossBannerInitial = await page.locator('.cross-examination-banner').innerText();
  await screenshot(page, 'mobile-hearing-cross-examination-banner.png');
  await page.locator('.hearing-court-hud').waitFor({ state: 'visible' });
  const mobileHudInitial = await page.locator('.hearing-court-hud').innerText();
  await screenshot(page, 'mobile-hearing-court-hud.png');
  await page.locator('.hearing-shortcuts').waitFor({ state: 'visible' });
  const mobileShortcutText = await page.locator('.hearing-shortcuts').innerText();
  await screenshot(page, 'mobile-hearing-shortcuts.png');
  await page.locator('.courtroom-bench').waitFor({ state: 'visible' });
  const mobileBenchSeats = await page.locator('.courtroom-seat').count();
  const mobileBenchText = await page.locator('.courtroom-bench').innerText();
  await screenshot(page, 'mobile-hearing-courtroom-bench.png');
  await page.locator('.hearing-trial-flow').waitFor({ state: 'visible' });
  const mobileTrialFlowInitial = await page.locator('.hearing-trial-flow').innerText();
  const mobileTrialFlowStepsInitial = await page.locator('.hearing-trial-flow-step').count();
  await screenshot(page, 'mobile-hearing-trial-flow.png');
  const routeCards = await page.locator('.hearing-route-card').count();
  const ledgerCards = await page.locator('.hearing-ledger-card').count();
  const sequenceItems = await page.locator('.hearing-sequence-item').count();
  const readySequenceItems = await page.locator('.hearing-sequence-item.status-ready').count();
  const mobileLedgerText = await page.locator('.hearing-ledger').innerText();
  if (routeCards < 3) throw new Error(`Expected mobile hearing route cards, saw ${routeCards}`);
  if (ledgerCards < 2) {
    throw new Error(`Expected mobile hearing ledger, saw ${mobileLedgerText}`);
  }
  if (sequenceItems !== 3 || readySequenceItems < 1) {
    throw new Error(`Expected mobile hearing sequence with a ready item, saw ${sequenceItems}/${readySequenceItems}`);
  }
  if (mobileBenchSeats !== 4 || !mobileBenchText.includes('COURTROOM')) {
    throw new Error(`Expected mobile courtroom bench with 4 seats, saw ${mobileBenchText}`);
  }
  await page.locator('.testimony-next').click();
  await page.locator('.hearing-record-tray').waitFor({ state: 'visible' });
  const mobileRecordCards = await page.locator('.hearing-record-card').count();
  await page.locator('.hearing-record-card[data-evidence-id="file-history"] button').first().click();
  const mobileTraySelection = await page.locator('.hearing-control-row select').inputValue();
  await screenshot(page, 'mobile-hearing-record-tray.png');
  await page.locator('.dock-comparison.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-submit-preview.status-ready').waitFor({ state: 'visible' });
  await page.locator('.courtroom-objection-cue').waitFor({ state: 'visible' });
  await page.locator('.cross-examination-banner.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-court-hud.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-reading-guide.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-case-note.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-statement-dock.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-trial-flow.status-ready').waitFor({ state: 'visible' });
  const mobileCaseNoteSteps = await page.locator('.hearing-case-note-step').count();
  const mobileStatementDockChecks = await page.locator('.hearing-statement-dock-checks span').count();
  const mobileCaseNote = await page.locator('.hearing-case-note').innerText();
  const mobileReadingGuide = await page.locator('.hearing-reading-guide').innerText();
  const mobileStatementDock = await page.locator('.hearing-statement-dock').innerText();
  const mobileTrialFlowReady = await page.locator('.hearing-trial-flow').innerText();
  const mobileObjectionCue = await page.locator('.courtroom-objection-cue').innerText();
  const mobileHudReady = await page.locator('.hearing-court-hud').innerText();
  const mobileCrossBannerReady = await page.locator('.cross-examination-banner').innerText();
  await screenshot(page, 'mobile-hearing-objection-cue.png');
  await screenshot(page, 'mobile-hearing-trial-flow-ready.png');
  await page.locator('.hearing-statement-dock-grid button').first().click();
  await page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-hearing-statement-dock-evidence.png');
  await page.locator('.quicklook-heading button').click();
  await page.locator('.hearing-statement-dock.status-ready').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-hearing-case-note.png');
  await screenshot(page, 'mobile-hearing-reading-guide.png');
  await screenshot(page, 'mobile-hearing-statement-dock.png');
  const mobileSubmitPreview = await page.locator('.hearing-submit-preview').innerText();
  await screenshot(page, 'mobile-hearing-submit-preview.png');
  await clickWorkPrimary(page);
  await waitForClash(page);
  await page.locator('.hearing-breakthrough.status-partial').waitFor({ state: 'visible' });
  const mobileBreakthroughSteps = await page.locator('.hearing-breakthrough-step').count();
  const mobileBreakthrough = await page.locator('.hearing-breakthrough').innerText();
  await screenshot(page, 'mobile-hearing-breakthrough.png');
  await page.locator('.confrontation-dock .inline-detail-button').click();
  await page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-hearing-evidence-quicklook.png');
  await page.locator('.quicklook-heading button').click();
  await screenshot(page, 'mobile-hearing-comparison.png');
  const comparisonText = await page.locator('.dock-comparison').innerText();
  const width = await assertNoOverflow(page, 'mobile hearing');
  await close(browser);
  if (!comparisonText) {
    throw new Error(`Expected mobile comparison axis, saw ${comparisonText}`);
  }
  if (!mobileSubmitPreview) {
    throw new Error(`Expected mobile submit preview, saw ${mobileSubmitPreview}`);
  }
  if (!mobileObjectionCue.includes('異議あり')) {
    throw new Error(`Expected mobile objection cue, saw ${mobileObjectionCue}`);
  }
  if (
    mobileTrialFlowStepsInitial !== 4 ||
    !mobileTrialFlowInitial.includes('TRIAL FLOW') ||
    !mobileTrialFlowReady.includes('矛盾を示す')
  ) {
    throw new Error(
      `Expected mobile trial flow to show 4 beats and ready turnabout, saw ${mobileTrialFlowStepsInitial}/${mobileTrialFlowReady}`,
    );
  }
  if (!mobileHudInitial.includes('TRIAL HUD') || !mobileHudReady.includes('異議あり準備')) {
    throw new Error(`Expected mobile trial HUD to update, saw initial=${mobileHudInitial} ready=${mobileHudReady}`);
  }
  if (!mobileShortcutText.includes('SHORTCUTS') || !mobileShortcutText.includes('証言送り')) {
    throw new Error(`Expected mobile hearing shortcuts, saw ${mobileShortcutText}`);
  }
  if (
    !mobileCrossBannerInitial.includes('CROSS EXAMINATION') ||
    !mobileCrossBannerReady.includes('記録を突きつける局面')
  ) {
    throw new Error(
      `Expected mobile cross examination banner to update, saw initial=${mobileCrossBannerInitial} ready=${mobileCrossBannerReady}`,
    );
  }
  if (mobileRecordCards < 4 || mobileTraySelection !== 'file-history') {
    throw new Error(`Expected mobile record tray selection, saw ${mobileRecordCards}/${mobileTraySelection}`);
  }
  if (!mobileReadingGuide) {
    throw new Error(`Expected mobile hearing reading guide, saw ${mobileReadingGuide}`);
  }
  if (mobileStatementDockChecks !== 5 || !mobileStatementDock) {
    throw new Error(`Expected mobile statement dock with 5 checks, saw ${mobileStatementDock}`);
  }
  if (mobileCaseNoteSteps !== 4 || !mobileCaseNote) {
    throw new Error(`Expected mobile hearing case note with 4 steps, saw ${mobileCaseNote}`);
  }
  if (mobileBreakthroughSteps !== 2 || !mobileBreakthrough) {
    throw new Error(`Expected mobile hearing breakthrough with 2 steps, saw ${mobileBreakthrough}`);
  }
  return {
    routeCards,
    sequenceItems,
    readySequenceItems,
    width,
    mobileCaseNoteSteps,
    mobileStatementDockChecks,
    mobileBreakthroughSteps,
  };
}

async function waitForClash(page) {
  await page.locator('.evidence-clash').waitFor({ state: 'visible' });
  await page.locator('.impact-burst').waitFor({ state: 'hidden' }).catch(() => {});
  await page.locator('.cut-in').waitFor({ state: 'hidden' }).catch(() => {});
}

async function runImpactBurstSmoke() {
  const present = await launchPage({
    state: createState({
      mode: 'present',
      currentLocationId: 'reception',
      evidenceIds: ['old-draft'],
      flags: ['saw_old_draft', 'client_pressure'],
    }),
  });
  const presentSelects = present.page.locator('.present-control-row select');
  await presentSelects.nth(0).selectOption('client-b');
  await presentSelects.nth(1).selectOption('old-draft');
  await clickWorkPrimary(present.page);
  await present.page.locator('.impact-burst.tone-pressure').waitFor({ state: 'visible' });
  await screenshot(present.page, 'desktop-impact-present.png');
  const presentImpact = await present.page.locator('.impact-burst').innerText();
  const presentPortrait = await present.page.locator('.impact-burst-meta img').getAttribute('src');
  await close(present.browser);

  const analysis = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'analysis',
      evidenceIds: ['old-draft', 'phone-note'],
      flags: ['saw_old_draft', 'saw_phone_note'],
    }),
  });
  const analysisSelects = analysis.page.locator('.analysis-card').first().locator('select');
  await analysisSelects.nth(0).selectOption('old-draft');
  await analysisSelects.nth(1).selectOption('phone-note');
  await analysis.page.locator('.analysis-card .secondary-button').first().click();
  await analysis.page.locator('.impact-burst.tone-success').waitFor({ state: 'visible' });
  await screenshot(analysis.page, 'mobile-impact-analysis.png');
  const mobileImpact = await analysis.page.locator('.impact-burst').innerText();
  const mobileWidth = await assertNoOverflow(analysis.page, 'mobile impact burst');
  await close(analysis.browser);

  if (!presentImpact) {
    throw new Error(`Expected pressure impact with evidence name, saw ${presentImpact}`);
  }
  if (!presentPortrait?.includes('client-b-pressure.')) {
    throw new Error(`Expected pressure portrait in impact, saw ${presentPortrait}`);
  }
  if (!mobileImpact) {
    throw new Error(`Expected success impact with analysis label, saw ${mobileImpact}`);
  }

  return { presentPortrait, mobileWidth };
}

async function runEvidenceClashSmoke() {
  const analysis = await launchPage({
    state: createState({
      mode: 'analysis',
      evidenceIds: ['old-draft', 'phone-note'],
      flags: ['saw_old_draft', 'saw_phone_note'],
    }),
  });
  await analysis.page.locator('.analysis-chain-board').waitFor({ state: 'visible' });
  const analysisChainSteps = await analysis.page.locator('.analysis-chain-step').count();
  const analysisChainReady = await analysis.page.locator('.analysis-chain-step.status-ready').count();
  await analysis.page.locator('.analysis-chain-step.status-ready .analysis-chain-evidence button.owned').nth(0).click();
  await analysis.page.locator('.analysis-chain-step.status-ready .analysis-chain-evidence button.owned').nth(1).click();
  const analysisSelects = analysis.page.locator('.analysis-card').first().locator('select');
  const firstChainSelection = await analysisSelects.nth(0).inputValue();
  const secondChainSelection = await analysisSelects.nth(1).inputValue();
  await analysis.page.locator('.analysis-card .secondary-button').first().click();
  await waitForClash(analysis.page);
  await screenshot(analysis.page, 'desktop-analysis-chain.png');
  await screenshot(analysis.page, 'desktop-clash-analysis.png');
  const analysisEvidence = await analysis.page.locator('.evidence-clash .clash-evidence span').count();
  const analysisClashSteps = await analysis.page.locator('.clash-sequence-step').count();
  const analysisClashSequence = await analysis.page.locator('.clash-sequence').innerText();
  await openNotebookTab(analysis.page, '章');
  await analysis.page.locator('.pursuit-memo').waitFor({ state: 'visible' });
  const pursuitNoteCount = await analysis.page.locator('.pursuit-note').count();
  await screenshot(analysis.page, 'desktop-pursuit-memo.png');
  await close(analysis.browser);
  if (analysisChainSteps !== 3 || analysisChainReady < 1 || !firstChainSelection || !secondChainSelection) {
    throw new Error(`Expected analysis chain to fill selections, saw ${analysisChainSteps}/${analysisChainReady}/${firstChainSelection}/${secondChainSelection}`);
  }

  const present = await launchPage({
    state: createState({
      mode: 'present',
      currentLocationId: 'reception',
      evidenceIds: ['old-draft'],
      flags: ['saw_old_draft', 'client_pressure'],
    }),
  });
  const presentSelects = present.page.locator('.present-control-row select');
  await presentSelects.nth(0).selectOption('client-b');
  await presentSelects.nth(1).selectOption('old-draft');
  await clickWorkPrimary(present.page);
  await waitForClash(present.page);
  await present.page.locator('.present-breakdown').waitFor({ state: 'visible' });
  await screenshot(present.page, 'desktop-clash-present.png');
  await screenshot(present.page, 'desktop-present-breakdown.png');
  const presentClash = await present.page.locator('.evidence-clash').innerText();
  const presentClashSteps = await present.page.locator('.clash-sequence-step').count();
  const presentBreakdownSteps = await present.page.locator('.present-breakdown-steps section').count();
  const presentClashPortrait = await present.page
    .locator('.evidence-clash .clash-speaker img')
    .getAttribute('src');
  await close(present.browser);

  const hearing = await launchPage({
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) =>
          !['hearing_cleared', 'hearing_pc_contradiction', 'pressed_later_fear'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await hearing.page.locator('.testimony-next').click();
  await hearing.page.locator('.hearing-control-row select').selectOption('file-history');
  await clickWorkPrimary(hearing.page);
  await waitForClash(hearing.page);
  await hearing.page.locator('.hearing-breakthrough.status-partial').waitFor({ state: 'visible' });
  const hearingBreakthroughSteps = await hearing.page.locator('.hearing-breakthrough-step').count();
  const hearingBreakthroughText = await hearing.page.locator('.hearing-breakthrough').innerText();
  await screenshot(hearing.page, 'desktop-hearing-breakthrough.png');
  await screenshot(hearing.page, 'desktop-clash-hearing.png');
  const hearingTone = await hearing.page.locator('.evidence-clash').getAttribute('class');
  const hearingClashSteps = await hearing.page.locator('.clash-sequence-step').count();
  const hearingClashPortrait = await hearing.page
    .locator('.evidence-clash .clash-speaker img')
    .getAttribute('src');
  await close(hearing.browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'analysis',
      evidenceIds: ['old-draft', 'phone-note'],
      flags: ['saw_old_draft', 'saw_phone_note'],
    }),
  });
  await mobile.page.locator('.analysis-chain-board').waitFor({ state: 'visible' });
  const mobileAnalysisChainSteps = await mobile.page.locator('.analysis-chain-step').count();
  const mobileSelects = mobile.page.locator('.analysis-card').first().locator('select');
  await mobileSelects.nth(0).selectOption('old-draft');
  await mobileSelects.nth(1).selectOption('phone-note');
  await screenshot(mobile.page, 'mobile-analysis-chain.png');
  await mobile.page.locator('.analysis-card .secondary-button').first().click();
  await waitForClash(mobile.page);
  await screenshot(mobile.page, 'mobile-clash-analysis.png');
  const mobileClashSteps = await mobile.page.locator('.clash-sequence-step').count();
  const mobileClashSequence = await mobile.page.locator('.clash-sequence').innerText();
  await openNotebookTab(mobile.page, '章');
  await mobile.page.locator('.notebook-sheet .pursuit-memo').waitFor({ state: 'visible' });
  await screenshot(mobile.page, 'mobile-pursuit-memo.png');
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile clash');
  const mobileClashPortrait = await mobile.page
    .locator('.evidence-clash .clash-speaker img')
    .getAttribute('src');
  await close(mobile.browser);

  if (!presentClashPortrait?.includes('client-b-pressure.')) {
    throw new Error(`Expected present clash pressure portrait, saw ${presentClashPortrait}`);
  }
  if (analysisClashSteps !== 3 || !analysisClashSequence.includes('VERDICT')) {
    throw new Error(`Expected analysis clash sequence, saw ${analysisClashSteps}/${analysisClashSequence}`);
  }
  if (presentClashSteps !== 3 || hearingClashSteps !== 3 || mobileClashSteps !== 3) {
    throw new Error(`Expected 3-step clash sequences, saw ${presentClashSteps}/${hearingClashSteps}/${mobileClashSteps}`);
  }
  if (!mobileClashSequence.includes('STATEMENT') || !mobileClashSequence.includes('RECORD')) {
    throw new Error(`Expected mobile clash sequence labels, saw ${mobileClashSequence}`);
  }
  if (presentBreakdownSteps !== 4) {
    throw new Error(`Expected four present breakdown steps, saw ${presentBreakdownSteps}`);
  }
  if (mobileAnalysisChainSteps !== 3) {
    throw new Error(`Expected mobile analysis chain steps, saw ${mobileAnalysisChainSteps}`);
  }
  if (!hearingClashPortrait?.includes('client-b-pressure.')) {
    throw new Error(`Expected hearing clash pressure portrait, saw ${hearingClashPortrait}`);
  }
  if (hearingBreakthroughSteps !== 2 || !hearingBreakthroughText) {
    throw new Error(`Expected hearing breakthrough with 2 steps, saw ${hearingBreakthroughText}`);
  }
  if (!mobileClashPortrait?.includes('assistant-success.')) {
    throw new Error(`Expected mobile clash success portrait, saw ${mobileClashPortrait}`);
  }
  if (pursuitNoteCount < 1) {
    throw new Error(`Expected pursuit note, saw ${pursuitNoteCount}`);
  }

  return {
    analysisEvidence,
    analysisChainSteps,
    pursuitNoteCount,
    presentClash,
    hearingTone,
    hearingBreakthroughSteps,
    mobileWidth,
    presentClashPortrait,
    presentBreakdownSteps,
    hearingClashPortrait,
    mobileClashPortrait,
  };
}

async function runHearingBoardSmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) =>
          !['hearing_cleared', 'hearing_pc_contradiction', 'pressed_later_fear'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await page.locator('.testimony-board').waitFor({ state: 'visible' });
  await page.locator('.cross-examination-banner').waitFor({ state: 'visible' });
  const crossBannerInitial = await page.locator('.cross-examination-banner').innerText();
  await screenshot(page, 'desktop-hearing-cross-examination-banner.png');
  await page.locator('.hearing-court-hud').waitFor({ state: 'visible' });
  const hudInitial = await page.locator('.hearing-court-hud').innerText();
  await screenshot(page, 'desktop-hearing-court-hud.png');
  await page.locator('.hearing-shortcuts').waitFor({ state: 'visible' });
  const shortcutText = await page.locator('.hearing-shortcuts').innerText();
  await screenshot(page, 'desktop-hearing-shortcuts.png');
  await page.locator('.courtroom-bench').waitFor({ state: 'visible' });
  const benchSeats = await page.locator('.courtroom-seat').count();
  const benchText = await page.locator('.courtroom-bench').innerText();
  await screenshot(page, 'desktop-hearing-courtroom-bench.png');
  await page.locator('.hearing-trial-flow').waitFor({ state: 'visible' });
  const trialFlowInitial = await page.locator('.hearing-trial-flow').innerText();
  const trialFlowStepsInitial = await page.locator('.hearing-trial-flow-step').count();
  await screenshot(page, 'desktop-hearing-trial-flow.png');
  await page.keyboard.press('ArrowRight');
  const keyboardStatement = await page.locator('.testimony-card').innerText();
  if (!keyboardStatement) {
    throw new Error(`Expected ArrowRight to move hearing testimony, saw ${keyboardStatement}`);
  }
  if (benchSeats !== 4 || !benchText.includes('COURTROOM')) {
    throw new Error(`Expected desktop courtroom bench with 4 seats, saw ${benchText}`);
  }
  await page.locator('.hearing-control-row select').focus();
  await page.keyboard.press('ArrowRight');
  const focusedStatement = await page.locator('.testimony-card').innerText();
  if (focusedStatement !== keyboardStatement) {
    throw new Error(`Expected focused evidence select to ignore hearing shortcut, saw ${focusedStatement}`);
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.locator('.hearing-record-tray').waitFor({ state: 'visible' });
  const recordCards = await page.locator('.hearing-record-card').count();
  await page.locator('.hearing-record-card[data-evidence-id="file-history"] button').first().click();
  const traySelection = await page.locator('.hearing-control-row select').inputValue();
  await screenshot(page, 'desktop-hearing-record-tray.png');
  await page.locator('.dock-comparison.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-submit-preview.status-ready').waitFor({ state: 'visible' });
  await page.locator('.cross-examination-banner.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-court-hud.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-reading-guide.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-case-note.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-trial-flow.status-ready').waitFor({ state: 'visible' });
  const caseNoteSteps = await page.locator('.hearing-case-note-step').count();
  const caseNoteText = await page.locator('.hearing-case-note').innerText();
  const readingGuideText = await page.locator('.hearing-reading-guide').innerText();
  const trialFlowReady = await page.locator('.hearing-trial-flow').innerText();
  await screenshot(page, 'desktop-hearing-case-note.png');
  await screenshot(page, 'desktop-hearing-reading-guide.png');
  await screenshot(page, 'desktop-hearing-trial-flow-ready.png');
  await page.locator('.hearing-reading-guide button').click();
  await page.locator('.evidence-quicklook img[src*="file-history"]').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-hearing-reading-evidence.png');
  await page.locator('.quicklook-heading button').click();
  const submitPreviewReady = await page.locator('.hearing-submit-preview').innerText();
  const hudReady = await page.locator('.hearing-court-hud').innerText();
  const crossBannerReady = await page.locator('.cross-examination-banner').innerText();
  await screenshot(page, 'desktop-hearing-submit-preview.png');
  await page.locator('.hearing-control-row select').selectOption('old-draft');
  await page.locator('.hearing-submit-preview.status-mismatch').waitFor({ state: 'visible' });
  const submitPreviewMismatch = await page.locator('.hearing-submit-preview').innerText();
  await screenshot(page, 'desktop-hearing-submit-mismatch.png');
  await page.locator('.hearing-control-row select').selectOption('file-history');
  await page.locator('.hearing-submit-preview.status-ready').waitFor({ state: 'visible' });
  await page.locator('.hearing-ledger').waitFor({ state: 'visible' });
  const ledgerCards = await page.locator('.hearing-ledger-card').count();
  const ledgerReady = await page.locator('.hearing-ledger-card.status-ready').count();
  const ledgerLocked = await page.locator('.hearing-ledger-card.status-locked').count();
  const ledgerText = await page.locator('.hearing-ledger').innerText();
  await screenshot(page, 'desktop-hearing-board.png');
  await screenshot(page, 'desktop-hearing-comparison.png');
  await page.locator('.confrontation-dock .inline-detail-button').click();
  await page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-hearing-evidence-quicklook.png');
  await page.locator('.quicklook-heading button').click();
  const activeText = await page.locator('.testimony-marker.active').innerText();
  const readyCards = await page.locator('.hearing-route-card.status-ready').count();
  const comparisonText = await page.locator('.dock-comparison').innerText();
  if (readyCards < 2) throw new Error(`Expected ready route cards, saw ${readyCards}`);
  if (ledgerCards < 2 || ledgerReady < 1 || ledgerLocked < 1) {
    throw new Error(`Expected hearing ledger with ready and locked steps, saw ${ledgerText}`);
  }
  if (!comparisonText) {
    throw new Error(`Expected comparison axis, saw ${comparisonText}`);
  }
  if (!readingGuideText) {
    throw new Error(`Expected hearing reading guide, saw ${readingGuideText}`);
  }
  if (caseNoteSteps !== 4 || !caseNoteText) {
    throw new Error(`Expected hearing case note with 4 steps, saw ${caseNoteText}`);
  }
  if (!submitPreviewReady) {
    throw new Error(`Expected ready submit preview, saw ${submitPreviewReady}`);
  }
  if (!hudInitial.includes('TRIAL HUD') || !hudReady.includes('つきつける')) {
    throw new Error(`Expected desktop trial HUD to update, saw initial=${hudInitial} ready=${hudReady}`);
  }
  if (!shortcutText.includes('SHORTCUTS') || !shortcutText.includes('Enter')) {
    throw new Error(`Expected desktop hearing shortcuts, saw ${shortcutText}`);
  }
  if (!crossBannerInitial.includes('CROSS EXAMINATION') || !crossBannerReady.includes('記録を突きつける局面')) {
    throw new Error(
      `Expected desktop cross examination banner to update, saw initial=${crossBannerInitial} ready=${crossBannerReady}`,
    );
  }
  if (trialFlowStepsInitial !== 4 || !trialFlowInitial.includes('TRIAL FLOW') || !trialFlowReady.includes('矛盾を示す')) {
    throw new Error(`Expected desktop trial flow with 4 beats and ready turnabout, saw ${trialFlowStepsInitial}/${trialFlowReady}`);
  }
  if (recordCards < 4 || traySelection !== 'file-history') {
    throw new Error(`Expected desktop record tray selection, saw ${recordCards}/${traySelection}`);
  }
  if (!submitPreviewMismatch) {
    throw new Error(`Expected mismatch submit preview, saw ${submitPreviewMismatch}`);
  }
  await page.locator('.hearing-ledger-card').nth(1).click();
  const selectedAfterLedger = await page.locator('.testimony-card').innerText();
  if (!selectedAfterLedger) {
    throw new Error(`Expected ledger click to select later fear statement, saw ${selectedAfterLedger}`);
  }
  await close(browser);
  return { activeText, readyCards };
}

async function runHearingCueSmoke() {
  const press = await launchPage({
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) =>
          !['hearing_cleared', 'hearing_pc_contradiction', 'pressed_no_edit', 'pressed_later_fear'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await press.page.locator('.testimony-board').waitFor({ state: 'visible' });
  await press.page.locator('.testimony-next').click();
  await press.page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await press.page.keyboard.press('p');
  await press.page.locator('.hearing-cue.tone-pressure').waitFor({ state: 'visible' });
  await press.page.locator('.hearing-cue-candidates').waitFor({ state: 'visible' });
  await press.page.locator('.hearing-amendment.status-pressed').waitFor({ state: 'visible' });
  await press.page.locator('.cut-in').waitFor({ state: 'hidden' }).catch(() => {});
  await screenshot(press.page, 'desktop-hearing-press-cue.png');
  await screenshot(press.page, 'desktop-hearing-amendment.png');
  const pressCue = await press.page.locator('.hearing-cue').innerText();
  const amendmentText = await press.page.locator('.hearing-amendment').innerText();
  const amendmentSequenceSteps = await press.page.locator('.hearing-amendment-sequence-step').count();
  const amendmentSequenceText = await press.page.locator('.hearing-amendment-sequence').innerText();
  const pressCandidateCount = await press.page.locator('.hearing-cue-candidate').count();
  const pressPortrait = await press.page.locator('.hearing-cue-heading img').getAttribute('src');
  await close(press.browser);

  const miss = await launchPage({
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) =>
          !['hearing_cleared', 'hearing_pc_contradiction', 'pressed_later_fear'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await miss.page.locator('.testimony-board').waitFor({ state: 'visible' });
  await miss.page.locator('.testimony-next').click();
  await miss.page.locator('.hearing-control-row select').selectOption('old-draft');
  await miss.page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await miss.page.keyboard.press('Enter');
  await miss.page.locator('.hearing-cue.tone-damage').waitFor({ state: 'visible' });
  await miss.page.locator('.hearing-cue-candidate').waitFor({ state: 'visible' });
  await miss.page.locator('.hearing-penalty-panel').waitFor({ state: 'visible' });
  await miss.page.locator('.hearing-recovery-note').waitFor({ state: 'visible' });
  await miss.page.locator('.cut-in').waitFor({ state: 'hidden' }).catch(() => {});
  await screenshot(miss.page, 'desktop-hearing-miss-cue.png');
  await screenshot(miss.page, 'desktop-hearing-penalty.png');
  await screenshot(miss.page, 'desktop-hearing-recovery-note.png');
  const missCue = await miss.page.locator('.hearing-cue').innerText();
  const missPenalty = await miss.page.locator('.hearing-penalty-panel').innerText();
  const missPortrait = await miss.page.locator('.hearing-cue-heading img').getAttribute('src');
  const missCandidateCount = await miss.page.locator('.hearing-cue-candidate').count();
  const missRecoverySections = await miss.page.locator('.hearing-recovery-grid section').count();
  const missRecoveryButtons = await miss.page.locator('.hearing-recovery-note button').count();
  await miss.page.locator('.hearing-cue-candidate').click();
  await miss.page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  const missCandidateImage = await miss.page.locator('.evidence-quicklook .evidence-detail img').getAttribute('src');
  await screenshot(miss.page, 'desktop-hearing-miss-recovery-evidence.png');
  await close(miss.browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) =>
          !['hearing_cleared', 'hearing_pc_contradiction', 'pressed_no_edit', 'pressed_later_fear'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await mobile.page.locator('.testimony-board').waitFor({ state: 'visible' });
  await mobile.page.locator('.testimony-next').click();
  await mobile.page.locator('.hearing-control-row .secondary-button').click();
  await mobile.page.locator('.hearing-cue.tone-pressure').waitFor({ state: 'visible' });
  await mobile.page.locator('.hearing-cue-candidates').waitFor({ state: 'visible' });
  await mobile.page.locator('.hearing-amendment.status-pressed').waitFor({ state: 'visible' });
  await mobile.page.locator('.cut-in').waitFor({ state: 'hidden' }).catch(() => {});
  await screenshot(mobile.page, 'mobile-hearing-press-cue.png');
  await screenshot(mobile.page, 'mobile-hearing-amendment.png');
  const mobileAmendmentSequenceSteps = await mobile.page.locator('.hearing-amendment-sequence-step').count();
  const mobileAmendmentSequenceText = await mobile.page.locator('.hearing-amendment-sequence').innerText();
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile hearing cue');
  await close(mobile.browser);

  const mobileMiss = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) =>
          !['hearing_cleared', 'hearing_pc_contradiction', 'pressed_later_fear'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await mobileMiss.page.locator('.testimony-board').waitFor({ state: 'visible' });
  await mobileMiss.page.locator('.testimony-next').click();
  await mobileMiss.page.locator('.hearing-control-row select').selectOption('old-draft');
  await clickWorkPrimary(mobileMiss.page);
  await mobileMiss.page.locator('.hearing-penalty-panel').waitFor({ state: 'visible' });
  await mobileMiss.page.locator('.hearing-recovery-note').waitFor({ state: 'visible' });
  await screenshot(mobileMiss.page, 'mobile-hearing-penalty.png');
  await screenshot(mobileMiss.page, 'mobile-hearing-recovery-note.png');
  const mobilePenalty = await mobileMiss.page.locator('.hearing-penalty-panel').innerText();
  const mobileRecoverySections = await mobileMiss.page.locator('.hearing-recovery-grid section').count();
  const mobileRecoveryWidth = await assertNoOverflow(mobileMiss.page, 'mobile hearing recovery note');
  await close(mobileMiss.browser);

  if (pressCandidateCount < 1 || !pressCue) {
    throw new Error(`Expected pressure cue with evidence candidate, saw ${pressCue}`);
  }
  if (!pressPortrait?.includes('client-b-pressure.')) {
    throw new Error(`Expected pressure portrait in press cue, saw ${pressPortrait}`);
  }
  if (!amendmentText) {
    throw new Error(`Expected hearing amendment panel with updated testimony, saw ${amendmentText}`);
  }
  if (amendmentSequenceSteps !== 3 || !amendmentSequenceText.includes('NEXT RECORD')) {
    throw new Error(`Expected hearing amendment sequence, saw ${amendmentSequenceSteps}/${amendmentSequenceText}`);
  }
  if (mobileAmendmentSequenceSteps !== 3 || !mobileAmendmentSequenceText.includes('ANSWER')) {
    throw new Error(`Expected mobile hearing amendment sequence, saw ${mobileAmendmentSequenceSteps}/${mobileAmendmentSequenceText}`);
  }
  if (!missCue) {
    throw new Error(`Expected damage cue with weak evidence, saw ${missCue}`);
  }
  if (missCandidateCount < 1) {
    throw new Error(`Expected damage cue with recovery evidence candidate, saw ${missCue}`);
  }
  if (!missPenalty.includes('JUDGE WARNING') || !missPenalty.includes('-1')) {
    throw new Error(`Expected desktop judge penalty panel, saw ${missPenalty}`);
  }
  if (!mobilePenalty.includes('JUDGE WARNING') || !mobilePenalty.includes('RETURN TO RECORD')) {
    throw new Error(`Expected mobile judge penalty panel, saw ${mobilePenalty}`);
  }
  if (missRecoverySections !== 3 || missRecoveryButtons < 1) {
    throw new Error(`Expected hearing recovery note with evidence action, saw sections=${missRecoverySections}, buttons=${missRecoveryButtons}`);
  }
  if (!missCandidateImage?.includes('file-history.')) {
    throw new Error(`Expected miss recovery to open file history evidence, saw ${missCandidateImage}`);
  }
  if (!missPortrait?.includes('client-b-damage.')) {
    throw new Error(`Expected damage portrait in miss cue, saw ${missPortrait}`);
  }
  if (mobileRecoverySections !== 3) {
    throw new Error(`Expected mobile hearing recovery note with 3 sections, saw ${mobileRecoverySections}`);
  }

  return { pressPortrait, missPortrait, mobileWidth, mobileRecoveryWidth };
}

async function runPortraitVariantSmoke() {
  const present = await launchPage({
    state: createState({
      mode: 'present',
      currentLocationId: 'reception',
      evidenceIds: ['old-draft'],
      flags: ['saw_old_draft', 'client_pressure'],
    }),
  });
  const presentSelects = present.page.locator('.present-control-row select');
  await presentSelects.nth(0).selectOption('client-b');
  await presentSelects.nth(1).selectOption('old-draft');
  await screenshot(present.page, 'desktop-portrait-present.png');
  const presentPortrait = await present.page.locator('.present-person img').getAttribute('src');
  await close(present.browser);

  const hearing = await launchPage({
    state: createState({
      mode: 'hearing',
      evidenceIds: allEvidence,
      flags: clearedFlags.filter(
        (flag) =>
          !['hearing_cleared', 'hearing_pc_contradiction', 'pressed_later_fear'].includes(flag),
      ),
      tone: 'pressure',
    }),
  });
  await hearing.page.locator('.testimony-next').click();
  await screenshot(hearing.page, 'desktop-portrait-hearing.png');
  const hearingPortrait = await hearing.page.locator('.testimony-portrait').getAttribute('src');
  await close(hearing.browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'move',
      currentLocationId: 'reception',
      narrative: 'Portrait variant mobile smoke.',
      speakerId: 'assistant',
      tone: 'success',
    }),
  });
  await screenshot(mobile.page, 'mobile-portrait-dialogue.png');
  const mobilePortrait = await mobile.page.locator('.stage-portrait').getAttribute('src');
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile portrait variants');
  await close(mobile.browser);

  if (!presentPortrait?.includes('client-b-pressure.')) {
    throw new Error(`Expected present pressure portrait, saw ${presentPortrait}`);
  }
  if (!hearingPortrait?.includes('client-b-pressure.')) {
    throw new Error(`Expected hearing pressure portrait, saw ${hearingPortrait}`);
  }
  if (!mobilePortrait?.includes('assistant-success.')) {
    throw new Error(`Expected mobile dialogue success portrait, saw ${mobilePortrait}`);
  }

  return { presentPortrait, hearingPortrait, mobilePortrait, mobileWidth };
}

async function runMobileLogSmoke() {
  const logState = createState({
    mode: 'log',
    evidenceIds: ['old-draft', 'file-history', 'scheduled-message'],
    flags: ['saw_old_draft', 'final_unlocked', 'analysis_complete'],
    history: [
      {
        id: 'log-1',
        mode: 'inspect',
        locationId: 'conference-room',
        text: 'Old draft found.',
        note: 'Old draft',
        speakerId: 'assistant',
        tone: 'investigation',
        evidenceIds: ['old-draft'],
        createdAt: 1,
      },
      {
        id: 'log-2',
        mode: 'hearing',
        locationId: 'reception',
        text: 'The file history conflicts with the statement.',
        note: 'Contradiction',
        speakerId: 'assistant',
        tone: 'pressure',
        evidenceIds: ['file-history'],
        createdAt: 2,
      },
      {
        id: 'log-3',
        mode: 'analysis',
        locationId: 'records-corner',
        text: 'The memo and old draft explain the risk.',
        note: 'Analysis link',
        speakerId: 'assistant',
        tone: 'success',
        evidenceIds: ['old-draft', 'phone-note'],
        createdAt: 3,
      },
      {
        id: 'log-4',
        mode: 'present',
        locationId: 'reception',
        text: 'Wrong person for this evidence.',
        note: 'Missed present',
        speakerId: 'assistant',
        tone: 'damage',
        createdAt: 4,
      },
    ],
  });

  const desktop = await launchPage({ state: logState });
  await desktop.page.locator('.history-filter-bar button').nth(1).click();
  await desktop.page.locator('.history-filter-bar button.active').waitFor({ state: 'visible' });
  const desktopEvidenceEntries = await desktop.page.locator('.history-entry').count();
  const desktopContextCards = await desktop.page.locator('.history-entry-context').count();
  const desktopEvidenceButtons = await desktop.page.locator('.history-evidence button').count();
  await desktop.page.locator('.history-case-summary').waitFor({ state: 'visible' });
  const desktopSummaryStats = await desktop.page.locator('.history-summary-grid span').count();
  const desktopSummaryEvidence = await desktop.page.locator('.history-summary-evidence button').count();
  await screenshot(desktop.page, 'desktop-log.png');
  await screenshot(desktop.page, 'desktop-log-summary.png');
  await desktop.page.locator('.history-evidence button').first().click();
  await desktop.page.locator('.evidence-detail').waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-log-evidence-jump.png');
  await (await visibleCommand(desktop.page, 8)).click();
  await desktop.page.locator('.history-filter-bar button').nth(1).click();
  await desktop.page.locator('.history-filter-bar button.active').waitFor({ state: 'visible' });
  await desktop.page.locator('.history-entry-actions button').nth(1).click();
  await desktop.page.locator('.testimony-board').first().waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-log-history-jump.png');
  const desktopWidth = await assertNoOverflow(desktop.page, 'desktop log');
  await close(desktop.browser);

  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: logState,
  });
  await screenshot(page, 'mobile-log.png');
  await page.locator('.history-filter-bar button').nth(3).click();
  await page.locator('.history-filter-bar button.active').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-log-filtered.png');
  const mobileHearingEntries = await page.locator('.history-entry').count();
  const mobileContextCards = await page.locator('.history-entry-context').count();
  await page.locator('.history-case-summary').waitFor({ state: 'visible' });
  const mobileSummaryStats = await page.locator('.history-summary-grid span').count();
  await page.locator('.history-entry-actions button').first().click();
  await page.locator('.testimony-board').first().waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-log-history-jump.png');
  const width = await assertNoOverflow(page, 'mobile log');
  await close(browser);
  if (desktopEvidenceEntries !== 3) {
    throw new Error(`Expected 3 evidence log entries, saw ${desktopEvidenceEntries}`);
  }
  if (desktopContextCards !== 3 || desktopEvidenceButtons < 4) {
    throw new Error(`Expected log context and evidence buttons, saw ${desktopContextCards}/${desktopEvidenceButtons}`);
  }
  if (desktopSummaryStats !== 4 || desktopSummaryEvidence < 1 || mobileSummaryStats !== 4) {
    throw new Error(`Expected log case summary, saw stats=${desktopSummaryStats}/${mobileSummaryStats}, evidence=${desktopSummaryEvidence}`);
  }
  if (mobileHearingEntries !== 1) {
    throw new Error(`Expected 1 hearing log entry, saw ${mobileHearingEntries}`);
  }
  if (mobileContextCards !== 1) {
    throw new Error(`Expected mobile hearing context card, saw ${mobileContextCards}`);
  }
  return {
    desktopWidth,
    width,
    desktopEvidenceEntries,
    desktopEvidenceButtons,
    desktopSummaryStats,
    mobileHearingEntries,
  };
}

async function runSessionBookmarkSmoke() {
  const bookmarkState = createState({
    mode: 'move',
    currentLocationId: 'reception',
    evidenceIds: ['old-draft', 'file-history'],
    flags: ['saw_old_draft', 'saw_file_history'],
    narrative: 'Bookmark QA state.',
    history: [
      {
        id: 'bookmark-1',
        mode: 'inspect',
        locationId: 'conference-room',
        text: 'QA confirmed the shared PC file-history timestamp.',
        note: 'File history confirmed.',
        speakerId: 'assistant',
        tone: 'investigation',
        evidenceIds: ['file-history'],
        createdAt: 1770000000000,
      },
    ],
  });

  const desktop = await launchPage({ state: bookmarkState });
  await openNotebookTab(desktop.page, '記録');
  await desktop.page.locator('.session-bookmark').waitFor({ state: 'visible' });
  const bookmarkText = await desktop.page.locator('.session-bookmark').innerText();
  const bookmarkEvidence = await desktop.page.locator('.session-bookmark-evidence span').count();
  const bookmarkProgress = await desktop.page.locator('.session-progress-mini span').count();
  await screenshot(desktop.page, 'desktop-session-bookmark.png');
  await openNotebookTab(desktop.page, '章');
  await desktop.page.locator('.progress-trail-heading').waitFor({ state: 'visible' });
  await desktop.page.locator('.progress-next-beat').waitFor({ state: 'visible' });
  const roadmapSteps = await desktop.page.locator('.progress-step').count();
  await openNotebookTab(desktop.page, '記録');
  await desktop.page.locator('.session-next-step').waitFor({ state: 'visible' });
  await desktop.page.locator('.session-next-button').click();
  await desktop.page.locator('.inspect-panel').waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-session-bookmark-next.png');
  await desktop.page.locator('.session-bookmark .secondary-button').first().click();
  await desktop.page.locator('.history-notebook').waitFor({ state: 'visible' });
  await screenshot(desktop.page, 'desktop-session-bookmark-log.png');
  await close(desktop.browser);

  if (bookmarkEvidence < 1 || bookmarkProgress !== 3 || roadmapSteps < 6 || !bookmarkText) {
    throw new Error(`Expected desktop session bookmark with latest entry and evidence, saw ${bookmarkText}`);
  }

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: bookmarkState,
  });
  await openNotebookTab(mobile.page, '記録');
  await mobile.page.locator('.notebook-sheet .session-bookmark').waitFor({ state: 'visible' });
  const mobileProgress = await mobile.page.locator('.notebook-sheet .session-progress-mini span').count();
  await openNotebookTab(mobile.page, '章');
  await mobile.page.locator('.notebook-sheet .progress-trail-heading').waitFor({ state: 'visible' });
  const mobileRoadmapText = await mobile.page.locator('.notebook-sheet .progress-trail').innerText();
  await screenshot(mobile.page, 'mobile-session-bookmark.png');
  const width = await assertNoOverflow(mobile.page, 'mobile session bookmark');
  await close(mobile.browser);

  if (mobileProgress !== 3 || !mobileRoadmapText.includes('CASE ROADMAP')) {
    throw new Error(`Expected mobile session bookmark progress chips and roadmap, saw ${mobileProgress}`);
  }

  return { bookmarkEvidence, bookmarkProgress, roadmapSteps, width };
}

async function runPresentPenaltySmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'present',
      currentLocationId: 'reception',
      evidenceIds: ['old-draft', 'visitor-log'],
      flags: ['saw_old_draft', 'client_pressure', 'client_knows_risk', 'unlocked_pc_known'],
      credibility: 5,
    }),
  });
  const selects = page.locator('.present-control-row select');
  await selects.nth(0).selectOption('clerk-a');
  await selects.nth(1).selectOption('old-draft');
  await page.locator('.present-pressure-board.status-weak').waitFor({ state: 'visible' });
  await page.locator('.present-verdict-panel.status-weak').waitFor({ state: 'visible' });
  const weakPressure = await page.locator('.present-pressure-board').innerText();
  const weakVerdict = await page.locator('.present-verdict-panel').innerText();
  await clickWorkPrimary(page);
  await page.locator('.present-miss-note').waitFor({ state: 'visible' });
  const missNote = await page.locator('.present-miss-note').innerText();
  await page.locator('.status-strip.damage').waitFor({ state: 'visible' });
  await page.locator('.credibility-risk-card').waitFor({ state: 'visible' });
  const riskText = await page.locator('.credibility-risk-card').innerText();
  await screenshot(page, 'desktop-present-miss-note.png');
  await screenshot(page, 'desktop-present-penalty.png');
  const status = await page.locator('.status-strip').innerText();
  await close(browser);
  if (!weakPressure || !weakVerdict.includes('PRESENT VERDICT') || !missNote || !riskText.includes('CREDIBILITY')) {
    throw new Error(`Expected weak present verdict, miss note, and risk card, saw ${weakPressure} / ${missNote}`);
  }
  return { status, weakPressure, weakVerdict, missNote, riskText };
}

async function runPresentPressureSmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'present',
      currentLocationId: 'reception',
      evidenceIds: ['old-draft', 'visitor-log'],
      flags: ['saw_old_draft', 'client_pressure', 'client_knows_risk', 'unlocked_pc_known'],
      tone: 'pressure',
    }),
  });
  const selects = page.locator('.present-control-row select');
  await selects.nth(0).selectOption('client-b');
  await selects.nth(1).selectOption('old-draft');
  await page.locator('.present-pressure-board.status-ready').waitFor({ state: 'visible' });
  await page.locator('.present-verdict-panel.status-ready').waitFor({ state: 'visible' });
  await page.locator('.present-target-board').waitFor({ state: 'visible' });
  const targetButtons = await page.locator('.present-target-grid button').count();
  await screenshot(page, 'desktop-present.png');
  await screenshot(page, 'desktop-present-target-board.png');
  const pressureText = await page.locator('.present-pressure-board').innerText();
  const verdictText = await page.locator('.present-verdict-panel').innerText();
  const targetText = await page.locator('.present-target-board').innerText();
  const width = await assertNoOverflow(page, 'desktop present pressure');
  await close(browser);
  if (!pressureText || !verdictText.includes('Press now') || !targetText || targetButtons < 2) {
    throw new Error(`Expected desktop present pressure and target board, saw ${pressureText} / ${targetText}`);
  }
  return { pressureText, verdictText, targetButtons, width };
}

async function runMobilePresentSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'present',
      currentLocationId: 'reception',
      evidenceIds: ['old-draft', 'visitor-log'],
      flags: ['saw_old_draft', 'client_pressure', 'client_knows_risk', 'unlocked_pc_known'],
      tone: 'pressure',
    }),
  });
  const selects = page.locator('.present-control-row select');
  await selects.nth(0).selectOption('client-b');
  await selects.nth(1).selectOption('old-draft');
  await page.locator('.present-pressure-board.status-ready').waitFor({ state: 'visible' });
  await page.locator('.present-verdict-panel.status-ready').waitFor({ state: 'visible' });
  await page.locator('.present-target-board').waitFor({ state: 'visible' });
  await page.locator('.present-target-grid button').nth(1).click();
  await page.locator('.present-pressure-board.status-ready').waitFor({ state: 'visible' });
  await page.locator('.present-verdict-panel.status-ready').waitFor({ state: 'visible' });
  const selectedEvidenceAfterTarget = await selects.nth(1).inputValue();
  await screenshot(page, 'mobile-present.png');
  await screenshot(page, 'mobile-present-target-board.png');
  const pressureText = await page.locator('.present-pressure-board').innerText();
  const verdictChecks = await page.locator('.present-verdict-checks section.met').count();
  const targetButtons = await page.locator('.present-target-grid button').count();
  await clickWorkPrimary(page);
  await page.locator('.present-breakdown').waitFor({ state: 'visible' });
  await page.locator('.impact-burst').waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  await page.locator('.impact-burst').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  await screenshot(page, 'mobile-present-breakdown.png');
  const breakdownSteps = await page.locator('.present-breakdown-steps section').count();
  const width = await assertNoOverflow(page, 'mobile present');
  await close(browser);
  if (!pressureText || verdictChecks !== 3 || targetButtons < 2 || selectedEvidenceAfterTarget !== 'visitor-log') {
    throw new Error(`Expected ready present target board, saw ${pressureText} / ${selectedEvidenceAfterTarget}`);
  }
  if (breakdownSteps !== 4) {
    throw new Error(`Expected mobile present breakdown steps, saw ${breakdownSteps}`);
  }
  return { width, pressureText, verdictChecks, targetButtons, breakdownSteps };
}

async function runConsultSmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'inspect',
      currentLocationId: 'conference-room',
      evidenceIds: ['old-draft', 'redline-note', 'phone-note', 'printer-log', 'file-history'],
      flags: [
        'saw_old_draft',
        'saw_redline',
        'saw_phone_note',
        'understood_sentence_risk',
        'saw_printer_log',
        'clerk_alibi',
        'saw_file_history',
      ],
    }),
  });
  await openNotebookTab(page, '焦点');
  await page.locator('.focus-action-card').waitFor({ state: 'visible' });
  const focusActionButtons = await page.locator('.focus-action-card button').count();
  await screenshot(page, 'desktop-focus-next-action.png');
  await openNotebookTab(page, '論点');
  await page.locator('.theory-progress-card').waitFor({ state: 'visible' });
  const theoryIssueChips = await page.locator('.theory-progress-issues span').count();
  await screenshot(page, 'desktop-theory-progress-card.png');
  await openNotebookTab(page, '焦点');
  await page.locator('.focus-action-card .focus-consult-button').click();
  await page.locator('.consult-panel').waitFor({ state: 'visible' });
  await page.locator('.consult-actions .secondary-button').click();
  await screenshot(page, 'desktop-consult.png');
  const title = await page.locator('.consult-heading strong').innerText();
  const visibleHints = await page.locator('.consult-step.visible').count();
  await page.locator('.consult-evidence .evidence-chip').first().click();
  await page.locator('.evidence-detail img[src*="file-history"]').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-consult-evidence-jump.png');
  const focusedEvidence = await page.locator('.evidence-detail').innerText();
  await openNotebookTab(page, '論点');
  await page.locator('.theory-progress-card .secondary-button').click();
  await page.locator('.theory-board').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-theory-progress-jump.png');
  await close(browser);
  if (focusActionButtons < 2) {
    throw new Error(`Expected focus action card with next and consult buttons, saw ${focusActionButtons}`);
  }
  if (theoryIssueChips < 4) {
    throw new Error(`Expected theory progress card with 4 issue chips, saw ${theoryIssueChips}`);
  }
  if (!focusedEvidence) {
    throw new Error(`Expected consult evidence jump to file history, saw ${focusedEvidence}`);
  }
  return { title, visibleHints };
}

async function runMobileConsultSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'consult',
      currentLocationId: 'reception',
      evidenceIds: [
        'old-draft',
        'phone-note',
        'visitor-log',
        'file-history',
        'email-draft',
        'scheduled-message',
      ],
      flags: [
        'saw_old_draft',
        'saw_redline',
        'saw_phone_note',
        'understood_sentence_risk',
        'saw_printer_log',
        'clerk_alibi',
        'saw_file_history',
        'unlocked_pc_known',
        'saw_visitor_log',
        'client_route_confirmed',
        'client_pressure',
        'client_knows_risk',
        'client_visit_confirmed',
        'saw_email_draft',
        'final_unlocked',
        'analysis_sentence_risk',
        'analysis_time_window',
      ],
    }),
  });
  await page.locator('.consult-panel').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-consult.png');
  await page.locator('.consult-evidence .evidence-chip').first().click();
  await page.locator('.evidence-detail').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-consult-evidence-jump.png');
  const width = await assertNoOverflow(page, 'mobile consult');
  await close(browser);
  return width;
}

async function runDeductionRetrySmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      credibility: 5,
    }),
  });
  await selectCorrectDeduction(page);
  await page.getByLabel('deduction-culprit-evidence').selectOption('phone-note');
  await clickWorkPrimary(page);
  await page.locator('.deduction-review.damage').waitFor({ state: 'visible' });
  await page.locator('.deduction-miss-board').waitFor({ state: 'visible' });
  const retryMissCards = await page.locator('.deduction-miss-card').count();
  await page.locator('.deduction-miss-card .inline-detail-button').first().click();
  await page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  await page.locator('.cut-in').waitFor({ state: 'hidden' });
  await screenshot(page, 'desktop-deduction-review.png');
  const retryStatus = await page.locator('.status-strip').innerText();
  await page.getByLabel('deduction-culprit-evidence').selectOption('visitor-log');
  await clickWorkPrimary(page);
  await page.locator('.story-stage-panel').waitFor({ state: 'visible' });
  await close(browser);
  if (retryMissCards < 1) {
    throw new Error(`Expected deduction retry miss cards, saw ${retryMissCards}`);
  }
  return { retryStatus, retryMissCards };
}

async function runDeductionStageSmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      narrative: 'Final deduction stage ready.',
    }),
  });
  await page.locator('.deduction-stage').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-deduction-stage.png');
  const desktopChapterGuide = await page.locator('.chapter-guide').innerText();
  const initialStage = await page.locator('.deduction-stage h3').innerText();
  await page.keyboard.press('ArrowRight');
  const keyboardNextStage = await page.locator('.deduction-stage h3').innerText();
  if (!keyboardNextStage || keyboardNextStage === initialStage) {
    throw new Error(`Expected ArrowRight to move deduction stage, saw ${keyboardNextStage}`);
  }
  await page.keyboard.press('ArrowLeft');
  const keyboardPreviousStage = await page.locator('.deduction-stage h3').innerText();
  if (!keyboardPreviousStage) {
    throw new Error(`Expected ArrowLeft to return deduction stage, saw ${keyboardPreviousStage}`);
  }
  await page.getByLabel('trial-culprit-choice').focus();
  await page.keyboard.press('ArrowRight');
  const focusedStage = await page.locator('.deduction-stage h3').innerText();
  if (focusedStage !== keyboardPreviousStage) {
    throw new Error(`Expected focused deduction select to ignore stage shortcut, saw ${focusedStage}`);
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.getByLabel('trial-culprit-choice').selectOption('client-b');
  await page.getByLabel('trial-culprit-evidence').selectOption('visitor-log');
  await page.locator('.deduction-fit.status-aligned').waitFor({ state: 'visible' });
  const deductionFit = await page.locator('.deduction-fit').innerText();
  await screenshot(page, 'desktop-deduction-fit.png');
  await page.locator('input[name="reason"]').nth(1).check();
  await page.getByLabel('deduction-reason-evidence').selectOption('phone-note');
  await page.locator('input[name="opportunity"]').nth(1).check();
  await page.getByLabel('deduction-opportunity-evidence').selectOption('file-history');
  await page.locator('input[name="proof"]').nth(2).check();
  await page.getByLabel('deduction-proof-evidence').selectOption('scheduled-message');
  await page.locator('.deduction-chain').waitFor({ state: 'visible' });
  await page.locator('.deduction-brief').waitFor({ state: 'visible' });
  await page.locator('.deduction-ready-panel').waitFor({ state: 'visible' });
  await page.locator('.deduction-final-argument.status-ready').waitFor({ state: 'visible' });
  await page.locator('.final-summation-panel.status-ready').waitFor({ state: 'visible' });
  const deductionBrief = await page.locator('.deduction-brief').innerText();
  const briefReadyCards = await page.locator('.deduction-brief-card.ready').count();
  const chainNodes = await page.locator('.chain-node.has-evidence').count();
  const readyPanelItems = await page.locator('.deduction-ready-grid section').count();
  const finalArgumentText = await page.locator('.deduction-final-argument').innerText();
  const finalArgumentCards = await page.locator('.deduction-final-grid article').count();
  const finalSummationText = await page.locator('.final-summation-panel').innerText();
  const finalSummationCards = await page.locator('.final-summation-grid article').count();
  await screenshot(page, 'desktop-deduction-chain.png');
  await screenshot(page, 'desktop-deduction-ready-panel.png');
  await screenshot(page, 'desktop-deduction-final-argument.png');
  await screenshot(page, 'desktop-deduction-final-summation.png');
  await page.locator('.deduction-stage .inline-detail-button').click();
  await page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-deduction-evidence-quicklook.png');
  await page.locator('.quicklook-heading button').click();
  await page.locator('.deduction-stage .secondary-button').click();
  await page.locator('.deduction-stage-verdict.correct').waitFor({ state: 'visible' });
  const correctVerdict = await page.locator('.deduction-stage-verdict.correct').innerText();
  await screenshot(page, 'desktop-deduction-stage-verdict.png');
  await page.locator('.deduction-stage .secondary-button').click();
  const activeStage = await page.locator('.deduction-stage h3').innerText();
  const answeredSteps = await page.locator('.deduction-step.answered').count();
  const correctSteps = await page.locator('.deduction-step.review-correct').count();
  await screenshot(page, 'desktop-deduction-stage-next.png');
  await page.getByLabel('trial-reason-choice').selectOption('typo');
  await page.getByLabel('trial-reason-evidence').selectOption('visitor-log');
  await page.locator('.deduction-fit.status-mismatch').waitFor({ state: 'visible' });
  const wrongFit = await page.locator('.deduction-fit').innerText();
  await screenshot(page, 'desktop-deduction-fit-wrong.png');
  await page.locator('.deduction-stage .secondary-button').click();
  await page.locator('.deduction-stage-verdict.wrong').waitFor({ state: 'visible' });
  const wrongVerdict = await page.locator('.deduction-stage-verdict.wrong').innerText();
  await screenshot(page, 'desktop-deduction-stage-wrong.png');
  await page.locator('.deduction-recovery').waitFor({ state: 'visible' });
  const recoverySections = await page.locator('.deduction-recovery-grid section').count();
  const recoveryButtons = await page.locator('.deduction-recovery .inline-detail-button').count();
  await screenshot(page, 'desktop-deduction-recovery.png');
  await page.locator('.deduction-recovery .inline-detail-button').click();
  await page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  const recoveryEvidenceImage = await page.locator('.evidence-quicklook .evidence-detail img').getAttribute('src');
  await screenshot(page, 'desktop-deduction-recovery-evidence.png');
  await page.locator('.quicklook-heading button').click();
  await close(browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      narrative: 'Mobile final deduction stage ready.',
    }),
  });
  await mobile.page.locator('.deduction-stage').waitFor({ state: 'visible' });
  await screenshot(mobile.page, 'mobile-deduction-stage.png');
  await openNotebookTab(mobile.page, '焦点');
  const mobileChapterGuide = await mobile.page.locator('.notebook-sheet .chapter-guide').innerText();
  await closeNotebookSheet(mobile.page);
  await mobile.page.getByLabel('trial-culprit-choice').selectOption('client-b');
  await mobile.page.getByLabel('trial-culprit-evidence').selectOption('visitor-log');
  await mobile.page.locator('.deduction-fit.status-aligned').waitFor({ state: 'visible' });
  const mobileFitCards = await mobile.page.locator('.deduction-fit-grid section').count();
  await screenshot(mobile.page, 'mobile-deduction-fit.png');
  await mobile.page.locator('input[name="reason"]').nth(1).check();
  await mobile.page.getByLabel('deduction-reason-evidence').selectOption('phone-note');
  await mobile.page.locator('input[name="opportunity"]').nth(1).check();
  await mobile.page.getByLabel('deduction-opportunity-evidence').selectOption('file-history');
  await mobile.page.locator('input[name="proof"]').nth(2).check();
  await mobile.page.getByLabel('deduction-proof-evidence').selectOption('scheduled-message');
  await mobile.page.locator('.deduction-chain').waitFor({ state: 'visible' });
  await mobile.page.locator('.deduction-brief').waitFor({ state: 'visible' });
  await mobile.page.locator('.deduction-ready-panel').waitFor({ state: 'visible' });
  await mobile.page.locator('.deduction-final-argument.status-ready').waitFor({ state: 'visible' });
  await mobile.page.locator('.final-summation-panel.status-ready').waitFor({ state: 'visible' });
  const mobileBriefReadyCards = await mobile.page.locator('.deduction-brief-card.ready').count();
  const mobileReadyPanelItems = await mobile.page.locator('.deduction-ready-grid section').count();
  const mobileFinalArgumentCards = await mobile.page.locator('.deduction-final-grid article').count();
  const mobileFinalSummationCards = await mobile.page.locator('.final-summation-grid article').count();
  const mobileFinalSummationText = await mobile.page.locator('.final-summation-panel').innerText();
  await screenshot(mobile.page, 'mobile-deduction-chain.png');
  await screenshot(mobile.page, 'mobile-deduction-ready-panel.png');
  await screenshot(mobile.page, 'mobile-deduction-final-argument.png');
  await screenshot(mobile.page, 'mobile-deduction-final-summation.png');
  await mobile.page.locator('.deduction-stage .inline-detail-button').click();
  await mobile.page.locator('.evidence-quicklook').waitFor({ state: 'visible' });
  await screenshot(mobile.page, 'mobile-deduction-evidence-quicklook.png');
  await mobile.page.locator('.quicklook-heading button').click();
  await mobile.page.locator('.deduction-stage .secondary-button').click();
  await mobile.page.locator('.deduction-stage-verdict.correct').waitFor({ state: 'visible' });
  await screenshot(mobile.page, 'mobile-deduction-stage-verdict.png');
  await mobile.page.locator('.deduction-stage .secondary-button').click();
  await mobile.page.getByLabel('trial-reason-choice').selectOption('typo');
  await mobile.page.getByLabel('trial-reason-evidence').selectOption('visitor-log');
  await mobile.page.locator('.deduction-stage .secondary-button').click();
  await mobile.page.locator('.deduction-recovery').waitFor({ state: 'visible' });
  await screenshot(mobile.page, 'mobile-deduction-recovery.png');
  const mobileWidth = await assertNoOverflow(mobile.page, 'mobile deduction stage');
  await close(mobile.browser);

  if (!correctVerdict) {
    throw new Error(`Expected correct stage verdict, saw ${correctVerdict}`);
  }
  if (!desktopChapterGuide.includes('4つの問い') || !mobileChapterGuide.includes('4つの問い')) {
    throw new Error(`Expected deduction chapter guide, saw desktop=${desktopChapterGuide}, mobile=${mobileChapterGuide}`);
  }
  if (!activeStage || activeStage === initialStage) {
    throw new Error(`Expected stage to advance to reason, saw ${activeStage}`);
  }
  if (answeredSteps < 1) {
    throw new Error(`Expected answered step marker, saw ${answeredSteps}`);
  }
  if (chainNodes < 4) {
    throw new Error(`Expected four evidence chain nodes, saw ${chainNodes}`);
  }
  if (briefReadyCards < 4 || !deductionBrief) {
    throw new Error(`Expected final deduction brief with completed chain, saw ${deductionBrief}`);
  }
  if (mobileBriefReadyCards < 4) {
    throw new Error(`Expected mobile final deduction brief cards, saw ${mobileBriefReadyCards}`);
  }
  if (readyPanelItems !== 4 || mobileReadyPanelItems !== 4) {
    throw new Error(`Expected deduction ready panel with 4 items, saw desktop=${readyPanelItems}, mobile=${mobileReadyPanelItems}`);
  }
  if (!finalArgumentText.includes('FINAL ARGUMENT') || finalArgumentCards !== 4 || mobileFinalArgumentCards !== 4) {
    throw new Error(`Expected final argument panel with 4 cards, saw desktop=${finalArgumentCards}, mobile=${mobileFinalArgumentCards}`);
  }
  if (
    !finalSummationText.includes('COURT SUMMATION') ||
    finalSummationCards !== 4 ||
    mobileFinalSummationCards !== 4 ||
    !mobileFinalSummationText.includes('FINAL CLAIM')
  ) {
    throw new Error(
      `Expected final summation panel with 4 cards, saw desktop=${finalSummationCards}/${finalSummationText}, mobile=${mobileFinalSummationCards}/${mobileFinalSummationText}`,
    );
  }
  if (correctSteps < 1) {
    throw new Error(`Expected correct step marker, saw ${correctSteps}`);
  }
  if (!wrongVerdict) {
    throw new Error(`Expected wrong stage verdict, saw ${wrongVerdict}`);
  }
  if (recoverySections < 3 || recoveryButtons < 1) {
    throw new Error(`Expected deduction recovery memo with evidence action, saw sections=${recoverySections}, buttons=${recoveryButtons}`);
  }
  if (!recoveryEvidenceImage?.includes('phone-note.')) {
    throw new Error(`Expected recovery memo to open phone note evidence, saw ${recoveryEvidenceImage}`);
  }
  if (!deductionFit) {
    throw new Error(`Expected aligned deduction fit panel, saw ${deductionFit}`);
  }
  if (!wrongFit) {
    throw new Error(`Expected mismatch deduction fit panel, saw ${wrongFit}`);
  }
  if (mobileFitCards < 3) {
    throw new Error(`Expected mobile deduction fit comparison cards, saw ${mobileFitCards}`);
  }

  return {
    activeStage,
    answeredSteps,
    correctSteps,
    chainNodes,
    finalArgumentCards,
    finalSummationCards,
    mobileFinalArgumentCards,
    mobileFinalSummationCards,
    mobileFitCards,
    mobileWidth,
  };
}

async function runMobileDeductionReviewSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      credibility: 5,
    }),
  });
  await selectCorrectDeduction(page);
  await page.getByLabel('deduction-proof-evidence').selectOption('email-draft');
  await clickWorkPrimary(page);
  await page.locator('.deduction-review.damage').waitFor({ state: 'visible' });
  await page.locator('.deduction-miss-board').waitFor({ state: 'visible' });
  const missCards = await page.locator('.deduction-miss-card').count();
  await page.locator('.cut-in').waitFor({ state: 'hidden' });
  await screenshot(page, 'mobile-deduction-review.png');
  const width = await assertNoOverflow(page, 'mobile deduction');
  await close(browser);
  if (missCards < 1) {
    throw new Error(`Expected mobile deduction miss cards, saw ${missCards}`);
  }
  return width;
}

async function runMobileEndingSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'ending',
      endingId: 'success',
      evidenceIds: allEvidence,
      flags: [...clearedFlags, 'case_cleared'],
      tone: 'success',
    }),
  });
  await page.locator('.ending-result-panel.success').waitFor({ state: 'visible' });
  await page.locator('.verdict-scene-panel').waitFor({ state: 'visible' });
  const resultItems = await page.locator('.ending-result-grid section').count();
  const verdictItems = await page.locator('.verdict-scene-grid article').count();
  const verdictText = await page.locator('.verdict-scene-panel').innerText();
  await screenshot(page, 'mobile-ending-final.png');
  const width = await assertNoOverflow(page, 'mobile ending');
  await close(browser);
  if (resultItems !== 4) {
    throw new Error(`Expected mobile ending result items, saw ${resultItems}`);
  }
  if (verdictItems !== 4 || !verdictText.includes('FINAL VERDICT')) {
    throw new Error(`Expected mobile final verdict scene, saw ${verdictItems}: ${verdictText}`);
  }
  return width;
}

async function runCaseReviewSmokes() {
  const desktop = await launchPage({
    state: createState({
      mode: 'review',
      endingId: 'success',
      evidenceIds: allEvidence,
      flags: [...clearedFlags, 'case_cleared'],
    }),
  });
  await screenshot(desktop.page, 'desktop-case-review.png');
  await desktop.page.locator('.review-scorecard').waitFor({ state: 'visible' });
  await desktop.page.locator('.review-rank-panel').waitFor({ state: 'visible' });
  const desktopScoreItems = await desktop.page.locator('.review-score-grid article').count();
  const desktopRankItems = await desktop.page.locator('.review-rank-grid article').count();
  await screenshot(desktop.page, 'desktop-case-review-scorecard.png');
  await screenshot(desktop.page, 'desktop-case-review-rank.png');
  await close(desktop.browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'review',
      endingId: 'success',
      evidenceIds: allEvidence,
      flags: [...clearedFlags, 'case_cleared'],
    }),
  });
  await screenshot(mobile.page, 'mobile-case-review.png');
  await mobile.page.locator('.review-scorecard').waitFor({ state: 'visible' });
  await mobile.page.locator('.review-rank-panel').waitFor({ state: 'visible' });
  const mobileScoreItems = await mobile.page.locator('.review-score-grid article').count();
  const mobileRankItems = await mobile.page.locator('.review-rank-grid article').count();
  await screenshot(mobile.page, 'mobile-case-review-scorecard.png');
  await screenshot(mobile.page, 'mobile-case-review-rank.png');
  const width = await assertNoOverflow(mobile.page, 'mobile case review');
  await close(mobile.browser);
  if (desktopScoreItems !== 4 || mobileScoreItems !== 4) {
    throw new Error(`Expected review scorecard with 4 items, saw desktop=${desktopScoreItems}, mobile=${mobileScoreItems}`);
  }
  if (desktopRankItems !== 3 || mobileRankItems !== 3) {
    throw new Error(`Expected review rank panel with 3 items, saw desktop=${desktopRankItems}, mobile=${mobileRankItems}`);
  }
  return width;
}

async function runProductionMaterialsSmokes() {
  const desktop = await launchPage({
    state: createState({
      mode: 'materials',
      endingId: 'success',
      evidenceIds: allEvidence,
      flags: [...clearedFlags, 'case_cleared'],
    }),
  });
  await screenshot(desktop.page, 'desktop-production-materials.png');
  await desktop.page.locator('.production-roadmap').waitFor({ state: 'visible' });
  const desktopRoadmapItems = await desktop.page.locator('.production-roadmap-grid article').count();
  await desktop.page.locator('.finish-audit').waitFor({ state: 'visible' });
  const desktopAuditItems = await desktop.page.locator('.finish-audit-grid article').count();
  const desktopAuditText = await desktop.page.locator('.finish-audit').innerText();
  await desktop.page.locator('.release-gate').waitFor({ state: 'visible' });
  const desktopReleaseGateItems = await desktop.page.locator('.release-gate-grid article').count();
  const desktopReleaseGateText = await desktop.page.locator('.release-gate').innerText();
  await desktop.page.locator('.asset-swap-plan').waitFor({ state: 'visible' });
  const desktopAssetSwapItems = await desktop.page.locator('.asset-swap-card').count();
  const desktopAssetSwapText = await desktop.page.locator('.asset-swap-plan').innerText();
  await screenshot(desktop.page, 'desktop-production-roadmap.png');
  await screenshot(desktop.page, 'desktop-finish-audit.png');
  await screenshot(desktop.page, 'desktop-release-gate.png');
  await screenshot(desktop.page, 'desktop-asset-swap-plan.png');
  await close(desktop.browser);

  const mobile = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'materials',
      endingId: 'success',
      evidenceIds: allEvidence,
      flags: [...clearedFlags, 'case_cleared'],
    }),
  });
  await screenshot(mobile.page, 'mobile-production-materials.png');
  await mobile.page.locator('.production-roadmap').waitFor({ state: 'visible' });
  const mobileRoadmapItems = await mobile.page.locator('.production-roadmap-grid article').count();
  await mobile.page.locator('.finish-audit').waitFor({ state: 'visible' });
  const mobileAuditItems = await mobile.page.locator('.finish-audit-grid article').count();
  const mobileAuditText = await mobile.page.locator('.finish-audit').innerText();
  await mobile.page.locator('.release-gate').waitFor({ state: 'visible' });
  const mobileReleaseGateItems = await mobile.page.locator('.release-gate-grid article').count();
  const mobileReleaseGateText = await mobile.page.locator('.release-gate').innerText();
  await mobile.page.locator('.asset-swap-plan').waitFor({ state: 'visible' });
  const mobileAssetSwapItems = await mobile.page.locator('.asset-swap-card').count();
  const mobileAssetSwapText = await mobile.page.locator('.asset-swap-plan').innerText();
  await screenshot(mobile.page, 'mobile-production-roadmap.png');
  await screenshot(mobile.page, 'mobile-finish-audit.png');
  await screenshot(mobile.page, 'mobile-release-gate.png');
  await screenshot(mobile.page, 'mobile-asset-swap-plan.png');
  const width = await assertNoOverflow(mobile.page, 'mobile production materials');
  await close(mobile.browser);
  if (desktopRoadmapItems !== 3 || mobileRoadmapItems !== 3) {
    throw new Error(`Expected production roadmap with 3 items, saw desktop=${desktopRoadmapItems}, mobile=${mobileRoadmapItems}`);
  }
  if (
    desktopAuditItems !== 4 ||
    mobileAuditItems !== 4 ||
    !desktopAuditText.includes('FINISH AUDIT') ||
    !mobileAuditText.includes('Presentation') ||
    !desktopAuditText.includes('SOUNDTRACK')
  ) {
    throw new Error(`Expected finish audit with 4 items, saw desktop=${desktopAuditItems}/${desktopAuditText}, mobile=${mobileAuditItems}/${mobileAuditText}`);
  }
  if (
    desktopReleaseGateItems !== 4 ||
    mobileReleaseGateItems !== 4 ||
    !desktopReleaseGateText.includes('RELEASE GATE') ||
    !desktopReleaseGateText.includes('ASSET WAIT') ||
    !mobileReleaseGateText.includes('高品質画像')
  ) {
    throw new Error(
      `Expected release gate with pass/external status, saw desktop=${desktopReleaseGateItems}/${desktopReleaseGateText}, mobile=${mobileReleaseGateItems}/${mobileReleaseGateText}`,
    );
  }
  if (
    desktopAssetSwapItems !== 4 ||
    mobileAssetSwapItems !== 4 ||
    !desktopAssetSwapText.includes('ASSET SWAP PLAN') ||
    !desktopAssetSwapText.includes('ASSET KEY MANIFEST') ||
    !desktopAssetSwapText.includes('35 keys') ||
    !desktopAssetSwapText.includes('public/assets/evidence') ||
    !mobileAssetSwapText.includes('GENERATION BRIEF')
  ) {
    throw new Error(
      `Expected asset swap plan with 4 categories, saw desktop=${desktopAssetSwapItems}/${desktopAssetSwapText}, mobile=${mobileAssetSwapItems}/${mobileAssetSwapText}`,
    );
  }
  return width;
}

async function runCutInSmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      credibility: 5,
    }),
  });
  await selectCorrectDeduction(page);
  await page.getByLabel('deduction-reason-evidence').selectOption('visitor-log');
  await clickWorkPrimary(page);
  await page.locator('.cut-in').waitFor({ state: 'visible' });
  await screenshot(page, 'desktop-cutin-damage.png');
  const text = await page.locator('.cut-in').innerText();
  await close(browser);
  return { text };
}

async function runCommandGuidanceSmoke() {
  const empty = await launchPage({
    state: createState({
      mode: 'move',
      narrative: 'Command guidance empty state.',
    }),
  });
  const emptyCommandGrid = await visibleCommandGrid(empty.page);
  await emptyCommandGrid.waitFor({ state: 'visible' });
  const emptyText = await emptyCommandGrid.innerText();
  const emptyPresentDisabled = await (await visibleCommand(empty.page, 3)).isDisabled();
  const emptyAnalysisDisabled = await (await visibleCommand(empty.page, 4)).isDisabled();
  await screenshot(empty.page, 'desktop-command-guidance.png');
  await close(empty.browser);

  if (!emptyPresentDisabled || !emptyAnalysisDisabled || !emptyText) {
    throw new Error(`Expected locked command guidance in empty state, saw ${emptyText}`);
  }

  const oneEvidence = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'move',
      evidenceIds: ['old-draft'],
      flags: ['saw_old_draft'],
      narrative: 'Command guidance one evidence state.',
    }),
  });
  const oneEvidenceCommandGrid = await visibleCommandGrid(oneEvidence.page);
  await oneEvidenceCommandGrid.waitFor({ state: 'visible' });
  const oneEvidenceText = await oneEvidenceCommandGrid.innerText();
  const presentDisabled = await (await visibleCommand(oneEvidence.page, 3)).isDisabled();
  const analysisDisabled = await (await visibleCommand(oneEvidence.page, 4)).isDisabled();
  await openNotebookTab(oneEvidence.page, '焦点');
  await oneEvidence.page.locator('.notebook-sheet .focus-action-card').waitFor({ state: 'visible' });
  const mobileFocusActions = await oneEvidence.page.locator('.notebook-sheet .focus-action-card button').count();
  await screenshot(oneEvidence.page, 'mobile-focus-next-action.png');
  await openNotebookTab(oneEvidence.page, '論点');
  await oneEvidence.page.locator('.notebook-sheet .theory-progress-card').waitFor({ state: 'visible' });
  const mobileTheoryIssueChips = await oneEvidence.page.locator('.notebook-sheet .theory-progress-issues span').count();
  await screenshot(oneEvidence.page, 'mobile-theory-progress-card.png');
  await screenshot(oneEvidence.page, 'mobile-command-guidance.png');
  const width = await assertNoOverflow(oneEvidence.page, 'mobile command guidance');
  await close(oneEvidence.browser);

  if (
    presentDisabled ||
    !analysisDisabled ||
    !oneEvidenceText ||
    mobileFocusActions < 2 ||
    mobileTheoryIssueChips < 4
  ) {
    throw new Error(`Expected present ready and analysis locked with one evidence, saw ${oneEvidenceText}`);
  }

  return { emptyPresentDisabled, emptyAnalysisDisabled, presentDisabled, analysisDisabled, width };
}

async function runMobileCutInSmoke() {
  const { browser, page } = await launchPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      credibility: 5,
    }),
  });
  await selectCorrectDeduction(page);
  await page.getByLabel('deduction-reason-evidence').selectOption('visitor-log');
  await clickWorkPrimary(page);
  await page.locator('.cut-in').waitFor({ state: 'visible' });
  await screenshot(page, 'mobile-cutin-damage.png');
  const width = await assertNoOverflow(page, 'mobile cut-in');
  await close(browser);
  return width;
}

async function runFailureSmoke() {
  const { browser, page } = await launchPage({
    state: createState({
      mode: 'deduction',
      evidenceIds: allEvidence,
      flags: clearedFlags,
      credibility: 1,
    }),
  });
  await selectCorrectDeduction(page);
  await page.getByLabel('deduction-proof-evidence').selectOption('email-draft');
  await clickWorkPrimary(page);
  await page.locator('.story-stage-panel').waitFor({ state: 'visible' });
  await page.locator('.ending-result-panel.failure').waitFor({ state: 'visible' });
  await page.locator('.credibility-risk-card.tone-danger').waitFor({ state: 'visible' });
  const failureResultItems = await page.locator('.ending-result-grid section').count();
  await screenshot(page, 'desktop-failure.png');
  const credibility = await page.locator('.status-strip').innerText();
  const riskText = await page.locator('.credibility-risk-card').innerText();
  await close(browser);
  if (failureResultItems !== 4) {
    throw new Error(`Expected failure result items, saw ${failureResultItems}`);
  }
  return { credibility, riskText, failureResultItems };
}

const title = await runTitleSmoke();
const desktop = await runDesktopFlow();
const mobile = await runMobileSmoke();
const investigationHotspots = await runInvestigationHotspotSmoke();
const mobileInvestigationHotspots = await runMobileInvestigationHotspotSmoke();
const moveRoutes = await runMoveRouteSmoke();
const talkDossier = await runTalkDossierSmoke();
const audioSettings = await runAudioSettingsSmoke();
const mobileCaseFile = await runMobileCaseFileSmoke();
const evidenceUsage = await runEvidenceUsageSmoke();
const theoryBoard = await runTheoryBoardSmoke();
const mobileHearing = await runMobileHearingSmoke();
const impactBurst = await runImpactBurstSmoke();
const evidenceClash = await runEvidenceClashSmoke();
const hearingBoard = await runHearingBoardSmoke();
const hearingCue = await runHearingCueSmoke();
const portraitVariants = await runPortraitVariantSmoke();
const mobileLog = await runMobileLogSmoke();
const sessionBookmark = await runSessionBookmarkSmoke();
const cutIn = await runCutInSmoke();
const commandGuidance = await runCommandGuidanceSmoke();
const mobileCutIn = await runMobileCutInSmoke();
const deductionStage = await runDeductionStageSmoke();
const deductionRetry = await runDeductionRetrySmoke();
const mobileDeductionReview = await runMobileDeductionReviewSmoke();
const mobileEnding = await runMobileEndingSmoke();
const mobileCaseReview = await runCaseReviewSmokes();
const mobileProductionMaterials = await runProductionMaterialsSmokes();
const consult = await runConsultSmoke();
const mobileConsult = await runMobileConsultSmoke();
const presentPressure = await runPresentPressureSmoke();
const presentPenalty = await runPresentPenaltySmoke();
const mobilePresent = await runMobilePresentSmoke();
const failure = await runFailureSmoke();

console.log(
  JSON.stringify(
    {
      title,
      desktop,
      mobile,
      investigationHotspots,
      mobileInvestigationHotspots,
      moveRoutes,
      talkDossier,
      audioSettings,
      mobileCaseFile,
      evidenceUsage,
      theoryBoard,
      mobileHearing,
      impactBurst,
      evidenceClash,
      hearingBoard,
      hearingCue,
      portraitVariants,
      mobileLog,
      sessionBookmark,
      cutIn,
      commandGuidance,
      mobileCutIn,
      deductionStage,
      deductionRetry,
      mobileDeductionReview,
      mobileEnding,
      mobileCaseReview,
      mobileProductionMaterials,
      consult,
      mobileConsult,
      presentPressure,
      presentPenalty,
      mobilePresent,
      failure,
    },
    null,
    2,
  ),
);
