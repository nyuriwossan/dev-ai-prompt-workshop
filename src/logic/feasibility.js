// GitHub Pages 適性の参考判定（ルールベース）。
// 「できる／できない」の二択にせず、3段階＋情報不足で示す。判定はあくまで参考。

export const LEVELS = {
  static: { rank: 1, label: '静的Webアプリとして実現しやすい', short: '実現しやすい', tone: 'ok' },
  external: { rank: 2, label: '外部サービスとの連携が必要', short: '外部サービスが必要', tone: 'warn' },
  review: { rank: 3, label: '追加の技術的検討が必要', short: '追加の検討が必要', tone: 'caution' },
};

const has = (arr, x) => Array.isArray(arr) && arr.includes(x);

/**
 * @param {object} v 新規作成フォームの値（effectiveValues 済み）
 * @returns {{ level: 'static'|'external'|'review', items: Array, missing: string[], publishNote: string|null }}
 *   items: { level, title, detail, prompt }  detail は画面用、prompt は依頼文用
 */
export function assessFeasibility(v) {
  const items = [];
  const missing = [];
  const push = (level, title, detail, prompt) => items.push({ level, title, detail, prompt });

  // ---- 保存・共有
  if (v.storage === 'none') {
    push('static', 'データを保存しない', 'その場で計算・表示するだけなら、ブラウザの中だけで完結します。', null);
  } else if (v.storage === 'local') {
    push('static', 'この端末に保存',
      'ブラウザの保存機能（localStorage・IndexedDB）で実現できます。ただし、ブラウザの履歴・データ削除や端末の変更で消えることがあります。',
      '保存はブラウザ内の保存機能（localStorage や IndexedDB）で実現できる見込みです。ブラウザのデータ削除で消える可能性があることを踏まえて設計してください。');
  } else if (v.storage === 'share') {
    if (v.shareWho === 'myDevices') {
      push('external', '自分の複数の端末でデータを同期',
        '端末をまたいで同じデータを使うには、データを置いておくサーバーやクラウドのデータベースが必要です。GitHub Pagesだけでは実現できません。「ファイルに書き出して、別の端末で読み込む」方式なら静的Webでも可能です。',
        '複数の端末でデータを同期するには、データを保存する外部サービス（クラウドのデータベースなど）が必要になる見込みです。外部サービスなしの代替案として「データをファイルに書き出し、別の端末で読み込む」方式も比較してください。');
    } else if (v.shareWho === 'group') {
      push('external', '決まった人たちとデータを共有',
        '共有用のデータベースと、「誰が見られるか」を決める仕組み（多くの場合ログイン）が必要です。',
        '決まった人たちとデータを共有するには、共有用のデータベースと、アクセスできる人を制限する仕組みが必要になる見込みです。');
    } else if (v.shareWho === 'public') {
      push('review', '不特定多数が投稿・閲覧',
        'データベースやログインに加えて、荒らし・不適切な投稿への対策、個人情報の扱い、運営の手間など、技術以外の検討も必要です。',
        '不特定多数が投稿・閲覧する仕組みは、データベースとログインに加え、不適切な投稿への対策・個人情報の扱い・運営方法の検討が必要です。初心者が安全に運用できるかも含めて検討してください。');
    } else {
      missing.push('データを誰と共有するか');
    }
    if (v.shareEdit === 'yes') {
      push('review', '複数人が書き込む',
        '同時に書き込んだときの上書き（競合）や、誰が何を変えたかの管理を考える必要があります。',
        '複数人が書き込むため、同時編集による上書き（競合）と変更履歴の扱いを検討してください。');
    } else if (v.shareEdit === 'unknown') {
      missing.push('共有相手も書き込むかどうか');
    }
  } else {
    missing.push('データを保存・共有するかどうか');
  }

  // ---- ログイン
  if (v.login === 'yes') {
    const soloLocal = v.users === 'self' && (v.storage === 'none' || v.storage === 'local');
    push('external', 'ログイン（認証）',
      `安全なログインには、認証サービスとサーバー側の仕組みが必要です。パスワードの確認をブラウザ側のコードだけで作るのは安全ではありません。${soloLocal ? '自分だけ・この端末だけで使うなら、ログインなしで済む可能性もあります。' : ''}`,
      `ログインには認証サービス（外部の認証基盤など）が必要になる見込みです。ブラウザ側のコードだけでパスワードを確認する方式は提案しないでください。${soloLocal ? '利用者は本人のみで端末内保存のため、ログインが本当に必要かも検討してください。' : ''}`);
  } else if (v.login === 'unknown') {
    missing.push('ログインが必要かどうか');
  }

  // ---- 外部サービス
  const ext = Array.isArray(v.external) ? v.external : [];
  if (has(ext, 'ai')) {
    push('external', '生成AIの組み込み',
      '生成AIのAPIを使うにはAPIキー（利用のための秘密の鍵）が必要です。APIキーをHTMLやJavaScriptに書くと誰でも見られるため、キーを隠しておく中継用のサーバーが必要になり、利用料金もかかります。この工房のように「AIへの依頼文を作って、利用者が自分のAIに貼る」方式なら、静的Webだけで作れます。',
      '生成AIのAPIを使う場合、APIキーを秘密に保つための中継サーバー（バックエンド）が必要になる見込みです。APIキーをHTMLやJavaScriptに書き込む構成は絶対に提案しないでください。利用料金の目安と、APIを使わずに「AIへの依頼文を作ってコピーする」方式で代替できるかも比較してください。');
  }
  if (has(ext, 'publicData')) {
    push('external', '公開情報（天気・地図など）の取り込み',
      'APIキーが不要で、ブラウザからの利用が許可されている（CORS対応の）サービスなら、GitHub Pagesからでも直接使えます。キーが必要なものや許可されていないものは、サーバー経由が必要です。利用規約と回数制限の確認も必要です。',
      '公開情報の取り込みは、APIキーが不要でブラウザからの利用が許可されている（CORS対応の）提供元を優先して検討してください。利用規約・回数制限・提供終了の可能性も確認してください。');
  }
  if (has(ext, 'account')) {
    push('review', '他サービスのアカウント連携',
      'Googleなどとの連携には、認証の設定（OAuthなど）・権限の範囲・秘密情報の管理が必要で、設定の難易度が高めです。',
      '他サービスのアカウント連携（OAuthなど）は、認証設定・必要な権限の範囲・秘密情報の管理が必要です。初心者が設定できる手順か、より簡単な代替（ファイルの書き出し・読み込みなど）がないかも検討してください。');
  }
  if (has(ext, 'notify')) {
    push('external', 'メール・通知の送信',
      'メールの送信や、決まった時刻に通知を送る処理には、サーバーや外部サービスが必要です。予定をカレンダー用のファイルに書き出す、などで代用できる場合もあります。',
      'メールや定時の通知を送るには、送信用の外部サービスやサーバーが必要になる見込みです。カレンダー用ファイル（.ics）の書き出しなど、サーバーなしの代替案があれば比較してください。');
  }
  if (has(ext, 'payment')) {
    push('review', '決済（お金のやりとり）',
      '決済サービスとサーバー側の処理が必須です。返金対応や、販売に必要な表示（法律上の義務）の確認など、技術以外の準備も必要になります。',
      '決済には決済サービスとサーバー側の処理が必須です。カード情報を自分のサイトで扱わない構成を前提に、必要な準備（返金対応・法律上必要な表示の確認など）も含めて検討してください。');
  }
  if (has(ext, 'unknown')) missing.push('外部のサービスとつなぐかどうか');

  // ---- 個人情報
  if (v.personal === 'yes') {
    const where = v.storage === 'local'
      ? '端末内に保存するだけなら外部へ送られませんが、共有の端末では他の人に見られる可能性があります。'
      : '保存場所・公開範囲・削除の方法を決める必要があります。';
    push('review', '個人情報を扱う',
      `${where}GitHub自身も、GitHub Pagesをパスワードやクレジットカード番号などの機密情報のやりとりに使わないよう案内しています。`,
      '個人情報を扱うため、保存場所・公開範囲・削除方法を明確にし、必要以上の情報を集めない設計にしてください。');
  } else if (v.personal === 'unknown') {
    missing.push('個人情報を扱うかどうか');
  }

  // ---- ファイル
  const files = Array.isArray(v.files) ? v.files : [];
  if (files.length) {
    push('static', 'ファイルの読み込み・書き出し',
      '選んだファイルの読み込みや、画像・テキストの保存（ダウンロード）は、ブラウザの中だけで処理できます。', null);
  }

  // ---- 公開先
  let publishNote = null;
  if (v.publish === 'localOnly') {
    publishNote = '自分の端末だけで使う場合、HTMLファイルを直接開くと一部の作り方（複数のJavaScriptファイルの読み込みなど）が動かないことがあります。1つのHTMLファイルにまとめる構成が無難です。';
  } else if (v.publish === 'other') {
    publishNote = 'GitHub Pages以外の公開先では、使える機能や制限が異なります。この判定はGitHub Pagesを基準にした参考です。';
  } else if (v.publish === 'ai') {
    missing.push('どこで公開するか');
  }

  const rank = Math.max(1, ...items.map((i) => LEVELS[i.level].rank));
  const level = Object.keys(LEVELS).find((k) => LEVELS[k].rank === rank);
  return { level, items, missing, publishNote };
}

/** 依頼文に入れる「実現方法の前提」の文 */
export function feasibilityPromptLines(result) {
  const lines = [];
  const prompts = result.items.filter((i) => i.prompt).map((i) => i.prompt);
  if (result.level === 'static') {
    lines.push('回答の範囲では、ログイン・データの共有・秘密のAPIキーが不要なため、GitHub Pagesで動く静的Webアプリ（HTML・CSS・JavaScriptのみ）として実現しやすいと考えています。');
    lines.push('まずこの構成で設計し、要件を満たすのに不要なサーバー・データベース・フレームワークは追加しないでください。');
  } else if (result.level === 'external') {
    lines.push('GitHub Pagesを画面部分として使いつつ、一部で外部サービスとの連携が必要になる可能性があります。');
    lines.push('必要な外部サービスの候補を、費用・難易度・リスクの観点で比較してください。外部サービスなしで作れる簡易版があれば、それも提案してください。');
  } else {
    lines.push('安全性・運用・費用の面で、追加の技術的検討が必要な要素があります。初心者が安全に作って運用できるかも含めて、慎重に検討してください。');
    lines.push('GitHub Pagesだけでの実現にこだわらず、必要なら別の構成や、範囲を絞った簡易版も提案してください。');
  }
  lines.push(...prompts);
  return lines;
}
