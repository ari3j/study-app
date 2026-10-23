// 学習方法プラグイン: 4択問題
StudyApp.registerMode({
  id: 'quiz4',
  title: '4択問題',
  supports: (q) => q.type === 'choice' && Array.isArray(q.choices) && q.choices.length === 4,

  render(el, q, api) {
    const { h } = StudyApp.ui;
    const { format, shuffle } = StudyApp.util;
    const LABELS = ['A', 'B', 'C', 'D'];
    // 選択肢の位置で覚えないよう毎回並び替える
    const order = shuffle([0, 1, 2, 3]);
    let answered = false;

    const items = order.map((ci, pos) => {
      const exp = h('div', { class: 'choice-exp hidden' });
      const btn = h('button', { class: 'choice', onclick: () => select(pos) },
        h('span', { class: 'choice-label' }, LABELS[pos]),
        h('span', { class: 'choice-text', html: format(q.choices[ci]) }));
      return { ci, btn, exp, wrap: h('div', { class: 'choice-wrap' }, btn, exp) };
    });

    const feedback = h('div', { class: 'feedback hidden' });
    const actionBar = h('div', { class: 'action-bar hidden' });

    el.append(
      h('div', { class: 'q-text', html: format(q.question) }),
      h('div', { class: 'choices' }, items.map((x) => x.wrap)),
      feedback,
      actionBar,
      h('p', { class: 'hint small muted desktop-only' }, '1〜4 / A〜D キーで選択'));

    function select(pos) {
      if (answered) return;
      answered = true;
      const chosen = items[pos];
      const correct = chosen.ci === q.answer;

      for (const it of items) {
        it.btn.disabled = true;
        if (it.ci === q.answer) it.btn.classList.add('is-correct');
        else if (it === chosen) it.btn.classList.add('is-wrong');
        else it.btn.classList.add('is-dim');
        const text = (q.explanations || [])[it.ci];
        if (text) {
          it.exp.innerHTML = format(text);
          it.exp.classList.remove('hidden');
        }
      }

      feedback.className = 'feedback ' + (correct ? 'ok' : 'ng');
      feedback.append(h('div', { class: 'feedback-title' }, correct ? '正解' : '不正解'));
      if (q.point) feedback.append(h('div', { class: 'feedback-point' }, h('span', { class: 'point-label' }, 'ポイント'), h('span', { html: format(q.point) })));
      const askBtn = h('button', { class: 'btn small-btn', onclick: () => StudyApp.ui.shareToAI(buildPrompt(chosen), askBtn) }, 'AI に質問する');
      feedback.append(h('div', { class: 'feedback-actions' }, askBtn));

      const buttons = correct
        ? [h('button', { class: 'btn primary', onclick: () => api.finish('confident') }, '確信あり', h('kbd', null, 'Enter')),
           h('button', { class: 'btn', onclick: () => api.finish('unsure') }, '迷った', h('kbd', null, 'M'))]
        : [h('button', { class: 'btn primary', onclick: () => api.finish('wrong') }, '次へ', h('kbd', null, 'Enter'))];
      if (correct) actionBar.append(h('div', { class: 'small muted action-hint' }, '答える前に確信していましたか？'));
      actionBar.append(h('div', { class: 'action-buttons' }, buttons));
      actionBar.classList.remove('hidden');
      feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      api.onKey((e) => {
        if (e.key === 'Enter') { e.preventDefault(); api.finish(correct ? 'confident' : 'wrong'); }
        else if (correct && (e.key === 'm' || e.key === 'M')) api.finish('unsure');
      });
    }

    // 表示した順の記号で組み立て、利用者が見た画面と一致させる
    function buildPrompt(chosen) {
      const line = (it) => LABELS[items.indexOf(it)] + '. ' + q.choices[it.ci];
      const correctItem = items.find((it) => it.ci === q.answer);
      return [
        '学習アプリ「' + api.theme.title + '」の4択問題について質問があります。',
        '',
        '【問題】',
        q.question,
        '',
        '【選択肢】',
        ...items.map(line),
        '',
        '【正解】' + line(correctItem),
        '【私の回答】' + line(chosen) + (chosen === correctItem ? '（正解）' : '（不正解）'),
        '',
        '【解説】',
        ...items.map((it) => LABELS[items.indexOf(it)] + ': ' + ((q.explanations || [])[it.ci] || '')),
        q.point ? '\n【ポイント】' + q.point : '',
        '',
        '解説を繰り返すのではなく、私の理解の穴を見つけるように問いかけを交えて、実務での具体例とともに答えてください。',
        '',
        '【質問】',
        '',
      ].join('\n');
    }

    api.onKey((e) => {
      const k = e.key.toLowerCase();
      const pos = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
      if (pos >= 0) select(pos);
    });
  },
});
