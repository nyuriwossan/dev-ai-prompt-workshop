// ① アイデアを考えたい：AIにアイデア提案を頼む依頼文。工房自身はアイデアを生成しない。

import { Doc, quote, bullets, numbered } from './md.js';
import { skillLine } from './common.js';
import { targetKind } from '../data/targets.js';
import { getMode } from '../data/modes.js';
import { optionLabel } from '../data/options.js';

const DIRECTION_TEXT = {
  practical: '実用性を重視してください。毎日の生活で実際に役立ち、使い続けられるものを中心にしてください。',
  mashup: '意外な組み合わせを重視してください。一見関係のなさそうなテーマや仕組みを掛け合わせた発想を中心にしてください。',
  original: '独創性を重視してください。よくあるアプリの焼き直しではなく、見たことのない切り口のものを中心にしてください。',
  easy: '作りやすさを重視してください。初心者がAIの助けを借りて、短い期間で1つ完成させられる規模のものを中心にしてください。',
  wide: '実用的なもの・遊び心のあるもの・変わり種など、種類の異なるアイデアを幅広く混ぜてください。',
};

const SCOPE_TEXT = {
  pages: 'GitHub Pages（無料で使える静的サイトの公開場所）だけで作れるものに限ってください。ログイン、データの共有、サーバーでの処理、秘密のAPIキーが必要なものは主案にしないでください。',
  allowExternal: '外部サービス（データベース、ログイン、外部APIなど）が必要なアイデアも候補に入れてかまいません。その場合は、必要なサービスと難しさを明記してください。',
  unknown: 'どこまでの仕組みが必要になるか、私にはまだ判断できません。GitHub Pagesだけで作れるものと、外部サービスが必要なものを区別して提案してください。',
};

const USERS_TEXT = { self: '自分', close: '家族・友だち', public: '誰でも（一般に公開）' };
const DEVICE_TEXT = { sp: 'スマートフォン中心', pc: 'パソコン中心', both: 'スマートフォンとパソコンの両方' };

export function buildIdeaPrompt(v, { target }) {
  const mode = getMode('idea');
  const kind = targetKind(target);
  const genreField = mode.steps[0].fields.find((f) => f.id === 'genres');
  const genres = (v.genres || []).filter((g) => g !== 'any').map((g) => optionLabel(genreField.options, g));
  const count = ['3', '6', '10'].includes(v.count) ? v.count : '6';

  const doc = new Doc();
  doc.heading(1, '依頼：個人開発のアイデア出し');
  doc.raw(
    '自分で作れそうなWebアプリ・ツールのアイデアを、一緒に考えてください。',
    '**まだコードは書かず、アイデアの提案だけをお願いします。**',
    kind === 'agent' ? 'この依頼では、ファイルの作成・変更やコマンドの実行は不要です。文章での提案だけを返してください。' : null,
    skillLine(v.skill, 'chat'),
  );

  doc.section('条件', [
    ...bullets([
      genres.length ? `ジャンル：${genres.join('、')}` : 'ジャンル：問いません（幅広く）',
      `発想の方向性：${optionLabel(mode.steps[0].fields[1].options, v.direction) || '幅広く多彩に'}`,
      USERS_TEXT[v.users] ? `使う人：${USERS_TEXT[v.users]}` : null,
      DEVICE_TEXT[v.device] ? `主に使う端末：${DEVICE_TEXT[v.device]}` : null,
      `作り手の経験：${optionLabel(mode.steps[2].fields[0].options, v.skill) || 'はじめて'}`,
    ]),
  ]);

  doc.section('興味のあるテーマ・好きなもの', v.interests ? quote(v.interests) : null);
  doc.section('日常の困りごと・面倒に感じること', v.troubles ? quote(v.troubles) : null);
  doc.section('避けたいもの', v.avoid ? quote(v.avoid) : null);

  doc.section('提案の方針', bullets([
    DIRECTION_TEXT[v.direction] || DIRECTION_TEXT.wide,
    SCOPE_TEXT[v.scope] || SCOPE_TEXT.unknown,
    'ありきたりなToDoアプリや家計簿だけに偏らず、創作・遊び・ランダム生成・シミュレーションなど、発想の面白さがあるものも混ぜてください。',
    (v.interests || v.troubles) ? '上に書いた好きなもの・困りごとを、できるだけ題材に取り入れてください。' : null,
  ]));

  doc.section('お願いしたいこと', [
    ...numbered([
      `アイデアを${count}個提案してください。`,
      '各アイデアについて、次の項目を書いてください。',
    ]),
    ...[
      'アイデア名と、一言での説明',
      '魅力（使うと何が楽しい・うれしいか）と目的',
      '主な機能（3つ程度）',
      '実現の難しさ（★1〜★3）とその理由',
      '初心者がAIの助けを借りて作れそうか',
      '実現方法：「GitHub Pagesだけで作れる」「外部サービスとの連携が必要」「追加の技術的検討が必要」のどれに当たるかと、その理由',
      '難しい場合は、GitHub Pagesだけで作れる簡易版の案',
    ].map((t) => `   - ${t}`),
    '3. 最後に、全アイデアの比較表（アイデア名／難しさ／実現方法／おすすめ度）を付けてください。',
    '4. 私の条件に特に合うものを1〜2個選び、理由を説明してください。',
  ]);

  doc.section('注意してほしいこと', bullets([
    'ログイン・個人情報・お金のやりとりが必要なアイデアは、必要な仕組みと注意点をはっきり書いてください。',
    '生成AIのAPIを組み込むアイデアは、APIキーを秘密に保つためのサーバーが必要になることと、利用料金がかかることを明記してください。',
    '実在のサービスやAPIを挙げる場合は、料金や利用条件が変わる可能性があることを添えてください。',
    '確かでないことは断定しないでください。',
  ]));

  doc.section('このあとの進め方', [
    '私がアイデアを1つ選んだら、次の形式でまとめ直してください。（この形式は、私が開発の依頼文を作るときに貼り付けて使います）',
    '',
    ...bullets([
      'アイデア名：',
      '何を作るか（1文）：',
      '誰が・どんな場面で使うか：',
      '絶対に必要な機能（優先順）：',
      'あったら嬉しい機能：',
      '保存するデータと保存先の見込み：',
      '実現方法の見込み（GitHub Pagesだけで作れるか）：',
    ]),
  ]);

  return doc.toString();
}
