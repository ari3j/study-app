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
js/game.js            難易度・メダル・景品交換
js/sphere.js          ジョブ一覧とスフィア盤
js/challenge.js       スフィア盤のマスを開くチャレンジ
jobs/*.js             ジョブ（スフィア盤）の定義
questions/            スフィア盤のマスの問題
modes/quiz4.js        学習方法プラグイン: 4択（Lv1）
modes/explain.js      学習方法プラグイン: 説明（Lv2）
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
  practices: [                 // 任意。実践課題（Lv3〜5）
    { id: 'p301', level: 3, title: '課題', detail: '補足（任意）' },
  ],
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
      difficulty: 2,           // ★1〜3。メダルの出やすさに影響
      hint: '難易度 Easy で表示するヒント（答えは書かない）',
      hard: {                  // 難易度 Hard とアビリティラーニングの最後で出題する高難度版（すべて選べ形式）
        question: '長めの状況設定つきの問題文',
        choices: ['記述0', '記述1', '記述2', '記述3', '記述4'],
        answers: [0, 2],       // 選ぶべき記述の index（複数）
        explanations: ['各記述の解説', '', '', '', ''],
      },
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
  level: 1,                                  // 任意。このレベルの達成条件に含める
  gradeLabels: { confident: '…', unsure: '…', wrong: '…' }, // 任意。結果画面の表示名
  supports: (q) => q.type === 'truefalse',  // この方法で出題できる問題か
  render(el, q, api) {
    // el に問題を描画する。StudyApp.ui.h / StudyApp.util.format が使える
    // api.theme          出題中のテーマ
    // api.difficulty     難易度 'easy' | 'normal' | 'hard'
    // api.onKey(fn)      キーボード操作のハンドラを登録
    // StudyApp.ui.shareToAI(text, button)  外部 AI チャットへ渡す（スマホは共有シート、PC はコピー）
    // api.finish(grade)  回答完了。grade は 'confident' | 'unsure' | 'wrong'
  },
});
```

出題の選定・間隔反復・再出題・結果画面はコア側が共通で扱うため、mode は1問分の表示と判定だけを実装すればよい。学習記録は学習方法ごとに別々に持つ。

## レベル

| Lv | 状態 | 達成条件 |
|---|---|---|
| 1 | 知っている | `level: 1` の学習方法（4択）で80%習得 |
| 2 | 説明できる | `level: 2` の学習方法（説明）で80%習得 |
| 3〜5 | 使える / 判断できる / 設計・改善できる | そのレベルの実践課題をすべて完了 |

下のレベルから順に判定する。「習得」は確信ありの正解を間隔を空けて4回重ねた状態。

## ジョブとスフィア盤（js/sphere.js・js/challenge.js）

- ジョブ（`jobs/*.js`）ごとにスフィア盤が1枚ある。アビリティは攻撃・魔法・回復・補助の4系統
- マス = 10問のチャレンジ（7割以上の正解でクリア）。アビリティのマスをすべてクリアすると、アビリティのマス（20問、14問以上でクリア）に挑戦でき、クリアでアビリティを習得
- アビリティのマスは3段構成: 最初の6問は制限時間15秒の早押し（正解したことのある問題を優先）、次の8問はじっくり、最後の6問は★3の問題を高難度版（`hard`）があればそれで出す
- 画面上の呼び名は `js/challenge.js` の `NAMES` で変えられる
- マスの問題は `questions/<ジョブ>/<アビリティ>.js` で登録し、`plugins.js` の `questions` に追加する

```js
StudyApp.registerQuestions({
  job: 'genai', ability: 'ml-basics', cell: 0,   // cell はアビリティ内のマスの番号（0 始まり）
  questions: [ /* 学習テーマと同じ形式の問題（category は不要） */ ],
});
```

## ゲーム要素（js/game.js）

| 難易度 | 内容 | メダル倍率 |
|---|---|---|
| Easy | 毎回ヒントを表示 | ×0.5 |
| Normal | 通常 | ×1.0 |
| Hard | `hard` 版を「すべて選べ」形式で出題 | ×0.7 |

現在は問題がそろうまで Normal のみ（Easy・Hard は `js/game.js` の `enabled: false` を `true` にすると選べるようになる）。

- 小さなメダル: セッション内の初回の正解で抽選。基本確率は ★1: 12% / ★2: 20% / ★3: 32%。一度正解したことがある問題は ×0.3
- メダル交換所: 称号・画面カラー（画面上の景品）と、自分で登録するリアルのごほうび
- 確率や景品は `js/game.js` 冒頭の定数で調整する

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
