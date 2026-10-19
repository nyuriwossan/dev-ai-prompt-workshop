// フォームの値の扱い（DOMに依存しない）：初期値・表示条件・必須判定・検証・整形。

import { allFields } from '../data/modes.js';

export function getDefaults(mode) {
  const v = {};
  for (const f of allFields(mode)) {
    if (f.default !== undefined) v[f.id] = Array.isArray(f.default) ? [...f.default] : f.default;
    else if (f.type === 'checks') v[f.id] = [];
    else if (f.type === 'check') v[f.id] = false;
    else v[f.id] = '';
  }
  return v;
}

export function isVisible(f, values) {
  return typeof f.when === 'function' ? Boolean(f.when(values)) : true;
}

export function isRequired(f, values) {
  return typeof f.required === 'function' ? Boolean(f.required(values)) : Boolean(f.required);
}

export function isEmptyValue(f, val) {
  if (f.type === 'checks') return !Array.isArray(val) || val.length === 0;
  if (f.type === 'check') return !val;
  return typeof val !== 'string' || val.trim() === '';
}

/** 表示中の項目だけ */
export function visibleFields(step, values) {
  return step.fields.filter((f) => isVisible(f, values));
}

/** ステップの検証。戻り値は [{ field, message }] */
export function validateStep(step, values) {
  const errors = [];
  for (const f of visibleFields(step, values)) {
    if (isRequired(f, values) && isEmptyValue(f, values[f.id])) {
      const msg = f.type === 'radio' || f.type === 'checks' ? 'どれか1つを選んでください。' : '入力してください。';
      errors.push({ field: f, step, message: msg });
    }
  }
  return errors;
}

export function validateAll(mode, values) {
  return mode.steps.flatMap((s) => validateStep(s, values));
}

/** 1行1項目の入力を配列にする。先頭の「・」「-」「1.」などは取り除く */
export function toLines(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*・•●○◯□■✓✔]|\d{1,2}[.)．、]|[（(]\d{1,2}[)）]|[①-⑳])\s*/, '').trim())
    .filter(Boolean);
}

/**
 * 依頼文に使う値：非表示の項目は空に、文字列は前後の空白を取る。
 * （非表示の値は消さずに state に残しておき、条件を戻したときに復元できるようにする）
 */
export function effectiveValues(mode, values) {
  const out = {};
  for (const f of allFields(mode)) {
    const raw = values[f.id];
    if (!isVisible(f, values)) {
      out[f.id] = f.type === 'checks' ? [] : f.type === 'check' ? false : '';
      continue;
    }
    if (f.type === 'checks') out[f.id] = Array.isArray(raw) ? raw.slice() : [];
    else if (f.type === 'check') out[f.id] = Boolean(raw);
    else out[f.id] = typeof raw === 'string' ? raw.trim() : '';
  }
  return out;
}

/** 入力が1つでもあるか（初期値のままなら false） */
export function hasUserInput(mode, values) {
  const d = getDefaults(mode);
  return allFields(mode).some((f) => JSON.stringify(values[f.id] ?? d[f.id]) !== JSON.stringify(d[f.id]));
}

/** 選択肢の「同時に選べない」処理 */
export function applyExclusive(f, current, changedValue, checked) {
  const opts = f.options || [];
  const exclusive = new Set(opts.filter((o) => o.exclusive).map((o) => o.value));
  let set = new Set(current || []);
  if (checked) {
    if (exclusive.has(changedValue)) set = new Set([changedValue]);
    else {
      for (const x of exclusive) set.delete(x);
      set.add(changedValue);
    }
  } else set.delete(changedValue);
  return opts.map((o) => o.value).filter((v) => set.has(v));
}
