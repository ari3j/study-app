# Study

HTML / CSS / JavaScript のみで動く学習アプリ。サーバー不要（`index.html` をブラウザで開くだけ）。

## 使い方

- PC: `index.html` をブラウザで開く
- iPhone: 静的ホスティング（GitHub Pages など）に置いて Safari で開き、共有メニューから「ホーム画面に追加」
  - iOS はローカルの HTML ファイルを直接実行しにくいため、ホスティングを推奨
- 学習記録は端末ごとの localStorage に保存。端末間の移行は「データ管理」のバックアップ / 復元で行う

## 構成

```
index.html
plugins.js            読み込むプラグインの一覧（追加時はここに1行足す）
css/style.css
js/core.js            プラグイン登録・保存・間隔反復・出題選定
js/app.js             画面とセッション進行
modes/quiz4.js        学習方法プラグイン: 4択
themes/*.js           学習テーマプラグイン
```

## 学習テーマの追加

`themes/xxx.js` を作り、`plugins.js` の `themes` にパスを追加する。

```js
StudyApp.registerTheme({
  id: 'my-theme',              // 一意。学習記録のキーになるので後から変えない
  title: 'テーマ名',
  description: '一覧に出る説明',   // 任意
  color: '#3b5bdb',            // 任意
  tips: 'テーマ画面に出る学び方のヒント', // 任意
  categories: [{ id: 'cat1', title: 'カテゴリ名' }],
  questions: [
    {
      id: 'q001',              // テーマ内で一意。後から変えない
      type: 'choice',          // 4択は 'choice'
      category: 'cat1',
      question: '問題文（`code` と **強調** が使える）',
      choices: ['選択肢0', '選択肢1', '選択肢2', '選択肢3'],
      answer: 0,               // 正解の index。表示時は毎回シャッフルされる
      explanations: ['各選択肢がなぜ正しい/誤りか', '', '', ''],
      point: '覚えるべき要点（1文）',
    },
  ],
});
```

- 新規問題は定義順に出題されるので、基礎 → 応用の順に並べる
- 問題を削除・変更しても他の問題の記録には影響しない

## 学習方法の追加

`modes/xxx.js` を作り、`plugins.js` の `modes` にパスを追加する。複数の学習方法があるとテーマ画面に切り替えが出る。

```js
StudyApp.registerMode({
  id: 'truefalse',
  title: '〇×',
  supports: (q) => q.type === 'truefalse',  // この方法で出題できる問題か
  render(el, q, api) {
    // el に問題を描画する。StudyApp.ui.h / StudyApp.util.format が使える
    // api.theme          出題中のテーマ
    // api.onKey(fn)      キーボード操作のハンドラを登録
    // StudyApp.ui.shareToAI(text, button)  外部 AI チャットへ渡す（スマホは共有シート、PC はコピー）
    // api.finish(grade)  回答完了。grade は 'confident' | 'unsure' | 'wrong'
  },
});
```

出題の選定・間隔反復・再出題・結果画面はコア側が共通で扱うため、mode は1問分の表示と判定だけを実装すればよい。

## 組み込んでいる学習法

| 手法 | 実装 |
|---|---|
| 想起練習 | 解説は回答後にのみ表示 |
| 間隔反復 | Leitner 方式。正解で 0→1→3→7→14→30→60 日。不正解で振り出し |
| 確信度評価 | 正解時に「確信あり / 迷った」を選択。迷った正解は間隔を伸ばさない |
| セッション内再出題 | 不正解の問題を3問後に1回再出題 |
| 交互練習 | カテゴリを混ぜてシャッフル出題 |
| 精緻化フィードバック | 全選択肢に正誤の理由、要点を表示 |
| 短いセッション | 1回10問。復習優先、空きに新規 |
| 選択肢シャッフル | 位置での記憶を防止 |
