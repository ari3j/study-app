// 学習方法（modes）と学習テーマ（themes）のプラグイン一覧。
// 追加するときはファイルを置いてここにパスを1行足すだけでよい。仕様は README.md を参照。
StudyApp.boot({
  modes: [
    'modes/quiz4.js',
    'modes/explain.js',
  ],
  themes: [
    'themes/harness-design.js',
    'themes/agentic-coding.js',
  ],
  jobs: [
    'jobs/genai.js',
    'jobs/planned.js',
  ],
  questions: [
    'questions/genai/ml-basics.js',
    'questions/genai/prompt-basic.js',
    'questions/genai/business.js',
    'questions/genai/gov-risk.js',
    'questions/genai/agent-basic.js',
    'questions/genai/ai-dev.js',
  ],
});
