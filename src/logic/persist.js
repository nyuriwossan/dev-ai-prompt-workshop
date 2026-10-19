// 入力内容の保存（この端末のブラウザ内のみ）と、JSONファイルへの書き出し・読み込み。
// - 外部へは送らない。
// - 保存・書き出しの前に、秘密情報らしき文字列は伏せ字にする。
// - 読み込むJSONは、定義にある項目・型・選択肢・文字数だけを受け入れる。

import { MODES, getMode, allFields } from '../data/modes.js';
import { APP_ID } from '../data/options.js';
import { getDefaults } from './form.js';
import { maskValues } from './secrets.js';

export const STORAGE_KEY = `${APP_ID}:draft:v1`;
export const PREF_KEY = `${APP_ID}:autosave`;
export const MAX_IMPORT_BYTES = 200 * 1024;
export const FORMAT_VERSION = 1;

function storage() {
  try {
    const s = window.localStorage;
    const k = `${APP_ID}:probe`;
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch (_) {
    return null;
  }
}

export function storageAvailable() {
  return Boolean(storage());
}

export function getAutosave() {
  const s = storage();
  if (!s) return false;
  try { return s.getItem(PREF_KEY) !== 'off'; } catch (_) { return false; }
}

export function setAutosave(on) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PREF_KEY, on ? 'on' : 'off');
    if (!on) s.removeItem(STORAGE_KEY);
  } catch (_) { /* noop */ }
}

/** state.values → 保存用オブジェクト */
export function serialize(valuesByMode, outputs) {
  const modes = {};
  for (const m of MODES) {
    if (valuesByMode[m.id]) modes[m.id] = maskValues(sanitizeModeValues(m, valuesByMode[m.id]));
  }
  return {
    app: APP_ID,
    format: FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    modes,
    outputs: sanitizeOutputs(outputs),
  };
}

export function saveDraft(valuesByMode, outputs) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(serialize(valuesByMode, outputs)));
    return true;
  } catch (_) {
    return false;
  }
}

export function loadDraft() {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseData(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

export function clearDraft() {
  const s = storage();
  if (!s) return;
  try { s.removeItem(STORAGE_KEY); } catch (_) { /* noop */ }
}

/** 1モード分の値を、定義に沿って安全な形に整える */
export function sanitizeModeValues(mode, input) {
  const out = getDefaults(mode);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const f of allFields(mode)) {
    if (!Object.prototype.hasOwnProperty.call(input, f.id)) continue;
    const val = input[f.id];
    const allowed = f.options ? new Set(f.options.map((o) => o.value)) : null;
    if (f.type === 'text' || f.type === 'textarea') {
      if (typeof val === 'string') out[f.id] = val.slice(0, f.max || 2000);
    } else if (f.type === 'radio') {
      if (typeof val === 'string' && (val === '' || allowed.has(val))) out[f.id] = val;
    } else if (f.type === 'checks') {
      if (Array.isArray(val)) {
        const picked = [...new Set(val.filter((x) => typeof x === 'string' && allowed.has(x)))];
        // 「なし」「分からない」は他と同時に選べない
        const ex = f.options.filter((o) => o.exclusive).map((o) => o.value);
        const hasEx = picked.find((x) => ex.includes(x));
        out[f.id] = hasEx ? [hasEx] : f.options.map((o) => o.value).filter((x) => picked.includes(x));
      }
    } else if (f.type === 'check') {
      if (typeof val === 'boolean') out[f.id] = val;
    }
  }
  return out;
}

const TARGET_VALUES = ['common', 'chatgpt', 'claude', 'codex', 'claudecode'];
const PURPOSE_VALUES = ['consult', 'implement'];

function sanitizeOutputs(outputs) {
  const out = {};
  if (!outputs || typeof outputs !== 'object') return out;
  for (const m of MODES) {
    const o = outputs[m.id];
    if (!o || typeof o !== 'object') continue;
    const t = TARGET_VALUES.includes(o.target) ? o.target : undefined;
    const p = PURPOSE_VALUES.includes(o.purpose) && m.purposes.includes(o.purpose) ? o.purpose : undefined;
    if (t || p) out[m.id] = { ...(t ? { target: t } : {}), ...(p ? { purpose: p } : {}) };
  }
  return out;
}

/**
 * 読み込んだデータの検証。
 * @returns {{ ok: true, modes: object, outputs: object } | { ok: false, error: string }}
 */
export function parseData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'ファイルの形式が正しくありません。' };
  if (data.app !== APP_ID) return { ok: false, error: 'この工房で書き出したファイルではないようです。' };
  if (typeof data.format !== 'number' || data.format > FORMAT_VERSION) return { ok: false, error: 'このバージョンの工房では読み込めない形式です。' };
  if (!data.modes || typeof data.modes !== 'object' || Array.isArray(data.modes)) return { ok: false, error: '入力内容が見つかりませんでした。' };
  const modes = {};
  for (const m of MODES) {
    if (data.modes[m.id] !== undefined) modes[m.id] = maskValues(sanitizeModeValues(m, data.modes[m.id]));
  }
  if (!Object.keys(modes).length) return { ok: false, error: '入力内容が見つかりませんでした。' };
  return { ok: true, modes, outputs: sanitizeOutputs(data.outputs) };
}

/** ファイルの文字列を読み込む（サイズ上限つき） */
export function parseImportText(text) {
  if (typeof text !== 'string') return { ok: false, error: 'ファイルを読み込めませんでした。' };
  if (new Blob([text]).size > MAX_IMPORT_BYTES) return { ok: false, error: 'ファイルが大きすぎます（200KBまで）。' };
  let data;
  try { data = JSON.parse(text); } catch (_) { return { ok: false, error: 'JSONとして読み込めませんでした。' }; }
  return parseData(data);
}

export { getMode };
