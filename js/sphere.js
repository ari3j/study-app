// ジョブ一覧とスフィア盤（FF10 風の成長マップ）。試作: マスのクリアはデモ操作のみ
(function () {
  'use strict';

  const S = window.StudyApp;
  const NS = 'http://www.w3.org/2000/svg';
  const RAD = Math.PI / 180;

  // アビリティの系統。名前・色・アイコンはここだけで決める
  const TYPES = {
    theory: { label: '攻撃', meaning: '基礎・理論', color: '#ff8787', icon: 'M0 -12 L3 3 L1.2 3 L1.2 10 L-1.2 10 L-1.2 3 L-3 3 Z M-7 3 L7 3 L7 5.5 L-7 5.5 Z' },
    apply: { label: '魔法', meaning: '活用', color: '#b197fc', icon: star(11, 4.6) },
    operate: { label: '回復', meaning: '運用', color: '#69db7c', icon: 'M-2.8 -10 H2.8 V-2.8 H10 V2.8 H2.8 V10 H-2.8 V2.8 H-10 V-2.8 H-2.8 Z' },
    build: { label: '補助', meaning: '開発', color: '#4dabf7', icon: 'M-9 -2 L0 -11 L9 -2 L9 2.5 L0 -6.5 L-9 2.5 Z M-9 6 L0 -3 L9 6 L9 10.5 L0 1.5 L-9 10.5 Z' },
  };
  const TYPE_ORDER = Object.keys(TYPES);

  function star(ro, ri) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? ri : ro;
      const a = (-90 + i * 36) * RAD;
      d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1) + ' ';
    }
    return d + 'Z';
  }

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    for (const c of children.flat()) if (c != null) el.append(c);
    return el;
  }

  // ---- 進行状況 ----
  // ---- 熟練度 ----
  // 全アビリティをラーニングすると熟練度が1つ上がり、次の周回に進む。2周目以降は全マスが開放され、次のレベルの問題に挑戦する
  // 出題形式の中身は js/challenge.js の LEVELS
  const PROFICIENCY = [
    { name: '知っている', format: '4択' },
    { name: '見極められる', format: 'すべて選べ' },
    { name: '理由を説明できる', format: '答えと理由の二段階' },
    { name: '誤りを見抜ける', format: '誤りを見つける' },
    { name: '自分の言葉で語れる', format: '記述して自己採点' },
  ];
  const MAX_LEVEL = PROFICIENCY.length;
  // 上級ジョブに挑戦するために、条件のジョブで必要な熟練度
  const QUALIFY_LEVEL = 4;

  function jobState(jobId) {
    const st = S.state('sphere');
    if (!st[jobId] || !st[jobId].cleared) st[jobId] = { proficiency: 0, cleared: {} };
    return st[jobId];
  }
  function cleared(jobId) { return jobState(jobId).cleared; }
  function proficiency(job) { return jobState(job.id).proficiency; }
  // 挑戦中のレベル（熟練度が最大なら null）
  function currentLevel(job) { const p = proficiency(job); return p < MAX_LEVEL ? p + 1 : null; }
  function profStars(n) { return '\u2606'.repeat(MAX_LEVEL - n) + '\u2605'.repeat(n); }
  function levelLabel(lv) { return 'Lv' + lv + ' ' + PROFICIENCY[lv - 1].name; }

  // マスをすべてクリアするとアビリティのマスに挑戦でき、そこをクリアするとアビリティを習得する
  function cellsDone(job, ab) { const c = cleared(job.id); return ab.cells.every((_, i) => c[ab.id + '-' + i]); }
  function abilityLearned(job, ab) { return currentLevel(job) === null || !!cleared(job.id)['ab:' + ab.id]; }
  function jobProgress(job) {
    const done = job.abilities.filter((ab) => abilityLearned(job, ab)).length;
    return { done, total: job.abilities.length, mastered: proficiency(job) >= MAX_LEVEL, qualified: proficiency(job) >= QUALIFY_LEVEL };
  }

  function resetJob(jobId) {
    delete S.state('sphere')[jobId];
    S.resetRecords(jobId);
  }

  // ---- 配置 ----
  // 中央にジョブ。系統ごとに扇形の区画を割り当て、区画の中で分類（group）ごとに道を放射状に伸ばす。
  // 区画の広さは道の本数に比例するので、系統の偏りがそのまま盤面の形になる。
  function layout(job) {
    const nodes = [];
    const edges = [];
    const byId = {};
    const abilities = {};
    const labels = [];
    const add = (n) => { nodes.push(n); byId[n.id] = n; return n; };
    const link = (a, b, kind) => edges.push({ a, b, kind: kind || 'path' });

    const groups = [];
    for (const ab of job.abilities) {
      let g = groups.find((x) => x.title === ab.group && x.type === ab.type);
      if (!g) groups.push(g = { title: ab.group, type: ab.type, abilities: [] });
      g.abilities.push(ab);
    }
    groups.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));

    const hub = add({ id: 'hub', kind: 'hub', x: 0, y: 0, r: 36 });
    const step = 360 / groups.length;
    const firstCount = groups.filter((g) => g.type === groups[0].type).length;
    groups.forEach((g, gi) => { g.angle = (-90 + (gi - (firstCount - 1) / 2) * step) * RAD; });

    for (const type of TYPE_ORDER) {
      const gs = groups.filter((g) => g.type === type);
      if (!gs.length) continue;
      const mid = gs.reduce((sum, g) => sum + g.angle, 0) / gs.length;
      const tn = add({ id: 'type-' + type, kind: 'type', type, x: 150 * Math.cos(mid), y: 150 * Math.sin(mid), r: 24, count: gs.reduce((n, g) => n + g.abilities.length, 0) });
      link(hub, tn);
      for (const g of gs) {
        let prev = tn;
        g.abilities.forEach((ab, ai) => {
          const R = 340 + ai * 230;
          const ax = R * Math.cos(g.angle);
          const ay = R * Math.sin(g.angle);
          const dx = ax - prev.x;
          const dy = ay - prev.y;
          const len = Math.hypot(dx, dy);
          const cells = ab.cells.map((cell, ci) => {
            const t = (ci + 1) / (ab.cells.length + 1);
            const off = (ci % 2 ? 1 : -1) * 17;
            return add({ id: ab.id + '-' + ci, kind: 'cell', title: cell, index: ci, ability: ab, type, x: prev.x + dx * t - (dy / len) * off, y: prev.y + dy * t + (dx / len) * off, r: 11 });
          });
          const an = add({ id: 'ab-' + ab.id, kind: 'ability', ability: ab, type, x: ax, y: ay, r: 22, cells, prev: ai ? g.abilities[ai - 1] : null });
          abilities[ab.id] = an;
          [prev, ...cells, an].reduce((p, c) => { link(p, c); return c; });
          prev = an;
        });
        const R = 340 + (g.abilities.length - 1) * 230 + 100;
        labels.push({ x: R * Math.cos(g.angle), y: R * Math.sin(g.angle) + 4, text: g.title, color: TYPES[type].color });
      }
    }
    for (const an of Object.values(abilities)) {
      for (const req of an.ability.requires || []) if (abilities[req]) link(abilities[req], an.cells[0], 'requires');
    }
    return { nodes, edges, byId, abilities, labels };
  }

  // layout はアビリティのマスをアビリティより先に追加しているので、この順で評価すれば足りる
  function evaluate(job, L) {
    const c = cleared(job.id);
    const lv = currentLevel(job);
    const allOpen = lv === null || lv >= 2;
    for (const n of L.nodes) {
      if (n.kind === 'hub' || n.kind === 'type') { n.state = 'lit'; continue; }
      if (n.kind === 'ability') {
        n.state = abilityLearned(job, n.ability) ? 'learned' : allOpen || cellsDone(job, n.ability) ? 'ready' : n.cells.some((x) => x.state !== 'locked') ? 'open' : 'locked';
        continue;
      }
      if (allOpen) { n.missing = []; n.state = c[n.id] || lv === null ? 'cleared' : 'available'; continue; }
      const an = L.abilities[n.ability.id];
      const missing = [];
      if (an.prev && !abilityLearned(job, an.prev)) missing.push(an.prev.title);
      for (const req of n.ability.requires || []) if (!abilityLearned(job, L.abilities[req].ability)) missing.push(L.abilities[req].ability.title);
      n.missing = missing;
      const prevCell = n.index ? an.cells[n.index - 1] : null;
      n.state = c[n.id] ? 'cleared' : !missing.length && (!prevCell || c[prevCell.id]) ? 'available' : 'locked';
    }
  }

  // ---- ジョブ一覧（トップページに表示する） ----
  function jobList() {
    const { h } = S.ui;
    const all = [...S.jobs.values()];
    const card = (job) => {
      const p = jobProgress(job);
      const reqs = (job.requires || []).map((id) => S.jobs.get(id)).filter(Boolean);
      const unlocked = reqs.every((r) => jobProgress(r).qualified);
      const playable = !job.planned && unlocked;
      const counts = TYPE_ORDER.map((t) => ({ t, n: job.abilities.filter((ab) => ab.type === t).length }));
      return h('button', { class: 'card job-card' + (playable ? '' : ' disabled'), disabled: !playable, onclick: () => open(job.id) },
        h('div', { class: 'job-card-head' },
          h('span', { class: 'job-card-title' }, job.title),
          job.planned ? h('span', { class: 'pill' }, '準備中') : p.mastered ? h('span', { class: 'pill ok' }, 'マスター') : null),
        job.planned ? null : h('div', { class: 'job-prof' }, h('span', { class: 'prof-stars' }, profStars(proficiency(job))),
          h('span', { class: 'small muted' }, currentLevel(job) ? levelLabel(currentLevel(job)) + ' に挑戦中' : '熟練度 最大')),
        h('div', { class: 'small muted' }, job.description),
        job.abilities.length ? [
          h('div', { class: 'type-bar' }, counts.filter((x) => x.n).map((x) => h('span', { style: 'flex:' + x.n + ';background:' + TYPES[x.t].color }))),
          h('div', { class: 'type-legend' }, counts.filter((x) => x.n).map((x) => h('span', null, h('i', { style: 'background:' + TYPES[x.t].color }), TYPES[x.t].label + ' ' + x.n))),
          h('div', { class: 'small muted' }, '今の周回のアビリティラーニング ' + p.done + '/' + p.total)] : null,
        reqs.length ? h('div', { class: 'job-reqs' }, '挑戦条件: ', reqs.map((r) => h('span', { class: 'req' + (jobProgress(r).qualified ? ' ok' : '') }, (jobProgress(r).qualified ? '✓ ' : '') + r.title + ' 熟練度' + profStars(QUALIFY_LEVEL)))) : null);
    };
    return [
      h('h2', { class: 'section-title' }, 'ジョブを選ぶ'),
      h('p', { class: 'small muted' }, 'ジョブごとにスフィア盤があります。全アビリティをラーニングすると熟練度が1つ上がり、全マスが開放された次の周回で、より深い理解を問う問題に挑戦します。'),
      h('div', { class: 'stack' }, all.filter((j) => j.tier !== 'advanced').map(card)),
      h('h2', { class: 'section-title' }, '上級ジョブ'),
      h('p', { class: 'small muted' }, '条件のジョブをすべて熟練度' + profStars(QUALIFY_LEVEL) + '以上にすると挑戦できます。'),
      h('div', { class: 'stack' }, all.filter((j) => j.tier === 'advanced').map(card)),
    ];
  }

  // ---- スフィア盤 ----
  function open(jobId) {
    const job = S.jobs.get(jobId);
    const { h, show, header } = S.ui;
    const L = layout(job);
    evaluate(job, L);

    const svg = s('svg', { class: 'sphere-svg' });
    const world = s('g');
    const gEdges = s('g');
    const gNodes = s('g');
    const gLabels = s('g');
    world.append(stars(), gEdges, gNodes, gLabels);
    svg.append(defs(), world);

    const sheet = h('div', { class: 'sphere-sheet hidden' });
    const banner = h('div', { class: 'sphere-round' });
    const wrap = h('div', { class: 'sphere-wrap' }, svg, banner,
      h('div', { class: 'sphere-controls' },
        h('button', { onclick: () => zoomAt(1.3), 'aria-label': '拡大' }, '+'),
        h('button', { onclick: () => zoomAt(1 / 1.3), 'aria-label': '縮小' }, '−'),
        h('button', { onclick: center, 'aria-label': '中央へ' }, '◎')),
      sheet);
    const resetBtn = h('button', { class: 'icon-btn', 'aria-label': '試作の進行をリセット', onclick: () => {
      if (confirm('このジョブの進行・熟練度・回答の記録をリセットしますか？')) { resetJob(job.id); closeSheet(); }
    } }, '↺');
    const top = header(job.title + ' のスフィア盤', S.ui.renderHome, resetBtn);
    show(top, wrap);
    wrap.style.top = top.offsetHeight + 'px';

    let selected = null;

    function redraw() {
      evaluate(job, L);
      const lv = currentLevel(job);
      banner.replaceChildren(h('span', { class: 'prof-stars' }, profStars(proficiency(job))),
        h('span', null, lv ? levelLabel(lv) + '（' + PROFICIENCY[lv - 1].format + '）' : 'マスター'));
      // 選んだマスのアビリティの前提条件（点線）と、その前提元のアビリティを強調する
      const focus = selected && selected.ability ? selected.ability : null;
      const edgeEls = L.edges.map((e) => {
        const lit = isLit(e.a) && isLit(e.b);
        const hl = e.kind === 'requires' && focus && e.b.ability === focus;
        const color = TYPES[e.b.type || e.a.type] ? TYPES[e.b.type || e.a.type].color : '#fff';
        return s('line', {
          x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y,
          class: 'sg-edge ' + e.kind + (lit && e.kind === 'path' ? ' lit' : '') + (hl ? ' hl' : ''),
          style: lit && !hl ? 'stroke:' + color + ';color:' + color : null,
        });
      });
      // 強調する線は最後に描いて、他の線の下に隠れないようにする
      gEdges.replaceChildren(...edgeEls.filter((el) => !el.classList.contains('hl')), ...edgeEls.filter((el) => el.classList.contains('hl')));
      gNodes.replaceChildren(...L.nodes.map(drawNode));
      gLabels.replaceChildren(...L.labels.map((l) => s('text', { x: l.x, y: l.y, class: 'lbl-group', fill: l.color }, l.text)));
    }

    function isLit(n) { return ['lit', 'cleared', 'learned'].includes(n.state); }

    function drawNode(n) {
      const t = TYPES[n.type];
      const reqSrc = n.kind === 'ability' && selected && selected.ability && (selected.ability.requires || []).includes(n.ability.id);
      const g = s('g', { class: 'sg-node ' + n.kind + ' ' + n.state + (selected === n ? ' selected' : '') + (reqSrc ? ' req-src' : ''), 'data-id': n.id, transform: 'translate(' + n.x + ' ' + n.y + ')', style: '--c:' + (t ? t.color : '#fff') });
      if (n.kind === 'hub') {
        g.append(
          s('circle', { r: n.r + 22, class: 'halo', fill: 'url(#hubHalo)' }),
          s('circle', { r: n.r, fill: 'url(#hubFill)', class: 'core' }),
          s('path', { d: 'M0 -18 L12 0 L0 18 L-12 0 Z', class: 'crystal' }),
          s('text', { y: n.r + 20, class: 'lbl-hub' }, job.title));
      } else if (n.kind === 'type') {
        g.append(
          s('circle', { r: n.r + 14, class: 'halo' }),
          s('circle', { r: n.r, class: 'core' }),
          s('path', { d: t.icon, class: 'icon', transform: 'scale(1.15)' }),
          s('text', { y: n.r + 18, class: 'lbl-type' }, t.label));
      } else if (n.kind === 'ability') {
        g.append(
          s('circle', { r: n.r + 14, class: 'halo' }),
          s('circle', { r: n.r, class: 'core' }),
          s('path', { d: t.icon, class: 'icon' }),
          s('text', { y: n.r + 18, class: 'lbl-ability' }, n.ability.title));
      } else {
        g.append(
          s('circle', { r: n.r + 9, class: 'halo' }),
          s('circle', { r: n.r, class: 'core' }),
          s('text', { y: -n.r - 7, class: 'lbl-cell' }, n.title));
      }
      return g;
    }

    // ---- 詳細シート ----
    function select(n) {
      selected = n;
      redraw();
      sheet.replaceChildren();
      S.ui.append(sheet, sheetContent(n));
      sheet.classList.remove('hidden');
    }

    function closeSheet() {
      selected = null;
      sheet.classList.add('hidden');
      redraw();
    }

    function typeBadge(type) {
      const t = TYPES[type];
      return h('span', { class: 'type-badge', style: 'background:' + t.color }, t.label + 'アビリティ');
    }

    function progressRow(title, done, total, color) {
      const pct = total ? Math.round((done / total) * 100) : 0;
      return h('div', { class: 'job-row' + (total && done === total ? ' ok' : '') },
        h('div', { class: 'job-head' }, h('strong', null, title), h('span', { class: 'small muted' }, done + '/' + total)),
        h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: 'width:' + pct + '%;background:' + color })));
    }

    function sheetContent(n) {
      const close = h('button', { class: 'icon-btn sheet-close', onclick: closeSheet, 'aria-label': '閉じる' }, '×');
      const c = cleared(job.id);
      const abs = Object.values(L.abilities);
      if (n.kind === 'hub') {
        const p = jobProgress(job);
        const advanced = [...S.jobs.values()].filter((j) => (j.requires || []).includes(job.id));
        const pf = proficiency(job);
        return [close, h('div', { class: 'sheet-kind' }, 'ジョブ'), h('h3', null, job.title),
          h('p', { class: 'small muted' }, job.description),
          h('div', { class: 'sheet-section' }, '熟練度'),
          h('div', { class: 'job-prof' }, h('span', { class: 'prof-stars big' }, profStars(pf)), h('span', null, pf ? levelLabel(pf) : 'まだ熟練度はありません')),
          PROFICIENCY.map((x, i) => h('div', { class: 'sheet-line' + (i < pf ? ' ok' : '') + (i === pf ? ' now' : '') },
            (i < pf ? '✓ ' : i === pf ? '▶ ' : '・') + levelLabel(i + 1), h('span', { class: 'small muted' }, x.format + (i === pf ? '（挑戦中）' : '')))),
          p.mastered ? null : progressRow('今の周回のアビリティラーニング', p.done, p.total, '#ffd43b'),
          h('div', { class: 'sheet-section' }, '系統ごとのアビリティ'),
          TYPE_ORDER.filter((t) => abs.some((a) => a.type === t)).map((t) => {
            const list = abs.filter((a) => a.type === t);
            return progressRow(TYPES[t].label + '（' + TYPES[t].meaning + '）', list.filter((a) => a.state === 'learned').length, list.length, TYPES[t].color);
          }),
          advanced.length ? [h('div', { class: 'sheet-section' }, 'このジョブが条件の上級ジョブ'),
            advanced.map((j) => h('div', { class: 'sheet-line' }, j.title, h('span', { class: 'small muted' }, '条件: ' + j.requires.map((id) => (S.jobs.get(id) || {}).title).join(' + '))))] : null];
      }
      if (n.kind === 'type') {
        const list = abs.filter((a) => a.type === n.type);
        return [close, h('div', { class: 'sheet-kind' }, '系統'), h('h3', null, typeBadge(n.type)),
          h('p', { class: 'small muted' }, TYPES[n.type].meaning + 'にあたるアビリティ'),
          progressRow('習得', list.filter((a) => a.state === 'learned').length, list.length, TYPES[n.type].color),
          list.map((a) => h('div', { class: 'sheet-line' + (a.state === 'learned' ? ' ok' : '') }, (a.state === 'learned' ? '✓ ' : '・') + a.ability.title, h('span', { class: 'small muted' }, a.ability.group)))];
      }
      if (n.kind === 'ability') {
        const done = n.cells.filter((x) => c[x.id]).length;
        const reqs = (n.ability.requires || []).map((r) => L.abilities[r].ability.title);
        return [close, h('div', { class: 'sheet-kind' }, 'アビリティ'), typeBadge(n.type),
          h('h3', null, n.ability.title),
          h('div', { class: 'small muted' }, '分類: ' + n.ability.group + (reqs.length ? '　前提: ' + reqs.join('、') : '')),
          h('p', { class: 'small' }, { learned: '習得済み', ready: S.challenge.NAMES.ability + 'に挑戦できます' }[n.state] || 'すべてのマスをクリアすると、' + S.challenge.NAMES.ability + 'に挑戦できます'),
          progressRow('マス', done, n.cells.length, TYPES[n.type].color),
          n.cells.map((x) => h('div', { class: 'sheet-line' + (c[x.id] ? ' ok' : '') }, (c[x.id] ? '✓ ' : '・') + x.title)),
          h('div', { class: 'sheet-section' }, S.challenge.NAMES.ability + '（' + S.challenge.ABILITY_SIZE + '問）'),
          h('p', { class: 'small muted' }, 'スピード勝負の早押しから始まり、最後は難問が続きます。' + S.challenge.need(S.challenge.ABILITY_SIZE) + '問以上の正解でアビリティを習得。'),
          abilityBattle(n)];
      }
      const stateText = { cleared: 'クリア済み', available: '挑戦できる', locked: 'まだ開いていない' }[n.state];
      const an = L.abilities[n.ability.id];
      const prevCell = n.index ? an.cells[n.index - 1] : null;
      const lv = currentLevel(job);
      const qs = lv ? S.challenge.cellPool(job, n.ability, n.index, lv) : [];
      const reqs = (n.ability.requires || []).map((r) => L.abilities[r].ability.title);
      return [close, h('div', { class: 'sheet-kind' }, 'マス'),
        h('div', { class: 'sheet-crumbs' }, typeBadge(n.type), ' ' + n.ability.title),
        reqs.length ? h('div', { class: 'small muted' }, '前提アビリティ: ' + reqs.join('、')) : null,
        h('h3', null, n.title), h('span', { class: 'pill sheet-state ' + n.state }, stateText),
        lv ? h('p', { class: 'small muted' }, levelLabel(lv) + ' の問題 ' + qs.length + '問' + (qs.length < S.challenge.MIN_CELL ? '（準備中）' : '・' + Math.min(qs.length, S.challenge.CELL_SIZE) + '問の' + S.challenge.NAMES.cell)) : null,
        n.state === 'locked' ? h('p', { class: 'small muted' },
          n.missing.length ? 'アビリティ「' + n.missing.join('」「') + '」の習得が必要です。' : '直前のマス「' + prevCell.title + '」をクリアすると開きます。') : null,
        lv && n.state !== 'locked' && qs.length >= S.challenge.MIN_CELL ? [
          h('button', { class: 'btn primary block', onclick: () => S.challenge.startCell(job, n.ability, n.index, lv, { back, onClear: () => clearCell(n) }) },
            n.state === 'cleared' ? 'もう一度挑戦する' : '挑戦する'),
          h('p', { class: 'small muted' }, S.challenge.need(Math.min(qs.length, S.challenge.CELL_SIZE)) + '問以上の正解でクリア。易しい問題から順に出ます。')] : null,
        lv && n.state !== 'locked' && qs.length < S.challenge.MIN_CELL ? h('button', { class: 'btn block demo-btn', onclick: () => {
          if (c[n.id]) { delete c[n.id]; S.save(); select(n); } else clearCell(n, true);
        } }, n.state === 'cleared' ? '【試作】未クリアに戻す' : '【試作】' + levelLabel(lv) + ' の問題は準備中のためクリア扱いにする') : null];
    }

    function back() { open(job.id); }

    function clearCell(n, inPlace) {
      const c = cleared(job.id);
      const wasReady = cellsDone(job, n.ability);
      c[n.id] = c[n.id] || Date.now();
      S.save();
      if (inPlace) select(n);
      S.ui.toast(!wasReady && cellsDone(job, n.ability) ? 'アビリティ「' + n.ability.title + '」に 挑戦できるようになった！' : 'マス「' + n.title + '」を クリアした！');
    }

    function learnAbility(n, inPlace) {
      const st = jobState(job.id);
      st.cleared['ab:' + n.ability.id] = st.cleared['ab:' + n.ability.id] || Date.now();
      S.ui.toast('アビリティ「' + n.ability.title + '」を おぼえた！');
      if (job.abilities.every((ab) => st.cleared['ab:' + ab.id])) {
        st.proficiency++;
        st.cleared = {};
        setTimeout(() => S.ui.toast(job.title + ' の熟練度が 上がった！ ' + profStars(st.proficiency)), 2300);
        setTimeout(() => S.ui.toast(st.proficiency < MAX_LEVEL
          ? '全マスが 開放された！ 次は ' + levelLabel(st.proficiency + 1)
          : job.title + ' を マスターした！'), 4600);
      }
      S.save();
      if (inPlace) select(n);
    }

    function abilityBattle(n) {
      const lv = currentLevel(job);
      if (!lv || (n.state !== 'ready' && n.state !== 'learned')) return null;
      const pool = S.challenge.abilityPool(job, n.ability, lv);
      if (pool.length >= S.challenge.MIN_ABILITY) {
        return h('button', { class: 'btn primary block', onclick: () => S.challenge.startAbility(job, n.ability, lv, { back, onClear: () => learnAbility(n) }) },
          n.state === 'learned' ? 'もう一度挑戦する' : '挑戦する');
      }
      const c = cleared(job.id);
      return h('button', { class: 'btn block demo-btn', onclick: () => {
        if (c['ab:' + n.ability.id]) { delete c['ab:' + n.ability.id]; S.save(); select(n); } else learnAbility(n, true);
      } }, n.state === 'learned' ? '【試作】未習得に戻す' : '【試作】' + levelLabel(lv) + ' の問題は準備中のため習得扱いにする');
    }

    // ---- 拡大縮小とドラッグ ----
    const view = { k: 1, x: 0, y: 0 };
    function apply() {
      world.setAttribute('transform', 'translate(' + view.x + ' ' + view.y + ') scale(' + view.k + ')');
      svg.classList.toggle('far', view.k < 0.5);
      svg.classList.toggle('near', view.k > 1.3);
    }
    function size() { const r = svg.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top }; }
    function zoomAt(f, cx, cy) {
      const z = size();
      if (cx == null) { cx = z.w / 2; cy = z.h / 2; }
      const k = Math.min(3, Math.max(0.2, view.k * f));
      const ratio = k / view.k;
      view.x = cx - (cx - view.x) * ratio;
      view.y = cy - (cy - view.y) * ratio;
      view.k = k;
      apply();
    }
    function center() {
      const z = size();
      view.k = Math.min(z.w, z.h) / 760;
      view.x = z.w / 2;
      view.y = z.h / 2;
      apply();
    }

    const pts = new Map();
    let moved = 0;
    let downNode = null;
    let pinch = null;
    svg.addEventListener('pointerdown', (e) => {
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { moved = 0; const t = e.target.closest('[data-id]'); downNode = t ? L.byId[t.getAttribute('data-id')] : null; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; downNode = null; }
    });
    svg.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        view.x += dx;
        view.y += dy;
        apply();
      } else if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const z = size();
        view.x += mx - pinch.mx;
        view.y += my - pinch.my;
        zoomAt(d / pinch.d, mx - z.left, my - z.top);
        pinch = { d, mx, my };
      }
    });
    svg.addEventListener('pointerup', (e) => {
      if (pts.size === 1 && moved < 8 && downNode) select(downNode);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    });
    svg.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null; });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const z = size();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - z.left, e.clientY - z.top);
    }, { passive: false });

    redraw();
    center();
  }

  function defs() {
    return s('defs', null,
      s('radialGradient', { id: 'hubFill' },
        s('stop', { offset: '0%', 'stop-color': '#ffffff' }),
        s('stop', { offset: '55%', 'stop-color': '#ffe8a3' }),
        s('stop', { offset: '100%', 'stop-color': '#d9a400' })),
      s('radialGradient', { id: 'hubHalo' },
        s('stop', { offset: '40%', 'stop-color': '#ffe066', 'stop-opacity': '.45' }),
        s('stop', { offset: '100%', 'stop-color': '#ffe066', 'stop-opacity': '0' })));
  }

  // 背景の星。毎回同じ配置になるよう簡易な疑似乱数を使う
  function stars() {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const g = s('g', { class: 'stars' });
    for (let i = 0; i < 420; i++) {
      g.append(s('circle', { cx: (rnd() - 0.5) * 3800, cy: (rnd() - 0.5) * 3800, r: rnd() * 1.6 + 0.3, opacity: (rnd() * 0.6 + 0.2).toFixed(2) }));
    }
    return g;
  }

  S.sphere = { open, jobList, resetJob, TYPES, PROFICIENCY };
})();
