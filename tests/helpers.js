// テスト共通：代表的な入力パターン
import { MODES, getMode } from '../src/data/modes.js';
import { getDefaults } from '../src/logic/form.js';
import { EXAMPLES } from '../src/data/examples.js';

export const TARGET_VALUES = ['common', 'chatgpt', 'claude', 'codex', 'claudecode'];

/** 必須項目だけを埋めた入力 */
export function minimalValues(modeId, extra = {}) {
  const mode = getMode(modeId);
  const base = getDefaults(mode);
  const req = {
    idea: { genres: ['any'] },
    create: { what: 'テスト用ツール', purpose: '動作確認のため', users: 'self', must: '入力した文字を表示する', device: 'sp', storage: 'none', login: 'no', personal: 'no', publish: 'pages' },
    fix: { goal: 'bug', app: 'テストアプリ', symptom: 'ボタンが反応しない', steps: '開く\nボタンを押す', expected: 'メッセージが出る', actual: '何も起きない', backup: 'git' },
  }[modeId];
  return { ...base, ...req, ...extra };
}

export function fixGoalValues(goal) {
  const common = { app: 'テストアプリ', backup: 'unknown' };
  const per = {
    add: { addWhat: '並べ替えボタン', after: '近い順に並ぶ' },
    change: { target: '保存ボタン', current: '押すと保存', after: '押すと確認してから保存' },
    design: { target: 'トップの色', after: '水色にしたい' },
    bug: { symptom: '消える', steps: '開く\n保存', expected: '残る', actual: '消える' },
    publish: { pubGoal: 'notUpdated', pubWhere: 'pages' },
  }[goal];
  return minimalValues('fix', { goal, ...common, ...per, symptom: per.symptom || '', steps: per.steps || '', expected: per.expected || '', actual: per.actual || '' });
}

/** 代表パターン一覧 [{ name, mode, values }] */
export function representativeCases() {
  const cases = [];
  for (const m of MODES) {
    cases.push({ name: `${m.id}-minimal`, mode: m.id, values: minimalValues(m.id) });
    (EXAMPLES[m.id] || []).forEach((ex, i) => cases.push({ name: `${m.id}-example${i + 1}`, mode: m.id, values: { ...getDefaults(m), ...ex.values } }));
  }
  for (const g of ['add', 'change', 'design', 'bug', 'publish']) cases.push({ name: `fix-goal-${g}`, mode: 'fix', values: fixGoalValues(g) });
  cases.push({
    name: 'create-external-all', mode: 'create',
    values: minimalValues('create', { external: ['ai', 'publicData', 'account', 'notify', 'payment'], externalNote: '天気とAI', login: 'yes', storage: 'share', shareWho: 'public', shareEdit: 'yes', personal: 'yes', publish: 'other', publishOther: '自分のサーバー' }),
  });
  cases.push({
    name: 'create-unknowns', mode: 'create',
    values: minimalValues('create', { users: 'unknown', storage: 'unknown', login: 'unknown', external: ['unknown'], personal: 'unknown', publish: 'ai' }),
  });
  return cases;
}
