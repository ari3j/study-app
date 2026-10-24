// 学習方法プラグイン: 4択（いばらの道では問題の hard 版を「すべて選べ」形式で出題する）
StudyApp.registerMode({
  id: 'quiz4',
  title: '4択',
  level: 1,
  gradeLabels: { confident: '確信して正解', unsure: '迷って正解', wrong: '不正解' },
  supports: (q) => q.type === 'choice' && Array.isArray(q.choices) && q.choices.length === 4,

  render(el, q, api) {
    const { h, append } = StudyApp.ui;
    const { format, shuffle } = StudyApp.util;
    const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
    const multi = api.difficulty === 'hard' && !!q.hard;
    const v = multi
      ? { question: q.hard.question, choices: q.hard.choices, answers: q.hard.answers, explanations: q.hard.explanations || [] }
      : { question: q.question, choices: q.choices, answers: [q.answer], explanations: q.explanations || [] };
    // 選択肢の位置で覚えないよう毎回並び替える
    const order = shuffle(v.choices.map((_, i) => i));
    const picked = new Set();
    let answered = false;

    const items = order.map((ci, pos) => {
      const exp = h('div', { class: 'choice-exp hidden' });
      const btn = h('button', { class: 'choice', onclick: () => (multi ? toggle(pos) : submit([pos])) },
        h('span', { class: 'choice-label' }, LABELS[pos]),
        h('span', { class: 'choice-text', html: format(v.choices[ci]) }));
      return { ci, btn, exp, wrap: h('div', { class: 'choice-wrap' }, btn, exp) };
    });

    const feedback = h('div', { class: 'feedback hidden' });
    const submitBtn = h('button', { class: 'btn primary', disabled: true, onclick: () => submit([...picked]) }, '決定', h('kbd', null, 'Enter'));
    const actionBar = h('div', { class: 'action-bar' + (multi ? '' : ' hidden') });
    if (multi) actionBar.append(h('div', { class: 'action-buttons' }, submitBtn));

    append(el,
      multi ? h('span', { class: 'pill ng multi-tag' }, 'いばらの道: 当てはまるものをすべて選ぶ') : null,
      h('div', { class: 'q-text', html: format(v.question) }),
      api.difficulty === 'easy' && q.hint ? h('div', { class: 'hint-box' }, h('span', { class: 'point-label' }, 'ヒント'), h('span', { html: format(q.hint) })) : null,
      h('div', { class: 'choices' }, items.map((x) => x.wrap)),
      feedback,
      actionBar,
      h('p', { class: 'hint small muted desktop-only' }, multi ? '1〜' + items.length + ' キーで選択、Enter で決定' : '1〜4 / A〜D キーで選択'));

    function toggle(pos) {
      if (answered) return;
      if (picked.has(pos)) picked.delete(pos); else picked.add(pos);
      items[pos].btn.classList.toggle('is-selected', picked.has(pos));
      submitBtn.disabled = picked.size === 0;
    }

    function submit(positions) {
      if (answered || !positions.length) return;
      answered = true;
      const chosen = new Set(positions.map((p) => items[p]));
      let missed = 0;
      let extra = 0;

      for (const it of items) {
        const should = v.answers.includes(it.ci);
        const sel = chosen.has(it);
        it.btn.disabled = true;
        it.btn.classList.remove('is-selected');
        if (should && (sel || !multi)) it.btn.classList.add('is-correct');
        else if (should) { it.btn.classList.add('is-missed'); missed++; }
        else if (sel) { it.btn.classList.add('is-wrong'); extra++; }
        else it.btn.classList.add('is-dim');
        const text = v.explanations[it.ci];
        if (text) {
          it.exp.innerHTML = format(text);
          it.exp.classList.remove('hidden');
        }
      }
      const correct = multi ? missed === 0 && extra === 0 : v.answers.includes([...chosen][0].ci);

      feedback.className = 'feedback ' + (correct ? 'ok' : 'ng');
      feedback.append(h('div', { class: 'feedback-title' },
        correct ? '正解' : multi ? '不正解（選び漏れ ' + missed + '・誤って選択 ' + extra + '）' : '不正解'));
      if (q.point) feedback.append(h('div', { class: 'feedback-point' }, h('span', { class: 'point-label' }, 'ポイント'), h('span', { html: format(q.point) })));
      const askBtn = h('button', { class: 'btn small-btn', onclick: () => StudyApp.ui.shareToAI(buildPrompt(chosen, correct), askBtn) }, 'AI に質問する');
      feedback.append(h('div', { class: 'feedback-actions' }, askBtn));

      const buttons = correct
        ? [h('button', { class: 'btn primary', onclick: () => api.finish('confident') }, '確信あり', h('kbd', null, 'Enter')),
           h('button', { class: 'btn', onclick: () => api.finish('unsure') }, '迷った', h('kbd', null, 'M'))]
        : [h('button', { class: 'btn primary', onclick: () => api.finish('wrong') }, '次へ', h('kbd', null, 'Enter'))];
      actionBar.replaceChildren();
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
    function buildPrompt(chosen, correct) {
      const line = (it) => LABELS[items.indexOf(it)] + '. ' + v.choices[it.ci];
      const answerItems = items.filter((it) => v.answers.includes(it.ci));
      return [
        '学習アプリ「' + api.theme.title + '」の' + (multi ? '複数選択' : '4択') + '問題について質問があります。',
        '',
        '【問題】',
        v.question,
        '',
        '【選択肢】',
        ...items.map(line),
        '',
        '【正解】' + answerItems.map(line).join(' / '),
        '【私の回答】' + [...chosen].map(line).join(' / ') + (correct ? '（正解）' : '（不正解）'),
        '',
        '【解説】',
        ...items.map((it) => LABELS[items.indexOf(it)] + ': ' + (v.explanations[it.ci] || '')),
        q.point ? '\n【ポイント】' + q.point : '',
        '',
        '解説を繰り返すのではなく、私の理解の穴を見つけるように問いかけを交えて、実務での具体例とともに答えてください。',
        '',
        '【質問】',
        '',
      ].join('\n');
    }

    api.onKey((e) => {
      if (e.key === 'Enter' && multi) { e.preventDefault(); submit([...picked]); return; }
      const k = e.key.toLowerCase();
      const pos = '123456'.indexOf(k) >= 0 ? '123456'.indexOf(k) : 'abcdef'.indexOf(k);
      if (pos >= 0 && pos < items.length) (multi ? toggle(pos) : submit([pos]));
    });
  },
});
