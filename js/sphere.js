// スフィア盤: カリキュラムを FF10 風の成長マップとして描く（試作: マスのクリアはデモ操作のみ）
(function () {
  'use strict';

  const S = window.StudyApp;
  const NS = 'http://www.w3.org/2000/svg';
  const RAD = Math.PI / 180;

  function s(tag, attrs, ...children) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    for (const c of children.flat()) if (c != null) el.append(c);
    return el;
  }

  // ---- 配置 ----
  // 中央に「生成AI」、上下左右に上位テーマ（ジョブ）の起点、そこから中位テーマごとに放射状の道を伸ばす。
  // 道の上に下位テーマ（アビリティ）の大きいマスを並べ、その手前にマスを並べる。
  function layout(cur) {
    const nodes = [];
    const edges = [];
    const byId = {};
    const units = {};
    const add = (n) => { nodes.push(n); byId[n.id] = n; return n; };
    const link = (a, b, kind) => edges.push({ a, b, kind: kind || 'path' });
    const labels = [];

    const hub = add({ id: 'hub', kind: 'hub', x: 0, y: 0, r: 34 });
    cur.domains.forEach((d, di) => {
      const phi = (-90 + 90 * di) * RAD;
      const gate = add({ id: 'gate-' + d.id, kind: 'gate', domain: d, x: 140 * Math.cos(phi), y: 140 * Math.sin(phi), r: 24 });
      link(hub, gate);
      labels.push({ x: 76 * Math.cos(phi), y: 76 * Math.sin(phi) + 4, text: d.title, cls: 'lbl-domain', color: d.color });
      const spread = d.areas.length > 3 ? 24 : 29;
      d.areas.forEach((a, ai) => {
        const ang = phi + (ai - (d.areas.length - 1) / 2) * spread * RAD;
        // 中位テーマの分岐点。ここから下位テーマの道が伸びる
        const areaNode = add({ id: 'area-' + a.id, kind: 'area', area: a, domain: d, x: 225 * Math.cos(ang), y: 225 * Math.sin(ang), r: 14 });
        link(gate, areaNode);
        let prev = areaNode;
        a.units.forEach((u, ui) => {
          const R = 400 + ui * 230;
          const ux = R * Math.cos(ang);
          const uy = R * Math.sin(ang);
          const dx = ux - prev.x;
          const dy = uy - prev.y;
          const len = Math.hypot(dx, dy);
          const cells = u.cells.map((title, ci) => {
            const t = (ci + 1) / (u.cells.length + 1);
            const off = (ci % 2 ? 1 : -1) * 17;
            return add({
              id: u.id + '-' + ci, kind: 'cell', title, index: ci, unit: u, area: a, domain: d,
              x: prev.x + dx * t - (dy / len) * off, y: prev.y + dy * t + (dx / len) * off, r: 11,
            });
          });
          const un = add({ id: 'unit-' + u.id, kind: 'unit', unit: u, area: a, domain: d, x: ux, y: uy, r: 22, cells, prevUnit: ui ? a.units[ui - 1] : null });
          units[u.id] = un;
          [prev, ...cells, un].reduce((p, c) => { link(p, c); return c; });
          prev = un;
        });
        const R = 400 + (a.units.length - 1) * 230 + 78;
        labels.push({ x: R * Math.cos(ang), y: R * Math.sin(ang), text: a.title, cls: 'lbl-area', color: d.color });
      });
    });
    // 他エリアの前提（requires）は点線で結ぶ
    for (const un of Object.values(units)) {
      for (const req of un.unit.requires || []) if (units[req]) link(units[req], un.cells[0], 'requires');
    }
    return { nodes, edges, byId, units, labels };
  }

  // ---- 進行状況 ----
  function progress() {
    const st = S.state('sphere');
    if (!st.cleared) st.cleared = {};
    return st;
  }

  // layout は各 unit のマスを unit より先に追加しているので、この順で評価すれば unit の判定時にはマスの状態が決まっている
  function evaluate(L) {
    const cleared = progress().cleared;
    const learned = (unitId) => L.units[unitId].cells.every((c) => cleared[c.id]);
    for (const n of L.nodes) {
      if (n.kind === 'hub' || n.kind === 'gate' || n.kind === 'area') { n.state = 'lit'; continue; }
      if (n.kind === 'unit') {
        n.state = learned(n.unit.id) ? 'learned' : n.cells.some((c) => c.state !== 'locked') ? 'open' : 'locked';
        continue;
      }
      const un = L.units[n.unit.id];
      const missing = [];
      if (un.prevUnit && !learned(un.prevUnit.id)) missing.push(un.prevUnit.title);
      for (const req of n.unit.requires || []) if (!learned(req)) missing.push(L.units[req].unit.title);
      n.missingUnits = missing;
      const prevCell = n.index ? un.cells[n.index - 1] : null;
      n.state = cleared[n.id] ? 'cleared' : !missing.length && (!prevCell || cleared[prevCell.id]) ? 'available' : 'locked';
    }
  }

  function domainProgress(L, d) {
    const us = Object.values(L.units).filter((u) => u.domain === d);
    return { done: us.filter((u) => u.state === 'learned').length, total: us.length };
  }

  // ---- 画面 ----
  function open(curId) {
    const cur = S.curricula.get(curId || 'genai');
    const { h, show, header, renderHome } = S.ui;
    const L = layout(cur);
    evaluate(L);

    const svg = s('svg', { class: 'sphere-svg' });
    const world = s('g');
    const gEdges = s('g');
    const gNodes = s('g');
    const gLabels = s('g');
    world.append(stars(), gEdges, gNodes, gLabels);
    svg.append(defs(cur), world);

    const sheet = h('div', { class: 'sphere-sheet hidden' });
    const wrap = h('div', { class: 'sphere-wrap' }, svg,
      h('div', { class: 'sphere-controls' },
        h('button', { onclick: () => zoomAt(1.3), 'aria-label': '拡大' }, '+'),
        h('button', { onclick: () => zoomAt(1 / 1.3), 'aria-label': '縮小' }, '−'),
        h('button', { onclick: center, 'aria-label': '中央へ' }, '◎')),
      sheet);
    const resetBtn = h('button', { class: 'icon-btn', 'aria-label': '試作の進行をリセット', onclick: () => {
      if (confirm('スフィア盤の進行（試作）をリセットしますか？')) { progress().cleared = {}; S.save(); redraw(); closeSheet(); }
    } }, '↺');
    const top = header(cur.title + ' スフィア盤', renderHome, resetBtn);
    show(top, wrap);
    wrap.style.top = top.offsetHeight + 'px';

    let selected = null;

    function redraw() {
      evaluate(L);
      gEdges.replaceChildren(...L.edges.map((e) => {
        const lit = isLit(e.a) && isLit(e.b);
        const color = (e.b.domain || e.a.domain || {}).color;
        return s('line', {
          x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y,
          class: 'sg-edge ' + e.kind + (lit && e.kind === 'path' ? ' lit' : ''),
          style: lit ? 'stroke:' + color + ';color:' + color : null,
        });
      }));
      gNodes.replaceChildren(...L.nodes.map(drawNode));
      gLabels.replaceChildren(...L.labels.map((l) => s('text', { x: l.x, y: l.y, class: l.cls, fill: l.color }, l.text)));
    }

    function isLit(n) { return ['lit', 'cleared', 'learned'].includes(n.state); }

    function drawNode(n) {
      const color = n.domain ? n.domain.color : '#ffffff';
      const g = s('g', { class: 'sg-node ' + n.kind + ' ' + n.state + (selected === n ? ' selected' : ''), 'data-id': n.id, transform: 'translate(' + n.x + ' ' + n.y + ')', style: '--c:' + color });
      if (n.kind === 'hub') {
        g.append(
          s('circle', { r: n.r + 22, class: 'halo', fill: 'url(#hubHalo)' }),
          s('circle', { r: n.r, fill: 'url(#hubFill)', class: 'core' }),
          s('path', { d: 'M0 -18 L12 0 L0 18 L-12 0 Z', class: 'crystal' }),
          s('text', { y: n.r + 20, class: 'lbl-hub' }, cur.title));
      } else if (n.kind === 'gate') {
        g.append(
          s('circle', { r: n.r + 14, class: 'halo' }),
          s('circle', { r: n.r, class: 'core' }),
          s('text', { y: 5, class: 'lbl-job' }, n.domain.job));
      } else if (n.kind === 'area') {
        g.append(
          s('circle', { r: n.r + 10, class: 'halo' }),
          s('circle', { r: n.r, class: 'core' }),
          s('circle', { r: 5, class: 'dot' }));
      } else if (n.kind === 'unit') {
        g.append(
          s('circle', { r: n.r + 14, class: 'halo' }),
          s('circle', { r: n.r, class: 'core' }),
          s('path', { d: 'M0 -11 L9.5 0 L0 11 L-9.5 0 Z', class: 'gem' }),
          s('text', { y: n.r + 18, class: 'lbl-unit' }, n.unit.title));
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

    function crumbs(n) {
      return h('div', { class: 'sheet-crumbs' },
        h('span', { style: 'color:' + n.domain.color }, '上位 ' + n.domain.title), ' › ',
        '中位 ' + n.area.title, n.kind === 'cell' ? [' › ', '下位 ' + n.unit.title] : null);
    }

    function sheetContent(n) {
      const close = h('button', { class: 'icon-btn sheet-close', onclick: closeSheet, 'aria-label': '閉じる' }, '×');
      const cleared = progress().cleared;
      if (n.kind === 'hub') {
        return [close, h('div', { class: 'sheet-kind' }, 'カリキュラム'), h('h3', null, cur.title),
          h('div', { class: 'sheet-section' }, '基本職'),
          cur.domains.map((d) => { const p = domainProgress(L, d); return jobRow(d.job + '・' + d.title, d.subtitle + ': ' + d.description, p.done, p.total, d.color); }),
          h('div', { class: 'sheet-section' }, '上位職'),
          (cur.jobs || []).map((j) => {
            const ok = j.requires.every((id) => { const d = cur.domains.find((x) => x.id === id); const p = domainProgress(L, d); return p.done === p.total; });
            const need = j.requires.map((id) => cur.domains.find((x) => x.id === id).job).join(' + ');
            return h('div', { class: 'job-row' + (ok ? ' ok' : '') }, h('strong', null, j.title), h('div', { class: 'small' }, j.description), h('div', { class: 'small muted' }, '転職条件: ' + need + ' をマスター'));
          })];
      }
      if (n.kind === 'gate') {
        const p = domainProgress(L, n.domain);
        return [close, h('div', { class: 'sheet-kind' }, '上位テーマ / ジョブ'),
          h('h3', null, n.domain.title, h('span', { class: 'sheet-job', style: 'background:' + n.domain.color }, n.domain.job)),
          h('p', { class: 'small muted' }, n.domain.subtitle + ': ' + n.domain.description),
          jobRow('アビリティ習得', '', p.done, p.total, n.domain.color),
          h('div', { class: 'sheet-section' }, '中位テーマ'),
          n.domain.areas.map((a) => h('div', { class: 'sheet-line' }, a.title, h('span', { class: 'small muted' }, a.units.map((u) => u.title).join(' / '))))];
      }
      if (n.kind === 'area') {
        const us = n.area.units.map((u) => L.units[u.id]);
        return [close, h('div', { class: 'sheet-kind' }, '中位テーマ'),
          h('div', { class: 'sheet-crumbs' }, h('span', { style: 'color:' + n.domain.color }, '上位 ' + n.domain.title)),
          h('h3', null, n.area.title),
          jobRow('下位テーマ', '', us.filter((u) => u.state === 'learned').length, us.length, n.domain.color),
          us.map((u) => h('div', { class: 'sheet-line' + (u.state === 'learned' ? ' ok' : '') }, (u.state === 'learned' ? '✓ ' : '・') + u.unit.title,
            h('span', { class: 'small muted' }, u.unit.cells.length + 'マス' + ((u.unit.requires || []).length ? '・前提: ' + u.unit.requires.map((r) => L.units[r].unit.title).join('、') : ''))))];
      }
      if (n.kind === 'unit') {
        const done = n.cells.filter((c) => cleared[c.id]).length;
        return [close, h('div', { class: 'sheet-kind' }, '下位テーマ / アビリティ'), crumbs(n),
          h('h3', null, n.unit.title),
          h('p', { class: 'small' }, n.state === 'learned' ? 'アビリティ「' + n.unit.title + 'の心得」を習得済み' : 'すべてのマスをクリアすると、アビリティ「' + n.unit.title + 'の心得」を習得'),
          jobRow('マス', '', done, n.cells.length, n.domain.color),
          n.cells.map((c) => h('div', { class: 'sheet-line' + (cleared[c.id] ? ' ok' : '') }, (cleared[c.id] ? '✓ ' : '・') + c.title))];
      }
      const stateText = { cleared: 'クリア済み', available: '挑戦できる', locked: 'まだ開いていない' }[n.state];
      const prevCell = n.index ? L.units[n.unit.id].cells[n.index - 1] : null;
      return [close, h('div', { class: 'sheet-kind' }, 'マス'), crumbs(n),
        h('h3', null, n.title), h('span', { class: 'pill sheet-state ' + n.state }, stateText),
        n.state === 'locked' ? h('p', { class: 'small muted' },
          n.missingUnits.length ? '下位テーマ「' + n.missingUnits.join('」「') + '」のアビリティ習得が必要です。' : '直前のマス「' + prevCell.title + '」をクリアすると開きます。') : null,
        n.state === 'available' ? [
          h('button', { class: 'btn primary block', disabled: true }, '挑戦する（10問）'),
          h('p', { class: 'small muted' }, '試作のため、問題はまだありません。初動・中盤・終盤の10問バトルで7問以上正解するとクリアになる予定です。')] : null,
        n.state !== 'locked' ? h('button', { class: 'btn block demo-btn', onclick: () => {
          if (cleared[n.id]) delete cleared[n.id]; else cleared[n.id] = Date.now();
          S.save();
          const learnedBefore = L.units[n.unit.id].state === 'learned';
          select(n);
          if (!learnedBefore && L.units[n.unit.id].state === 'learned') S.ui.toast('アビリティ「' + n.unit.title + 'の心得」を おぼえた！');
        } }, n.state === 'cleared' ? '【試作】未クリアに戻す' : '【試作】クリアしたことにする') : null];
    }

    function jobRow(title, desc, done, total, color) {
      const pct = total ? Math.round((done / total) * 100) : 0;
      return h('div', { class: 'job-row' + (done === total && total ? ' ok' : '') },
        h('div', { class: 'job-head' }, h('strong', null, title), h('span', { class: 'small muted' }, done + '/' + total)),
        desc ? h('div', { class: 'small muted' }, desc) : null,
        h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: 'width:' + pct + '%;background:' + color })));
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
    const up = (e) => {
      if (pts.size === 1 && moved < 8 && downNode) select(downNode);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch = null; });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const z = size();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - z.left, e.clientY - z.top);
    }, { passive: false });

    redraw();
    center();
  }

  function defs(cur) {
    return s('defs', null,
      s('radialGradient', { id: 'hubFill' },
        s('stop', { offset: '0%', 'stop-color': '#ffffff' }),
        s('stop', { offset: '55%', 'stop-color': '#a5d8ff' }),
        s('stop', { offset: '100%', 'stop-color': '#4c6ef5' })),
      s('radialGradient', { id: 'hubHalo' },
        s('stop', { offset: '40%', 'stop-color': '#a5d8ff', 'stop-opacity': '.5' }),
        s('stop', { offset: '100%', 'stop-color': '#a5d8ff', 'stop-opacity': '0' })));
  }

  // 背景の星。毎回同じ配置になるよう簡易な疑似乱数を使う
  function stars() {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const g = s('g', { class: 'stars' });
    for (let i = 0; i < 260; i++) {
      g.append(s('circle', { cx: (rnd() - 0.5) * 2600, cy: (rnd() - 0.5) * 2600, r: rnd() * 1.6 + 0.3, opacity: (rnd() * 0.6 + 0.2).toFixed(2) }));
    }
    return g;
  }

  S.sphere = { open };
})();
