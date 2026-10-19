// 個人開発AI依頼文工房：画面の組み立てと画面遷移。
// 工房はAIを呼び出さない。入力内容は外部に送らず、保存はこの端末のブラウザ内だけ（オフにできる）。

import { h, clear, appendChildren } from './ui/dom.js';
import { renderField, setFieldError, focusField, fieldDomId } from './ui/fields.js';
import { copyText } from './ui/clipboard.js';
import { downloadText, stamp } from './ui/download.js';
import { MODES, getMode } from './data/modes.js';
import { EXAMPLES } from './data/examples.js';
import { GLOSSARY } from './data/glossary.js';
import { TARGETS, PURPOSES, APP_NAME, APP_ID, APP_VERSION } from './data/options.js';
import { getTargetInfo } from './data/targets.js';
import {
  getDefaults, visibleFields, validateStep, validateAll, hasUserInput, effectiveValues,
} from './logic/form.js';
import { maskSecrets } from './logic/secrets.js';
import { assessFeasibility, LEVELS } from './logic/feasibility.js';
import {
  buildPrompt, buildSummary, buildNotices, buildChecklist, resultTitle, defaultPurpose,
} from './prompts/build.js';
import {
  getAutosave, setAutosave, saveDraft, loadDraft, clearDraft, serialize, parseImportText, storageAvailable,
} from './logic/persist.js';

const add = (el, ...xs) => appendChildren(el, xs);
const main = document.getElementById('main');
const toastEl = document.getElementById('toast');

// ---------------------------------------------------------------- 状態

const state = {
  values: {},
  outputs: {}, // modeId -> { target, purpose }
  autosave: getAutosave(),
  restored: false,
};
for (const m of MODES) state.values[m.id] = getDefaults(m);

(function restore() {
  if (!state.autosave) return;
  const d = loadDraft();
  if (!d || !d.ok) return;
  for (const [id, v] of Object.entries(d.modes)) state.values[id] = v;
  state.outputs = d.outputs || {};
  state.restored = true;
})();

let saveTimer = null;
function scheduleSave() {
  if (!state.autosave) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; saveDraft(state.values, state.outputs); }, 300);
}

function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  if (state.autosave) saveDraft(state.values, state.outputs);
}
// 保存の待ち時間中にページを閉じても消えないように
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });

function outputFor(modeId) {
  const o = state.outputs[modeId] || {};
  const mode = getMode(modeId);
  const purpose = mode.purposes.includes(o.purpose) ? o.purpose : defaultPurpose(modeId, state.values[modeId]);
  return { target: o.target || 'common', purpose };
}

// ---------------------------------------------------------------- 共通部品

let toastTimer = null;
function toast(message, kind = 'ok') {
  toastEl.textContent = message;
  toastEl.className = `toast toast-${kind} is-visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
}

function copyButton(getText, { label = '全文をコピー', cls = 'btn btn-primary', done = 'コピーしました。使っているAIに貼り付けてください。' } = {}) {
  const btn = h('button', { type: 'button', class: cls }, label);
  btn.addEventListener('click', async () => {
    const text = getText();
    if (!text) return;
    const ok = await copyText(text);
    if (ok) {
      btn.textContent = 'コピーしました ✓';
      btn.classList.add('is-done');
      toast(done);
      setTimeout(() => { btn.textContent = label; btn.classList.remove('is-done'); }, 2200);
    } else {
      toast('自動でコピーできませんでした。依頼文を長押し（または選択）してコピーしてください。', 'error');
    }
  });
  return btn;
}

function modeChip(mode) {
  return h('span', { class: `mode-chip mode-${mode.id}` }, h('span', { 'aria-hidden': 'true' }, mode.icon), ` ${mode.no} ${mode.title}`);
}

function pageTitle(text, extra = {}) {
  return h('h1', { class: 'page-title', id: 'page-title', tabindex: '-1', ...extra }, text);
}

function setTitle(t) {
  document.title = t ? `${t}｜${APP_NAME}` : `${APP_NAME}｜「作りたい」を、AIに伝わる依頼文へ`;
}

// ---------------------------------------------------------------- ホーム

function renderHome() {
  setTitle('');
  const hero = h('section', { class: 'hero' },
    h('p', { class: 'hero-kicker' }, '無料・登録不要・入力内容は外部に送信しません'),
    h('h1', { class: 'hero-title', id: 'page-title', tabindex: '-1' }, '「作りたい」を、', h('br'), 'AIに伝わる依頼文へ。'),
    h('p', { class: 'hero-lead' },
      'プログラミングを知らなくても大丈夫。いくつかの質問に答えるだけで、ChatGPT・Claude・Codex・Claude Code などにそのまま貼れる「開発の依頼文」ができます。アイデア探しから、新しく作る、作ったものを直すまで。'),
    h('ol', { class: 'steps', 'aria-label': '使い方' },
      h('li', {}, h('span', { class: 'step-no' }, '1'), '入口を選ぶ'),
      h('li', {}, h('span', { class: 'step-no' }, '2'), '質問に答える'),
      h('li', {}, h('span', { class: 'step-no' }, '3'), 'コピーして自分のAIへ')));

  const cards = h('div', { class: 'entry-grid' }, MODES.map((m) => {
    const inProgress = hasUserInput(m, state.values[m.id]);
    return h('a', { class: `entry-card mode-${m.id}`, href: `#/${m.id}`, dataset: { mode: m.id } },
      h('span', { class: 'entry-head' },
        h('span', { class: 'entry-icon', 'aria-hidden': 'true' }, m.icon),
        h('span', { class: 'entry-titles' },
          h('span', { class: 'entry-no' }, `入口${m.no}`),
          h('span', { class: 'entry-title' }, m.title))),
      h('span', { class: 'entry-short' }, m.short),
      h('ul', { class: 'entry-who', 'aria-label': 'こんな人に' }, m.who.map((w) => h('li', {}, w))),
      h('span', { class: 'entry-foot' },
        inProgress ? h('span', { class: 'tag tag-progress' }, '入力の続きがあります') : h('span', { class: 'entry-steps' }, `質問は${m.steps.length}ステップ`),
        h('span', { class: 'entry-go', 'aria-hidden': 'true' }, 'はじめる →')));
  }));

  const flow = h('section', { class: 'card flow-card', 'aria-labelledby': 'flow-title' },
    h('h2', { class: 'section-title', id: 'flow-title' }, '3つの入口のつながり'),
    h('ol', { class: 'flow' },
      h('li', { class: 'flow-item mode-idea' }, h('strong', {}, '① アイデア'), h('span', {}, 'AIにアイデアを出してもらい、1つ選ぶ')),
      h('li', { class: 'flow-item mode-create' }, h('strong', {}, '② 新しく作る'), h('span', {}, '選んだアイデアを貼り付けて、仕様の相談 → 実装を頼む')),
      h('li', { class: 'flow-item mode-fix' }, h('strong', {}, '③ 直す'), h('span', {}, '機能追加・不具合修正を「壊さずに」頼む'))),
    h('p', { class: 'small muted' }, 'どの入口からでも始められます。'));

  const does = h('section', { class: 'card', 'aria-labelledby': 'does-title' },
    h('h2', { class: 'section-title', id: 'does-title' }, 'この工房がすること・しないこと'),
    h('div', { class: 'two-col' },
      h('div', {},
        h('h3', { class: 'sub-title ok-title' }, 'すること'),
        h('ul', { class: 'plain-list' },
          h('li', {}, 'あなたの答えを、AIが作業しやすい依頼文に組み立てる'),
          h('li', {}, 'GitHub Pages（無料の公開場所）だけで作れそうかを、参考として示す'),
          h('li', {}, '改修のとき「変えてはいけないこと」と確認項目を依頼文に入れる'))),
      h('div', {},
        h('h3', { class: 'sub-title no-title' }, 'しないこと'),
        h('ul', { class: 'plain-list' },
          h('li', {}, 'AIを呼び出す・アイデアやコードを自動で作る'),
          h('li', {}, '入力内容をサーバーへ送る（この端末のブラウザにだけ保存。オフにもできます）'),
          h('li', {}, 'AIの作業結果が正しいことや、既存機能が壊れないことの保証')))),
    h('p', { class: 'small' }, h('a', { href: '#/about' }, '使い方と安全について詳しく'), '　', h('a', { href: '#/glossary' }, '用語集')));

  add(main, hero, cards, flow, does,
    state.restored ? h('p', { class: 'small muted center' }, '前回の入力を、この端末から読み込みました。') : null);
}

// ---------------------------------------------------------------- フォーム

function stepper(mode, current, values) {
  const items = mode.steps.map((s, i) => {
    const errs = validateStep(s, values).length;
    const isCur = i === current;
    return h('li', { class: `stepper-item${isCur ? ' is-current' : ''}${i < current ? ' is-past' : ''}` },
      h('a', { href: `#/${mode.id}/${i + 1}`, 'aria-current': isCur ? 'step' : null },
        h('span', { class: 'stepper-no' }, String(i + 1)),
        h('span', { class: 'stepper-label' }, s.title),
        errs && i < current ? h('span', { class: 'visually-hidden' }, '（未入力の必須項目あり）') : null));
  });
  items.push(h('li', { class: `stepper-item stepper-result${current === 'result' ? ' is-current' : ''}` },
    h('a', { href: `#/${mode.id}/result`, 'aria-current': current === 'result' ? 'step' : null },
      h('span', { class: 'stepper-no', 'aria-hidden': 'true' }, '✓'),
      h('span', { class: 'stepper-label' }, '依頼文'))));
  return h('nav', { class: 'stepper', 'aria-label': '質問の進み具合' }, h('ol', {}, items));
}

function examplePicker(mode) {
  const list = EXAMPLES[mode.id] || [];
  if (!list.length) return null;
  const details = h('details', { class: 'examples' },
    h('summary', {}, '入力例を入れてみる'),
    h('p', { class: 'small muted' }, 'どんな答え方をすればよいか、例で確かめられます。今の入力は上書きされます。'),
    h('div', { class: 'example-buttons' }, list.map((ex) => h('button', {
      type: 'button', class: 'btn btn-ghost btn-sm',
      onclick: () => {
        if (hasUserInput(mode, state.values[mode.id]) && !window.confirm('今の入力を、入力例で上書きします。よろしいですか？')) return;
        state.values[mode.id] = { ...getDefaults(mode), ...structuredClone(ex.values) };
        if (state.outputs[mode.id]) delete state.outputs[mode.id].purpose;
        scheduleSave();
        toast(`入力例「${ex.label}」を入れました。`);
        route();
      },
    }, ex.label))));
  return details;
}

function renderStep(mode, index) {
  const step = mode.steps[index];
  const values = state.values[mode.id];
  setTitle(`${mode.title}（${index + 1}/${mode.steps.length}）`);

  const errorBox = h('div', { class: 'error-summary', id: 'error-summary', role: 'alert', tabindex: '-1', hidden: true });
  const body = h('div', { class: 'step-body' });

  const drawFields = (focusId) => {
    clear(body);
    const vis = visibleFields(step, values);
    const basic = vis.filter((f) => !f.advanced);
    const adv = vis.filter((f) => f.advanced);
    for (const f of basic) {
      const el = renderField(mode.id, f, values, onChange);
      if (f.collapsible) {
        body.append(h('details', { class: 'more more-paste', open: Boolean(values[f.id]) },
          h('summary', {}, f.collapsible), el));
      } else body.append(el);
    }
    if (adv.length) {
      const filled = adv.some((f) => {
        const val = values[f.id];
        return Array.isArray(val) ? val.length : Boolean(val) && val !== (f.default ?? '');
      });
      body.append(h('details', { class: 'more', open: filled || null, id: `more-${mode.id}-${step.id}` },
        h('summary', {}, `もっと詳しく伝える（任意・${adv.length}項目）`),
        h('div', { class: 'more-body' }, adv.map((f) => renderField(mode.id, f, values, onChange)))));
    }
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) el.focus({ preventScroll: true });
    }
  };

  function onChange(_fieldId, structural) {
    scheduleSave();
    if (!errorBox.hidden) refreshErrors(false);
    if (structural) {
      const active = document.activeElement && document.activeElement.id;
      const y = window.scrollY;
      drawFields(active);
      window.scrollTo(0, y);
    }
  }

  function refreshErrors(focus) {
    const errors = validateStep(step, values);
    for (const f of step.fields) setFieldError(mode.id, f.id, null);
    for (const e of errors) setFieldError(mode.id, e.field.id, e.message);
    clear(errorBox);
    if (!errors.length) { errorBox.hidden = true; return true; }
    errorBox.hidden = false;
    add(errorBox,
      h('p', { class: 'error-summary-title' }, `未入力の必須項目が${errors.length}つあります`),
      h('ul', {}, errors.map((e) => h('li', {}, h('a', {
        href: `#wrap-${fieldDomId(mode.id, e.field.id)}`,
        onclick: (ev) => { ev.preventDefault(); focusField(mode.id, e.field.id); },
      }, e.field.label)))));
    if (focus) errorBox.focus();
    return false;
  }

  const isLast = index === mode.steps.length - 1;
  const next = h('button', {
    type: 'button', class: 'btn btn-primary btn-next',
    onclick: () => {
      if (!refreshErrors(true)) return;
      location.hash = isLast ? `#/${mode.id}/result` : `#/${mode.id}/${index + 2}`;
    },
  }, isLast ? '依頼文を作る ✓' : '次へ →');
  const back = index === 0
    ? h('a', { class: 'btn btn-ghost', href: '#/' }, '← 入口へ')
    : h('a', { class: 'btn btn-ghost', href: `#/${mode.id}/${index}` }, '← 戻る');

  add(main,
    h('div', { class: 'form-head' },
      modeChip(mode),
      stepper(mode, index, values),
      h('p', { class: 'step-count' }, `ステップ ${index + 1} / ${mode.steps.length}`),
      pageTitle(step.title),
      h('p', { class: 'lead' }, step.lead)),
    index === 0 ? examplePicker(mode) : null,
    errorBox,
    body,
    h('div', { class: 'step-nav' }, back, next),
    savePanelMini());
  drawFields();
  scrollStepperToCurrent();

  // 依頼文画面から「修正する」で来たときに、該当項目へ
  const focusTarget = sessionFocus.take();
  if (focusTarget) setTimeout(() => focusField(mode.id, focusTarget), 50);
}

const sessionFocus = {
  id: null,
  set(id) { this.id = id; },
  take() { const x = this.id; this.id = null; return x; },
};

function scrollStepperToCurrent() {
  const nav = main.querySelector('.stepper');
  const cur = nav && nav.querySelector('.is-current');
  if (cur) nav.scrollLeft = Math.max(0, cur.offsetLeft - 24);
}

function savePanelMini() {
  if (!storageAvailable()) return h('p', { class: 'save-mini muted' }, 'このブラウザでは入力を保存できません。ページを閉じると入力は消えます。');
  return h('p', { class: 'save-mini muted' },
    state.autosave ? '入力は、この端末のブラウザにだけ自動で保存しています。' : '入力の自動保存はオフです。ページを閉じると入力は消えます。',
    ' ', h('a', { href: '#/about#save' }, '保存の設定'));
}

// ---------------------------------------------------------------- 結果

function segmented(name, options, current, onPick, labelText) {
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': labelText });
  options.forEach((o, i) => {
    const id = `${name}-${i}`;
    group.append(
      h('input', {
        type: 'radio', class: 'seg-input', name, id, value: o.value, checked: o.value === current,
        onchange: () => onPick(o.value),
      }),
      h('label', { class: 'seg', for: id }, o.label));
  });
  return group;
}

function renderResult(mode) {
  const values = state.values[mode.id];
  const errors = validateAll(mode, values);
  if (errors.length) {
    const first = errors[0];
    const idx = mode.steps.indexOf(first.step);
    sessionFocus.set(first.field.id);
    toast('まだ答えていない必須の質問があります。', 'error');
    location.replace(`#/${mode.id}/${idx + 1}`);
    return;
  }
  const title = resultTitle(mode.id, values);
  setTitle(title);

  const out = outputFor(mode.id);
  const promptView = h('pre', { class: 'prompt-view', id: 'prompt-view', tabindex: '0', 'aria-label': '生成された依頼文' });
  const targetNote = h('p', { class: 'target-note' });
  const purposeNote = h('p', { class: 'purpose-note small' });
  const noticeBox = h('div', { class: 'notices', 'aria-live': 'polite' });
  const infoBox = h('div', { class: 'notices notices-info' });
  const checklistBox = h('div', { class: 'checklist-box' });
  let currentText = '';

  const draw = () => {
    const o = outputFor(mode.id);
    currentText = buildPrompt(mode.id, values, o);
    promptView.textContent = currentText;
    targetNote.textContent = getTargetInfo(o.target).screenNote;
    const p = PURPOSES.find((x) => x.value === o.purpose);
    purposeNote.textContent = mode.purposes.length > 1 && p ? p.hint : '';
    drawNotices(o);
  };

  const drawNotices = (o) => {
    clear(noticeBox);
    clear(infoBox);
    for (const n of buildNotices(mode.id, values, o)) {
      const el = h('div', { class: `notice notice-${n.kind}`, dataset: { notice: n.id } },
        h('p', { class: 'notice-title' }, n.title),
        h('p', {}, n.text));
      if (n.action === 'maskInputs') {
        el.append(h('button', {
          type: 'button', class: 'btn btn-sm btn-danger-ghost',
          onclick: () => {
            for (const [k, v] of Object.entries(values)) if (typeof v === 'string') values[k] = maskSecrets(v);
            scheduleSave();
            toast('入力欄から秘密情報らしき文字列を消しました。');
            draw();
          },
        }, '入力欄からも消す'));
      }
      (n.kind === 'info' ? infoBox : noticeBox).append(el);
    }
  };

  const pick = (key) => (val) => {
    state.outputs[mode.id] = { ...(state.outputs[mode.id] || {}), [key]: val };
    scheduleSave();
    draw();
  };

  const filename = `${APP_ID}-${mode.id}-${stamp()}.md`;
  const actions = () => h('div', { class: 'output-actions' },
    copyButton(() => currentText),
    h('button', {
      type: 'button', class: 'btn btn-ghost',
      onclick: () => { downloadText(filename, currentText, 'text/markdown'); toast('Markdownファイルとして保存しました。'); },
    }, 'Markdownで保存'));

  const outputCard = h('section', { class: 'card output-card', 'aria-labelledby': 'output-title' },
    h('h2', { class: 'section-title', id: 'output-title' }, '依頼文'),
    h('div', { class: 'control-row' },
      h('p', { class: 'control-label', id: 'target-label' }, '出力先（使うAI）'),
      segmented(`target-${mode.id}`, TARGETS, out.target, pick('target'), '出力先（使うAI）'),
      targetNote),
    mode.purposes.length > 1 ? h('div', { class: 'control-row' },
      h('p', { class: 'control-label' }, '依頼の段階'),
      segmented(`purpose-${mode.id}`, PURPOSES, out.purpose, pick('purpose'), '依頼の段階'),
      purposeNote) : null,
    actions(),
    promptView,
    actions(),
    h('p', { class: 'small muted' }, 'コピーした依頼文は、AIに貼る前に自由に書き足して構いません。AIから質問が返ってきたら、答えてから先へ進めましょう。'));

  // GitHub Pages 適性（新規作成のみ）
  let feasCard = null;
  if (mode.id === 'create') {
    const feas = assessFeasibility(effectiveValues(mode, values));
    const lv = LEVELS[feas.level];
    feasCard = h('section', { class: 'card feas-card', 'aria-labelledby': 'feas-title' },
      h('h2', { class: 'section-title', id: 'feas-title' }, 'GitHub Pagesで作れそうか（参考）'),
      h('p', { class: `feas-level feas-${lv.tone}` }, h('span', { class: 'feas-dot', 'aria-hidden': 'true' }), h('span', {}, `判定：${lv.label}`)),
      feas.missing.length ? h('div', { class: 'notice notice-warn' },
        h('p', { class: 'notice-title' }, '判断に必要な情報が足りません'),
        h('p', {}, `「${feas.missing.join('」「')}」が決まっていないため、判定が変わる可能性があります。依頼文では、AIに確認・質問させるようにしています。`)) : null,
      h('ul', { class: 'feas-list' }, feas.items.map((it) => h('li', { class: `feas-item feas-${LEVELS[it.level].tone}` },
        h('span', { class: 'feas-tag' }, LEVELS[it.level].short),
        h('span', { class: 'feas-text' }, h('strong', {}, it.title), h('span', {}, it.detail))))),
      feas.publishNote ? h('p', { class: 'small' }, feas.publishNote) : null,
      h('p', { class: 'small muted' }, 'あなたの回答から機械的に判定した参考情報です。最終的な判断は、AIとの相談や公式の情報で確かめてください。'));
  }

  // 確認チェックリスト
  const drawChecklist = () => {
    clear(checklistBox);
    const items = buildChecklist(mode.id, values);
    checklistBox.append(
      h('ul', { class: 'checklist' }, items.map((t, i) => h('li', {},
        h('input', { type: 'checkbox', id: `chk-${i}`, class: 'check-input' }),
        h('label', { for: `chk-${i}` }, t)))),
      h('div', { class: 'output-actions' }, copyButton(() => items.map((t) => `- [ ] ${t}`).join('\n'), {
        label: 'チェックリストをコピー', cls: 'btn btn-ghost btn-sm', done: 'チェックリストをコピーしました。',
      })));
  };
  drawChecklist();
  const checkCard = h('section', { class: 'card', 'aria-labelledby': 'check-title' },
    h('h2', { class: 'section-title', id: 'check-title' }, mode.id === 'idea' ? 'このあとの確認' : '自分で確認するチェックリスト'),
    h('p', { class: 'small muted' }, mode.id === 'idea'
      ? 'AIの答えを受け取ったら、次のことを確かめましょう。'
      : 'AIが「できました」と言っても、自分の目で確かめるのがいちばん確実です。このリストは依頼文には入りません。'),
    checklistBox);

  // 入力のまとめ
  const summary = buildSummary(mode.id, values);
  const summaryCard = h('section', { class: 'card', 'aria-labelledby': 'sum-title' },
    h('h2', { class: 'section-title', id: 'sum-title' }, '入力のまとめ'),
    summary.map((s) => h('div', { class: 'sum-step' },
      h('div', { class: 'sum-head' },
        h('h3', { class: 'sub-title' }, `${s.index + 1}. ${s.title}`),
        h('a', { class: 'btn btn-text btn-sm', href: `#/${mode.id}/${s.index + 1}`, 'aria-label': `${s.title}を修正する` }, '修正する')),
      s.items.length
        ? h('dl', { class: 'sum-list' }, s.items.map((it) => [h('dt', {}, it.label), h('dd', {}, it.text)]))
        : h('p', { class: 'small muted' }, '（入力なし）'))));

  // 次の一歩
  const nextCard = h('section', { class: 'card next-card', 'aria-labelledby': 'next-title' },
    h('h2', { class: 'section-title', id: 'next-title' }, '次の一歩'),
    ...nextSteps(mode));

  add(main,
    h('div', { class: 'form-head' },
      modeChip(mode),
      stepper(mode, 'result', values),
      pageTitle(`${title}ができました`)),
    noticeBox,
    outputCard,
    infoBox,
    feasCard,
    checkCard,
    summaryCard,
    nextCard,
    savePanel(mode));
  draw();
  scrollStepperToCurrent();
}

function nextSteps(mode) {
  if (mode.id === 'idea') {
    return [
      h('p', {}, 'AIの提案から気に入ったアイデアを選んだら、AIにまとめ直してもらった文章を「② 新しく作りたい」に貼り付けて、開発の依頼文を作りましょう。'),
      h('a', {
        class: 'btn btn-primary', href: '#/create/1',
        onclick: () => sessionFocus.set('fromIdea'),
      }, '② 新しく作りたい へ進む →'),
    ];
  }
  if (mode.id === 'create') {
    return [
      h('ol', { class: 'plain-list numbered' },
        h('li', {}, 'まず「相談・設計用」をAIに渡し、質問に答えながら仕様を固めます。'),
        h('li', {}, '固まったら「実装・改修用」に切り替えてコピーし、作ってもらいます。AIがまとめた「実装用の要件まとめ」も一緒に貼ると確実です。'),
        h('li', {}, 'できあがったら、上のチェックリストで確かめます。直したいところは「③ 作ったものを直したい」へ。')),
      h('a', { class: 'btn btn-ghost', href: '#/fix/1' }, '③ 作ったものを直したい へ'),
    ];
  }
  return [
    h('p', {}, '1回の依頼で頼むことは1つに絞ると、壊れにくくなります。別の改修は、今回の改修を確かめてから新しく頼みましょう。'),
    h('button', {
      type: 'button', class: 'btn btn-ghost',
      onclick: () => {
        if (!window.confirm('「作ったものを直したい」の入力を消して、最初から入力します。よろしいですか？（対象のアプリの情報は残します）')) return;
        const keep = ['app', 'repoUrl', 'siteUrl', 'structure', 'files', 'skill', 'backup'];
        const prev = state.values.fix;
        const fresh = getDefaults(mode);
        for (const k of keep) fresh[k] = prev[k];
        state.values.fix = fresh;
        if (state.outputs.fix) delete state.outputs.fix.purpose;
        scheduleSave();
        location.hash = '#/fix/1';
      },
    }, '同じアプリで別の改修を入力する'),
  ];
}

// ---------------------------------------------------------------- 保存・読み込み

function savePanel(mode) {
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'import-file', tabindex: '-1' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > 200 * 1024) { toast('ファイルが大きすぎます（200KBまで）。', 'error'); return; }
    const text = await file.text();
    const res = parseImportText(text);
    if (!res.ok) { toast(res.error, 'error'); return; }
    if (!window.confirm('読み込んだ内容で、今の入力を置き換えます。よろしいですか？')) return;
    for (const [id, v] of Object.entries(res.modes)) state.values[id] = v;
    state.outputs = { ...state.outputs, ...res.outputs };
    scheduleSave();
    toast('入力内容を読み込みました。');
    route();
  });

  const autosaveBox = storageAvailable()
    ? h('label', { class: 'check', for: 'autosave' },
      h('input', {
        type: 'checkbox', id: 'autosave', class: 'check-input', checked: state.autosave,
        onchange: (e) => {
          state.autosave = e.target.checked;
          setAutosave(state.autosave);
          if (state.autosave) saveDraft(state.values, state.outputs);
          toast(state.autosave ? '自動保存をオンにしました。' : '自動保存をオフにして、保存していた入力を消しました。');
        },
      }),
      h('span', { class: 'check-text' }, 'この端末のブラウザに入力を自動保存する'))
    : h('p', { class: 'small muted' }, 'このブラウザでは、入力を自動保存できません。');

  return h('section', { class: 'card save-card', id: 'save', 'aria-labelledby': 'save-title' },
    h('h2', { class: 'section-title', id: 'save-title' }, '入力の保存と読み込み'),
    autosaveBox,
    h('p', { class: 'small muted' }, '保存先はこの端末のブラウザの中だけです。共用のパソコンではオフにしてください。APIキーやパスワードらしき文字列は、保存・書き出しのときに伏せ字にします。'),
    h('div', { class: 'output-actions' },
      h('button', {
        type: 'button', class: 'btn btn-ghost btn-sm',
        onclick: () => {
          const data = serialize(state.values, state.outputs);
          downloadText(`${APP_ID}-${stamp()}.json`, `${JSON.stringify(data, null, 2)}\n`, 'application/json');
          toast('入力内容をJSONファイルに書き出しました。');
        },
      }, 'ファイルに書き出す（JSON）'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => fileInput.click() }, 'ファイルから読み込む'),
      fileInput,
      mode ? h('button', {
        type: 'button', class: 'btn btn-text btn-sm btn-danger-text',
        onclick: () => {
          if (!window.confirm(`「${mode.title}」の入力をすべて消します。よろしいですか？`)) return;
          state.values[mode.id] = getDefaults(mode);
          delete state.outputs[mode.id];
          scheduleSave();
          toast('入力を消しました。');
          location.hash = `#/${mode.id}/1`;
        },
      }, 'この入口の入力を消す') : h('button', {
        type: 'button', class: 'btn btn-text btn-sm btn-danger-text',
        onclick: () => {
          if (!window.confirm('3つの入口すべての入力を消します。よろしいですか？')) return;
          for (const m of MODES) state.values[m.id] = getDefaults(m);
          state.outputs = {};
          clearDraft();
          toast('すべての入力を消しました。');
          route();
        },
      }, 'すべての入力を消す')));
}

// ---------------------------------------------------------------- 使い方・用語集

function renderAbout() {
  setTitle('使い方と安全について');
  add(main,
    pageTitle('使い方と安全について'),
    h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, '使い方'),
      h('ol', { class: 'plain-list numbered' },
        h('li', {}, 'トップで、3つの入口（アイデア／新しく作る／直す）から1つ選びます。'),
        h('li', {}, '質問に答えます。分からない質問は「分からない」「おまかせ」を選べば大丈夫です。'),
        h('li', {}, '依頼文の画面で、使うAI（出力先）と、依頼の段階（相談・設計用／実装・改修用）を選びます。'),
        h('li', {}, '「全文をコピー」を押して、自分が使っているAIに貼り付けます。'))),
    h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, '出力先の違い'),
      h('dl', { class: 'sum-list' },
        h('dt', {}, '共通'), h('dd', {}, 'どのAIにも貼れる形。チャットでも、ファイルを直接編集できるAIでも使えるよう、両方の場合を書いています。'),
        h('dt', {}, 'ChatGPT・Claude'), h('dd', {}, 'チャットで使う前提。設計の相談、コードの提示、初心者向けの説明を重視します。2つは同じ組み立てです（AIごとの最適化を装わないため）。'),
        h('dt', {}, 'Codex・Claude Code'), h('dd', {}, 'リポジトリ（作業フォルダ）を開いて使うコーディングエージェント向け。既存ファイルの確認、変更範囲の限定、テスト、差分の確認など、作業手順を重視します。')),
      h('p', { class: 'small muted' }, 'AIの機能や名前は変わることがあります。依頼文では、使えるかどうか分からない機能を前提にしないようにしています。')),
    h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, 'GitHub Pagesの判定について'),
      h('p', {}, '「② 新しく作りたい」では、回答から「静的Webアプリとして実現しやすい」「外部サービスとの連携が必要」「追加の技術的検討が必要」の3段階で参考情報を表示します。'),
      h('ul', { class: 'plain-list' },
        h('li', {}, 'GitHub Pagesは、HTML・CSS・JavaScriptをそのまま公開する仕組みです。計算・ゲーム・端末内への保存などは、これだけで作れます。'),
        h('li', {}, '複数の端末や人とのデータ共有、ログイン、生成AIのAPI、メール送信、決済などは、外部のサービスやサーバーが必要になります。'),
        h('li', {}, 'APIキーなどの秘密の鍵を、HTMLやJavaScriptに書く作り方は提案しません。書いたコードは誰でも見られるためです。')),
      h('p', { class: 'small muted' }, '判定は簡単なルールによる目安です。外部サービスを組み合わせれば実現できる場合もあるため、「できる／できない」とは断定しません。')),
    h('section', { class: 'card' },
      h('h2', { class: 'section-title' }, '安全とプライバシー'),
      h('ul', { class: 'plain-list' },
        h('li', {}, 'この工房はAIを呼び出しません。依頼文は、このページの中のプログラムが組み立てています。'),
        h('li', {}, '入力内容をサーバーへ送信しません。アクセス解析や広告も使っていません。'),
        h('li', {}, '入力は、この端末のブラウザの中にだけ自動保存します（下の設定でオフにできます）。'),
        h('li', {}, 'APIキー・パスワードらしき文字列を見つけたら、依頼文・保存・書き出しで伏せ字にします。簡単なパターンによる検出なので、見逃すこともあります。そもそも入力しないでください。'),
        h('li', {}, '依頼文で「変えてはいけないこと」を伝えても、AIが既存の機能を壊さないとは限りません。変更後は自分でも確かめ、元に戻せる状態を保ってください。'))),
    savePanel(null));
  if (location.hash.endsWith('#save')) setTimeout(() => document.getElementById('save')?.scrollIntoView(), 50);
}

function renderGlossary() {
  setTitle('用語集');
  add(main,
    pageTitle('用語集'),
    h('p', { class: 'lead' }, 'AIの返事によく出てくる言葉を、ひとことで説明します。'),
    h('section', { class: 'card' },
      h('dl', { class: 'glossary' }, GLOSSARY.map((g) => [h('dt', {}, g.term), h('dd', {}, g.text)]))));
}

function renderNotFound() {
  setTitle('ページが見つかりません');
  add(main, pageTitle('ページが見つかりません'), h('p', {}, h('a', { href: '#/' }, 'トップへ戻る')));
}

// ---------------------------------------------------------------- ルーティング

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const path = raw.split('#')[0];
  const parts = path.split('/').filter(Boolean);
  clear(main);
  window.scrollTo(0, 0);

  if (!parts.length) renderHome();
  else if (parts[0] === 'about') renderAbout();
  else if (parts[0] === 'glossary') renderGlossary();
  else {
    const mode = getMode(parts[0]);
    if (!mode) renderNotFound();
    else if (parts[1] === 'result') renderResult(mode);
    else {
      const n = Number.parseInt(parts[1] || '1', 10);
      if (!Number.isInteger(n) || n < 1 || n > mode.steps.length) renderNotFound();
      else renderStep(mode, n - 1);
    }
  }
  const t = document.getElementById('page-title');
  if (t && !document.activeElement?.closest?.('#main .step-body')) t.focus({ preventScroll: true });
  document.querySelectorAll('.site-nav a').forEach((a) => {
    if (a.getAttribute('href') === `#/${parts[0] || ''}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

window.addEventListener('hashchange', route);
document.getElementById('app-version').textContent = `v${APP_VERSION}`;
route();
