// 3つのモードで共通に使う文の組み立て。

import { getTargetInfo } from '../data/targets.js';
import { optionLabel, MOOD_OPTIONS, DEVICE_OPTIONS } from '../data/options.js';

export const SECURITY_LINE = 'APIキー・パスワード・アクセストークンなどの秘密情報を、HTMLやJavaScriptなどブラウザで動くコードに書き込む構成は提案しないでください。';
export const XSS_LINE = '利用者が入力した文字を画面に表示するときは、HTMLとして実行されないようにしてください（XSS対策）。';
export const NO_GUESS_LINE = '重要な仕様を勝手に補わないでください。分からない点は「未確定」として扱い、必要なら私に質問してください。';

/** 開発経験に応じた説明の細かさ */
export function skillLine(skill, kind) {
  if (skill === 'used') return '私には開発の経験があります。説明は簡潔で構いません。';
  if (skill === 'some') return 'AIと一緒に少し作った経験があります。基本的な操作の説明は簡潔で構いませんが、専門用語には短い説明を添えてください。';
  if (kind === 'agent') return '私はプログラミングの経験がほとんどありません。報告では専門用語をなるべく避け、私が確認・操作する必要があることは手順として書いてください。';
  return '私はプログラミングの経験がほとんどありません。専門用語には短い説明を添え、操作の手順は省略せずに書いてください。';
}

/** 端末の希望を AI 向けの文に */
export function deviceLine(device) {
  if (device === 'sp') return 'スマートフォンでの利用を主目的とします。スマートフォンの画面幅で読みやすく、指で押しやすい大きさの操作部品にしてください（パソコンで開いても崩れないように）。';
  if (device === 'pc') return 'パソコンでの利用を主目的とします（スマートフォンで開いても最低限崩れないように）。';
  if (device === 'both') return 'スマートフォンとパソコンの両方で使います。どちらの画面幅でも読みやすく操作しやすい表示にしてください。';
  return null;
}

export function deviceLabel(device) {
  return optionLabel(DEVICE_OPTIONS, device);
}

export function moodLine(mood, note) {
  const parts = [];
  if (mood && mood !== 'ai') parts.push(`雰囲気は「${optionLabel(MOOD_OPTIONS, mood)}」。`);
  if (mood === 'ai') parts.push('雰囲気はおまかせします。用途に合うものを提案してください。');
  if (note) parts.push(`希望：${note}`);
  return parts.length ? parts.join('') : null;
}

/** 出力先ごとの環境についての注意（common / chat） */
export function envLines(target) {
  const info = getTargetInfo(target);
  return info.envLines ? [...info.envLines] : [];
}

/** エージェント向け：作業ルールファイル */
export function ruleFileLine(target) {
  const info = getTargetInfo(target);
  if (info.kind !== 'agent') return null;
  return `作業を始める前に、作業フォルダ内に ${info.ruleFiles} など作業ルールを書いたファイルがあれば読み、その指示に従ってください。`;
}

/** 完了時の報告（実装・改修用） */
export function reportLines({ bug = false, create = false } = {}) {
  return [
    create ? '作成したファイルと、それぞれの役割' : '変更したファイルと、変更内容の要約',
    bug ? '不具合の原因' : null,
    create ? '実装した機能と、実装しなかった（できなかった）機能' : null,
    '実施した確認・テストとその結果（実施できなかった確認は「未実施」と明記）',
    create ? '置いた仮定と、残っている課題' : '既存の機能への影響と、残っている懸念',
    create ? null : '問題があったときに元に戻す方法',
  ].filter(Boolean);
}
