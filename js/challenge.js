// スフィア盤のマスを開くチャレンジ。マスは10問、アビリティは20問（スピード勝負 → じっくり → 難問の3段構成）。
// 1問の表示と判定は quiz4 モードに任せ、出題の組み立て・制限時間・クリア判定をここで行う。
(function () {
  'use strict';

  const S = window.StudyApp;
  const CLEAR_RATE = 0.7;
  const QUICK_SECONDS = 15;
  const CELL_SIZE = 10;
  const ABILITY_SIZE = 20;
  const MIN_CELL = 5;
  const MIN_ABILITY = 10;
  // 画面に出す呼び名。ここだけ変えれば全体の表記が変わる
  const NAMES = { cell: 'スキルラーニング', ability: 'アビリティラーニング' };
  const PHASES = {
    opening: { title: 'スピード勝負', sub: '15秒以内に答えよう' },
    middle: { title: 'じっくり勝負', sub: '落ち着いて、確実に正解を重ねよう' },
    final: { title: 'ラストスパート', sub: '難問が続く。踏ん張りどころ！' },
  };

  // マスの問題: 登録された問題と、既存テーマから割り当てた問題（from）
  function cellPool(job, ab, ci) {
    const cell = ab.cells[ci];
    const from = typeof cell === 'string' ? [] : cell.from || [];
    const mapped = from.flatMap((f) => {
      const [themeId, category] = f.split(':');
      const theme = S.themes.get(themeId);
      return theme ? theme.questions.filter((q) => q.category === category) : [];
    });
    const mode = S.modes.get('quiz4');
    return [...S.questionsForCell(job.id, ab.id, ci), ...mapped].filter((q) => mode.supports(q));
  }

  function abilityPool(job, ab) { return ab.cells.flatMap((_, ci) => cellPool(job, ab, ci)); }

  const level = (q) => q.difficulty || 2;

  // マス: 易しい問題から順に出す
  function cellItems(pool) {
    return S.util.shuffle(pool).slice(0, CELL_SIZE).sort((a, b) => level(a) - level(b)).map((q) => ({ q }));
  }

  // アビリティ: 最初は正解したことのある易しめの問題を早押しで、最後は難しい問題（高難度版があれば使う）、残りを間に
  function abilityItems(job, pool) {
    const n = Math.min(ABILITY_SIZE, pool.length);
    const edge = n === ABILITY_SIZE ? 6 : Math.round(n * 0.3);
    const left = S.util.shuffle(pool);
    const take = (count, score) => { left.sort((a, b) => score(a) - score(b)); return left.splice(0, count); };
    const unseen = (q) => { const c = S.getCard(job.id, 'quiz4', q.id); return c && c.correct > 0 ? 0 : 1; };
    const opening = take(edge, (q) => unseen(q) * 10 + level(q));
    const final = take(edge, (q) => -level(q) * 10 - (q.hard ? 1 : 0));
    const middle = take(n - edge * 2, (q) => Math.abs(level(q) - 2));
    return [
      ...opening.map((q) => ({ q, phase: 'opening', timed: true })),
      ...middle.map((q) => ({ q, phase: 'middle' })),
      ...final.sort((a, b) => level(a) - level(b)).map((q) => ({ q, phase: 'final', hard: true })),
    ];
  }

  function startCell(job, ab, ci, hooks) {
    const title = typeof ab.cells[ci] === 'string' ? ab.cells[ci] : ab.cells[ci].title;
    run({ job, kind: 'cell', title, items: cellItems(cellPool(job, ab, ci)), retry: () => startCell(job, ab, ci, hooks), ...hooks });
  }

  function startAbility(job, ab, hooks) {
    run({ job, kind: 'ability', title: ab.title, items: abilityItems(job, abilityPool(job, ab)), retry: () => startAbility(job, ab, hooks), ...hooks });
  }

  function run(cfg) {
    const st = Object.assign({ index: 0, correct: 0, log: [], medals: 0, need: Math.ceil(cfg.items.length * CLEAR_RATE) }, cfg);
    document.body.classList.remove('rush');
    next(st);
  }

  function next(st) {
    if (st.index >= st.items.length) { result(st); return; }
    const item = st.items[st.index];
    const prev = st.items[st.index - 1];
    if (item.phase && (!prev || prev.phase !== item.phase) && !item.introduced) {
      item.introduced = true;
      phaseScreen(st, item.phase);
      return;
    }
    question(st, item);
  }

  function phaseScreen(st, phase) {
    const { h, show, setKeyHandler } = S.ui;
    const go = () => next(st);
    document.body.classList.toggle('rush', phase === 'final');
    show(h('div', { class: 'phase-screen phase-' + phase },
      h('div', { class: 'phase-kicker' }, st.title + ' ' + NAMES.ability),
      h('div', { class: 'phase-title' }, PHASES[phase].title),
      h('div', { class: 'phase-sub' }, PHASES[phase].sub),
      h('div', { class: 'phase-score' }, '正解 ' + st.correct + ' / クリアまで ' + st.need),
      h('button', { class: 'btn primary', onclick: go }, '進む', h('kbd', null, 'Enter'))));
    setKeyHandler((e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  }

  function question(st, item) {
    const { h, show, bar, setKeyHandler } = S.ui;
    const body = h('div', { class: 'question-body' });
    const timerFill = h('div', { class: 'timer-fill' });
    let timer = null;
    let done = false;
    const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
    const quit = () => {
      if (!confirm(NAMES[st.kind] + 'を中断しますか？')) return;
      stopTimer();
      document.body.classList.remove('rush');
      st.back();
    };

    show(
      h('header', { class: 'topbar' },
        h('button', { class: 'icon-btn', onclick: quit, 'aria-label': '中断' }, '×'),
        h('div', { class: 'topbar-progress' }, bar(st.index, st.items.length, 'thin')),
        h('span', { class: 'small muted counter' }, (st.index + 1) + '/' + st.items.length)),
      h('main', { class: 'container challenge' },
        h('div', { class: 'challenge-status' },
          h('span', { class: 'pill phase-pill' }, st.title),
          h('span', { class: 'pill stars' }, '★'.repeat(level(item.q))),
          h('span', { class: 'challenge-score' }, '正解 ' + st.correct + ' / クリアまで ' + st.need)),
        item.timed ? h('div', { class: 'timer' }, timerFill) : null,
        body));

    const finish = (grade) => {
      if (done) return;
      done = true;
      stopTimer();
      const before = S.getCard(st.job.id, 'quiz4', item.q.id);
      S.record(st.job.id, 'quiz4', item.q.id, grade);
      if (grade !== 'wrong') {
        st.correct++;
        if (S.game.rollMedal(item.q, before)) { st.medals++; S.ui.toast('小さなメダルを 手に入れた！'); }
      }
      st.log.push({ q: item.q, grade });
      st.index++;
      next(st);
    };

    S.modes.get('quiz4').render(body, item.q, {
      theme: { title: st.job.title },
      difficulty: item.hard && item.q.hard ? 'hard' : S.game.difficulty().id,
      onKey: setKeyHandler,
      finish,
      answered: stopTimer,
    });

    if (item.timed) {
      const start = Date.now();
      timer = setInterval(() => {
        const left = 1 - (Date.now() - start) / (QUICK_SECONDS * 1000);
        timerFill.style.width = Math.max(0, left * 100) + '%';
        timerFill.classList.toggle('low', left < 0.3);
        if (left <= 0) { S.ui.toast('時間切れ！'); finish('wrong'); }
      }, 100);
    }
  }

  function result(st) {
    const { h, show, header, setKeyHandler } = S.ui;
    const cleared = st.correct >= st.need;
    document.body.classList.remove('rush');
    if (cleared) st.onClear();
    const misses = st.log.filter((x) => x.grade === 'wrong');
    show(
      header(NAMES[st.kind], st.back),
      h('main', { class: 'container' },
        h('section', { class: 'card result-hero challenge-result ' + (cleared ? 'win' : 'lose') },
          h('div', { class: 'challenge-result-title' }, cleared ? 'クリア！' : 'ざんねん…'),
          h('div', { class: 'muted' }, st.title),
          h('div', { class: 'result-score' }, st.correct + '/' + st.items.length),
          h('div', { class: 'muted small' }, 'クリア条件 ' + st.need + '問以上の正解'),
          st.medals ? h('div', { class: 'result-medal' }, h('span', { class: 'medal-icon' }), '小さなメダル ×' + st.medals) : null),
        misses.length ? h('h2', { class: 'section-title' }, '要点の振り返り') : null,
        misses.length ? h('div', { class: 'stack' }, misses.map((x) =>
          h('div', { class: 'card review-item ng' },
            h('div', { class: 'review-q', html: S.util.format(x.q.question) }),
            x.q.point ? h('div', { class: 'review-point', html: S.util.format(x.q.point) }) : null))) : null,
        h('div', { class: 'stack actions-end' },
          h('button', { class: 'btn primary block', onclick: st.back }, 'スフィア盤に戻る'),
          h('button', { class: 'btn block', onclick: st.retry }, cleared ? 'もう一度挑戦する' : '再挑戦する'))));
    setKeyHandler((e) => { if (e.key === 'Enter') { e.preventDefault(); st.back(); } });
  }

  S.challenge = { NAMES, startCell, startAbility, cellPool, abilityPool, MIN_CELL, MIN_ABILITY, CELL_SIZE, ABILITY_SIZE };
})();
