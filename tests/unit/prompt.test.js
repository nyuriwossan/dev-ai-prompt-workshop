import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMode } from '../../src/data/modes.js';
import {
  buildPrompt, buildNotices, buildChecklist, buildSummary, defaultPurpose,
} from '../../src/prompts/build.js';
import { codeBlock } from '../../src/prompts/md.js';
import { representativeCases, minimalValues, fixGoalValues, TARGET_VALUES } from '../helpers.js';

/** 本文のない見出し（次の見出しが同じか上のレベル）を探す */
function emptyHeading(text) {
  const heads = [...text.matchAll(/^(#{1,6}) (.*)\n\n(#{1,6}) /gm)];
  const bad = heads.find((m) => m[3].length <= m[1].length);
  if (bad) return bad[2];
  return /^#{1,6} .*\n*$/.test(text.split('\n').slice(-2).join('\n')) ? 'last' : null;
}

const all = [];
for (const c of representativeCases()) {
  for (const target of TARGET_VALUES) {
    for (const purpose of getMode(c.mode).purposes) {
      all.push({ ...c, target, purpose, key: `${c.name}/${target}/${purpose}`, text: buildPrompt(c.mode, c.values, { target, purpose }) });
    }
  }
}

test('どの組み合わせでも、不自然な文字列や空の見出しが出ない', () => {
  for (const p of all) {
    assert.doesNotMatch(p.text, /undefined|null|\[object |NaN/, p.key);
    assert.equal(emptyHeading(p.text), null, `${p.key}: 中身のない見出し`);
    assert.doesNotMatch(p.text, /\n{3,}/, `${p.key}: 空行が続きすぎ`);
    if (p.mode !== 'idea') assert.doesNotMatch(p.text, /：\s*$/m, `${p.key}: 値の空いた項目`); // アイデアの引き継ぎ形式は意図的に空欄
    assert.match(p.text, /^# 依頼：/, p.key);
    assert.ok(p.text.length < 12000, `${p.key}: 長すぎる (${p.text.length})`);
  }
});

test('依頼文のスナップショット（意図しない文言の変化を検出）', () => {
  const snap = JSON.parse(readFileSync(new URL('../fixtures/prompts.json', import.meta.url), 'utf8'));
  for (const p of all) assert.equal(p.text, snap[p.key], `${p.key} が変わりました。意図した変更なら node tests/update-fixtures.mjs を実行してください`);
  assert.equal(Object.keys(snap).length, all.length);
});

test('入力した内容が依頼文に正確に入る（日本語・記号・HTMLらしき文字列もそのまま）', () => {
  const tricky = '「推し」の<b>誕生日</b> & 記念日 ✨ `code` ＃見出し？';
  const v = minimalValues('create', { what: tricky, purpose: '朝に確認\n2行目もある', must: '・登録できる\n- 一覧が見られる' });
  const t = buildPrompt('create', v, { target: 'common', purpose: 'consult' });
  assert.ok(t.includes(tricky));
  assert.ok(t.includes('> 朝に確認\n> 2行目もある'));
  assert.ok(t.includes('1. 登録できる\n2. 一覧が見られる'));
});

test('アイデア：コードを書かせず、比較・GitHub Pages区別・簡易版・引き継ぎ形式を求める', () => {
  const t = buildPrompt('idea', minimalValues('idea', { count: '10', interests: '猫' }), { target: 'chatgpt' });
  for (const s of ['まだコードは書かず', 'アイデアを10個', '魅力', '主な機能', '実現の難しさ', '初心者がAIの助けを借りて作れそうか', 'GitHub Pagesだけで作れる', '外部サービスとの連携が必要', '簡易版', '比較表', 'ありきたりなToDoアプリや家計簿だけに偏らず', 'まとめ直してください', '猫']) {
    assert.ok(t.includes(s), s);
  }
  assert.match(buildPrompt('idea', minimalValues('idea'), { target: 'codex' }), /ファイルの作成・変更やコマンドの実行は不要/);
});

test('新規作成：相談用と実装用を区別する', () => {
  const v = minimalValues('create');
  const consult = buildPrompt('create', v, { target: 'common', purpose: 'consult' });
  const impl = buildPrompt('create', v, { target: 'common', purpose: 'implement' });
  assert.match(consult, /まだコードを書かないでください/);
  assert.match(consult, /最大5つまで質問/);
  assert.match(consult, /実装用の要件まとめ/);
  assert.doesNotMatch(impl, /まだコードを書かないで/);
  assert.match(impl, /次の要件で、Webアプリを作ってください/);
  assert.match(impl, /## 完成条件/);
  assert.match(impl, /## 完了時の報告/);
  assert.match(impl, /XSS対策/);
});

test('新規作成：利用者の言葉をAI向けの文に変換する', () => {
  const t = buildPrompt('create', minimalValues('create', { device: 'sp', users: 'self', storage: 'local' }), { target: 'common', purpose: 'consult' });
  assert.match(t, /スマートフォンでの利用を主目的とします/);
  assert.match(t, /利用者は本人のみです/);
  assert.match(t, /入力内容を端末内（ブラウザ）に保存し、ページの再読み込みやブラウザの再起動後も残せる構成を検討してください/);
});

test('新規作成：未確定の項目は勝手に補わず、質問させる', () => {
  const v = minimalValues('create', { login: 'unknown', storage: 'unknown' });
  for (const purpose of ['consult', 'implement']) {
    const t = buildPrompt('create', v, { target: 'common', purpose });
    assert.match(t, /未確定（私にも分からない）：データを保存・共有するか、ログインが必要か/);
    assert.match(t, /重要な仕様を勝手に補わないでください/);
    assert.match(t, purpose === 'implement' ? /作業を始める前に選択肢と違いを示して質問/ : /質問してください/);
  }
});

test('新規作成：完成条件が空なら、実装用では目安を入れ、相談用では案を求める', () => {
  const v = minimalValues('create', { storage: 'local' });
  assert.match(buildPrompt('create', v, { purpose: 'consult' }), /完成条件はまだ決めていません/);
  const impl = buildPrompt('create', v, { purpose: 'implement' });
  assert.match(impl, /ページを再読み込みしても、保存した内容が残っている/);
  assert.match(impl, /上は目安です/);
  const withDone = buildPrompt('create', minimalValues('create', { done: '3人登録できる' }), { purpose: 'implement' });
  assert.match(withDone, /## 完成条件\n\n- 3人登録できる/);
});

test('出力先：チャット向けとエージェント向けで作業指示が変わる', () => {
  const v = minimalValues('create');
  const chat = buildPrompt('create', v, { target: 'chatgpt', purpose: 'implement' });
  const codex = buildPrompt('create', v, { target: 'codex', purpose: 'implement' });
  const cc = buildPrompt('create', v, { target: 'claudecode', purpose: 'implement' });
  assert.match(chat, /ファイルごとに全体を示してください/);
  assert.doesNotMatch(chat, /AGENTS\.md|git diff/);
  assert.match(codex, /AGENTS\.md など作業ルール/);
  assert.match(codex, /README/);
  assert.match(cc, /CLAUDE\.md や AGENTS\.md/);
  assert.equal(buildPrompt('create', v, { target: 'chatgpt', purpose: 'consult' }), buildPrompt('create', v, { target: 'claude', purpose: 'consult' }), 'ChatGPTとClaudeは同じ組み立て');
});

test('改修：すべての目的・出力先・段階で、変更禁止と最小変更を指示する', () => {
  for (const p of all.filter((x) => x.mode === 'fix')) {
    assert.match(p.text, /## 変更してはいけないこと（最重要）/, p.key);
    assert.match(p.text, /変更は必要最小限/, p.key);
    assert.match(p.text, /関係のない部分を壊さない/, p.key);
    assert.match(p.text, /## 元に戻せるようにすること/, p.key);
    if (p.purpose === 'implement' && p.values.goal !== 'publish') {
      assert.match(p.text, /既存の機能/, p.key);
      assert.match(p.text, /## 完了時の報告/, p.key);
      assert.match(p.text, /未実施/, p.key);
    }
  }
});

test('改修：変更禁止の選択と自由記述が入る', () => {
  const v = fixGoalValues('add');
  v.protect = ['data', 'url'];
  v.protectNote = 'ガチャ履歴';
  const t = buildPrompt('fix', v, { target: 'codex', purpose: 'implement' });
  assert.match(t, /保存されているデータと保存の形式/);
  assert.match(t, /公開URL・ファイル名・フォルダ構成/);
  assert.match(t, /- ガチャ履歴/);
  assert.match(t, /git diff/);
  assert.match(t, /回帰/);
});

test('不具合修正：再現手順・期待結果・実際の結果・エラーを含む', () => {
  const v = fixGoalValues('bug');
  v.errorText = 'TypeError: x is null\n    at app.js:10';
  for (const target of TARGET_VALUES) {
    const t = buildPrompt('fix', v, { target, purpose: 'implement' });
    assert.match(t, /### 再現手順\n\n1\. 開く\n2\. 保存/);
    assert.match(t, /### 期待する結果\n\n> 残る/);
    assert.match(t, /### 実際の結果\n\n> 消える/);
    assert.match(t, /```text\nTypeError: x is null\n {4}at app\.js:10\n```/);
    assert.match(t, /原因を特定してから修正/);
  }
  const consult = buildPrompt('fix', v, { target: 'common', purpose: 'consult' });
  assert.match(consult, /原因の候補/);
  assert.match(consult, /まだコードを書き換えないでください/);
});

test('改修：URLだけでは参照できない場合に、ファイルを求める指示を入れる', () => {
  const v = { ...fixGoalValues('change'), repoUrl: 'https://github.com/example/app' };
  const t = buildPrompt('fix', v, { target: 'chatgpt', purpose: 'implement' });
  assert.match(t, /直接確認できない場合は、推測で進めず、確認に必要なファイル/);
  const agent = buildPrompt('fix', v, { target: 'claudecode', purpose: 'implement' });
  assert.match(agent, /上のリポジトリと違う場合/);
  const noUrl = buildPrompt('fix', fixGoalValues('change'), { target: 'claude', purpose: 'implement' });
  assert.match(noUrl, /コードはまだ貼り付けていません/);
});

test('改修：公開の相談ではGitHub Pagesの確認観点を出す', () => {
  const t = buildPrompt('fix', fixGoalValues('publish'), { target: 'common', purpose: 'consult' });
  assert.match(t, /キャッシュ/);
  assert.match(t, /見つからない場合の探し方/);
});

test('エラー文にバッククォートがあってもコードブロックが閉じる', () => {
  const lines = codeBlock('a ``` b\n````');
  assert.equal(lines[0], '`````text');
  assert.equal(lines.at(-1), '`````');
});

test('秘密情報は依頼文に入らず、画面で警告する', () => {
  const v = fixGoalValues('bug');
  v.errorText = 'Error: 401 with key sk-proj-abcdefghijklmnopqrstuvwx1234';
  const t = buildPrompt('fix', v, { target: 'common', purpose: 'implement' });
  assert.doesNotMatch(t, /sk-proj-abcdefg/);
  assert.match(t, /秘密情報のため削除/);
  const n = buildNotices('fix', v, { target: 'common', purpose: 'implement' });
  assert.equal(n[0].id, 'secrets');
  assert.equal(n[0].kind, 'danger');
});

test('どの出力も、ブラウザのコードに秘密情報を置く構成を提案させない', () => {
  for (const p of all.filter((x) => x.mode !== 'idea')) assert.match(p.text, /秘密情報を、(HTMLやJavaScriptなどブラウザで動く)?コードに書き込/, p.key);
});

test('注意事項：状況に応じて表示が変わる', () => {
  const ids = (mode, v, o) => buildNotices(mode, v, o).map((n) => n.id);
  assert.deepEqual(ids('create', minimalValues('create'), { purpose: 'implement' }), []);
  assert.deepEqual(ids('create', minimalValues('create', { login: 'unknown', external: ['ai'] }), { purpose: 'implement' }), ['undecided', 'feasibility']);
  assert.deepEqual(ids('create', minimalValues('create', { login: 'unknown' }), { purpose: 'consult' }), []);
  assert.ok(ids('fix', fixGoalValues('add'), {}).includes('noGuarantee'));
  assert.ok(ids('fix', fixGoalValues('add'), {}).includes('backup'));
  assert.ok(!ids('fix', minimalValues('fix'), {}).includes('backup'));
  assert.ok(ids('fix', { ...minimalValues('fix'), siteUrl: 'https://a.github.io/b/' }, { target: 'chatgpt' }).includes('url'));
  assert.ok(!ids('fix', { ...minimalValues('fix'), siteUrl: 'https://a.github.io/b/' }, { target: 'codex' }).includes('url'));
});

test('チェックリストとまとめ', () => {
  const c = buildChecklist('create', minimalValues('create', { storage: 'local', done: '3人登録できる' }));
  assert.ok(c.includes('ページを再読み込みしても、入力した内容が残っている'));
  assert.ok(c.includes('3人登録できる'));
  assert.ok(c.some((x) => x.includes('入力した文字を表示する')));
  const f = buildChecklist('fix', minimalValues('fix'));
  assert.ok(f[0].includes('再現手順'));
  assert.ok(f.includes('前から保存していたデータが消えず、読み込める'));
  const s = buildSummary('create', minimalValues('create'));
  assert.equal(s.length, 4);
  assert.ok(s[0].items.some((i) => i.text === 'テスト用ツール'));
  assert.ok(!s[2].items.some((i) => i.id === 'shareWho'));
});

test('既定の段階：新規は相談、改修は実装（公開の相談だけ相談）', () => {
  assert.equal(defaultPurpose('create', {}), 'consult');
  assert.equal(defaultPurpose('fix', { goal: 'bug' }), 'implement');
  assert.equal(defaultPurpose('fix', { goal: 'publish' }), 'consult');
});
