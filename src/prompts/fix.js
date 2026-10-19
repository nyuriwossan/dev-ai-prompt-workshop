// ③ 作ったものを直したい：機能追加・変更・デザイン・不具合・公開の依頼文。
// 最重要：変更対象以外を壊さないこと。依頼文だけで破損を完全には防げない（画面で別に案内する）。

import { Doc, quote, bullets, numbered, oneLine, codeBlock } from './md.js';
import { skillLine, moodLine, ruleFileLine, reportLines, envLines } from './common.js';
import { toLines } from '../logic/form.js';
import { targetKind } from '../data/targets.js';
import { getMode, allFields } from '../data/modes.js';
import { optionLabel } from '../data/options.js';

const field = (id) => allFields(getMode('fix')).find((f) => f.id === id);
const label = (id, value) => optionLabel(field(id).options, value);

export const GOAL_TITLES = {
  add: '機能の追加',
  change: '機能の変更',
  design: 'デザインの変更',
  bug: '不具合の修正',
  publish: '公開・更新の相談',
};

const PROTECT_TEXT = {
  features: '今ある他の機能（今回の依頼と関係のない機能が、これまでどおり動くこと）',
  data: '保存されているデータと保存の形式（これまでに保存したデータが、変更後も読み込めること）',
  design: '今回の依頼で変える部分以外のデザイン・レイアウト',
  text: '画面の文章・表示内容（依頼した部分以外）',
  url: '公開URL・ファイル名・フォルダ構成',
};

const FREQ = { always: '毎回起きる', sometimes: 'ときどき起きる', once: '一度だけ起きた', unknown: '頻度は分からない' };

/** 公開の相談で、AIに確認してほしい観点（GitHub Pages の場合） */
const PAGES_CHECKPOINTS = {
  first: [
    'GitHub Pagesで公開する手順（リポジトリの設定画面で公開元を選ぶ方法。ブランチから公開する方法と、GitHub Actions を使う方法の違い）',
    '公開URLの形（多くの場合 https://ユーザー名.github.io/リポジトリ名/ ）',
    '公開前に確認すること（最初に開くファイル index.html の置き場所、ファイル名の大文字・小文字）',
  ],
  notUpdated: [
    '反映までに数分かかることがある点',
    'ブラウザに古い表示が残っている（キャッシュ）可能性と、その確かめ方',
    '公開元に設定しているブランチ・フォルダと、更新したファイルの場所が合っているか',
    'GitHub Actions を使っている場合、公開の処理が成功しているかの確かめ方',
  ],
  broken: [
    'ファイルの参照の書き方（「/」から始まる書き方は、リポジトリ名のついたURLで場所がずれやすい）',
    'ファイル名・フォルダ名の大文字・小文字の違い',
    '最初に開くファイル（index.html）の置き場所',
    'ブラウザの開発者ツール（コンソール）に出るエラーの確かめ方',
  ],
  url: [
    'リポジトリ名と公開URLの関係',
    'リポジトリ名を変えたときに、公開URLがどう変わるか',
  ],
  other: [],
};

function appLines(v, kind) {
  const lines = bullets([
    `アプリ：${oneLine(v.app)}`,
    v.repoUrl ? `GitHubリポジトリ：${oneLine(v.repoUrl)}` : null,
    v.siteUrl ? `公開サイト：${oneLine(v.siteUrl)}` : null,
    v.structure && v.structure !== 'unknown' ? `ファイルの構成：${label('structure', v.structure)}` : null,
    v.structure === 'unknown' ? 'ファイルの構成：分からない' : null,
    v.files ? `関係しそうなファイル：${oneLine(v.files)}` : null,
  ]);
  const access = [];
  if (kind === 'agent') {
    access.push(v.repoUrl
      ? '作業はこのリポジトリ（作業フォルダ）で行ってください。開いているフォルダが上のリポジトリと違う場合や、ファイルを確認できない場合は、作業を始めずに私に知らせてください。'
      : '作業は、いま開いている作業フォルダ（リポジトリ）で行ってください。対象のアプリのファイルが見当たらない場合は、作業を始めずに私に知らせてください。');
  } else {
    if (v.repoUrl || v.siteUrl) access.push('上のURLの中身をあなたが直接確認できない場合は、推測で進めず、確認に必要なファイル（例：index.html や JavaScript のファイル）を貼り付けるよう私に依頼してください。');
    else access.push('コードはまだ貼り付けていません。確認に必要なファイルを教えてください。私が貼り付けます。');
    access.push('どのファイルが必要か私には分からないことがあるので、探し方も教えてください。');
    if (kind === 'common') access.unshift('あなたがファイルを直接読める環境の場合は、まず関係するファイルを確認してください。');
  }
  return [...lines, '', ...access];
}

function requestParts(v) {
  const shot = v.attachShot ? '添付のスクリーンショットも参照してください。' : null;
  switch (v.goal) {
    case 'add':
      return [
        { title: '追加したい機能', body: quote(v.addWhat) },
        { title: '追加する場所', body: v.addWhere ? oneLine(v.addWhere) : null },
        { title: '今の状態', body: v.current ? quote(v.current) : null },
        { title: '追加後の動き', body: quote(v.after) },
        { title: '理由・使う場面', body: v.addWhy ? quote(v.addWhy) : null },
      ];
    case 'change':
      return [
        { title: '変えたいところ', body: oneLine(v.target) },
        { title: '今の動き', body: quote(v.current) },
        { title: '変更後の動き', body: quote(v.after) },
        { title: '理由・使う場面', body: v.addWhy ? quote(v.addWhy) : null },
      ];
    case 'design':
      return [
        { title: '変えたい場所', body: oneLine(v.target) },
        { title: '今の見た目・気になっている点', body: v.current ? quote(v.current) : null },
        { title: '変更後のイメージ', body: [...quote(v.after), shot ? '' : null, shot] },
        { title: '雰囲気', body: v.mood ? moodLine(v.mood, '') : null },
        { title: '使っている端末・ブラウザ', body: v.env ? oneLine(v.env) : null },
      ];
    case 'bug':
      return [
        { title: '起きていること', body: [...quote(v.symptom), shot ? '' : null, shot] },
        { title: '再現手順', body: numbered(toLines(v.steps)) },
        { title: '期待する結果', body: quote(v.expected) },
        { title: '実際の結果', body: quote(v.actual) },
        { title: 'エラーメッセージ', body: v.errorText ? codeBlock(v.errorText) : 'エラーメッセージは確認できていません（表示されていない、または見方が分からない）。' },
        { title: '発生頻度', body: v.frequency ? FREQ[v.frequency] : null },
        { title: 'いつから・直前に変えたこと', body: v.since ? quote(v.since) : null },
        { title: '使っている端末・ブラウザ', body: v.env ? oneLine(v.env) : null },
      ];
    case 'publish':
      return [
        { title: '困っていること', body: label('pubGoal', v.pubGoal) },
        { title: '公開先', body: label('pubWhere', v.pubWhere) },
        { title: '状況', body: v.pubDetail ? quote(v.pubDetail) : null },
      ];
    default:
      return [];
  }
}

function protectLines(v) {
  const chosen = (v.protect || []).map((p) => PROTECT_TEXT[p]).filter(Boolean);
  const lines = [
    v.goal === 'publish'
      ? '公開・更新の作業のために、アプリの機能やデザインを変えないでください。変更が必要な場合は、理由を説明して私の確認を取ってください。'
      : '今回の依頼の対象以外の機能・デザイン・文章は、原則として変更しないでください。',
  ];
  const out = bullets(lines);
  if (chosen.length || v.protectNote) {
    out.push('- 特に、次のものは今の状態を保ってください。');
    for (const c of chosen) out.push(`  - ${c}`);
    if (v.protectNote) out.push(`  - ${oneLine(v.protectNote)}`);
  }
  out.push(...bullets([
    '変更は必要最小限にしてください。今回の目的に関係のない整理や書き換え（リファクタリング）、依頼していない機能の追加はしないでください。',
    '保存の処理やデータの形式を変える必要がある場合は、作業の前に理由と影響を説明し、私の確認を取ってください。',
    'APIキー・パスワード・アクセストークンなどの秘密情報を、コードに書き込まないでください。',
  ]));
  return out;
}

function backupLines(v, kind, implement) {
  const lines = [];
  if (v.backup === 'git') lines.push('今の状態は、GitHubなどに保存（コミット）してあります。');
  if (v.backup === 'copy') lines.push('今の状態は、ファイルのコピーを取ってあります。');
  if (kind === 'agent' && implement) {
    lines.push('作業の前に、未保存の変更がないか（git status など）を確認してください。可能なら作業用のブランチを作ってから変更してください。');
    if (v.backup === 'no' || v.backup === 'unknown') lines.push('今の状態がまだ保存されていない可能性があります。変更を始める前に、今の状態を記録（コミットなど）してよいか私に確認してください。Gitが使えない場合は、変更前のファイルを残す方法を提案してください。');
  } else if (v.backup === 'no' || v.backup === 'unknown') {
    lines.push('今の状態をまだ保存していません（または、保存できているか分かりません）。作業の前に、元に戻せるよう今のファイルを保存する方法を、初心者にも分かるように教えてください。');
  }
  if (implement) lines.push('うまく動かなかったときに、変更前の状態へ戻す方法も教えてください。');
  return bullets(lines);
}

function processLines(v, target, kind, implement) {
  const isBug = v.goal === 'bug';
  if (v.goal === 'publish') {
    const pts = v.pubWhere === 'pages' ? PAGES_CHECKPOINTS[v.pubGoal] || [] : [];
    return [
      ...numbered([
        '状況から考えられる原因や、必要な手順を説明してください。',
        '私が確認・操作することを、1つずつ順番に書いてください。',
        '設定画面のメニュー名や配置は変わることがあるため、見つからない場合の探し方も添えてください。',
        implement && kind === 'agent' ? '修正が必要なファイルがあれば、必要最小限の変更をしてください。公開設定など、私がブラウザで操作する必要があることは手順として書いてください。' : null,
        implement && kind !== 'agent' ? '修正が必要なファイルがあれば、どこをどう変えるか分かるように示してください。' : null,
      ]),
      ...(pts.length ? ['', '次の観点も確認してください。', ...bullets(pts)] : []),
    ];
  }

  if (!implement) {
    const common = isBug
      ? [
        '関係しそうなコードを確認し、原因の候補を、可能性の高い順に挙げてください。',
        '原因を確かめる方法を説明してください。私が確認する必要がある場合は、手順（ブラウザのコンソールの見方など）も書いてください。',
        '修正の方針と、影響が出そうな範囲を説明してください。',
      ]
      : [
        '関係しそうな既存のコードと、変更の影響範囲を確認してください。',
        '実現の方法を提案してください。方法が複数ある場合は、手間と影響の大きさで比較してください。',
        '影響を受けそうな既存の機能やデータがあれば、挙げてください。',
        '変更するファイルと、変更箇所の見込みを示してください。',
      ];
    return numbered([
      kind === 'agent' ? ruleFileLine(target) : null,
      ...common,
      kind === 'agent' ? 'この段階では、まだファイルを変更しないでください。' : 'この段階では、まだコードを書き換えないでください。',
    ]);
  }

  if (kind === 'agent') {
    return numbered([
      ruleFileLine(target),
      '変更の前に関係するコードを読み、影響範囲を確認したうえで、変更の計画を短く示してください。',
      isBug ? '原因を特定してから修正してください。推測だけで複数の箇所を書き換えないでください。' : null,
      '必要最小限の変更で実装してください。',
      isBug ? '修正後、上の「再現手順」を実行して、期待する結果になることを確認してください。' : '変更後、依頼した内容どおりに動くことを確認してください。',
      '利用できるテスト・ビルド・ブラウザでの操作確認を実行し、既存の機能が壊れていないか（回帰）を確認してください。',
      '差分（git diff など）を確認し、依頼の範囲外の変更が入っていたら元に戻してください。',
    ]);
  }

  return [
    ...numbered([
      '変更の前に、関係するコードを確認し、影響範囲を説明してください。コードが手元にない場合は、必要なファイルを私に求めてください。',
      isBug ? '原因を特定してから修正してください。推測だけで複数の箇所を書き換えないでください。' : null,
      '変更は必要最小限にしてください。',
      '変更したファイルは、どこをどう変えたか分かるように示してください。ファイルが短い場合は、置き換えられるようファイル全体を示してください。長い場合は、変更箇所の前後も含めて、どこを置き換えるか分かるように示してください。',
      kind === 'common' ? 'ファイルを直接編集できる環境の場合は、変更後に利用できる方法で動作を確認し、依頼の範囲外の変更が入っていないか差分を確認してください。' : null,
      isBug
        ? '修正後に私が確認する手順を書いてください（上の「再現手順」で直ったかどうか＋既存の機能が今までどおり動くか）。'
        : '変更後に私が確認する手順を書いてください（依頼した変更＋既存の機能が今までどおり動くか）。',
    ]),
    ...(kind === 'chat' ? ['', ...bullets(envLines(target))] : []),
  ];
}

function doneLines(v) {
  const done = toLines(v.done);
  const lines = [];
  if (v.goal === 'bug') lines.push('「再現手順」を実行しても、「期待する結果」のとおりになる');
  if (v.goal === 'add') lines.push('「追加後の動き」のとおりに使える');
  if (v.goal === 'change') lines.push('「変更後の動き」のとおりになる');
  if (v.goal === 'design') lines.push('「変更後のイメージ」に沿った見た目になっている');
  if (v.goal !== 'publish') {
    lines.push('「変更してはいけないこと」に書いたものが、変更前と同じように動く・表示される');
    if ((v.protect || []).includes('data')) lines.push('変更前に保存したデータが、変更後も読み込める');
  }
  lines.push(...done);
  return bullets(lines);
}

export function buildFixPrompt(v, { target, purpose }) {
  const kind = targetKind(target);
  const implement = purpose === 'implement';
  const goalTitle = GOAL_TITLES[v.goal] || '改修';

  const doc = new Doc();
  const stage = v.goal === 'publish' ? '' : implement ? '' : '（まず相談）';
  doc.heading(1, `依頼：既存のWebアプリの${goalTitle}${stage}`);
  const intro = {
    add: 'AIと一緒に作ったWebアプリに、機能を追加したいです。',
    change: 'AIと一緒に作ったWebアプリの、今ある機能を変更したいです。',
    design: 'AIと一緒に作ったWebアプリの、デザインを変更したいです。',
    bug: 'AIと一緒に作ったWebアプリで、不具合が起きています。',
    publish: 'AIと一緒に作ったWebアプリの、公開・更新について相談させてください。',
  }[v.goal];
  doc.raw(
    intro,
    v.goal === 'publish' ? null
      : implement
        ? (v.goal === 'bug' ? '原因を調べて修正してください。' : '下の内容で実装してください。')
        : (v.goal === 'bug' ? 'まず原因の調査と修正方針の検討をお願いします。' : 'まず実現方法と影響範囲の検討をお願いします。'),
    '**いちばん大切なのは、今回の依頼に関係のない部分を壊さないことです。**',
    skillLine(v.skill, kind),
  );

  doc.section('対象のアプリ', appLines(v, kind));
  doc.sectionWithSubs('依頼内容', requestParts(v));
  doc.section('変更してはいけないこと（最重要）', protectLines(v));
  doc.section('元に戻せるようにすること', backupLines(v, kind, implement));
  doc.section('進め方', processLines(v, target, kind, implement));
  if (v.goal !== 'publish' || implement) doc.section(implement ? '完了の条件' : '完了の条件（目安）', doneLines(v));
  if (implement) doc.section('完了時の報告', bullets(reportLines({ bug: v.goal === 'bug' })));
  else {
    doc.section('回答のしかた', bullets([
      '私が決める必要がある点と、AIからの提案を区別してください。',
      '確かでないことは断定せず、その旨を書いてください。',
      v.goal !== 'publish' ? '方針が決まったら、修正（実装）用の依頼に進みます。' : null,
    ]));
  }
  return doc.toString();
}
