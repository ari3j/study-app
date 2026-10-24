// 今後追加する予定のジョブ（スフィア盤はまだない）。ジョブ一覧で上級ジョブの条件を示すために登録している。
StudyApp.registerJob({
  id: 'data-scientist', title: 'データサイエンティスト', tier: 'basic', planned: true,
  description: '統計と機械学習でデータから価値を引き出す', abilities: [],
});
StudyApp.registerJob({
  id: 'python', title: 'AIソーサラー', tier: 'basic', planned: true,
  description: 'Python を自在に操り、データ処理や AI の仕組みを形にする', abilities: [],
});
StudyApp.registerJob({
  id: 'mlops', title: 'MLOpsマシーナリー', tier: 'basic', planned: true,
  description: '機械学習モデルを本番で動かし続ける仕組みを組み上げる', abilities: [],
});
StudyApp.registerJob({
  id: 'arch-data-scientist', title: 'アーク・データサイエンティスト', tier: 'advanced', planned: true,
  requires: ['data-scientist', 'genai', 'python'],
  description: 'データと生成AIを組み合わせ、事業の課題を解く', abilities: [],
});
