import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, getMode, allFields, duplicateFieldIds } from '../../src/data/modes.js';
import { EXAMPLES } from '../../src/data/examples.js';
import {
  getDefaults, validateStep, validateAll, toLines, applyExclusive, effectiveValues, isVisible, hasUserInput,
} from '../../src/logic/form.js';
import { assessFeasibility, feasibilityPromptLines } from '../../src/logic/feasibility.js';
import { detectSecrets, maskSecrets, scanPersonal } from '../../src/logic/secrets.js';
import { parseData, parseImportText, sanitizeModeValues, serialize } from '../../src/logic/persist.js';
import { minimalValues, fixGoalValues } from '../helpers.js';

test('フォーム定義：項目IDの重複がなく、選択肢が揃っている', () => {
  for (const m of MODES) {
    assert.deepEqual(duplicateFieldIds(m), [], m.id);
    for (const f of allFields(m)) {
      assert.ok(f.label, `${m.id}.${f.id} label`);
      if (f.type === 'radio' || f.type === 'checks') {
        assert.ok(f.options?.length >= 2, `${m.id}.${f.id} options`);
        const vals = f.options.map((o) => o.value);
        assert.equal(new Set(vals).size, vals.length, `${m.id}.${f.id} 選択肢の重複`);
        if (f.default !== undefined) {
          for (const d of [].concat(f.default)) assert.ok(vals.includes(d), `${m.id}.${f.id} default ${d}`);
        }
      }
    }
  }
});

test('入力例はすべて定義どおりの値で、必須項目を満たす', () => {
  for (const m of MODES) {
    for (const ex of EXAMPLES[m.id]) {
      const v = { ...getDefaults(m), ...ex.values };
      for (const k of Object.keys(ex.values)) assert.ok(allFields(m).some((f) => f.id === k), `${m.id}: 未定義の項目 ${k}`);
      assert.deepEqual(sanitizeModeValues(m, v), v, `${m.id}/${ex.label}`);
      assert.deepEqual(validateAll(m, v).map((e) => e.field.id), [], `${m.id}/${ex.label}`);
    }
  }
});

test('必須判定：空だとエラー、非表示の項目は必須にしない', () => {
  const create = getMode('create');
  const errs = validateAll(create, getDefaults(create)).map((e) => e.field.id);
  for (const id of ['what', 'purpose', 'users', 'must', 'device', 'storage', 'login', 'personal', 'publish']) assert.ok(errs.includes(id), id);
  assert.ok(!errs.includes('shareWho'), '共有を選んでいないので shareWho は不要');
  const v = minimalValues('create', { storage: 'share' });
  assert.deepEqual(validateAll(create, v).map((e) => e.field.id), ['shareWho']);
  assert.deepEqual(validateAll(create, minimalValues('create')), []);
});

test('改修モード：目的ごとに必要な質問が切り替わる', () => {
  const fix = getMode('fix');
  const step2 = fix.steps[1];
  const req = (goal) => validateStep(step2, { ...getDefaults(fix), goal }).map((e) => e.field.id);
  assert.deepEqual(req('bug'), ['symptom', 'steps', 'expected', 'actual']);
  assert.deepEqual(req('add'), ['addWhat', 'after']);
  assert.deepEqual(req('change'), ['target', 'current', 'after']);
  assert.deepEqual(req('design'), ['target', 'after']);
  assert.deepEqual(req('publish'), ['pubGoal']);
  assert.deepEqual(validateStep(step2, { ...getDefaults(fix), goal: 'publish', pubGoal: 'broken' }).map((e) => e.field.id), ['pubDetail']);
  // 不具合用の項目は、機能追加のときには表示しない
  const steps = allFields(fix).find((f) => f.id === 'steps');
  assert.equal(isVisible(steps, { goal: 'add' }), false);
  for (const g of ['add', 'change', 'design', 'bug', 'publish']) assert.deepEqual(validateAll(fix, fixGoalValues(g)), [], g);
});

test('非表示の項目の値は依頼文に使わない（ただし state には残す）', () => {
  const create = getMode('create');
  const v = minimalValues('create', { storage: 'local', backup: 'yes' });
  v.storage = 'none';
  const eff = effectiveValues(create, v);
  assert.equal(eff.backup, '');
  assert.equal(v.backup, 'yes');
});

test('1行1項目：先頭の記号・番号を取り除く', () => {
  assert.deepEqual(toLines('・りんご\n- みかん\n\n1. ぶどう\n①もも\n  （2）なし  '), ['りんご', 'みかん', 'ぶどう', 'もも', 'なし']);
  assert.deepEqual(toLines(''), []);
});

test('「なし」「分からない」は他の選択肢と同時に選べない', () => {
  const f = allFields(getMode('create')).find((x) => x.id === 'external');
  assert.deepEqual(applyExclusive(f, ['none'], 'ai', true), ['ai']);
  assert.deepEqual(applyExclusive(f, ['ai', 'notify'], 'unknown', true), ['unknown']);
  assert.deepEqual(applyExclusive(f, ['ai'], 'payment', true), ['ai', 'payment']);
  assert.deepEqual(applyExclusive(f, ['ai', 'payment'], 'ai', false), ['payment']);
});

test('hasUserInput：初期値のままなら false', () => {
  for (const m of MODES) assert.equal(hasUserInput(m, getDefaults(m)), false, m.id);
  assert.equal(hasUserInput(getMode('idea'), { ...getDefaults(getMode('idea')), interests: '猫' }), true);
});

// ---------------------------------------------------------------- GitHub Pages 適性

const feas = (extra) => assessFeasibility(effectiveValues(getMode('create'), minimalValues('create', extra)));

test('適性：自分だけ・端末内保存・ログインなし・外部なし → 静的', () => {
  const r = feas({ storage: 'local', backup: 'yes' });
  assert.equal(r.level, 'static');
  assert.deepEqual(r.missing, []);
  const lines = feasibilityPromptLines(r).join('\n');
  assert.match(lines, /静的Webアプリ/);
  assert.match(lines, /不要なサーバー・データベース・フレームワークは追加しない/);
});

test('適性：ログイン・同期・AI・通知 → 外部サービス', () => {
  assert.equal(feas({ login: 'yes' }).level, 'external');
  assert.equal(feas({ storage: 'share', shareWho: 'myDevices' }).level, 'external');
  assert.equal(feas({ storage: 'share', shareWho: 'group', shareEdit: 'readOnly' }).level, 'external');
  assert.equal(feas({ external: ['notify'] }).level, 'external');
  const ai = feas({ external: ['ai'] });
  assert.equal(ai.level, 'external');
  assert.match(feasibilityPromptLines(ai).join('\n'), /APIキーをHTMLやJavaScriptに書き込む構成は絶対に提案しないでください/);
});

test('適性：決済・個人情報・不特定多数の投稿・同時編集・アカウント連携 → 追加の検討', () => {
  assert.equal(feas({ external: ['payment'] }).level, 'review');
  assert.equal(feas({ personal: 'yes' }).level, 'review');
  assert.equal(feas({ storage: 'share', shareWho: 'public' }).level, 'review');
  assert.equal(feas({ storage: 'share', shareWho: 'group', shareEdit: 'yes' }).level, 'review');
  assert.equal(feas({ external: ['account'] }).level, 'review');
});

test('適性：分からない項目は「情報不足」として列挙する', () => {
  const r = feas({ storage: 'unknown', login: 'unknown', external: ['unknown'], personal: 'unknown', publish: 'ai' });
  assert.deepEqual(r.missing, ['データを保存・共有するかどうか', 'ログインが必要かどうか', '外部のサービスとつなぐかどうか', '個人情報を扱うかどうか', 'どこで公開するか']);
  assert.equal(r.level, 'static', '分かっている範囲では静的');
});

test('適性：公開先による注記', () => {
  assert.match(feas({ publish: 'localOnly' }).publishNote, /1つのHTMLファイル/);
  assert.match(feas({ publish: 'other' }).publishNote, /GitHub Pages以外/);
});

// ---------------------------------------------------------------- 秘密情報

test('秘密情報：代表的なキーを検出し、伏せ字にする', () => {
  const samples = [
    'sk-proj-abcdefghijklmnopqrstuvwx1234',
    'sk-ant-api03-abcdefghijklmnopqrstu',
    'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
    'AIzaSyA1234567890abcdefghijklmnopqrstuv',
    'AKIAIOSFODNN7EXAMPLE',
    'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdefg',
    'password: hunter22',
    'APIキー＝abcd1234efgh',
    '-----BEGIN PRIVATE KEY-----\nMIIEv\n-----END PRIVATE KEY-----',
  ];
  for (const s of samples) {
    assert.ok(detectSecrets(s).length, s);
    const masked = maskSecrets(`前 ${s} 後`);
    assert.match(masked, /秘密情報のため削除/, s);
    assert.ok(masked.startsWith('前 ') && masked.endsWith(' 後'), masked);
  }
});

test('秘密情報：ふつうのエラー文や文章は伏せない', () => {
  for (const s of ['Uncaught TypeError: Cannot read properties of null', 'token: undefined', 'パスワード：必要', 'localStorage に保存する', 'task-list の sk-button']) {
    assert.deepEqual(detectSecrets(s), [], s);
    assert.equal(maskSecrets(s), s);
  }
});

test('個人情報らしき文字列の警告', () => {
  assert.deepEqual(scanPersonal({ a: '連絡は taro@example.com まで' }), ['メールアドレス']);
  assert.deepEqual(scanPersonal({ a: '090-1234-5678' }), ['電話番号']);
  assert.deepEqual(scanPersonal({ a: '推しの誕生日 2024-01-01' }), []);
});

// ---------------------------------------------------------------- 保存・読み込み

test('JSON：書き出し→読み込みで元に戻り、秘密情報は伏せ字になる', () => {
  const values = { create: minimalValues('create', { notes: 'key: sk-proj-abcdefghijklmnopqrstuvwx1234' }), idea: minimalValues('idea') };
  const data = serialize(values, { create: { target: 'codex', purpose: 'implement' } });
  assert.equal(data.app, 'dev-ai-prompt-workshop');
  assert.doesNotMatch(JSON.stringify(data), /sk-proj-/);
  const res = parseImportText(JSON.stringify(data));
  assert.equal(res.ok, true);
  assert.equal(res.modes.create.what, 'テスト用ツール');
  assert.match(res.modes.create.notes, /秘密情報のため削除/);
  assert.deepEqual(res.outputs.create, { target: 'codex', purpose: 'implement' });
});

test('JSON：不正な内容は受け入れない・定義外の値は捨てる', () => {
  assert.equal(parseImportText('not json').ok, false);
  assert.equal(parseImportText('[]').ok, false);
  assert.equal(parseData({ app: 'other', format: 1, modes: {} }).ok, false);
  assert.equal(parseData({ app: 'dev-ai-prompt-workshop', format: 99, modes: { idea: {} } }).ok, false);
  assert.equal(parseImportText('x'.repeat(210 * 1024)).ok, false);
  const res = parseData({
    app: 'dev-ai-prompt-workshop', format: 1,
    modes: { create: { what: 'a'.repeat(500), users: 'hacker', external: ['ai', 'none', 'evil'], login: 1, __proto__x: 'x', unknownKey: 'x' } },
    outputs: { create: { target: 'evil', purpose: 'implement' }, idea: { purpose: 'implement' } },
  });
  assert.equal(res.ok, true);
  const c = res.modes.create;
  assert.equal(c.what.length, 120);
  assert.equal(c.users, '');
  assert.deepEqual(c.external, ['none'], '排他の選択肢が混ざったら排他側だけ残す');
  assert.equal(c.login, '');
  assert.equal('unknownKey' in c, false);
  assert.deepEqual(res.outputs, { create: { purpose: 'implement' } });
});
