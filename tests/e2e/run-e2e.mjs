// ブラウザ操作による受け入れテスト（Playwright / Chromium、iPhone 13 相当の画面）。
// 使い方: npm i && npm run test:e2e
//   既存のChromiumを使う場合: CHROMIUM_PATH=/path/to/chrome npm run test:e2e
// スクリーンショットは test-results/ に保存する。

import { mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import { startServer } from './server.mjs';
import { buildPrompt } from '../../src/prompts/build.js';
import { minimalValues } from '../helpers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'test-results');
await mkdir(OUT, { recursive: true });
const { server, origin: ORIGIN } = await startServer(ROOT);

const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); console.log(`ok   - ${name}`); } catch (e) {
    results.push({ name, ok: false }); console.log(`FAIL - ${name}\n       ${String(e.message).split('\n').slice(0, 8).join('\n       ')}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await chromium.launch(launchOpts);
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const context = await browser.newContext({ ...iphone, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });
const page = await context.newPage();

const external = [];
page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
page.on('dialog', (d) => d.accept());

async function go(hash) {
  await page.goto(`${ORIGIN}/${hash}`);
  await page.waitForSelector('#page-title');
}
async function noOverflow(label) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert(r.sw <= r.w, `${label}: 横にはみ出しています（${r.sw} > ${r.w}）`);
}
const promptText = () => page.textContent('#prompt-view');
const radio = (modeId, fieldId, value) => page.click(`label:has(> input[name="${modeId}-${fieldId}"][value="${value}"])`);
const next = async () => { await page.click('.btn-next'); await page.waitForTimeout(150); };

// ---------------------------------------------------------------- ホーム

await check('トップ：3つの入口が表示され、キーボードで開ける', async () => {
  await go('#/');
  await page.evaluate(() => localStorage.clear());
  await go('#/');
  const cards = await page.$$eval('.entry-card', (els) => els.map((e) => e.dataset.mode));
  assert(JSON.stringify(cards) === '["idea","create","fix"]', `入口: ${cards}`);
  await noOverflow('トップ');
  await page.screenshot({ path: join(OUT, '01-home.png'), fullPage: true });
  await page.focus('.entry-card[data-mode="fix"]');
  await page.keyboard.press('Enter');
  await page.waitForURL(/#\/fix$/);
  await page.waitForSelector('.stepper');
  assert((await page.textContent('#page-title')).includes('何を直す'), '③の最初のステップ');
});

// ---------------------------------------------------------------- ① アイデア

await check('①アイデア：必須未入力で次へ進めず、エラーへ移動できる', async () => {
  await go('#/idea/1');
  await next();
  const summary = await page.waitForSelector('#error-summary:not([hidden])');
  assert((await summary.textContent()).includes('どんなジャンル'), 'エラー一覧にジャンル');
  assert(await page.evaluate(() => document.activeElement.id === 'error-summary'), 'エラー一覧にフォーカス');
  assert(page.url().endsWith('#/idea/1'), '移動していない');
  assert(await page.isVisible('#wrap-idea-genres.has-error'), '項目にエラー表示');
});

await check('①アイデア：回答が依頼文に入り、コピーできる', async () => {
  await page.click('label:has(> input[name="idea-genres"][value="play"])');
  await page.click('label:has(> input[name="idea-genres"][value="experiment"])');
  await page.click('label:has(> input[name="idea-genres"][value="any"])');
  const checked = await page.$$eval('input[name="idea-genres"]:checked', (els) => els.map((e) => e.value));
  assert(JSON.stringify(checked) === '["any"]', `おまかせは他と同時に選べない: ${checked}`);
  await page.click('label:has(> input[name="idea-genres"][value="play"])');
  await radio('idea', 'direction', 'mashup');
  await next();
  await page.fill('#idea-interests', '和菓子と天気');
  await next();
  await next();
  await page.waitForURL(/#\/idea\/result$/);
  const t = await promptText();
  assert(t.includes('和菓子と天気') && t.includes('意外な組み合わせ') && t.includes('ジャンル：遊び・ゲーム'), '回答が反映');
  assert(!(await page.isVisible('input[name^="purpose-idea"]')), 'アイデアには段階の切り替えがない');
  await page.click('.output-card .btn-primary >> nth=0');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert(clip === t, 'クリップボードの内容が依頼文と一致');
  await noOverflow('①結果');
  await page.screenshot({ path: join(OUT, '02-idea-result.png'), fullPage: true });
});

await check('①→②：アイデアの貼り付け欄へ進める', async () => {
  await page.click('.next-card a.btn-primary');
  await page.waitForURL(/#\/create\/1$/);
  await page.waitForTimeout(400);
  assert(await page.evaluate(() => document.activeElement.id === 'create-fromIdea'), '貼り付け欄にフォーカス');
  assert(await page.isVisible('#create-fromIdea'), '貼り付け欄が開いている');
});

// ---------------------------------------------------------------- ② 新しく作りたい

await check('②新規：条件分岐（共有→共有先、端末保存→バックアップ、外部あり→詳細）', async () => {
  await page.fill('#create-fromIdea', 'アイデア名：和菓子天気\n何を作るか：天気で和菓子をおすすめ');
  await page.fill('#create-what', '天気で和菓子をおすすめするアプリ');
  await page.fill('#create-purpose', '毎朝、季節の和菓子を楽しむきっかけにしたい');
  await radio('create', 'users', 'self');
  await next();
  await page.fill('#create-must', '今日の天気を選ぶ\nおすすめの和菓子が出る');
  await next();
  assert(!(await page.isVisible('#wrap-create-shareWho')), '最初は共有先を聞かない');
  assert(!(await page.isVisible('#wrap-create-backup')), '最初はバックアップを聞かない');
  await radio('create', 'device', 'sp');
  await radio('create', 'storage', 'share');
  assert(await page.isVisible('#wrap-create-shareWho'), '共有を選ぶと共有先を聞く');
  await radio('create', 'shareWho', 'group');
  assert(await page.isVisible('#wrap-create-shareEdit'), '決まった人なら書き込みを聞く');
  await radio('create', 'storage', 'local');
  assert(!(await page.isVisible('#wrap-create-shareWho')), '端末保存なら共有先を隠す');
  assert(await page.isVisible('#wrap-create-backup'), '端末保存ならバックアップを聞く');
  await radio('create', 'login', 'no');
  assert(!(await page.isVisible('#wrap-create-externalNote')), '外部なしなら詳細を聞かない');
  await page.click('label:has(> input[name="create-external"][value="publicData"])');
  assert(await page.isVisible('#wrap-create-externalNote'), '外部ありなら詳細を聞く');
  const ext = await page.$$eval('input[name="create-external"]:checked', (els) => els.map((e) => e.value));
  assert(JSON.stringify(ext) === '["publicData"]', `「つながない」が外れる: ${ext}`);
  await page.fill('#create-externalNote', '天気予報を表示したい');
  await radio('create', 'personal', 'no');
  await radio('create', 'publish', 'pages');
  await noOverflow('②ステップ3');
  await page.screenshot({ path: join(OUT, '03-create-step3.png'), fullPage: true });
  await next();
  await next();
  await page.waitForURL(/#\/create\/result$/);
});

await check('②新規：GitHub Pages適性・出力先・段階の切り替え', async () => {
  const feas = await page.textContent('.feas-card');
  assert(feas.includes('外部サービスとの連携が必要') && feas.includes('公開情報'), `適性: ${feas.slice(0, 80)}`);
  let t = await promptText();
  assert(t.includes('設計相談') && t.includes('まだコードを書かないで'), '既定は相談用');
  assert(t.includes('天気で和菓子をおすすめ') && t.includes('アイデア名：和菓子天気'), '入力と貼り付けたアイデアが入る');
  await page.click('label[for="purpose-create-1"]');
  t = await promptText();
  assert(t.includes('実装') && !t.includes('まだコードを書かないで'), '実装用に切り替わる');
  await page.click('label[for="target-create-3"]');
  t = await promptText();
  assert(t.includes('AGENTS.md'), 'Codex向けの作業指示');
  assert((await page.textContent('.target-note')).includes('Codex'), '出力先の説明');
  await page.click('label[for="target-create-4"]');
  assert((await promptText()).includes('CLAUDE.md'), 'Claude Code向け');
  await page.click('label[for="target-create-1"]');
  t = await promptText();
  assert(!t.includes('AGENTS.md') && t.includes('ファイルごとに全体'), 'ChatGPT向け');
  assert(await page.isVisible('.notices [data-notice="feasibility"]'), '実装用＋外部ありで注意を表示');
  await noOverflow('②結果');
  await page.screenshot({ path: join(OUT, '04-create-result.png'), fullPage: true });
});

await check('②新規：「修正する」で戻り、変更が反映される', async () => {
  await page.click('.sum-step >> nth=0 >> a:has-text("修正する")');
  await page.waitForURL(/#\/create\/1$/);
  await page.fill('#create-what', '天気と和菓子のアプリ');
  await page.click('.stepper-result a');
  await page.waitForURL(/#\/create\/result$/);
  assert((await promptText()).includes('天気と和菓子のアプリ'), '修正が反映');
  assert(await page.isChecked('#target-create-1'), '出力先の選択が保たれる');
});

await check('②新規：Markdownで保存できる', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.output-card button:has-text("Markdownで保存") >> nth=0')]);
  assert(dl.suggestedFilename().endsWith('.md'), dl.suggestedFilename());
  const text = await readFile(await dl.path(), 'utf8');
  assert(text === (await promptText()), 'ダウンロードした内容が依頼文と一致');
});

await check('入力がHTMLとして実行されない（XSS）', async () => {
  await go('#/create/1');
  const evil = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  await page.fill('#create-what', evil);
  await page.click('.stepper-result a');
  await page.waitForURL(/#\/create\/result$/);
  await page.waitForTimeout(200);
  assert((await promptText()).includes(evil), '文字としてそのまま表示');
  assert(await page.evaluate(() => window.__xss === undefined), 'スクリプトが実行されていない');
  assert(await page.evaluate(() => !document.querySelector('main img, main script')), '要素が作られていない');
  await page.click('.sum-step >> nth=0 >> a:has-text("修正する")');
  await page.fill('#create-what', '天気と和菓子のアプリ');
});

await check('未回答の必須項目があると、依頼文の画面から該当の質問へ戻す', async () => {
  await page.fill('#create-purpose', '');
  await go('#/create/result');
  await page.waitForURL(/#\/create\/1$/);
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => document.activeElement.id === 'create-purpose'), '空の必須項目にフォーカス');
  await page.fill('#create-purpose', '毎朝、季節の和菓子を楽しむきっかけにしたい');
});

// ---------------------------------------------------------------- ③ 直したい

await check('③改修：目的で質問が切り替わり、変更禁止・再現手順が入る', async () => {
  await go('#/fix/1');
  await radio('fix', 'goal', 'add');
  await page.fill('#fix-app', '和菓子アプリ');
  await page.fill('#fix-repoUrl', 'https://github.com/example/wagashi');
  await next();
  assert(await page.isVisible('#fix-addWhat'), '機能追加の質問');
  assert(!(await page.isVisible('#fix-steps')), '不具合の質問は出ない');
  await page.click('.stepper a:has-text("何を直す")');
  await page.waitForTimeout(150);
  await radio('fix', 'goal', 'bug');
  await next();
  assert(await page.isVisible('#fix-steps') && !(await page.isVisible('#fix-addWhat')), '不具合の質問に切り替わる');
  await next();
  const errs = await page.$$eval('#error-summary li', (els) => els.length);
  assert(errs === 4, `不具合の必須は4つ: ${errs}`);
  await page.fill('#fix-symptom', '保存が消える');
  await page.fill('#fix-steps', '開く\n保存を押す\n再読み込み');
  await page.fill('#fix-expected', '残る');
  await page.fill('#fix-actual', '消える');
  await page.fill('#fix-errorText', 'Error 401: key=sk-proj-abcdefghijklmnopqrstuvwx1234');
  await next();
  await radio('fix', 'backup', 'no');
  await page.click('label:has(> input[name="fix-protect"][value="design"])');
  await next();
  await page.waitForURL(/#\/fix\/result$/);
  const t = await promptText();
  for (const s of ['変更してはいけないこと（最重要）', '### 再現手順', '1. 開く', '### 期待する結果', '### 実際の結果', '今回の依頼で変える部分以外のデザイン', '推測で進めず']) assert(t.includes(s), `含まれない: ${s}`);
  assert(await page.isChecked('#purpose-fix-1'), '改修は既定で実装・改修用');
  assert(!t.includes('sk-proj-abcdefg'), 'APIキーは伏せ字');
  assert(await page.isVisible('.notice-danger[data-notice="secrets"]'), '秘密情報の警告');
  assert(await page.isVisible('[data-notice="noGuarantee"]'), '破損を保証しない旨');
  assert(await page.isVisible('[data-notice="backup"]'), '保存の注意');
  await page.waitForTimeout(400);
  const stored = await page.evaluate(() => localStorage.getItem('dev-ai-prompt-workshop:draft:v1'));
  assert(stored && !stored.includes('sk-proj-abcdefg') && stored.includes('保存が消える'), '保存データでも伏せ字');
  await page.click('[data-notice="secrets"] button');
  assert(!(await page.isVisible('.notice-danger[data-notice="secrets"]')), '入力欄から消すと警告が消える');
  await noOverflow('③結果');
  await page.screenshot({ path: join(OUT, '05-fix-result.png'), fullPage: true });
});

// ---------------------------------------------------------------- 保存・読み込み

await check('再読み込みしても入力が残る／自動保存オフで消える', async () => {
  await page.reload();
  await page.waitForSelector('#prompt-view');
  assert((await promptText()).includes('保存が消える'), '再読み込み後も残る');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("ファイルに書き出す")')]);
  const json = await readFile(await dl.path(), 'utf8');
  assert(JSON.parse(json).modes.fix.symptom === '保存が消える', 'JSONに書き出せる');
  await page.uncheck('#autosave');
  assert(await page.evaluate(() => localStorage.getItem('dev-ai-prompt-workshop:draft:v1') === null), 'オフで保存データを消す');
  await page.reload();
  await page.waitForSelector('#page-title');
  await page.waitForURL(/#\/fix\/1$/);
  assert((await page.inputValue('#fix-app')) === '', '保存しないので消えている');
  await page.click('a:has-text("保存の設定")');
  await page.waitForSelector('#import-file', { state: 'attached' });
  await page.setInputFiles('#import-file', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.waitForTimeout(300);
  await go('#/fix/result');
  assert((await promptText()).includes('保存が消える'), 'JSONから読み込める');
  await page.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') });
  await page.waitForTimeout(200);
  assert((await page.textContent('#toast')).includes('この工房で書き出したファイルではない'), '不正なファイルは拒否');
  await page.check('#autosave');
});

await check('ユニットテストと同じ依頼文が画面に出る', async () => {
  const v = minimalValues('create');
  await page.evaluate((data) => {
    localStorage.setItem('dev-ai-prompt-workshop:draft:v1', JSON.stringify({ app: 'dev-ai-prompt-workshop', format: 1, modes: { create: data }, outputs: { create: { target: 'claudecode', purpose: 'implement' } } }));
  }, v);
  await page.reload();
  await go('#/create/result');
  assert((await promptText()) === buildPrompt('create', v, { target: 'claudecode', purpose: 'implement' }), '一致');
});

// ---------------------------------------------------------------- 表示幅・その他

await check('狭い画面（320px）・パソコン幅でも横にはみ出さない', async () => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const hash of ['#/', '#/idea/1', '#/create/3', '#/create/result', '#/fix/2', '#/fix/result', '#/about', '#/glossary']) {
      await go(hash);
      await noOverflow(`${width}px ${hash}`);
    }
  }
  await page.screenshot({ path: join(OUT, '06-pc-fix-result.png'), fullPage: true });
  await page.setViewportSize(iphone.viewport);
});

await check('外部への通信がなく、エラーも出ていない', async () => {
  assert(external.length === 0, `外部通信: ${external.join(', ')}`);
  assert(pageErrors.length === 0, `エラー: ${pageErrors.join(' / ')}`);
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
