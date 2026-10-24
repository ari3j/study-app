// カリキュラムプラグイン: 生成AI
// 上位テーマ（domain）= ジョブ。title は表示名、subtitle は分野名 / 中位テーマ（area）/ 下位テーマ（unit）= アビリティ / マス（cell）= 10問のバトル1回
// unit はエリア内で上から順に開く。requires は他エリアの前提となる下位テーマ。
StudyApp.registerCurriculum({
  id: 'genai',
  title: '生成AI',
  jobs: [
    { title: '賢者', requires: ['found', 'use'], description: 'しくみを理解し、言葉で AI を自在に操る' },
    { title: 'AIアーキテクト', requires: ['dev', 'ops'], description: 'AI を組み込んだシステムを、安全に設計・運用する' },
    { title: '勇者', requires: ['found', 'use', 'dev', 'ops'], description: '生成AIのすべての道を極めた者' },
  ],
  domains: [
    {
      id: 'found', title: '叡智の書庫', subtitle: '基礎', job: '学者', color: '#4dabf7',
      description: '生成AIがどう動くのかを知る',
      areas: [
        { id: 'ml', title: 'AIと機械学習の基礎', units: [
          { id: 'ml-basics', title: '機械学習の基本', cells: ['学習と推論', '教師あり・教師なし・強化学習', '過学習と汎化', '評価指標'] },
          { id: 'nn', title: 'ニューラルネットワーク', cells: ['ニューロンと層', '学習のしくみ', '深層学習の発展'] },
        ] },
        { id: 'llm', title: 'LLMのしくみ', units: [
          { id: 'token', title: 'トークンと埋め込み', cells: ['トークン化', '埋め込みベクトル', 'コンテキストウィンドウ'] },
          { id: 'transformer', title: 'Transformer', cells: ['注意機構', 'Transformerの構造', 'スケーリング則'] },
          { id: 'training', title: '学習の流れ', cells: ['事前学習', '指示チューニング', '人のフィードバックによる強化学習', '推論モデルと思考'] },
          { id: 'generation', title: '生成のしくみ', cells: ['次トークン予測', 'サンプリング', 'ハルシネーションの原因'] },
        ] },
        { id: 'multimodal', title: 'マルチモーダルと生成モデル', units: [
          { id: 'image', title: '画像の生成と理解', cells: ['拡散モデル', '画像生成の制御', '画像理解'] },
          { id: 'media', title: '音声・動画', cells: ['音声認識と音声合成', '動画生成', 'マルチモーダルモデル'] },
        ] },
      ],
    },
    {
      id: 'use', title: '言霊の塔', subtitle: '活用', job: '魔法使い', color: '#b197fc',
      description: '言葉という呪文で AI を使いこなす',
      areas: [
        { id: 'prompt', title: 'プロンプトエンジニアリング', units: [
          { id: 'prompt-basic', title: '基本原則', cells: ['明確で具体的に', '文脈と目的を伝える', '例を示す', '役割を与える'] },
          { id: 'prompt-struct', title: '構造化', cells: ['タグと区切り', '出力形式の指定', '長い文書の扱い'] },
          { id: 'prompt-reason', title: '推論を引き出す', cells: ['段階的に考えさせる', '思考と回答の分離', 'プロンプトの連鎖'] },
          { id: 'prompt-improve', title: '改善サイクル', cells: ['失敗の分析', 'テストケースで比べる', 'プロンプトの管理'] },
        ] },
        { id: 'work', title: '業務での活用', units: [
          { id: 'writing', title: '文章作成', cells: ['下書きと推敲', '要約', '翻訳とトーン調整'] },
          { id: 'research', title: '調査と分析', cells: ['情報収集と出典確認', 'データ分析', '意思決定の補助'] },
          { id: 'adoption', title: '業務への組み込み', cells: ['定型業務の自動化', 'ナレッジ共有', '導入効果の測定'] },
        ] },
        { id: 'select', title: 'モデルとツールの選択', units: [
          { id: 'model-select', title: 'モデルの選び方', cells: ['性能・速度・コスト', 'モデルの種類と特徴', 'ベンチマークの読み方'] },
          { id: 'ai-tools', title: 'AIツールの使い分け', cells: ['チャットアシスタント', '検索・調査ツール', '専門特化ツール'] },
        ] },
      ],
    },
    {
      id: 'dev', title: '錬成の工房', subtitle: '開発', job: '錬金術師', color: '#ffa94d',
      description: 'AI を組み込み、新しいものを生み出す',
      areas: [
        { id: 'api', title: 'LLM API 開発', units: [
          { id: 'api-basic', title: 'API の基本', requires: ['generation'], cells: ['メッセージとロール', '主要なパラメータ', 'ストリーミング', 'エラーとリトライ'] },
          { id: 'api-tools', title: '構造化出力とツール', cells: ['JSON 出力', 'ツール呼び出し', '画像・ファイル入力'] },
          { id: 'api-optimize', title: 'コストと速度', cells: ['トークンとコスト', 'プロンプトキャッシュ', 'バッチ処理', 'モデルの使い分け'] },
        ] },
        { id: 'rag', title: 'RAG', units: [
          { id: 'rag-search', title: '検索の基礎', requires: ['token'], cells: ['ベクトル検索', 'ハイブリッド検索', 'リランキング'] },
          { id: 'rag-build', title: 'RAG の構築', cells: ['文書の分割', 'メタデータと前処理', '回答生成と引用'] },
          { id: 'rag-eval', title: 'RAG の評価', cells: ['検索の評価', '回答の評価', '改善の進め方'] },
        ] },
        { id: 'agent', title: 'AIエージェント開発', units: [
          { id: 'harness', title: 'ハーネス設計', requires: ['api-tools'], cells: ['ループと基本概念', 'ツール設計', 'コンテキスト管理', '安全性と権限', '評価と観測'] },
          { id: 'mcp', title: 'MCPと外部連携', cells: ['MCPのしくみ', 'サーバーとツールの公開', '認証と権限'] },
          { id: 'multi-agent', title: 'マルチエージェント', cells: ['役割分担', 'オーケストレーション', '並列化と統合'] },
        ] },
        { id: 'coding', title: 'Agentic Coding', units: [
          { id: 'ac-workflow', title: '基本ワークフロー', requires: ['prompt-basic'], cells: ['探索・計画・実装・検証', '指示の出し方', '早めの軌道修正'] },
          { id: 'ac-context', title: 'コンテキストと指示ファイル', cells: ['指示ファイル', 'セッション管理', 'やり直しの判断'] },
          { id: 'ac-verify', title: '検証とレビュー', cells: ['テスト駆動', '見た目の検証', '差分レビュー'] },
          { id: 'ac-scale', title: '並列化と自動化', cells: ['サブエージェント', 'worktree と並列実行', 'コマンド・フック・CI'] },
        ] },
      ],
    },
    {
      id: 'ops', title: '守護の城塞', subtitle: '運用', job: '守護者', color: '#69db7c',
      description: '品質と安全を守り、信頼される AI にする',
      areas: [
        { id: 'quality', title: '評価と品質', units: [
          { id: 'eval-design', title: '評価設計', cells: ['評価セットの作り方', 'LLM による自動評価', '人による評価'] },
          { id: 'hallucination', title: 'ハルシネーション対策', requires: ['generation'], cells: ['根拠を示させる', '検証の仕組み', '不確かさの扱い'] },
          { id: 'observability', title: '観測と改善', cells: ['ログとトレース', '本番での監視', '継続的な改善'] },
        ] },
        { id: 'security', title: 'セキュリティ', units: [
          { id: 'injection', title: 'プロンプトインジェクション', requires: ['prompt-basic'], cells: ['直接型', '間接型', '防御の設計'] },
          { id: 'data-protection', title: 'データ保護', cells: ['機密情報の扱い', '学習利用とデータ保持', '出力からの漏洩'] },
          { id: 'isolation', title: '権限と隔離', cells: ['最小権限', 'サンドボックス', '人による確認'] },
        ] },
        { id: 'governance', title: '倫理・法務・ガバナンス', units: [
          { id: 'ip', title: '著作権と知的財産', cells: ['学習と著作権', '生成物の権利', '商用利用の注意'] },
          { id: 'fairness', title: '公平性と責任', cells: ['バイアス', '透明性と説明責任', '有害な出力'] },
          { id: 'rules', title: 'ルールと規制', cells: ['国内のガイドライン', '海外の規制', '社内ルールづくり'] },
        ] },
      ],
    },
  ],
});
