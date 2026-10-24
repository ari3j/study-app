// 学習方法プラグイン: 説明（選択肢なしで答えと理由を自分の言葉で説明し、自己採点する）
StudyApp.registerMode({
  id: 'explain',
  title: '説明',
  gradeLabels: { confident: '説明できた', unsure: '一部だけ', wrong: '説明できず' },
  // 自己採点なので「言えた」だけを正解として数える
  passes: (grade) => grade === 'confident',
  supports: (q) => q.type === 'choice' && Array.isArray(q.choices),

  render(el, q, api) {
    const { h, append } = StudyApp.ui;
    const { format } = StudyApp.util;
    const multi = !!api.hard && !!q.hard;
    const v = multi
      ? { question: q.hard.question, choices: q.hard.choices, answers: q.hard.answers, explanations: q.hard.explanations || [] }
      : { question: q.question, choices: q.choices, answers: [q.answer], explanations: q.explanations || [] };
    const exps = v.explanations;
    let revealed = false;

    const input = h('textarea', { class: 'explain-input', rows: '4', placeholder: '答えと、なぜそうなのかを書く（頭の中で説明するだけでもよい）' });
    const answerBox = h('div', { class: 'hidden' });
    const revealBtn = h('button', { class: 'btn primary', onclick: reveal }, '答えを見る', h('kbd', null, 'Ctrl+Enter'));
    const actionBar = h('div', { class: 'action-bar' }, h('div', { class: 'action-buttons' }, revealBtn));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); reveal(); }
    });

    append(el,
      h('div', { class: 'q-text', html: format(v.question) }),
      h('p', { class: 'small muted' }, multi
        ? '選択肢は出ません。当てはまるものを自分で考え、できるだけ多く理由とともに挙げてください。'
        : '選択肢は出ません。答えとその理由を、何も見ずに自分の言葉で説明してください。'),
      input,
      answerBox,
      actionBar);

    function reveal() {
      if (revealed) return;
      revealed = true;
      input.readOnly = true;
      const mine = input.value.trim();
      const all = v.choices.map((c, i) => ({ c, e: exps[i], i }));
      const rights = all.filter((x) => v.answers.includes(x.i));
      const others = all.filter((x) => !v.answers.includes(x.i));

      const askBtn = h('button', { class: 'btn small-btn', onclick: () => StudyApp.ui.shareToAI(buildPrompt(mine), askBtn) },
        mine ? 'AI に添削してもらう' : 'AI に質問する');

      answerBox.className = 'model-answer';
      append(answerBox,
        h('div', { class: 'model-label' }, '模範解答'),
        rights.map((x) => [
          h('div', { class: 'model-main', html: format(x.c) }),
          x.e ? h('div', { class: 'model-reason', html: format(x.e) }) : null]),
        q.point ? h('div', { class: 'feedback-point' }, h('span', { class: 'point-label' }, 'ポイント'), h('span', { html: format(q.point) })) : null,
        h('details', { class: 'model-others' },
          h('summary', null, 'よくある誤った考え方'),
          h('ul', null, others.map((x) => h('li', null, h('span', { html: format(x.c) }), x.e ? h('div', { class: 'small muted', html: format(x.e) }) : null)))),
        h('div', { class: 'feedback-actions' }, askBtn));

      const grade = (g) => () => api.finish(g);
      actionBar.replaceChildren(
        h('div', { class: 'small muted action-hint' }, '要点と理由を自分の言葉で言えましたか？'),
        h('div', { class: 'action-buttons' },
          h('button', { class: 'btn primary', onclick: grade('confident') }, '言えた', h('kbd', null, '1')),
          h('button', { class: 'btn', onclick: grade('unsure') }, '一部', h('kbd', null, '2')),
          h('button', { class: 'btn', onclick: grade('wrong') }, '言えず', h('kbd', null, '3'))));
      answerBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      api.onKey((e) => {
        const g = { 1: 'confident', 2: 'unsure', 3: 'wrong' }[e.key];
        if (g) api.finish(g);
      });
    }

    function buildPrompt(mine) {
      return [
        '学習アプリ「' + api.job.title + '」で、次の問題に選択肢なしで答える練習をしています。',
        '',
        '【問題】',
        v.question,
        '',
        '【模範解答】',
        ...v.answers.map((i) => '・' + v.choices[i] + (exps[i] ? '（' + exps[i] + '）' : '')),
        q.point ? '【ポイント】' + q.point : '',
        '',
        mine ? '【私の説明】\n' + mine : '',
        '',
        mine
          ? '私の説明を添削してください。合っている点、抜けている観点、誤解している点を分けて指摘し、理解を確かめる問いを1つ投げかけてください。'
          : '解説を繰り返すのではなく、私の理解の穴を見つけるように問いかけを交えて、実務での具体例とともに答えてください。',
        '',
        '【質問】',
        '',
      ].join('\n');
    }

    setTimeout(() => input.focus({ preventScroll: true }), 0);
  },
});
