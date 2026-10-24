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
    'questions/genai/llm-mechanism.js',
    'questions/genai/model-types.js',
    'questions/genai/knowledge.js',
    'questions/genai/multimodal.js',
    'questions/genai/prompt-basic.js',
    'questions/genai/prompt-tech.js',
    'questions/genai/prompt-caution.js',
    'questions/genai/business.js',
    'questions/genai/ai-project.js',
    'questions/genai/ai-strategy.js',
    'questions/genai/quality.js',
    'questions/genai/security.js',
    'questions/genai/gov-risk.js',
    'questions/genai/gov-system.js',
    'questions/genai/api.js',
    'questions/genai/rag.js',
    'questions/genai/agent-basic.js',
    'questions/genai/agent-dev.js',
    'questions/genai/ai-dev.js',
    'questions/genai/agentic-coding.js',
  ],
});
