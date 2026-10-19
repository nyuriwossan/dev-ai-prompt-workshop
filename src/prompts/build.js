// 依頼文生成の入口。
// 値 → 表示条件で整理 → 秘密情報を伏せる → モード別テンプレート → 出力先・段階の調整 → Markdown
// あわせて、画面だけに出す「入力のまとめ」「注意事項」「完成チェックリスト」も作る（これらはコピーされない）。

import { getMode, allFields } from '../data/modes.js';
import { effectiveValues, isEmptyValue, isVisible, toLines } from '../logic/form.js';
import { maskValues, scanValues, scanPersonal } from '../logic/secrets.js';
import { assessFeasibility } from '../logic/feasibility.js';
import { targetKind } from '../data/targets.js';
import { buildIdeaPrompt } from './idea.js';
import { buildCreatePrompt, undecidedItems } from './create.js';
import { buildFixPrompt, GOAL_TITLES } from './fix.js';
import { TARGETS, PURPOSES } from '../data/options.js';

export function normalizeTarget(t) {
  return TARGETS.some((x) => x.value === t) ? t : 'common';
}

export function normalizePurpose(mode, p) {
  return mode.purposes.includes(p) ? p : mode.purposes[0];
}

/** 改修モードの既定の段階（公開の相談は相談用、それ以外は実装・改修用） */
export function defaultPurpose(modeId, values) {
  if (modeId === 'idea') return 'consult';
  if (modeId === 'create') return 'consult';
  return values && values.goal === 'publish' ? 'consult' : 'implement';
}

export function buildPrompt(modeId, values, opts = {}) {
  const mode = getMode(modeId);
  if (!mode) throw new Error(`unknown mode: ${modeId}`);
  const target = normalizeTarget(opts.target);
  const purpose = normalizePurpose(mode, opts.purpose);
  const v = maskValues(effectiveValues(mode, values));
  if (modeId === 'idea') return buildIdeaPrompt(v, { target });
  if (modeId === 'create') return buildCreatePrompt(v, { target, purpose });
  return buildFixPrompt(v, { target, purpose });
}

/** 画面用：入力のまとめ（ステップごと、表示中で入力済みの項目のみ） */
export function buildSummary(modeId, values) {
  const mode = getMode(modeId);
  const v = maskValues(effectiveValues(mode, values));
  return mode.steps.map((step, i) => ({
    index: i,
    title: step.title,
    items: step.fields
      .filter((f) => isVisible(f, values) && !isEmptyValue(f, v[f.id]))
      .map((f) => ({ id: f.id, label: f.label.replace(/（[^）]*）$/, '').replace(/[？?]$/, ''), text: displayValue(f, v[f.id]) })),
  }));
}

function displayValue(f, val) {
  if (f.type === 'radio') return (f.options.find((o) => o.value === val) || {}).label || '';
  if (f.type === 'checks') return val.map((x) => (f.options.find((o) => o.value === x) || {}).label).filter(Boolean).join('、');
  if (f.type === 'check') return val ? 'はい' : '';
  if (f.list) return toLines(val).join(' ／ ');
  return val;
}

/**
 * 画面用：注意事項。kind は danger | warn | info
 */
export function buildNotices(modeId, values, { target, purpose } = {}) {
  const mode = getMode(modeId);
  const v = effectiveValues(mode, values);
  const kind = targetKind(normalizeTarget(target));
  const notices = [];

  const secretHits = scanValues(v);
  if (secretHits.length) {
    const kinds = [...new Set(secretHits.flatMap((h) => h.kinds))];
    const labels = secretHits.map((h) => (allFields(mode).find((f) => f.id === h.id) || {}).label).filter(Boolean);
    notices.push({
      kind: 'danger',
      id: 'secrets',
      title: '秘密情報らしき文字列が入力に含まれています',
      text: `${kinds.join('・')}らしき文字列がありました（${labels.join('／')}）。依頼文では自動で伏せ字にしています。入力欄からも消しておくのがおすすめです。検出は簡単なパターンによるもので、見逃すこともあります。`,
      action: 'maskInputs',
    });
  }
  const pii = scanPersonal(v);
  if (pii.length) {
    notices.push({
      kind: 'warn',
      id: 'personal',
      title: '個人情報らしき文字列があります',
      text: `${pii.join('・')}らしき文字列があります。AIに渡してよい情報か確認してください（依頼文では伏せていません）。`,
    });
  }

  if (modeId === 'create') {
    const feas = assessFeasibility(v);
    const { unknown } = undecidedItems(v);
    if (purpose === 'implement' && unknown.length) {
      notices.push({
        kind: 'warn', id: 'undecided',
        title: '未確定の項目があります',
        text: `「${unknown.join('」「')}」が未確定です。実装用の依頼文でもAIに質問させるようにしていますが、先に「相談・設計用」で決めておくと、作り直しが減ります。`,
      });
    }
    if (purpose === 'implement' && feas.level !== 'static') {
      notices.push({
        kind: 'warn', id: 'feasibility',
        title: '外部サービスや追加の検討が必要な要素があります',
        text: 'いきなり実装を頼むより、まず「相談・設計用」で構成と費用・リスクを確認するのがおすすめです。',
      });
    }
  }

  if (modeId === 'fix') {
    if (v.backup === 'no' || v.backup === 'unknown') {
      notices.push({
        kind: 'warn', id: 'backup',
        title: '作業の前に、今の状態を保存しておきましょう',
        text: '今動いているファイルのコピーを取るか、GitHubに保存（コミット）してから改修を頼むと、失敗しても元に戻せます。依頼文にも、保存方法を教えてもらう指示を入れています。',
      });
    }
    if ((v.repoUrl || v.siteUrl) && kind !== 'agent') {
      notices.push({
        kind: 'info', id: 'url',
        title: 'URLを書いても、AIが中身を見られるとは限りません',
        text: '見られない場合は、必要なファイルを求めるよう依頼文に書いてあります。求められたら、該当するファイルの中身を貼り付けてください。',
      });
    }
    notices.push({
      kind: 'info', id: 'noGuarantee',
      title: '依頼文だけで、既存機能の破損を完全には防げません',
      text: '「変更しないこと」をはっきり伝えても、AIが別の部分を変えてしまうことはあります。変更後は「自分で確認するチェックリスト」で、今回の変更と既存の機能の両方を自分でも確かめてください。',
    });
  }

  return notices;
}

/** 画面用：自分で確認するチェックリスト */
export function buildChecklist(modeId, values) {
  const mode = getMode(modeId);
  const v = effectiveValues(mode, values);
  const items = [];
  if (modeId === 'idea') {
    items.push('提案されたアイデアに「GitHub Pagesだけで作れるか」の区別が書かれている');
    items.push('気になるアイデアを1つ選んで、AIに「引き継ぎ用のまとめ」を書いてもらった');
    items.push('そのまとめを「② 新しく作りたい」の最初の欄に貼り付けた');
    return items;
  }
  if (modeId === 'create') {
    for (const m of toLines(v.must)) items.push(`必須の機能「${m}」を、実際に操作して確かめた`);
    if (v.device === 'sp' || v.device === 'both') items.push('スマホで開いて、表示が崩れず、指で操作できる');
    if (v.device === 'pc' || v.device === 'both') items.push('パソコンで開いて、表示が崩れず操作できる');
    if (v.storage === 'local') items.push('ページを再読み込みしても、入力した内容が残っている');
    if (v.storage === 'local' && v.backup === 'yes') items.push('書き出したファイルを読み込んで、データを元に戻せる');
    for (const d of toLines(v.done)) items.push(d);
    if (v.publish === 'pages') items.push('GitHub Pagesの公開URLで開いても、同じように動く');
    items.push('コードやファイルに、APIキー・パスワードが書かれていない');
    items.push('入力欄に <b>テスト</b> と入れても、太字にならず、そのままの文字で表示される');
    return items;
  }
  // fix
  if (v.goal === 'bug') items.push('「再現手順」どおりに操作しても、不具合が起きない');
  if (v.goal === 'add') items.push('追加した機能が「追加後の動き」のとおりに使える');
  if (v.goal === 'change') items.push('変更した機能が「変更後の動き」のとおりになっている');
  if (v.goal === 'design') items.push('変えたい場所が、イメージどおりの見た目になっている');
  if (v.goal === 'publish') items.push('公開URLで、最新の内容が表示される');
  const p = v.protect || [];
  if (p.includes('features')) items.push('今回の変更と関係のない機能も、今までどおり動く');
  if (p.includes('data')) items.push('前から保存していたデータが消えず、読み込める');
  if (p.includes('design')) items.push('変更を頼んでいない部分の見た目が変わっていない');
  if (p.includes('text')) items.push('画面の文章が勝手に変わっていない');
  if (p.includes('url')) items.push('公開URLやファイル名が変わっていない');
  if (v.protectNote) items.push(`「${v.protectNote.replace(/\s+/g, ' ')}」が今までどおり`);
  for (const d of toLines(v.done)) items.push(d);
  items.push('スマホとパソコン（使う端末）で、表示が崩れていない');
  if (v.goal !== 'publish') items.push('公開している場合、公開サイトにも反映されている');
  items.push('うまくいかなかったときに、元に戻す方法が分かっている');
  return items;
}

export function resultTitle(modeId, values) {
  const mode = getMode(modeId);
  if (modeId === 'fix' && GOAL_TITLES[values.goal]) return `${GOAL_TITLES[values.goal]}の依頼文`;
  return mode.resultTitle;
}

export { PURPOSES };
