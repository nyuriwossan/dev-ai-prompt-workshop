// 出力先（AI・ツール）ごとの文言。製品の機能や名称は変わりやすいので、ここにまとめて更新しやすくしている。
// 実際には使えない機能を前提にしないよう、製品固有の機能は「使える場合は」という条件つきで書く。

export const TARGET_INFO = {
  common: {
    name: '共通',
    kind: 'common',
    screenNote: 'どのAIにも貼れる形です。チャットでも、ファイルを直接編集できるAI（コーディングエージェント）でも使えるよう、両方の場合の進め方を書いています。',
    envLines: [
      'あなたがファイルを直接読み書きできる環境の場合は、作業の前に既存のファイルを確認してください。',
      'チャットでのやりとりの場合は、コードをファイル名つきで示してください。',
    ],
  },
  chatgpt: {
    name: 'ChatGPT',
    kind: 'chat',
    screenNote: 'ChatGPTのチャットに貼る想定です。コードは回答の中に表示され、自分でファイルに保存して使います。ChatGPT向けとClaude向けは、どちらも「チャットAI向け」の同じ組み立てです（AIごとの最適化を装わないため）。',
    envLines: [
      'この会話でファイルの作成やプレビュー表示の機能が使える場合は、使ってかまいません。使えない場合は、コードをファイル名つきで示してください。',
    ],
  },
  claude: {
    name: 'Claude',
    kind: 'chat',
    screenNote: 'Claudeのチャットに貼る想定です。コードは回答の中に表示され、自分でファイルに保存して使います。ChatGPT向けとClaude向けは、どちらも「チャットAI向け」の同じ組み立てです（AIごとの最適化を装わないため）。',
    envLines: [
      'この会話でファイルの作成やプレビュー表示の機能が使える場合は、使ってかまいません。使えない場合は、コードをファイル名つきで示してください。',
    ],
  },
  codex: {
    name: 'Codex',
    kind: 'agent',
    screenNote: 'Codexで、作業するフォルダ（リポジトリ）を開いた状態で使う想定です。AIがファイルを読み書きし、コマンドを実行できる環境向けの作業指示になります。',
    ruleFiles: 'AGENTS.md',
  },
  claudecode: {
    name: 'Claude Code',
    kind: 'agent',
    screenNote: 'Claude Codeで、作業するフォルダ（リポジトリ）を開いた状態で使う想定です。AIがファイルを読み書きし、コマンドを実行できる環境向けの作業指示になります。',
    ruleFiles: 'CLAUDE.md や AGENTS.md',
  },
};

export function targetKind(target) {
  return (TARGET_INFO[target] || TARGET_INFO.common).kind;
}

export function getTargetInfo(target) {
  return TARGET_INFO[target] || TARGET_INFO.common;
}
