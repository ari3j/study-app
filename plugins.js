// 学習方法（modes）・ジョブ（jobs）・マスの問題（questions）のプラグイン一覧。
// 追加するときはファイルを置いてここにパスを1行足すだけでよい。仕様は README.md を参照。
StudyApp.boot({
  modes: [
    'modes/quiz4.js',
    'modes/explain.js',
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
    'questions/genai/agent-dev.js',
    'questions/genai/ai-dev.js',
    'questions/genai/agentic-coding.js',
  ],
});
