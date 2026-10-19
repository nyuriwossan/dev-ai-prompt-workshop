// ② 新しく作りたい：相談・設計用／実装用の依頼文。

import { Doc, quote, bullets, numbered, oneLine } from './md.js';
import {
  skillLine, deviceLine, moodLine, envLines, ruleFileLine, reportLines,
  SECURITY_LINE, XSS_LINE, NO_GUESS_LINE,
} from './common.js';
import { toLines } from '../logic/form.js';
import { assessFeasibility, feasibilityPromptLines } from '../logic/feasibility.js';
import { targetKind } from '../data/targets.js';
import { getMode, allFields } from '../data/modes.js';
import { optionLabel } from '../data/options.js';

const field = (id) => allFields(getMode('create')).find((f) => f.id === id);
const label = (id, value) => optionLabel(field(id).options, value);

const USERS_LINE = {
  self: '利用者は本人のみです。',
  close: '利用者は家族・友だちなどの少人数です。',
  public: '不特定多数の人が使うことを想定しています。',
  unknown: null,
};

/** 未確定（分からない）とおまかせ（AIに提案してほしい）の項目 */
export function undecidedItems(v) {
  const unknown = [];
  const delegated = [];
  if (v.users === 'unknown') unknown.push('誰が使うか');
  if (v.storage === 'unknown') unknown.push('データを保存・共有するか');
  if (v.shareEdit === 'unknown') unknown.push('共有相手も書き込むか');
  if (v.login === 'unknown') unknown.push('ログインが必要か');
  if ((v.external || []).includes('unknown')) unknown.push('外部のサービスとつなぐか');
  if (v.personal === 'unknown') unknown.push('個人情報を扱うか');
  if (v.publish === 'ai') delegated.push('公開先');
  if (v.mood === 'ai') delegated.push('画面の雰囲気');
  if (v.backup === 'ai') delegated.push('バックアップ（ファイルへの書き出し）機能の要否');
  if (v.tech === 'ai' || !v.tech) delegated.push('使う技術・ファイル構成');
  if (!toLines(v.done).length) delegated.push('完成条件');
  return { unknown, delegated };
}

function storageLines(v, implement) {
  const lines = [];
  if (v.storage === 'none') lines.push('入力内容は保存しません。ページを閉じたら消えてかまいません。');
  if (v.storage === 'local') {
    lines.push(implement
      ? '入力内容を端末内（ブラウザ）に保存し、ページの再読み込みやブラウザの再起動後も残るようにしてください。'
      : '入力内容を端末内（ブラウザ）に保存し、ページの再読み込みやブラウザの再起動後も残せる構成を検討してください。');
    if (v.backup === 'yes') lines.push('保存したデータをファイルに書き出してバックアップし、そのファイルを読み込んで復元できるようにしたいです。');
    if (v.backup === 'no') lines.push('ファイルへの書き出し（バックアップ）機能は不要です。');
    if (v.backup === 'ai') lines.push('ファイルへの書き出し（バックアップ）機能が必要かどうかも提案してください。');
  }
  if (v.storage === 'share') {
    const who = { myDevices: '自分の複数の端末（スマートフォンとパソコンなど）', group: '決まった人たち（家族・仲間など）', public: '不特定多数' }[v.shareWho];
    lines.push(`データを${who || '他の端末や他の人'}と共有したいです。`);
    if (v.shareEdit === 'yes') lines.push('共有した相手も書き込みます（複数人が書き込む）。');
    if (v.shareEdit === 'readOnly') lines.push('書き込むのは私だけで、他の人は見るだけです。');
  }
  if (v.storage === 'unknown') lines.push('保存が必要かどうかは未確定です。');
  return bullets(lines);
}

function connectionLines(v) {
  const ext = v.external || [];
  const lines = [];
  if (v.login === 'no') lines.push('ログイン：不要です。');
  if (v.login === 'yes') lines.push('ログイン：必要です。');
  if (v.login === 'unknown') lines.push('ログイン：必要かどうか未確定です。');
  if (ext.includes('none')) lines.push('外部サービス：つなぎません。');
  else if (ext.includes('unknown')) lines.push('外部サービス：つなぐかどうか未確定です。');
  else if (ext.length) {
    const names = ext.map((e) => label('external', e));
    lines.push(`外部サービス：${names.join('／')}`);
  }
  if (v.externalNote) lines.push(`外部サービスでしたいこと：${v.externalNote}`);
  if (v.personal === 'no') lines.push('個人情報（名前・連絡先・住所など）：扱いません。');
  if (v.personal === 'yes') lines.push('個人情報（名前・連絡先・住所など）：扱います。');
  if (v.personal === 'unknown') lines.push('個人情報：扱うかどうか未確定です。');
  const files = (v.files || []).map((f) => label('files', f));
  if (files.length) lines.push(`ファイル：${files.join('／')}（ブラウザの中で処理し、外部へ送らない）`);
  return bullets(lines);
}

function publishLines(v) {
  const lines = [];
  if (v.publish === 'pages') lines.push('公開先：GitHub Pages（無料の静的サイト公開）で公開したいです。');
  if (v.publish === 'localOnly') lines.push('公開先：公開はせず、自分の端末で使えれば十分です。HTMLファイルを開くだけで使えるよう、1つのHTMLファイルにまとめる構成を優先してください。');
  if (v.publish === 'other') lines.push(`公開先：${v.publishOther ? `${v.publishOther}（GitHub Pages以外）` : 'GitHub Pages以外の場所'}で公開したいです。`);
  if (v.publish === 'ai') lines.push('公開先：決めていません。無料で始めやすい公開方法を提案してください。');
  if (v.tech === 'single' && v.publish !== 'localOnly') lines.push('作り方：1つのHTMLファイルにまとめてください。');
  if (v.tech === 'plain') lines.push('作り方：HTML・CSS・JavaScriptだけで、ビルド（変換作業）なしで動く構成にしてください。');
  if (v.tech === 'specify' && v.techNote) lines.push(`作り方：${v.techNote}`);
  if (v.tech === 'specify' && !v.techNote) lines.push('作り方：指定したい技術があります（詳細は未記入）。');
  return bullets(lines);
}

/** 実装用で、完成条件が空欄のときの既定の条件 */
export function defaultDoneLines(v) {
  return [
    '「必須の機能」がすべて動く',
    v.device === 'sp' || v.device === 'both' ? 'スマートフォンの画面幅で、表示が崩れず操作できる' : null,
    v.device === 'pc' || v.device === 'both' ? 'パソコンの画面幅で、表示が崩れず操作できる' : null,
    v.storage === 'local' ? 'ページを再読み込みしても、保存した内容が残っている' : null,
    v.storage === 'local' && v.backup === 'yes' ? '書き出したファイルを読み込んで、データを復元できる' : null,
    v.publish === 'pages' ? 'GitHub Pagesの公開URLで開いても、同じように動く' : null,
    'ブラウザの開発者ツール（コンソール）にエラーが出ていない',
  ].filter(Boolean);
}

export function buildCreatePrompt(v, { target, purpose }) {
  const kind = targetKind(target);
  const implement = purpose === 'implement';
  const must = toLines(v.must);
  const nice = toLines(v.nice);
  const notNow = toLines(v.notNow);
  const done = toLines(v.done);
  const feas = assessFeasibility(v);
  const { unknown, delegated } = undecidedItems(v);

  const doc = new Doc();
  doc.heading(1, implement ? `依頼：新しいWebアプリの実装「${oneLine(v.what)}」` : `依頼：新しいWebアプリの設計相談「${oneLine(v.what)}」`);
  if (implement) {
    doc.raw(
      '次の要件で、Webアプリを作ってください。',
      skillLine(v.skill, kind),
    );
  } else {
    doc.raw(
      '作りたいWebアプリがあります。実装に入る前に、仕様の整理と実現方法の検討を手伝ってください。',
      kind === 'agent'
        ? '**この段階では、まだコードを書かず、ファイルの作成・変更もしないでください。**'
        : '**この段階では、まだコードを書かないでください。**',
      skillLine(v.skill, kind),
    );
  }

  doc.section('作りたいもの', oneLine(v.what));
  doc.section('目的・使う場面', v.purpose ? quote(v.purpose) : null);
  doc.section('参考：AIと一緒に考えたアイデア', v.fromIdea ? [
    '以前、AIに提案してもらったアイデアです。このページの他の項目と食い違う場合は、他の項目を優先してください。',
    '',
    ...quote(v.fromIdea),
  ] : null);

  doc.section('利用者と利用環境', bullets([
    USERS_LINE[v.users],
    v.users === 'unknown' ? '利用者の範囲（自分だけか、他の人も使うか）は未確定です。' : null,
    deviceLine(v.device),
    v.kind ? `種類：${label('kind', v.kind)}` : null,
  ]));

  doc.sectionWithSubs('機能', [
    { title: '必須の機能（優先順）', body: numbered(must) },
    { title: 'あったら嬉しい機能（今回は必須ではない）', body: nice.length ? [...bullets(nice), '', implement ? '必須の機能が完成するまでは手をつけず、追加する場合は事前に確認してください。' : '後から追加しやすい設計にしたいです。'] : null },
    { title: '今回は作らないもの', body: bullets(notNow) },
  ]);

  doc.section('使う流れ', v.flow ? quote(v.flow) : null);
  doc.section('データの保存', storageLines(v, implement));
  doc.section('ログイン・外部サービス・個人情報', connectionLines(v));
  doc.section('見た目', bullets([moodLine(v.mood, v.moodNote)]));
  doc.section('公開先と作り方', publishLines(v));

  doc.section('実現方法についての前提（依頼文作成ツールによる参考判定）', [
    ...bullets(feasibilityPromptLines(feas)),
    '',
    'この判定は私の回答をもとにした目安です。誤りや見落としがあれば指摘してください。',
  ]);

  const undecided = [];
  if (unknown.length) undecided.push(`未確定（私にも分からない）：${unknown.join('、')}`);
  if (delegated.length) undecided.push(`おまかせ（提案してほしい）：${delegated.join('、')}`);
  if (unknown.length) {
    undecided.push(implement
      ? '未確定の点のうち、作り方が大きく変わるものは、作業を始める前に選択肢と違いを示して質問してください。影響の小さいものは、仮定を明記して進めてください。'
      : '未確定の点は、答えによって作り方がどう変わるかを説明したうえで質問してください。');
  }
  doc.section('未確定・おまかせの点', bullets(undecided));

  doc.section('守ってほしいこと', bullets([
    SECURITY_LINE,
    NO_GUESS_LINE,
    implement ? '依頼していない機能（ログイン、外部連携、分析ツールなど）は追加しないでください。' : null,
    implement ? XSS_LINE : null,
    implement && feas.level !== 'static' ? '外部サービスが必要な部分は、私の確認なしに有料サービスの登録や秘密情報の設定を前提にしないでください。外部サービスなしで動く部分から作り、外部連携の部分は必要な準備と手順を説明してください。' : null,
    v.notes ? `その他：${oneLine(v.notes)}` : null,
  ]));

  if (!implement) {
    doc.section('お願いしたいこと', numbered([
      '上の内容をもとに、要件を整理してください。必須の機能と、後回しにできる機能を分けてください。',
      '仕様を決めるうえで重要な確認事項があれば、最大5つまで質問してください。影響の小さい点は、質問せずに仮の案を示してください。',
      'GitHub Pagesだけで作れるか、外部サービスが必要かを判断し、理由を説明してください。',
      '最初に作る範囲（最小限の完成形）を提案してください。',
      '画面の構成と、操作の流れを提案してください。',
      v.storage !== 'none' ? '保存するデータの内容と、保存の方法を提案してください。' : null,
      done.length ? '下の「完成条件」に足りないものがあれば提案してください。' : '完成条件はまだ決めていません。私が自分で確かめられる形で、完成条件の案を出してください。',
      '最後に、確定した内容を「実装用の要件まとめ」として、次の依頼にそのまま使える形でまとめてください。',
    ]));
    doc.section('完成条件（案）', bullets(done));
    doc.section('回答のしかた', bullets([
      '私が決める必要がある点と、AIからの提案を区別してください。',
      '確かでないことは断定せず、その旨を書いてください。',
    ]));
    return doc.toString();
  }

  // ---- 実装用
  doc.section('完成条件', [
    ...bullets(done.length ? done : defaultDoneLines(v)),
    done.length ? null : '',
    done.length ? null : '（完成条件は私が細かく決めていないため、上は目安です。足りない点があれば補って示してください。）',
  ]);

  if (kind === 'agent') {
    doc.section('進め方', numbered([
      ruleFileLine(target),
      '作業フォルダの状態を確認してください。既存のファイルがある場合は、上書きしてよいか私に確認してください。',
      '実装を始める前に、ファイル構成と実装方針を短く示してください。',
      '必須の機能から順に実装してください。',
      '実装後、利用できる確認方法（テスト、簡易サーバーでの表示確認、ブラウザでの操作確認など）で動作を確かめてください。',
      v.device === 'sp' || v.device === 'both' ? 'スマートフォンの画面幅でも表示と操作を確認してください（確認できない場合はその旨を報告してください）。' : null,
      'README に、使い方と公開・更新の手順を書いてください。',
      `今後の改修で既存の機能を壊さないよう、構成・データの保存形式・確認方法を、${target === 'codex' ? 'AGENTS.md' : 'CLAUDE.md'} などの作業ルールファイルに短くまとめてください。`,
    ]));
  } else {
    doc.section('進め方', [
      ...numbered([
        '作業を始める前に、要件に不明な点や矛盾がないか確認してください。',
        '最初に、ファイル構成と実装方針を短く説明してください。',
        kind === 'common'
          ? 'ファイルを直接作成・編集できる環境の場合は、ファイルを作成し、利用できる方法で動作を確認してください。チャットの場合は、コードを省略せず（「以下同じ」などと省かず）、ファイルごとに全体を示してください。'
          : 'コードは省略せず（「以下同じ」などと省かず）、ファイルごとに全体を示してください。',
        '作ったファイルを保存して、自分の端末で動作を確認する手順を説明してください。',
        v.publish === 'pages' ? 'GitHub Pagesで公開する手順を、はじめての人にも分かるように説明してください。' : null,
        '後で修正を頼むときのために、ファイル構成と、データの保存形式を短くまとめてください。',
      ]),
      ...(kind === 'chat' ? ['', ...bullets(envLines(target))] : []),
    ]);
  }

  doc.section('完了時の報告', bullets(reportLines({ create: true })));
  return doc.toString();
}
