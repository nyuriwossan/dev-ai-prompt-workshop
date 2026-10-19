// 秘密情報（APIキー・トークン・パスワードなど）らしき文字列の検出と伏せ字化。
// 簡単なパターンによる検出なので、見逃しや誤検出はありうる（画面でもそう案内する）。

const MASK = '［秘密情報のため削除］';

const PATTERNS = [
  { name: 'Anthropic APIキー', re: /sk-ant-[A-Za-z0-9_-]{16,}/g },
  { name: 'OpenAI APIキー', re: /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g },
  { name: 'GitHubトークン', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g },
  { name: 'Google APIキー', re: /\bAIza[0-9A-Za-z_-]{35}/g },
  { name: 'AWSアクセスキー', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { name: 'Slackトークン', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: '決済サービスの秘密キー', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { name: '秘密鍵', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g },
  { name: '認証トークン', re: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/g },
  {
    name: 'パスワード・キーの記述',
    // 「password: xxxx1」「APIキー＝xxxx1」のような書き方。値の部分だけを伏せる。
    // 「token: undefined」のようなエラー文を消さないよう、値は英数字記号6文字以上・数字を含むものに限る。
    re: /((?:api[_ -]?key|secret|token|password|passwd|pwd|access[_ -]?key|パスワード|ＡＰＩキー|APIキー|アクセスキー|秘密鍵|トークン)\s*["']?\s*[:=：＝]\s*["']?)((?=[!-~]*\d)[A-Za-z0-9!#$%&*+\-./@^_~]{6,})/gi,
    group: 2,
  },
];

/** text に含まれる秘密情報らしき文字列の種類を返す */
export function detectSecrets(text) {
  if (typeof text !== 'string' || !text) return [];
  const found = new Set();
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(text)) found.add(p.name);
    p.re.lastIndex = 0;
  }
  return [...found];
}

/** 秘密情報らしき部分を伏せ字にする */
export function maskSecrets(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    if (p.group) out = out.replace(p.re, (_m, pre) => `${pre}${MASK}`);
    else out = out.replace(p.re, MASK);
  }
  return out;
}

/** 値オブジェクト全体を伏せ字にしたコピー */
export function maskValues(values) {
  const out = {};
  for (const [k, v] of Object.entries(values || {})) out[k] = typeof v === 'string' ? maskSecrets(v) : v;
  return out;
}

/** 値オブジェクトのうち、秘密情報らしきものを含む項目 id と種類 */
export function scanValues(values) {
  const hits = [];
  for (const [k, v] of Object.entries(values || {})) {
    const kinds = detectSecrets(v);
    if (kinds.length) hits.push({ id: k, kinds });
  }
  return hits;
}

// ---- 個人情報らしきもの（警告だけ。伏せない）
const PII = [
  { name: 'メールアドレス', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { name: '電話番号', re: /(?:\b0\d{1,4}[-‐ー−]\d{1,4}[-‐ー−]\d{3,4}\b|\b0[789]0\d{8}\b)/ },
];

export function scanPersonal(values) {
  const kinds = new Set();
  for (const v of Object.values(values || {})) {
    if (typeof v !== 'string') continue;
    for (const p of PII) if (p.re.test(v)) kinds.add(p.name);
  }
  return [...kinds];
}

export const SECRET_MASK = MASK;
