// ジョブプラグイン: 生成AI
// アビリティ = 下位テーマ。type はアビリティの系統（theory / apply / operate / build。表示名は js/sphere.js の TYPES）。
// group は分類名（表示のみ）。同じ group のアビリティは定義順に1本の道でつながり、前のアビリティを覚えると次が開く。
// requires は他の道の前提アビリティ。
// cells はマス（1マス = 10問のチャレンジ）。すべてのマスをクリアすると、アビリティのマス（20問）に挑戦できる。
StudyApp.registerJob({
  id: 'genai',
  title: '生成AI',
  tier: 'basic',
  description: '生成AIのしくみを知り、使いこなし、組み込み、安全に運用する',
  abilities: [
    // ---- 攻撃（基礎・理論） ----
    { id: 'ml-basics', type: 'theory', group: 'AIと機械学習の基礎', title: '機械学習とAIシステム',
      cells: ['機械学習の基本', 'ニューラルネットワーク', 'AIシステムの種類'] },

    { id: 'llm-mechanism', type: 'theory', group: 'LLMのしくみ', title: 'LLMのしくみ', requires: ['ml-basics'],
      cells: ['トークンと埋め込み', 'Transformerと学習の流れ', '文章生成とハルシネーション'] },
    { id: 'model-types', type: 'theory', group: 'LLMのしくみ', title: '言語モデルの種類と選定',
      cells: ['オープンウェイトとクローズドウェイト', 'SLMと用途に応じた選び方'] },

    { id: 'knowledge', type: 'theory', group: '外部知識の活用', title: '外部知識の与え方', requires: ['llm-mechanism'],
      cells: ['Web検索・APIとの連携', 'In-Context Learning と RAG', 'ファインチューニング'] },

    { id: 'multimodal', type: 'theory', group: 'マルチモーダル', title: 'マルチモーダル', requires: ['llm-mechanism'],
      cells: ['画像の生成と理解', '音声・動画'] },

    // ---- 魔法（活用） ----
    { id: 'prompt-basic', type: 'apply', group: 'プロンプトエンジニアリング', title: 'プロンプトの基本',
      cells: ['必要性と基本構成', '構造化と出力形式'] },
    { id: 'prompt-tech', type: 'apply', group: 'プロンプトエンジニアリング', title: 'プロンプト手法',
      cells: ['Few-shot と CoT', '発想を広げる手法', '採点・再帰的な修正・自動生成'] },
    { id: 'prompt-caution', type: 'apply', group: 'プロンプトエンジニアリング', title: '実行時の注意点と改善',
      cells: ['回答のゆらぎと文字数の制限', '入力する情報と権利侵害', 'プロンプトの評価と改善'] },

    { id: 'business', type: 'apply', group: '業務とプロジェクト', title: '業務での活用',
      cells: ['文章作成と調査・分析', 'AIツールの使い分け', 'Operational AI による業務変革'] },
    { id: 'ai-project', type: 'apply', group: '業務とプロジェクト', title: 'AIプロジェクトの進め方',
      cells: ['成功要素とAI適用の判断', 'データの設計', '人とAIの協働'] },
    { id: 'ai-strategy', type: 'apply', group: '業務とプロジェクト', title: 'AI戦略',
      cells: ['AI戦略の全体像', '組織・技術・事例'] },

    // ---- 回復（運用） ----
    { id: 'quality', type: 'operate', group: '評価と品質', title: '評価と品質', requires: ['llm-mechanism'],
      cells: ['評価設計', 'ハルシネーション対策', '観測と改善'] },

    { id: 'security', type: 'operate', group: 'セキュリティ', title: 'セキュリティとデータ保護', requires: ['prompt-basic'],
      cells: ['プロンプトインジェクション', '機密情報とデータ保持', '閉域環境・データ主権・権限'] },

    { id: 'gov-risk', type: 'operate', group: 'AIガバナンス', title: 'AIのリスク',
      cells: ['虚偽・誤判定・バイアス', '財産権とプライバシー'] },
    { id: 'gov-system', type: 'operate', group: 'AIガバナンス', title: 'AIガバナンスと規制',
      cells: ['ルール・教育・体制', 'AIマネジメントシステム', '国内外の規制'] },

    // ---- 補助（開発） ----
    { id: 'api', type: 'build', group: 'LLM API 開発', title: 'LLM API の基本', requires: ['llm-mechanism'],
      cells: ['メッセージとパラメータ', '構造化出力とツール呼び出し', 'コストと速度'] },

    { id: 'rag-build', type: 'build', group: 'RAG', title: 'RAGのしくみと構築', requires: ['knowledge'],
      cells: ['知識獲得の課題とRAG', 'チャンク分割とベクトル化', '検索と回答生成'] },
    { id: 'rag-improve', type: 'build', group: 'RAG', title: 'RAGの改善と評価',
      cells: ['性能問題の切り分け', 'クエリ変換・HyDE・ルーティング', '高性能検索と Graph RAG'] },

    { id: 'agent-basic', type: 'build', group: 'AIエージェント', title: 'AIエージェントの基本',
      cells: ['エージェントの条件と代表的なサービス', '構成と分類', 'MCP と A2A'] },
    { id: 'agent-dev', type: 'build', group: 'AIエージェント', title: 'エージェント開発', requires: ['api'],
      cells: ['開発ツール', 'ハーネス設計: ループとツール', 'ハーネス設計: コンテキストと安全性'] },

    { id: 'ai-dev', type: 'build', group: 'システム開発とAI', title: 'AI時代のシステム開発',
      cells: ['AI Native 開発と品質', '従来型開発へのAI適用', 'AI-Native 開発の各フェーズ'] },
    { id: 'agentic-coding', type: 'build', group: 'システム開発とAI', title: 'Agentic Coding', requires: ['prompt-basic'],
      cells: ['ワークフローと指示の出し方', 'コンテキストと検証', '並列化と安全な運用'] },
  ],
});
