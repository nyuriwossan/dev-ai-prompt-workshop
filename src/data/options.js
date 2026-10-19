// 複数のフォームで共有する選択肢。value は保存・JSONに使う識別子なので、変更するときは互換性に注意する。

export const APP_NAME = '個人開発AI依頼文工房';
export const APP_ID = 'dev-ai-prompt-workshop';
export const APP_VERSION = '1.0';

/** 開発経験（依頼文の説明の細かさを変える） */
export const SKILL_OPTIONS = [
  { value: 'first', label: 'はじめて', hint: 'コードを書いたことはほとんどない' },
  { value: 'some', label: '少しある', hint: 'AIと一緒に何か作ったことがある' },
  { value: 'used', label: '慣れている', hint: '説明は短くてよい' },
];

/** 使う端末 */
export const DEVICE_OPTIONS = [
  { value: 'sp', label: 'スマホ中心' },
  { value: 'pc', label: 'パソコン中心' },
  { value: 'both', label: '両方' },
];

/** 見た目の雰囲気 */
export const MOOD_OPTIONS = [
  { value: 'simple', label: 'シンプル・すっきり' },
  { value: 'cute', label: 'かわいい・やさしい' },
  { value: 'cool', label: 'かっこいい・クール' },
  { value: 'retro', label: 'レトロ・ゲーム風' },
  { value: 'wa', label: '和風' },
  { value: 'calm', label: '落ち着いた・大人っぽい' },
  { value: 'pop', label: 'にぎやか・ポップ' },
  { value: 'ai', label: 'おまかせ（AIに提案してもらう）' },
];

/** 依頼文の出力先 */
export const TARGETS = [
  { value: 'common', label: '共通', kind: 'common' },
  { value: 'chatgpt', label: 'ChatGPT', kind: 'chat' },
  { value: 'claude', label: 'Claude', kind: 'chat' },
  { value: 'codex', label: 'Codex', kind: 'agent' },
  { value: 'claudecode', label: 'Claude Code', kind: 'agent' },
];

/** 依頼の段階 */
export const PURPOSES = [
  { value: 'consult', label: '相談・設計用', hint: 'まだコードを書かせず、仕様や方針を一緒に決める' },
  { value: 'implement', label: '実装・改修用', hint: '決まった内容で、コードを書いて・直してもらう' },
];

export function optionLabel(options, value) {
  const o = options.find((x) => x.value === value);
  return o ? o.label : '';
}
