// プラグイン登録・学習記録の保存を担うコア。UI は持たない。
(function () {
  'use strict';

  const DAY = 86400000;
  const STORAGE_KEY = 'studyapp:v1';

  const modes = new Map();
  const jobs = new Map();

  function registerJob(job) {
    if (!job || !job.id || !job.title || !Array.isArray(job.abilities)) {
      console.error('registerJob: id, title, abilities は必須です', job);
      return;
    }
    jobs.set(job.id, job);
  }

  // スフィア盤のマスの問題。cell はアビリティ内のマスの番号（0 始まり）、level は熟練度レベル（省略時は共通の問題）
  const cellQuestions = new Map();
  function registerQuestions(def) {
    if (!def || !def.job || !def.ability || def.cell == null || !Array.isArray(def.questions)) {
      console.error('registerQuestions: job, ability, cell, questions は必須です', def);
      return;
    }
    const key = def.job + '/' + def.ability + '/' + def.cell + '/' + (def.level || 0);
    cellQuestions.set(key, [...(cellQuestions.get(key) || []), ...def.questions]);
  }
  function questionsForCell(jobId, abilityId, cell, level) { return cellQuestions.get(jobId + '/' + abilityId + '/' + cell + '/' + (level || 0)) || []; }

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
    for (const src of [...(config.modes || []), ...(config.jobs || []), ...(config.questions || [])]) await loadScript(src);
    StudyApp.start();
  }

  // ---- 永続化 ----
  function emptyData() { return { version: 2, cards: {}, activity: {}, sphere: {} }; }

  // ---- 保存データの検証 ----
  // 保存データとバックアップは外部から書き換えられうる（同じ origin の別ページ、手で作られたファイルなど）。
  // そのまま使わず、既知の形だけを読み取って作り直し、想定外のキー・型・値は捨てる。
  // 保存領域（state）を増やすときは、ここにも検証を追加すること
  const KEY_RE = /^[A-Za-z0-9_:./-]{1,100}$/;
  const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const GRADES = new Set(['confident', 'unsure', 'wrong']);
  const MAX_PROFICIENCY = 5;
  const MAX_ENTRIES = 20000;
  const MAX_IMPORT_CHARS = 5000000;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isCount = (v) => Number.isSafeInteger(v) && v >= 0;
  const safeEntries = (obj) => (isObj(obj) ? Object.keys(obj).filter((k) => KEY_RE.test(k) && !FORBIDDEN_KEYS.has(k)).slice(0, MAX_ENTRIES).map((k) => [k, obj[k]]) : []);

  function sanitize(raw) {
    const out = emptyData();
    if (!isObj(raw) || raw.version !== 2) return out;
    for (const [deck, cards] of safeEntries(raw.cards)) {
      const clean = {};
      for (const [qid, c] of safeEntries(cards)) {
        if (!isObj(c) || !isCount(c.correct) || !isCount(c.wrong)) continue;
        clean[qid] = { correct: c.correct, wrong: c.wrong };
        if (isCount(c.last)) clean[qid].last = c.last;
        if (GRADES.has(c.lastGrade)) clean[qid].lastGrade = c.lastGrade;
      }
      out.cards[deck] = clean;
    }
    for (const [day, n] of safeEntries(raw.activity)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && isCount(n)) out.activity[day] = n;
    }
    for (const [jobId, st] of safeEntries(raw.sphere)) {
      if (!isObj(st) || !isCount(st.proficiency) || st.proficiency > MAX_PROFICIENCY) continue;
      const cleared = {};
      for (const [k, t] of safeEntries(st.cleared)) if (isCount(t)) cleared[k] = t;
      out.sphere[jobId] = { proficiency: st.proficiency, cleared };
    }
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitize(JSON.parse(raw));
    } catch (e) { console.error(e); }
    return emptyData();
  }

  let data = load();

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { console.error(e); }
  }

  function exportData() { return JSON.stringify(data, null, 2); }

  // バックアップは JSON としてだけ読み、検証したデータだけを取り込む（コードとして実行することはない）
  function importData(text) {
    if (text.length > MAX_IMPORT_CHARS) throw new Error('ファイルが大きすぎます');
    const parsed = JSON.parse(text);
    if (!isObj(parsed) || parsed.version !== 2 || !isObj(parsed.cards)) throw new Error('対応していないバックアップ形式です');
    data = sanitize(parsed);
    save();
  }

  // 拡張機能（sphere.js など）用の保存領域。読み込み時に検証される既知のキー（sanitize 参照）だけを使う
  function state(key) { return data[key] || (data[key] = {}); }

  // ---- 日付 ----
  function dayKey(t) {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---- 回答の記録（deck ごと。スフィア盤ではジョブと熟練度レベルの組） ----
  function getCard(deck, qid) { return (data.cards[deck] || {})[qid] || null; }

  // grade: 'confident'（確信して正解）| 'unsure'（迷って正解）| 'wrong'（不正解）
  function record(deck, qid, grade) {
    const now = Date.now();
    const cards = data.cards[deck] || (data.cards[deck] = {});
    const c = cards[qid] || { correct: 0, wrong: 0 };
    if (grade === 'wrong') c.wrong++; else c.correct++;
    c.last = now;
    c.lastGrade = grade;
    cards[qid] = c;
    const k = dayKey(now);
    data.activity[k] = (data.activity[k] || 0) + 1;
    save();
  }

  function resetRecords(prefix) {
    for (const key of Object.keys(data.cards)) if (key.startsWith(prefix + '/')) delete data.cards[key];
    save();
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
    registerMode, registerJob, registerQuestions, questionsForCell, boot, modes, jobs,
    record, getCard, resetRecords, streak, todayCount,
    exportData, importData, state, save,
    util: { shuffle, escapeHtml, format, dayKey },
  };
})();
