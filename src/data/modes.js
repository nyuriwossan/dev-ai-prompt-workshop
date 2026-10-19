// 3つの入口（アイデア／新規作成／改修）のフォーム定義。
//
// 項目の書き方
//   id        値のキー（JSON保存にも使う）
//   type      text | textarea | radio | checks | check
//   label     画面の質問文（初心者の言葉で）
//   why       何のための質問か（小さく表示）
//   hint      入力の補足
//   placeholder / example
//   required  true または (values) => boolean
//   when      (values) => boolean。false のときは表示も検証も依頼文への反映もしない
//   advanced  true なら「もっと詳しく（任意）」の折りたたみに入れる
//   list      true なら1行1項目として扱う
//   max       最大文字数
//   default   初期値
//   options   [{ value, label, hint, exclusive }]  exclusive は「なし」「分からない」など他と同時に選べない選択肢

import { SKILL_OPTIONS, DEVICE_OPTIONS, MOOD_OPTIONS } from './options.js';

const has = (arr, ...xs) => Array.isArray(arr) && xs.some((x) => arr.includes(x));

// ---------------------------------------------------------------- ① アイデアを考えたい

const IDEA = {
  id: 'idea',
  no: '①',
  icon: '💡',
  title: 'アイデアを考えたい',
  short: '何を作るか、AIと一緒に考える',
  who: ['何か作りたいけれど、具体案がない', '普段の困りごとを解決する道具を考えたい', '面白い・変わったアイデアを探している'],
  resultTitle: 'アイデア出しの依頼文',
  purposes: ['consult'],
  steps: [
    {
      id: 'direction',
      title: '方向性',
      lead: 'どんな方向で考えたいか、ざっくり選んでください。あとから変えられます。',
      fields: [
        {
          id: 'genres', type: 'checks', required: true, label: 'どんなジャンルに興味がありますか？',
          why: 'AIが提案するアイデアの範囲を決めます。複数選べます。',
          options: [
            { value: 'life', label: '生活・便利', hint: '毎日のちょっとした面倒を減らす' },
            { value: 'create', label: '創作・表現', hint: '文章・絵・キャラクター・世界観' },
            { value: 'play', label: '遊び・ゲーム', hint: 'ミニゲーム・占い・ガチャ' },
            { value: 'hobby', label: '趣味・推し活', hint: '推しの記録・コレクション' },
            { value: 'organize', label: '整理・分析', hint: '記録をまとめる・見える化する' },
            { value: 'experiment', label: '実験・変わり種', hint: 'ランダム生成・シミュレーション' },
            { value: 'any', label: 'おまかせ', hint: 'ジャンルを問わず幅広く', exclusive: true },
          ],
        },
        {
          id: 'direction', type: 'radio', required: true, label: '発想の方向性は？', default: 'wide',
          why: 'アイデアの「尖り方」を変えます。',
          options: [
            { value: 'practical', label: '実用性を重視', hint: '毎日役に立つもの' },
            { value: 'mashup', label: '意外な組み合わせ', hint: '関係なさそうなものを掛け合わせる' },
            { value: 'original', label: '独創性を重視', hint: '見たことのないもの' },
            { value: 'easy', label: '簡単に作れるもの', hint: 'まず1つ完成させたい' },
            { value: 'wide', label: '幅広く多彩に', hint: 'いろいろな種類を見たい' },
          ],
        },
      ],
    },
    {
      id: 'self',
      title: '好きなこと・困りごと',
      lead: 'どちらも空欄で大丈夫です。書くほど、あなたに合ったアイデアになります。',
      fields: [
        {
          id: 'interests', type: 'textarea', label: '興味のあるテーマ・好きなもの', max: 1000, rows: 3,
          why: '好きなものを題材にすると、作り続ける気力が湧きやすくなります。',
          placeholder: '例：猫、和菓子、ファンタジー小説、天気、剣道',
        },
        {
          id: 'troubles', type: 'textarea', label: '日常の困りごと・面倒に感じること', max: 1000, rows: 3,
          why: '「困りごと」は、実用的な道具のいちばんの種です。',
          placeholder: '例：冷蔵庫の中身を忘れて同じものを買ってしまう／推しの配信予定を見逃す',
        },
        {
          id: 'avoid', type: 'textarea', label: '避けたいもの・苦手なもの', max: 500, rows: 2, advanced: true,
          placeholder: '例：毎日入力が必要なもの、個人情報を扱うもの',
        },
      ],
    },
    {
      id: 'conditions',
      title: '作る条件',
      lead: '作り手のあなたの状況を教えてください。',
      fields: [
        {
          id: 'skill', type: 'radio', required: true, label: '開発の経験は？', default: 'first',
          why: '経験に合った難しさのアイデアを出してもらうためです。',
          options: SKILL_OPTIONS,
        },
        {
          id: 'scope', type: 'radio', required: true, label: 'どこまでの仕組みを使ってよいですか？', default: 'pages',
          why: 'GitHub Pages（無料で使える公開場所）だけで作れるかどうかで、作りやすさが大きく変わります。',
          options: [
            { value: 'pages', label: 'GitHub Pagesだけで作れるもの', hint: '無料・ログインなし・サーバーなし' },
            { value: 'allowExternal', label: '外部サービスが必要なものも候補に', hint: 'ログインやデータ共有なども検討' },
            { value: 'unknown', label: '分からない', hint: '区別して提案してほしい' },
          ],
        },
        {
          id: 'users', type: 'radio', label: '誰が使いますか？', default: 'any',
          options: [
            { value: 'self', label: '自分' },
            { value: 'close', label: '家族・友だち' },
            { value: 'public', label: '誰でも（公開したい）' },
            { value: 'any', label: 'こだわらない' },
          ],
        },
        {
          id: 'device', type: 'radio', label: '主に使う端末は？', default: 'any',
          options: [...DEVICE_OPTIONS, { value: 'any', label: 'こだわらない' }],
        },
        {
          id: 'count', type: 'radio', label: 'いくつ提案してほしいですか？', default: '6', advanced: true,
          options: [
            { value: '3', label: '3個', hint: 'じっくり比べたい' },
            { value: '6', label: '6個' },
            { value: '10', label: '10個', hint: 'たくさん見たい' },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- ② 新しく作りたい

const CREATE = {
  id: 'create',
  no: '②',
  icon: '🛠️',
  title: '新しく作りたい',
  short: '作りたいものを、AIが作業できる依頼にする',
  who: ['作りたいものが決まっている', '頭の中にイメージはあるが、説明が難しい', 'AIにツールやゲームを作ってもらいたい'],
  resultTitle: '新規作成の依頼文',
  purposes: ['consult', 'implement'],
  steps: [
    {
      id: 'what',
      title: '作りたいもの',
      lead: 'まず、何を・何のために作るかを教えてください。',
      fields: [
        {
          id: 'fromIdea', type: 'textarea', label: 'AIに提案してもらったアイデア（あれば貼り付け）', max: 4000, rows: 5,
          why: '「アイデアを考えたい」でAIと決めたアイデアを、そのまま引き継げます。',
          hint: 'AIの返事をコピーして貼り付けてください。なければ空欄で大丈夫です。',
          collapsible: '①でアイデアを考えた人は、ここに貼り付け',
        },
        {
          id: 'what', type: 'text', required: true, label: '何を作りたいですか？', max: 120,
          why: '依頼文の見出しになります。一言で大丈夫です。',
          placeholder: '例：推しの誕生日までの日数を表示するカウントダウン',
        },
        {
          id: 'purpose', type: 'textarea', required: true, label: '何のために、どんな場面で使いますか？', max: 1000, rows: 3,
          why: '目的が分かると、AIが機能の優先順位を判断しやすくなります。',
          placeholder: '例：推しの誕生日や記念日を忘れないように、朝の通勤中にスマホで確認したい',
        },
        {
          id: 'users', type: 'radio', required: true, label: '誰が使いますか？',
          why: '使う人の数で、必要な仕組み（共有・ログインなど）が変わります。',
          options: [
            { value: 'self', label: '自分だけ' },
            { value: 'close', label: '家族・友だちなど少人数' },
            { value: 'public', label: '誰でも（不特定多数）' },
            { value: 'unknown', label: 'まだ決めていない' },
          ],
        },
        {
          id: 'kind', type: 'radio', label: 'どんな種類のものに近いですか？', advanced: true,
          options: [
            { value: 'tool', label: '便利な道具・計算' },
            { value: 'game', label: 'ゲーム・遊び' },
            { value: 'record', label: '記録・管理' },
            { value: 'creative', label: '創作・表現' },
            { value: 'site', label: '情報を見せるサイト' },
            { value: 'other', label: 'その他・分からない' },
          ],
        },
      ],
    },
    {
      id: 'features',
      title: '機能と見た目',
      lead: '「絶対に欲しい」と「あったら嬉しい」を分けると、AIが作りすぎを防げます。',
      fields: [
        {
          id: 'must', type: 'textarea', list: true, required: true, label: '絶対に欲しい機能（1行に1つ）', max: 1500, rows: 4,
          why: '最初に作る範囲になります。3〜5個までがおすすめです。',
          placeholder: '例：\n推しの名前と誕生日を登録できる\n誕生日までの残り日数を表示する\n登録した内容が次に開いたときも残っている',
        },
        {
          id: 'nice', type: 'textarea', list: true, label: 'あったら嬉しい機能（1行に1つ）', max: 1500, rows: 3,
          why: '今回は必須にせず、後から足す候補として伝えます。',
          placeholder: '例：誕生日当日に画面がお祝い仕様になる',
        },
        {
          id: 'mood', type: 'radio', label: '画面の雰囲気は？', default: 'ai',
          options: MOOD_OPTIONS,
        },
        {
          id: 'notNow', type: 'textarea', list: true, label: '今回は作らなくていいもの', max: 800, rows: 2, advanced: true,
          why: 'AIが頼んでいない機能を足すのを防ぎます。',
          placeholder: '例：ログイン機能、通知機能',
        },
        {
          id: 'flow', type: 'textarea', label: '使う流れ（開いてから終わるまで）', max: 800, rows: 2, advanced: true,
          placeholder: '例：開く→推しを登録→一覧で残り日数を見る',
        },
        {
          id: 'moodNote', type: 'text', label: 'デザインの希望（色・参考にしたい雰囲気など）', max: 200, advanced: true,
          placeholder: '例：くすんだ水色と白。文字は大きめ',
        },
      ],
    },
    {
      id: 'data',
      title: 'データと公開',
      lead: 'ここの答えで、GitHub Pagesだけで作れるかが決まります。分からなければ「分からない」で大丈夫です。',
      fields: [
        {
          id: 'device', type: 'radio', required: true, label: '主に使う端末は？',
          options: DEVICE_OPTIONS,
        },
        {
          id: 'storage', type: 'radio', required: true, label: '入力した内容を、次に開いたときも残したいですか？',
          why: '保存の仕方で、必要な仕組みが大きく変わります。',
          options: [
            { value: 'none', label: '残さなくていい', hint: 'その場で使うだけ' },
            { value: 'local', label: 'この端末に残したい', hint: '自分のスマホ・PCの中だけ' },
            { value: 'share', label: '他の端末や他の人とも共有したい' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'shareWho', type: 'radio', required: true, label: '誰と（どこと）共有しますか？',
          when: (v) => v.storage === 'share',
          options: [
            { value: 'myDevices', label: '自分の複数の端末', hint: 'スマホとPCで同じデータを見る' },
            { value: 'group', label: '決まった人たち', hint: '家族・仲間など' },
            { value: 'public', label: '不特定多数', hint: '誰でも投稿・閲覧できる' },
          ],
        },
        {
          id: 'shareEdit', type: 'radio', label: '共有した相手も書き込みますか？',
          when: (v) => v.storage === 'share' && (v.shareWho === 'group' || v.shareWho === 'public'),
          options: [
            { value: 'yes', label: '複数人が書き込む' },
            { value: 'readOnly', label: '書くのは自分だけ・他の人は見るだけ' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'backup', type: 'radio', label: 'データをファイルに書き出して、バックアップできるようにしますか？', default: 'ai',
          why: 'ブラウザの中の保存は、履歴の削除などで消えることがあります。',
          when: (v) => v.storage === 'local',
          options: [
            { value: 'yes', label: 'できるようにしたい' },
            { value: 'no', label: 'いらない' },
            { value: 'ai', label: 'おまかせ' },
          ],
        },
        {
          id: 'login', type: 'radio', required: true, label: 'ログイン（ID・パスワード）は必要ですか？',
          hint: '「自分だけ・この端末だけ」で使うなら、多くの場合ログインは不要です。',
          options: [
            { value: 'no', label: '不要' },
            { value: 'yes', label: '必要' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'external', type: 'checks', required: true, label: '外部のサービスとつなぎますか？', default: ['none'],
          why: '外部サービスを使うと、GitHub Pagesだけでは作れない場合があります。',
          options: [
            { value: 'none', label: 'つながない', exclusive: true },
            { value: 'ai', label: '生成AI（ChatGPT・Claudeなど）を組み込みたい' },
            { value: 'publicData', label: '天気・地図など公開情報を取り込みたい' },
            { value: 'account', label: 'Googleなど他サービスのアカウントやデータと連携したい' },
            { value: 'notify', label: 'メールや通知を送りたい' },
            { value: 'payment', label: 'お金のやりとり（決済）がある' },
            { value: 'unknown', label: '分からない', exclusive: true },
          ],
        },
        {
          id: 'externalNote', type: 'text', label: '外部サービスで何をしたいですか？', max: 300,
          when: (v) => has(v.external, 'ai', 'publicData', 'account', 'notify', 'payment'),
          placeholder: '例：今日の天気を表示したい／Googleカレンダーに予定を入れたい',
        },
        {
          id: 'personal', type: 'radio', required: true, label: '名前・連絡先・住所などの個人情報を扱いますか？',
          options: [
            { value: 'no', label: '扱わない' },
            { value: 'yes', label: '扱う' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'publish', type: 'radio', required: true, label: 'どこで使えるようにしたいですか？',
          options: [
            { value: 'pages', label: 'GitHub Pagesで公開', hint: '無料でURLから開ける' },
            { value: 'localOnly', label: '自分の端末で使えればいい' },
            { value: 'other', label: 'ほかの場所で公開' },
            { value: 'ai', label: '分からない', hint: 'AIに提案してほしい' },
          ],
        },
        {
          id: 'publishOther', type: 'text', label: 'どこで公開したいですか？', max: 120,
          when: (v) => v.publish === 'other',
          placeholder: '例：自分のブログの中に置きたい',
        },
        {
          id: 'files', type: 'checks', label: 'ファイルを扱いますか？', advanced: true,
          options: [
            { value: 'image', label: '画像を読み込む' },
            { value: 'data', label: 'CSV・Excel・JSONなどを読み込む' },
            { value: 'export', label: '画像やテキストをファイルとして保存する' },
          ],
        },
      ],
    },
    {
      id: 'done',
      title: '完成の目安',
      lead: '最後に、何ができたら「完成」かを決めましょう。',
      fields: [
        {
          id: 'done', type: 'textarea', list: true, label: '何ができれば「完成」ですか？（1行に1つ）', max: 1500, rows: 4,
          why: '「動いた気がする」で終わらず、確かめられる形にするためです。',
          hint: '空欄なら、AIに完成条件の案を出してもらう依頼文になります。',
          placeholder: '例：\niPhoneのSafariで開いて、推しを3人登録できる\n再読み込みしても登録内容が消えない',
        },
        {
          id: 'skill', type: 'radio', required: true, label: 'あなたの開発経験は？', default: 'first',
          why: 'AIの説明の細かさを合わせます。',
          options: SKILL_OPTIONS,
        },
        {
          id: 'tech', type: 'radio', label: '作り方の指定はありますか？', default: 'ai', advanced: true,
          options: [
            { value: 'ai', label: 'AIにおまかせ' },
            { value: 'single', label: '1つのHTMLファイルにまとめたい' },
            { value: 'plain', label: 'HTML・CSS・JavaScriptだけ（準備なしで動く形）' },
            { value: 'specify', label: '指定がある' },
          ],
        },
        {
          id: 'techNote', type: 'text', label: '指定したい技術・作り方', max: 200, advanced: true,
          when: (v) => v.tech === 'specify',
          placeholder: '例：Reactを使いたい',
        },
        {
          id: 'notes', type: 'textarea', label: 'その他、伝えておきたいこと', max: 1000, rows: 2, advanced: true,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- ③ 作ったものを直したい

const isGoal = (...gs) => (v) => gs.includes(v.goal);

const FIX = {
  id: 'fix',
  no: '③',
  icon: '🔧',
  title: '作ったものを直したい',
  short: '機能追加・変更・不具合修正・公開の相談',
  who: ['AIで作ったアプリに機能を足したい・変えたい', 'エラーや不具合を直したい', '公開・更新がうまくいかない'],
  resultTitle: '改修の依頼文',
  purposes: ['consult', 'implement'],
  steps: [
    {
      id: 'target',
      title: '何を直す？',
      lead: 'したいことと、対象のアプリを教えてください。',
      fields: [
        {
          id: 'goal', type: 'radio', required: true, label: '何をしたいですか？',
          why: '選んだ内容によって、次の質問が変わります。',
          options: [
            { value: 'add', label: '機能を追加したい' },
            { value: 'change', label: '今ある機能を変えたい' },
            { value: 'design', label: 'デザインを変えたい' },
            { value: 'bug', label: 'エラー・不具合を直したい' },
            { value: 'publish', label: '公開・更新について相談したい' },
          ],
        },
        {
          id: 'app', type: 'text', required: true, label: '対象のアプリは？（名前と、何をするものか）', max: 150,
          placeholder: '例：推しの誕生日カウントダウン（スマホ用のWebアプリ）',
        },
        {
          id: 'repoUrl', type: 'text', label: 'GitHubリポジトリのURL（あれば）', max: 300, inputmode: 'url',
          why: 'AIによっては、URLだけでは中身を見られません。見られないときはファイルを求めるよう依頼文に書きます。',
          placeholder: '例：https://github.com/ユーザー名/リポジトリ名',
        },
        {
          id: 'siteUrl', type: 'text', label: '公開サイトのURL（あれば）', max: 300, inputmode: 'url',
          placeholder: '例：https://ユーザー名.github.io/リポジトリ名/',
        },
        {
          id: 'structure', type: 'radio', label: 'ファイルの構成は？', advanced: true,
          options: [
            { value: 'single', label: 'HTMLファイル1つ' },
            { value: 'multi', label: '複数のファイル' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'files', type: 'text', label: '関係しそうなファイル名', max: 300, advanced: true,
          placeholder: '例：index.html、app.js',
        },
      ],
    },
    {
      id: 'detail',
      title: 'くわしく',
      lead: '「今どうなっていて」「どうなってほしいか」を分けて書くと、AIに伝わりやすくなります。',
      fields: [
        // 機能追加
        {
          id: 'addWhat', type: 'textarea', required: true, label: '追加したい機能は？', max: 1000, rows: 3,
          when: isGoal('add'),
          placeholder: '例：登録した推しを、誕生日が近い順に並べ替えるボタン',
        },
        {
          id: 'addWhere', type: 'text', label: 'どの画面の、どこに追加しますか？', max: 200,
          when: isGoal('add'),
          placeholder: '例：一覧画面の上',
        },
        // 機能変更・デザイン変更
        {
          id: 'target', type: 'text', required: true, label: '変えたいのはどこですか？', max: 200,
          when: isGoal('change', 'design'),
          placeholder: '例：保存ボタンの動き／トップ画面の色',
        },
        {
          id: 'current', type: 'textarea', label: '今はどうなっていますか？', max: 1000, rows: 3,
          required: (v) => v.goal === 'change',
          when: isGoal('add', 'change', 'design'),
          placeholder: '例：一覧は登録した順に並んでいる',
        },
        {
          id: 'after', type: 'textarea', required: true, label: '変更後は、どうなってほしいですか？', max: 1000, rows: 3,
          when: isGoal('add', 'change', 'design'),
          placeholder: '例：ボタンを押すと誕生日が近い順に並び、もう一度押すと元の順に戻る',
        },
        {
          id: 'mood', type: 'radio', label: '目指す雰囲気は？',
          when: isGoal('design'),
          options: MOOD_OPTIONS,
        },
        {
          id: 'addWhy', type: 'textarea', label: 'なぜ必要ですか？どんな場面で使いますか？', max: 600, rows: 2, advanced: true,
          when: isGoal('add', 'change'),
        },
        // 不具合
        {
          id: 'symptom', type: 'textarea', required: true, label: 'どんな問題が起きていますか？', max: 1000, rows: 2,
          when: isGoal('bug'),
          placeholder: '例：保存ボタンを押しても、再読み込みすると内容が消える',
        },
        {
          id: 'steps', type: 'textarea', list: true, required: true, label: 'どうすると起きますか？（手順を1行ずつ）', max: 1500, rows: 4,
          why: 'AIが同じ手順で問題を確かめる（再現する）ために使います。',
          when: isGoal('bug'),
          placeholder: '例：\nアプリを開く\n推しを1人登録して保存を押す\nページを再読み込みする',
        },
        {
          id: 'expected', type: 'textarea', required: true, label: '本来は、どうなってほしいですか？', max: 800, rows: 2,
          when: isGoal('bug'),
          placeholder: '例：再読み込みしても、登録した推しが一覧に残っている',
        },
        {
          id: 'actual', type: 'textarea', required: true, label: '実際には、どうなりますか？', max: 800, rows: 2,
          when: isGoal('bug'),
          placeholder: '例：一覧が空になる。エラーの表示は出ない',
        },
        {
          id: 'errorText', type: 'textarea', label: 'エラーメッセージ（あれば、そのまま貼り付け）', max: 6000, rows: 4, code: true,
          why: '言い換えずにそのまま貼るのがいちばん伝わります。',
          hint: 'APIキーやパスワードが含まれていないか確認してください。',
          when: isGoal('bug'),
          placeholder: '例：Uncaught TypeError: Cannot read properties of null',
        },
        {
          id: 'frequency', type: 'radio', label: 'どのくらいの頻度で起きますか？',
          when: isGoal('bug'),
          options: [
            { value: 'always', label: '毎回' },
            { value: 'sometimes', label: 'ときどき' },
            { value: 'once', label: '一度だけ' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'since', type: 'textarea', label: 'いつから起きていますか？直前に変えたことは？', max: 600, rows: 2, advanced: true,
          when: isGoal('bug'),
          placeholder: '例：昨日、並べ替え機能を追加してから',
        },
        {
          id: 'env', type: 'text', label: '使っている端末・ブラウザ', max: 150, advanced: true,
          when: isGoal('bug', 'design'),
          placeholder: '例：iPhoneのSafari',
        },
        {
          id: 'attachShot', type: 'check', label: 'スクリーンショットを依頼文と一緒にAIへ添付する',
          hint: 'チェックすると「添付の画像を参照してください」と依頼文に入ります。画像は自分でAIに添付してください。',
          when: isGoal('bug', 'design'),
        },
        // 公開・更新
        {
          id: 'pubGoal', type: 'radio', required: true, label: '公開について、何に困っていますか？',
          when: isGoal('publish'),
          options: [
            { value: 'first', label: 'はじめて公開したい' },
            { value: 'notUpdated', label: '更新したのに反映されない' },
            { value: 'broken', label: '公開したら動かない・表示が崩れる' },
            { value: 'url', label: 'URL・リポジトリ名・設定について知りたい' },
            { value: 'other', label: 'その他' },
          ],
        },
        {
          id: 'pubWhere', type: 'radio', required: true, label: 'どこで公開していますか（したいですか）？', default: 'pages',
          when: isGoal('publish'),
          options: [
            { value: 'pages', label: 'GitHub Pages' },
            { value: 'other', label: 'ほかのサービス' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'pubDetail', type: 'textarea', label: '状況をくわしく', max: 1500, rows: 3,
          required: (v) => v.pubGoal === 'other' || v.pubGoal === 'broken',
          when: isGoal('publish'),
          placeholder: '例：自分のPCでは動くのに、公開URLを開くと真っ白になる',
        },
      ],
    },
    {
      id: 'protect',
      title: '守ること',
      lead: '改修でいちばん大事なのは「頼んでいないところを壊さない」ことです。',
      fields: [
        {
          id: 'protect', type: 'checks', label: '絶対に変えてほしくないものは？', default: ['features', 'data'],
          why: '依頼文に「変更禁止」として書きます。選ばなくても、変更は最小限にするよう必ず指示します。',
          options: [
            { value: 'features', label: '今ある他の機能' },
            { value: 'data', label: '保存されているデータ・保存の形式' },
            { value: 'design', label: '今のデザイン・レイアウト' },
            { value: 'text', label: '画面の文章・表示内容' },
            { value: 'url', label: '公開URL・ファイル名・フォルダ構成' },
          ],
        },
        {
          id: 'protectNote', type: 'textarea', label: '特に壊したくないもの', max: 800, rows: 2,
          placeholder: '例：ガチャの結果の履歴機能',
        },
        {
          id: 'backup', type: 'radio', required: true, label: '今動いている状態を保存してありますか？',
          why: '失敗したときに元に戻せるかどうかを、AIに伝えるためです。',
          options: [
            { value: 'git', label: 'GitHubなどに保存（コミット）してある' },
            { value: 'copy', label: 'ファイルのコピーを取ってある' },
            { value: 'no', label: 'まだ' },
            { value: 'unknown', label: '分からない' },
          ],
        },
        {
          id: 'done', type: 'textarea', list: true, label: '何ができれば「完了」ですか？（1行に1つ）', max: 1000, rows: 3,
          hint: '空欄でも大丈夫です。依頼内容から確認項目を組み立てます。',
          placeholder: '例：iPhoneで並べ替えボタンが押せる',
        },
        {
          id: 'skill', type: 'radio', required: true, label: 'あなたの開発経験は？', default: 'first',
          options: SKILL_OPTIONS,
        },
      ],
    },
  ],
};

export const MODES = [IDEA, CREATE, FIX];
export const MODE_IDS = MODES.map((m) => m.id);

export function getMode(id) {
  return MODES.find((m) => m.id === id) || null;
}

/** モードの全項目（ステップ順） */
export function allFields(mode) {
  return mode.steps.flatMap((s) => s.fields);
}

/** 同じ id の項目がモード内で重複していないか（テスト用） */
export function duplicateFieldIds(mode) {
  const seen = new Set();
  const dup = [];
  for (const f of allFields(mode)) {
    if (seen.has(f.id)) dup.push(f.id);
    seen.add(f.id);
  }
  return dup;
}
