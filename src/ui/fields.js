// フォーム項目の描画。値は呼び出し元の values オブジェクトに直接書き込む。
// ユーザー入力は value / textContent でのみ扱い、innerHTML は使わない。

import { h, appendChildren } from './dom.js';
import { isRequired, applyExclusive } from '../logic/form.js';

export function fieldDomId(modeId, fieldId) {
  return `${modeId}-${fieldId}`;
}

function badge(required) {
  return h('span', { class: required ? 'badge badge-required' : 'badge badge-optional' }, required ? '必須' : '任意');
}

const ids = (...xs) => xs.filter(Boolean).join(' ') || null;

/**
 * @param {string} modeId
 * @param {object} f 項目定義
 * @param {object} values このモードの値（書き換える）
 * @param {(id:string, structural:boolean)=>void} onChange structural=true のときは表示条件が変わりうる
 */
export function renderField(modeId, f, values, onChange) {
  const base = fieldDomId(modeId, f.id);
  const whyId = f.why ? `${base}-why` : null;
  const hintId = f.hint ? `${base}-hint` : null;
  const errId = `${base}-err`;
  const required = isRequired(f, values);
  const wrap = h('div', { class: `field field-${f.type}`, id: `wrap-${base}`, dataset: { field: f.id } });
  const why = f.why ? h('p', { class: 'why', id: whyId }, f.why) : null;
  const hint = f.hint ? h('p', { class: 'hint', id: hintId }, f.hint) : null;
  const err = h('p', { class: 'field-error', id: errId, hidden: true });
  const add = (...xs) => appendChildren(wrap, xs);
  const labelInner = [h('span', { class: 'label-text' }, f.label), f.type === 'check' ? null : badge(required)];

  switch (f.type) {
    case 'text':
    case 'textarea': {
      const isArea = f.type === 'textarea';
      const counter = h('span', { class: 'counter', 'aria-hidden': 'true' });
      const update = () => {
        const n = (values[f.id] || '').length;
        counter.textContent = f.max && n > f.max * 0.8 ? `${n} / ${f.max}` : '';
      };
      const input = h(isArea ? 'textarea' : 'input', {
        id: base,
        name: f.id,
        class: `input${isArea ? ' textarea' : ''}${f.code ? ' mono' : ''}`,
        type: isArea ? null : 'text',
        inputmode: f.inputmode || null,
        rows: isArea ? String(f.rows || 3) : null,
        maxlength: f.max ? String(f.max) : null,
        placeholder: f.placeholder || null,
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: f.code ? 'false' : null,
        'aria-required': required ? 'true' : null,
        'aria-describedby': ids(whyId, hintId, errId),
        value: values[f.id] || '',
        oninput: (e) => { values[f.id] = e.target.value; update(); onChange(f.id, false); },
      });
      update();
      add(h('label', { class: 'label', for: base }, labelInner), why, hint, err, input, h('div', { class: 'counter-row' }, counter));
      break;
    }

    case 'radio':
    case 'checks': {
      const isRadio = f.type === 'radio';
      const group = h('div', { class: `chips${f.options.some((o) => o.hint) ? ' chips-hinted' : ''}` });
      f.options.forEach((o, i) => {
        const id = `${base}-${i}`;
        const checked = isRadio ? values[f.id] === o.value : (values[f.id] || []).includes(o.value);
        const input = h('input', {
          type: isRadio ? 'radio' : 'checkbox',
          id, name: base, value: o.value, class: 'chip-input', checked,
          onchange: () => {
            if (isRadio) values[f.id] = o.value;
            else values[f.id] = applyExclusive(f, values[f.id], o.value, input.checked);
            onChange(f.id, true);
          },
        });
        group.append(h('label', { class: `chip${o.exclusive ? ' chip-exclusive' : ''}`, for: id },
          input,
          h('span', { class: 'chip-body' },
            h('span', { class: 'chip-text' }, o.label),
            o.hint ? h('span', { class: 'chip-hint' }, o.hint) : null)));
      });
      add(h('fieldset', {
        class: 'fieldset',
        id: base,
        tabindex: '-1',
        'aria-required': isRadio && required ? 'true' : null,
        'aria-describedby': ids(whyId, hintId, errId),
      },
      h('legend', { class: 'label' }, labelInner, isRadio ? null : h('span', { class: 'multi' }, '複数選べます')),
      why, hint, err, group));
      break;
    }

    case 'check': {
      const input = h('input', {
        type: 'checkbox', id: base, name: f.id, class: 'check-input', checked: Boolean(values[f.id]),
        'aria-describedby': ids(hintId, errId),
        onchange: (e) => { values[f.id] = e.target.checked; onChange(f.id, true); },
      });
      add(h('label', { class: 'check', for: base }, input, h('span', { class: 'check-text' }, f.label)), hint, err);
      break;
    }

    default:
      add(h('p', {}, `未対応の項目: ${f.type}`));
  }
  return wrap;
}

export function setFieldError(modeId, fieldId, message) {
  const base = fieldDomId(modeId, fieldId);
  const wrap = document.getElementById(`wrap-${base}`);
  const err = document.getElementById(`${base}-err`);
  if (!wrap || !err) return;
  err.textContent = message || '';
  err.hidden = !message;
  wrap.classList.toggle('has-error', Boolean(message));
  wrap.querySelectorAll('input, textarea').forEach((el) => {
    if (el.type === 'checkbox' || el.type === 'radio') return;
    if (message) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  });
  const fs = wrap.querySelector('fieldset');
  if (fs) { if (message) fs.setAttribute('aria-invalid', 'true'); else fs.removeAttribute('aria-invalid'); }
}

export function focusField(modeId, fieldId) {
  const base = fieldDomId(modeId, fieldId);
  const wrap = document.getElementById(`wrap-${base}`);
  if (!wrap) return;
  const details = wrap.closest('details');
  if (details) details.open = true;
  const target = wrap.querySelector('input:not([type=hidden]), textarea') || wrap;
  wrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setTimeout(() => target.focus({ preventScroll: true }), 60);
}
