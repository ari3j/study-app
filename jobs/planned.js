// 今後追加する予定のジョブ（スフィア盤はまだない）。ジョブ一覧で上級ジョブの条件を示すために登録している。
StudyApp.registerJob({
  id: 'data-scientist', title: 'データサイエンティスト', tier: 'basic', planned: true,
  description: '統計と機械学習でデータから価値を引き出す', abilities: [],
});
StudyApp.registerJob({
  id: 'python', title: 'Python', tier: 'basic', planned: true,
  description: 'Python でデータ処理や自動化を書きこなす', abilities: [],
});
StudyApp.registerJob({
  id: 'senior-data-scientist', title: '上級データサイエンティスト', tier: 'advanced', planned: true,
  requires: ['data-scientist', 'genai', 'python'],
  description: 'データと生成AIを組み合わせ、事業の課題を解く', abilities: [],
});
