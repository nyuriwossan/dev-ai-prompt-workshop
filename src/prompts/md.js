// Markdown 組み立ての小さな補助。利用者の入力が見出しやリストの構造を壊さないように整える。

/** 1行の文字列に（改行・連続空白をまとめる） */
export function oneLine(text) {
  return String(text ?? '').replace(/\s*\r?\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}

/** 複数行テキストを引用ブロックに */
export function quote(text) {
  const lines = String(text ?? '').trim().split(/\r?\n/);
  return lines.map((l) => (l.trim() ? `> ${l.trimEnd()}` : '>'));
}

/** 箇条書き */
export function bullets(items) {
  return items.filter(Boolean).map((t) => `- ${oneLine(t)}`);
}

/** 番号つきリスト */
export function numbered(items) {
  return items.filter(Boolean).map((t, i) => `${i + 1}. ${oneLine(t)}`);
}

/** チェックボックス形式 */
export function checkboxes(items) {
  return items.filter(Boolean).map((t) => `- [ ] ${oneLine(t)}`);
}

/** コードブロック。中身に含まれるバッククォートより長いフェンスを使う */
export function codeBlock(text, lang = 'text') {
  const body = String(text ?? '').replace(/\s+$/, '');
  const longest = Math.max(2, ...(body.match(/`+/g) || []).map((s) => s.length));
  const fence = '`'.repeat(longest + 1);
  return [`${fence}${lang}`, ...body.split(/\r?\n/), fence];
}

function clean(body) {
  return (Array.isArray(body) ? body : [body]).flat(Infinity).filter((l) => l !== null && l !== undefined && l !== false).map(String);
}

/**
 * 文書の組み立て。section の body が空なら見出しごと出さない。
 */
export class Doc {
  constructor() { this.blocks = []; }

  raw(...lines) {
    const ls = lines.flat().filter((l) => l !== null && l !== undefined && l !== false);
    if (ls.length) this.blocks.push(ls.join('\n'));
    return this;
  }

  heading(level, title) { return this.raw(`${'#'.repeat(level)} ${title}`); }

  /** body: 文字列の配列（入れ子配列可）。空要素は除く */
  section(title, body, level = 2) {
    const ls = clean(body);
    if (!ls.some((l) => l.trim() !== '')) return this;
    this.blocks.push(`${'#'.repeat(level)} ${title}\n\n${ls.join('\n')}`);
    return this;
  }

  /** 小見出しごとの塊。parts: [{ title, body }] */
  sectionWithSubs(title, parts, level = 2) {
    const subs = parts
      .map((p) => {
        const ls = clean(p.body);
        return ls.some((l) => l.trim() !== '') ? `${'#'.repeat(level + 1)} ${p.title}\n\n${ls.join('\n')}` : null;
      })
      .filter(Boolean);
    if (!subs.length) return this;
    this.blocks.push(`${'#'.repeat(level)} ${title}\n\n${subs.join('\n\n')}`);
    return this;
  }

  toString() { return `${this.blocks.join('\n\n')}\n`; }
}
