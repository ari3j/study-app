// ゲーム要素: 冒険の難易度・小さなメダル・景品交換
(function () {
  'use strict';

  const S = window.StudyApp;

  const DIFFICULTIES = [
    { id: 'easy', title: '楽ちんプレイ', description: '毎回ヒントが表示される。メダルは出にくい', medalRate: 0.5 },
    { id: 'normal', title: 'バッチリ冒険', description: 'バランスのよい通常の冒険', medalRate: 1 },
    { id: 'hard', title: 'いばらの道', description: '長い文章の「すべて選べ」問題。メダルも出にくい', medalRate: 0.7 },
  ];

  // 問題の難易度（★1〜3）ごとの基本ドロップ率。一度正解した問題は REPEAT_RATE 倍になる
  const BASE_RATE = { 1: 0.12, 2: 0.2, 3: 0.32 };
  const REPEAT_RATE = 0.3;

  const TITLES = [
    { id: 'novice', name: '見習い冒険者', cost: 0 },
    { id: 'collector', name: 'メダル集め', cost: 3 },
    { id: 'traveler', name: '物知りの旅人', cost: 8 },
    { id: 'sage', name: '賢者のたまご', cost: 15 },
    { id: 'hero', name: '伝説の勇者', cost: 30 },
    { id: 'king', name: 'メダル王の友', cost: 50 },
  ];

  const SKINS = [
    { id: 'default', name: 'いつもの画面', cost: 0 },
    { id: 'forest', name: '森の村', cost: 8 },
    { id: 'night', name: '夜の城', cost: 8 },
    { id: 'sky', name: '天空の城', cost: 12 },
    { id: 'volcano', name: '炎の洞窟', cost: 12 },
    { id: 'gold', name: 'メダル王の黄金', cost: 25 },
  ];

  const DEFAULT_REWARDS = [
    { name: '好きな飲み物を買う', cost: 3 },
    { name: 'デザートを食べる', cost: 5 },
    { name: 'ゲームを30分遊ぶ', cost: 8 },
    { name: '欲しかった本を1冊買う', cost: 30 },
  ];

  function g() {
    const st = S.state('game');
    if (st.medals == null) {
      Object.assign(st, {
        medals: 0, earned: 0, title: 'novice', skin: 'default', owned: ['title:novice', 'skin:default'],
        rewards: DEFAULT_REWARDS.map((r, i) => ({ id: 'r' + i, ...r })), history: [],
      });
    }
    return st;
  }

  function difficulty() {
    const id = S.getPref('difficulty');
    return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
  }

  function setDifficulty(id) { S.setPref('difficulty', id); }

  function medalChance(q, cardBefore) {
    const base = BASE_RATE[q.difficulty] || BASE_RATE[2];
    const repeat = cardBefore && cardBefore.correct > 0 ? REPEAT_RATE : 1;
    return base * repeat * difficulty().medalRate;
  }

  // 正解時に呼ぶ。メダルを手に入れたら true
  function rollMedal(q, cardBefore) {
    if (Math.random() >= medalChance(q, cardBefore)) return false;
    const st = g();
    st.medals++;
    st.earned++;
    S.save();
    return true;
  }

  function owns(kind, id) { return g().owned.includes(kind + ':' + id); }

  // 称号・画面カラー: 未所持なら購入して装備、所持済みなら装備だけ
  function equip(kind, item) {
    const st = g();
    if (!owns(kind, item.id)) {
      if (st.medals < item.cost) return false;
      st.medals -= item.cost;
      st.owned.push(kind + ':' + item.id);
      st.history.unshift({ name: item.name, cost: item.cost, at: Date.now() });
    }
    st[kind] = item.id;
    S.save();
    applySkin();
    return true;
  }

  function redeem(reward) {
    const st = g();
    if (st.medals < reward.cost) return false;
    st.medals -= reward.cost;
    st.history.unshift({ name: reward.name, cost: reward.cost, at: Date.now() });
    S.save();
    return true;
  }

  function addReward(name, cost) {
    g().rewards.push({ id: 'r' + Date.now(), name, cost });
    S.save();
  }

  function removeReward(id) {
    const st = g();
    st.rewards = st.rewards.filter((r) => r.id !== id);
    S.save();
  }

  function applySkin() {
    const skin = g().skin;
    document.body.className = document.body.className.replace(/\bskin-\S+/g, '').trim();
    if (skin !== 'default') document.body.classList.add('skin-' + skin);
  }

  function currentTitle() { return (TITLES.find((t) => t.id === g().title) || TITLES[0]).name; }

  S.game = {
    DIFFICULTIES, TITLES, SKINS,
    state: g, difficulty, setDifficulty, rollMedal, owns, equip, redeem, addReward, removeReward, applySkin, currentTitle,
  };
})();
