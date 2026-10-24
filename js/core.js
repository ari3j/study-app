// プラグイン登録・学習記録の保存・間隔反復（SRS）・出題選定・レベル判定を担うコア。UI は持たない。
(function () {
  'use strict';

  const DAY = 86400000;
  // Leitner 方式: box ごとの次回復習までの日数。正解（確信あり）で box が1つ上がる。
  const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
  const MASTERED_BOX = 4;
  const STORAGE_KEY = 'studyapp:v1';
  const SESSION_SIZE = 10;
  // レベル n の達成条件: level=n の学習方法で MASTERY_RATIO 以上を習得し、level=n の実践課題をすべて完了
  const LEVEL_NAMES = ['知っている', '説明できる', '使える', '判断できる', '設計・改善できる'];
  const MASTERY_RATIO = 0.8;

  const themes = new Map();
  const modes = new Map();

  function registerTheme(theme) {
    if (!theme || !theme.id || !theme.title || !Array.isArray(theme.questions)) {
      console.error('registerTheme: id, title, questions は必須です', theme);
      return;
    }
    themes.set(theme.id, theme);
  }

  function registerMode(mode) {
    if (!mode || !mode.id || typeof mode.supports !== 'function' || typeof mode.render !== 'function') {
      console.error('registerMode: id, supports, render は必須です', mode);
      return;
    }
    modes.set(mode.id, mode);
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { console.error('プラグインの読み込みに失敗: ' + src); resolve(); };
      document.head.appendChild(s);
    });
  }

  async function boot(config) {
    for (const src of [...(config.modes || []), ...(config.themes || [])]) await loadScript(src);
    StudyApp.start();
  }

  // ---- 永続化 ----
  function emptyData() { return { version: 2, cards: {}, practice: {}, activity: {}, prefs: {} }; }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === 2) return Object.assign(emptyData(), parsed);
      }
    } catch (e) { console.error(e); }
    return emptyData();
  }

  let data = load();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error(e); }
  }

  function exportData() { return JSON.stringify(data, null, 2); }

  function importData(text) {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.version !== 2 || typeof parsed.cards !== 'object') throw new Error('対応していないバックアップ形式です');
    data = Object.assign(emptyData(), parsed);
    save();
  }

  function resetTheme(themeId) {
    for (const key of Object.keys(data.cards)) if (key.startsWith(themeId + '/')) delete data.cards[key];
    delete data.practice[themeId];
    save();
  }

  // 拡張機能（game.js など）用の保存領域
  function state(key) { return data[key] || (data[key] = {}); }

  function getPref(key) { return data.prefs[key]; }
  function setPref(key, value) { data.prefs[key] = value; save(); }

  // ---- 日付 ----
  function startOfDay(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dayKey(t) {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---- 学習記録と SRS（学習方法ごとに別々に記録する） ----
  function deck(themeId, modeId) { return themeId + '/' + modeId; }
  function getCard(themeId, modeId, qid) { return (data.cards[deck(themeId, modeId)] || {})[qid] || null; }

  // grade: 'confident'（確信して正解）| 'unsure'（迷って正解）| 'wrong'（不正解）
  function record(themeId, modeId, qid, grade) {
    const now = Date.now();
    const key = deck(themeId, modeId);
    const cards = data.cards[key] || (data.cards[key] = {});
    const c = cards[qid] || { box: 0, due: 0, correct: 0, wrong: 0 };
    if (grade === 'wrong') {
      c.box = 0;
      c.wrong++;
    } else {
      c.correct++;
      // 迷って正解は定着していないとみなし、box を上げない
      c.box = grade === 'confident' ? Math.min(c.box + 1, INTERVALS.length - 1) : Math.max(c.box, 1);
    }
    c.due = startOfDay(now) + INTERVALS[c.box] * DAY;
    c.last = now;
    c.lastGrade = grade;
    cards[qid] = c;
    const k = dayKey(now);
    data.activity[k] = (data.activity[k] || 0) + 1;
    save();
  }

  function isDue(c, now) { return c && c.due <= now; }
  function isWeak(c) { return c && (c.box <= 1 || c.lastGrade !== 'confident'); }

  function questionsFor(theme, mode, category) {
    return theme.questions.filter((q) => mode.supports(q) && (!category || q.category === category));
  }

  function themeStats(theme, mode) {
    const now = Date.now();
    const stats = { total: 0, fresh: 0, learning: 0, mastered: 0, due: 0, weak: 0, byCategory: {} };
    for (const q of questionsFor(theme, mode)) {
      const c = getCard(theme.id, mode.id, q.id);
      const cat = stats.byCategory[q.category] || (stats.byCategory[q.category] = { total: 0, mastered: 0, seen: 0 });
      stats.total++;
      cat.total++;
      if (!c) { stats.fresh++; continue; }
      cat.seen++;
      if (c.box >= MASTERED_BOX) { stats.mastered++; cat.mastered++; } else stats.learning++;
      if (isDue(c, now)) stats.due++;
      if (isWeak(c)) stats.weak++;
    }
    return stats;
  }

  // kind: 'recommended' | 'weak' | 'category' | 'ahead'（復習期限前の先取り）
  function buildSession(theme, mode, kind, category) {
    const now = Date.now();
    const pool = questionsFor(theme, mode, category).map((q) => ({ q, c: getCard(theme.id, mode.id, q.id) }));
    const byDue = (a, b) => a.c.due - b.c.due;
    const due = pool.filter((x) => isDue(x.c, now)).sort(byDue);
    // 新規は定義順（テーマ作者が基礎→応用の順に並べる前提）
    const fresh = pool.filter((x) => !x.c);
    let picked;
    if (kind === 'weak') {
      picked = pool.filter((x) => isWeak(x.c)).sort((a, b) => a.c.box - b.c.box || b.c.wrong - a.c.wrong);
    } else if (kind === 'ahead') {
      picked = pool.filter((x) => x.c && !isDue(x.c, now)).sort(byDue);
    } else if (kind === 'category') {
      const rest = pool.filter((x) => x.c && !isDue(x.c, now)).sort((a, b) => a.c.box - b.c.box);
      picked = [...due, ...fresh, ...rest];
    } else {
      picked = [...due, ...fresh];
    }
    // 交互練習（interleaving）: 選んだ問題の順番は混ぜる
    return shuffle(picked.slice(0, SESSION_SIZE).map((x) => x.q));
  }

  // ---- 実践課題 ----
  function isPracticeDone(themeId, id) { return !!(data.practice[themeId] || {})[id]; }

  function togglePractice(themeId, id) {
    const p = data.practice[themeId] || (data.practice[themeId] = {});
    if (p[id]) delete p[id]; else p[id] = Date.now();
    save();
  }

  // ---- レベル ----
  function levelRequirements(theme, level) {
    const reqs = [];
    for (const m of modes.values()) {
      if (m.level !== level) continue;
      const st = themeStats(theme, m);
      if (st.total) reqs.push({ label: m.title + 'で習得', done: st.mastered, target: Math.ceil(st.total * MASTERY_RATIO) });
    }
    const items = (theme.practices || []).filter((p) => p.level === level);
    if (items.length) reqs.push({ label: '実践課題', done: items.filter((p) => isPracticeDone(theme.id, p.id)).length, target: items.length });
    return reqs;
  }

  // 下のレベルから順に条件を満たした所までを現在のレベルとする
  function themeLevel(theme) {
    let level = 0;
    for (let n = 1; n <= LEVEL_NAMES.length; n++) {
      const reqs = levelRequirements(theme, n);
      if (!reqs.length || reqs.some((r) => r.done < r.target)) return { level, next: { level: n, reqs } };
      level = n;
    }
    return { level, next: null };
  }

  function streak() {
    let t = Date.now();
    if (!data.activity[dayKey(t)]) t -= DAY;
    let n = 0;
    while (data.activity[dayKey(t)]) { n++; t -= DAY; }
    return n;
  }

  function todayCount() { return data.activity[dayKey(Date.now())] || 0; }

  // ---- ユーティリティ ----
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // 問題文用の簡易書式: `code` と **強調** のみ
  function format(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  window.StudyApp = {
    registerTheme, registerMode, boot, themes, modes,
    record, getCard, themeStats, buildSession, streak, todayCount,
    isPracticeDone, togglePractice, themeLevel,
    exportData, importData, resetTheme, getPref, setPref, state, save,
    util: { shuffle, escapeHtml, format, dayKey },
    MASTERED_BOX, SESSION_SIZE, LEVEL_NAMES,
  };
})();
