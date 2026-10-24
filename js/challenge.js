// スフィア盤のマスを開くラーニング。マスは10問、アビリティは20問（スピード勝負 → じっくり → 難問の3段構成）。
// 熟練度レベルごとに出題形式が変わる。1問の表示と判定は各 mode に任せ、出題の組み立て・制限時間・クリア判定をここで行う。
(function () {
  'use strict';

  const S = window.StudyApp;
  const CLEAR_RATE = 0.9;
  const CELL_SIZE = 10;
  const ABILITY_SIZE = 20;
  const MIN_CELL = 5;
  const MIN_ABILITY = 10;
  // 画面に出す呼び名。ここだけ変えれば全体の表記が変わる
  const NAMES = { cell: 'スキルラーニング', ability: 'アビリティラーニング' };
  const PHASES = {
    opening: { title: 'スピード勝負', sub: (sec) => sec + '秒以内に答えよう' },
    middle: { title: 'じっくり勝負', sub: () => '落ち着いて、確実に正解を重ねよう' },
    final: { title: 'ラストスパート', sub: () => '難問が続く。踏ん張りどころ！' },
  };

  // 熟練度レベルごとの出題形式。shared: 共通の問題（level 指定なしで登録）を使うか。quick: 早押しの制限時間（0 なら早押しなし）
  const LEVELS = {
    1: { mode: 'quiz4', shared: true, quick: 15 },
    2: { mode: 'quiz4', shared: true, quick: 30, hard: true, filter: (q) => !!q.hard },
    3: { mode: 'twotier', shared: false, quick: 0 },
    4: { mode: 'finderror', shared: false, quick: 0 },
    5: { mode: 'explain', shared: true, quick: 0 },
  };

  function deck(job, lv) { return job.id + '/L' + lv; }
  const level = (q) => q.difficulty || 2;

  // マスの問題（そのマスに登録された問題のうち、レベルの形式で出せるもの）
  function cellPool(job, ab, ci, lv) {
    const L = LEVELS[lv];
    const mode = S.modes.get(L.mode);
    if (!mode) return [];
    return S.questionsForCell(job.id, ab.id, ci, L.shared ? 0 : lv).filter((q) => mode.supports(q) && (!L.filter || L.filter(q)));
  }

  function abilityPool(job, ab, lv) { return ab.cells.flatMap((_, ci) => cellPool(job, ab, ci, lv)); }

  function need(count) { return Math.ceil(count * CLEAR_RATE); }

  // 問題が足りないときは他のマスの問題で補う。不正解 → 迷った の順に弱点を優先し、
  // 同じアビリティと前提アビリティの問題を先に使う。それ以外のアビリティからは、答えたことのある問題だけを使う
  function fillShared(job, ab, lv, own, count) {
    if (own.length >= count) return [];
    const ids = new Set(own.map((q) => q.id));
    const near = new Set([ab.id, ...(ab.requires || [])]);
    const candidates = [];
    for (const other of job.abilities) {
      other.cells.forEach((_, ci) => {
        for (const q of cellPool(job, other, ci, lv)) {
          if (ids.has(q.id)) continue;
          ids.add(q.id);
          const c = S.getCard(deck(job, lv), q.id);
          const isNear = near.has(other.id);
          if (!c && !isNear) continue;
          const weak = !c ? 2 : c.lastGrade === 'wrong' ? 0 : c.lastGrade === 'unsure' ? 1 : 3;
          candidates.push({ q, weak, near: isNear ? 0 : 1 });
        }
      });
    }
    return S.util.shuffle(candidates).sort((a, b) => a.weak - b.weak || a.near - b.near).slice(0, count - own.length).map((x) => x.q);
  }

  // マス: 易しい問題から順に出す
  function cellItems(job, ab, ci, lv) {
    const own = S.util.shuffle(cellPool(job, ab, ci, lv)).slice(0, CELL_SIZE);
    const shared = fillShared(job, ab, lv, own, CELL_SIZE);
    return [...own.map((q) => ({ q })), ...shared.map((q) => ({ q, shared: true }))].sort((a, b) => level(a.q) - level(b.q));
  }

  // アビリティ: 早押しがあるレベルでは最初に正解したことのある易しめの問題を、最後に難しい問題を、残りを間に出す
  function abilityItems(job, ab, lv) {
    const L = LEVELS[lv];
    const own = abilityPool(job, ab, lv);
    const shared = fillShared(job, ab, lv, own, ABILITY_SIZE);
    const sharedIds = new Set(shared.map((q) => q.id));
    const pool = [...own, ...shared];
    const n = Math.min(ABILITY_SIZE, pool.length);
    const edge = n === ABILITY_SIZE ? 6 : Math.round(n * 0.3);
    const left = S.util.shuffle(pool);
    const take = (count, score) => { left.sort((a, b) => score(a) - score(b)); return left.splice(0, count); };
    const unseen = (q) => { const c = S.getCard(deck(job, lv), q.id); return c && c.lastGrade !== 'wrong' ? 0 : 1; };
    const opening = L.quick ? take(edge, (q) => unseen(q) * 10 + level(q)) : [];
    const final = take(edge, (q) => -level(q));
    const middle = take(n - opening.length - final.length, (q) => Math.abs(level(q) - 2));
    const mark = (q) => (sharedIds.has(q.id) ? { shared: true } : {});
    return [
      ...opening.map((q) => ({ q, phase: 'opening', timed: true, ...mark(q) })),
      ...middle.map((q) => ({ q, phase: 'middle', ...mark(q) })),
      ...final.sort((a, b) => level(a) - level(b)).map((q) => ({ q, phase: 'final', ...mark(q) })),
    ];
  }

  function startCell(job, ab, ci, lv, hooks) {
    run({ job, lv, kind: 'cell', title: ab.cells[ci], items: cellItems(job, ab, ci, lv), retry: () => startCell(job, ab, ci, lv, hooks), ...hooks });
  }

  function startAbility(job, ab, lv, hooks) {
    run({ job, lv, kind: 'ability', title: ab.title, items: abilityItems(job, ab, lv), retry: () => startAbility(job, ab, lv, hooks), ...hooks });
  }

  function run(cfg) {
    const st = Object.assign({ index: 0, correct: 0, log: [], need: need(cfg.items.length), mode: S.modes.get(LEVELS[cfg.lv].mode) }, cfg);
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
      h('div', { class: 'phase-sub' }, PHASES[phase].sub(LEVELS[st.lv].quick)),
      h('div', { class: 'phase-score' }, '正解 ' + st.correct + ' / クリアまで ' + st.need),
      h('button', { class: 'btn primary', onclick: go }, '進む', h('kbd', null, 'Enter'))));
    setKeyHandler((e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  }

  function passes(st, grade) { return st.mode.passes ? st.mode.passes(grade) : grade !== 'wrong'; }

  function question(st, item) {
    const { h, show, bar, setKeyHandler } = S.ui;
    const L = LEVELS[st.lv];
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
          item.shared ? h('span', { class: 'pill warn' }, '復習') : null,
          h('span', { class: 'challenge-score' }, '正解 ' + st.correct + ' / クリアまで ' + st.need)),
        item.timed ? h('div', { class: 'timer' }, timerFill) : null,
        body));

    const finish = (grade) => {
      if (done) return;
      done = true;
      stopTimer();
      S.record(deck(st.job, st.lv), item.q.id, grade);
      if (passes(st, grade)) st.correct++;
      st.log.push({ q: item.q, grade });
      st.index++;
      next(st);
    };

    st.mode.render(body, item.q, {
      job: st.job,
      hard: !!L.hard,
      onKey: setKeyHandler,
      finish,
      answered: stopTimer,
    });

    if (item.timed) {
      const start = Date.now();
      timer = setInterval(() => {
        const left = 1 - (Date.now() - start) / (L.quick * 1000);
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
    const misses = st.log.filter((x) => !passes(st, x.grade));
    show(
      header(NAMES[st.kind], st.back),
      h('main', { class: 'container' },
        h('section', { class: 'card result-hero challenge-result ' + (cleared ? 'win' : 'lose') },
          h('div', { class: 'challenge-result-title' }, cleared ? 'クリア！' : 'ざんねん…'),
          h('div', { class: 'muted' }, st.title),
          h('div', { class: 'result-score' }, st.correct + '/' + st.items.length),
          h('div', { class: 'muted small' }, 'クリア条件 ' + st.need + '問以上の正解')),
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

  function resetRecords(job) { S.resetRecords(job.id); }

  S.challenge = { NAMES, LEVELS, startCell, startAbility, cellPool, abilityPool, need, resetRecords, MIN_CELL, MIN_ABILITY, CELL_SIZE, ABILITY_SIZE };
})();
