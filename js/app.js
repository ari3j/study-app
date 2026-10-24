// 画面描画とセッション進行。問題1問の表示と採点は各 mode プラグインに委ねる。
(function () {
  'use strict';

  const S = window.StudyApp;
  const { format } = S.util;
  const root = () => document.getElementById('app');
  let keyHandler = null;

  document.addEventListener('keydown', (e) => {
    if (keyHandler && !e.isComposing && !e.metaKey && !e.ctrlKey && !e.altKey) keyHandler(e);
  });

  // DOM 生成ヘルパー。attrs.html は信頼済み文字列（format 済み）のみ渡すこと
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v);
    }
    return append(el, ...children);
  }

  // 配列はたどり、null / false は飛ばして子要素を追加する
  function append(el, ...children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(c));
    }
    return el;
  }

  function show(...nodes) {
    keyHandler = null;
    root().replaceChildren(...nodes);
    window.scrollTo(0, 0);
  }

  function header(title, onBack, extra) {
    return h('header', { class: 'topbar' },
      onBack ? h('button', { class: 'icon-btn', onclick: onBack, 'aria-label': '戻る' }, '‹') : h('span', { class: 'icon-btn-space' }),
      h('h1', { class: 'topbar-title' }, title),
      extra || h('span', { class: 'icon-btn-space' }));
  }

  function bar(value, total, cls) {
    const pct = total ? Math.round((value / total) * 100) : 0;
    return h('div', { class: 'bar ' + (cls || '') }, h('div', { class: 'bar-fill', style: 'width:' + pct + '%' }));
  }

  function themeColor(theme) { return theme.color || 'var(--primary)'; }

  function availableModes(theme) {
    return [...S.modes.values()].filter((m) => theme.questions.some((q) => m.supports(q)));
  }

  function currentMode(theme) {
    const list = availableModes(theme);
    const saved = S.getPref('mode:' + theme.id);
    return list.find((m) => m.id === saved) || list[0] || null;
  }

  // ---- ホーム ----
  function renderHome() {
    const list = [...S.themes.values()];
    const streak = S.streak();
    const cards = list.map((theme) => {
      const mode = currentMode(theme);
      const st = mode ? S.themeStats(theme, mode) : null;
      const { level } = S.themeLevel(theme);
      return h('button', { class: 'card theme-card', onclick: () => renderTheme(theme) },
        h('div', { class: 'theme-badge', style: 'background:' + themeColor(theme) }, 'Lv' + level),
        h('div', { class: 'theme-body' },
          h('div', { class: 'theme-title' }, theme.title),
          theme.description ? h('div', { class: 'muted small' }, theme.description) : null,
          st ? h('div', { class: 'theme-progress' },
            bar(st.mastered, st.total),
            h('span', { class: 'small muted' }, mode.title + ' 習得 ' + st.mastered + '/' + st.total),
            st.due ? h('span', { class: 'pill warn' }, '復習 ' + st.due) : null,
            st.fresh === st.total ? h('span', { class: 'pill' }, '未学習') : null) : null));
    });

    const G = S.game;
    const diff = G.difficulty();
    const selectable = G.DIFFICULTIES.filter((d) => d.enabled);
    show(
      header('Study', null, h('button', { class: 'icon-btn', onclick: renderData, 'aria-label': 'データ管理' }, '⚙')),
      h('main', { class: 'container' },
        h('div', { class: 'hero-title' }, h('span', { class: 'small muted' }, '称号'), h('strong', null, G.currentTitle())),
        h('section', { class: 'stats-row three' },
          stat(streak, '連続学習日数'),
          stat(S.todayCount(), '今日の回答数'),
          h('button', { class: 'card stat medal-stat', onclick: renderMedals },
            h('div', { class: 'stat-value' }, h('span', { class: 'medal-icon' }), String(G.state().medals)),
            h('div', { class: 'small muted' }, '小さなメダル ›'))),
        selectable.length > 1 ? [
          h('h2', { class: 'section-title' }, '難易度'),
          h('div', { class: 'segmented' }, selectable.map((d) =>
            h('button', { class: d === diff ? 'active' : '', onclick: () => { G.setDifficulty(d.id); renderHome(); } }, d.title))),
          h('p', { class: 'small muted diff-desc' }, diff.description)] : null,
        h('button', { class: 'card sphere-entry', onclick: S.sphere.openJobs },
          h('div', { class: 'sphere-entry-title' }, 'ジョブとスフィア盤'),
          h('div', { class: 'small' }, '試作版: 見た目と進み方の確認用')),
        h('h2', { class: 'section-title' }, '学習テーマ'),
        cards.length ? h('div', { class: 'stack' }, cards) : h('p', { class: 'muted' }, 'テーマが登録されていません。plugins.js を確認してください。'),
        methodNote()));
  }

  function stat(value, label) {
    return h('div', { class: 'card stat' }, h('div', { class: 'stat-value' }, String(value)), h('div', { class: 'small muted' }, label));
  }

  function methodNote() {
    return h('details', { class: 'card note' },
      h('summary', null, 'このアプリに組み込んでいる学習法'),
      h('ul', null,
        h('li', null, h('strong', null, 'レベル'), ' Lv1 知っている（4択）→ Lv2 説明できる（説明）→ Lv3〜5 使える・判断できる・設計できる（実践課題）。問題の習得は80%で達成。'),
        h('li', null, h('strong', null, '想起練習'), ' 読むより「思い出す」方が記憶に残る。解説を見る前に必ず自分で答えを選ぶ。'),
        h('li', null, h('strong', null, '間隔反復'), ' 正解した問題は 1→3→7→14→30→60日と間隔を空けて再出題。間違えた問題は翌日以降すぐ戻ってくる。'),
        h('li', null, h('strong', null, '確信度の自己評価'), ' 正解でも「迷った」なら定着扱いにしない。まぐれ当たりを放置しない。'),
        h('li', null, h('strong', null, 'セッション内の再出題'), ' 間違えた問題は数問後にもう一度出る。その場で正しく想起し直すことで修正が定着する。'),
        h('li', null, h('strong', null, '交互練習'), ' カテゴリを混ぜて出題し、問題ごとに「どの知識を使うか」を判断させる。'),
        h('li', null, h('strong', null, '精緻化フィードバック'), ' 正解の理由だけでなく、各誤答がなぜ誤りかも示す。'),
        h('li', null, h('strong', null, '短いセッション'), ' 1回 ' + S.SESSION_SIZE + '問。毎日少しずつが最も効率がよい。')));
  }

  // ---- テーマ画面 ----
  function renderTheme(theme) {
    const modes = availableModes(theme);
    const mode = currentMode(theme);
    if (!mode) {
      show(header(theme.title, renderHome), h('main', { class: 'container' }, h('p', null, 'このテーマに対応する学習方法がありません。')));
      return;
    }
    const st = S.themeStats(theme, mode);
    const rec = S.buildSession(theme, mode, 'recommended');
    const recDue = Math.min(st.due, rec.length);
    const start = (kind, category) => {
      const qs = S.buildSession(theme, mode, kind, category);
      if (qs.length) startSession(theme, mode, qs, kind, category);
    };

    const actions = [];
    if (rec.length) {
      actions.push(h('button', { class: 'btn primary block', onclick: () => start('recommended') },
        h('span', null, 'おすすめ学習'),
        h('span', { class: 'btn-sub' }, '復習 ' + recDue + ' / 新規 ' + (rec.length - recDue))));
    } else {
      actions.push(h('div', { class: 'card done-note' },
        h('strong', null, '今日の分は完了しています'),
        h('div', { class: 'small muted' }, '次の復習日まで間隔を空けるほうが長期記憶に残ります。')));
      if (st.learning + st.mastered > 0) {
        actions.push(h('button', { class: 'btn block', onclick: () => start('ahead') }, '先取りで復習する'));
      }
    }
    if (st.weak) actions.push(h('button', { class: 'btn block', onclick: () => start('weak') }, h('span', null, '苦手克服'), h('span', { class: 'btn-sub' }, st.weak + '問')));

    const cats = (theme.categories || []).map((cat) => {
      const c = st.byCategory[cat.id] || { total: 0, mastered: 0, seen: 0 };
      if (!c.total) return null;
      return h('button', { class: 'row', onclick: () => start('category', cat.id) },
        h('div', { class: 'row-main' },
          h('div', null, cat.title),
          h('div', { class: 'row-meta' }, bar(c.mastered, c.total), h('span', { class: 'small muted' }, c.mastered + '/' + c.total))),
        h('span', { class: 'chev' }, '›'));
    });

    const practiceGroups = S.LEVEL_NAMES.map((name, i) => {
      const items = (theme.practices || []).filter((p) => p.level === i + 1);
      if (!items.length) return null;
      return [
        h('div', { class: 'practice-level' }, 'Lv' + (i + 1) + ' ' + name),
        items.map((p) => {
          const done = S.isPracticeDone(theme.id, p.id);
          return h('button', { class: 'row practice' + (done ? ' done' : ''), 'aria-pressed': String(done), onclick: () => {
            const y = window.scrollY;
            S.togglePractice(theme.id, p.id);
            renderTheme(theme);
            window.scrollTo(0, y);
          } },
            h('span', { class: 'check' }, done ? '✓' : ''),
            h('div', { class: 'row-main' }, h('div', null, p.title), p.detail ? h('div', { class: 'small muted' }, p.detail) : null));
        }),
      ];
    });

    show(
      header(theme.title, renderHome),
      h('main', { class: 'container' },
        theme.description ? h('p', { class: 'muted' }, theme.description) : null,
        levelCard(theme),
        h('h2', { class: 'section-title' }, mode.title + 'の学習'),
        h('section', { class: 'stats-row four' },
          stat(st.mastered, '習得'), stat(st.learning, '学習中'), stat(st.fresh, '未学習'), stat(st.due, '復習待ち')),
        modes.length > 1 ? h('div', { class: 'segmented' }, modes.map((m) =>
          h('button', { class: m === mode ? 'active' : '', onclick: () => { S.setPref('mode:' + theme.id, m.id); renderTheme(theme); } }, m.title))) : null,
        h('div', { class: 'stack' }, actions),
        h('h2', { class: 'section-title' }, 'カテゴリ別'),
        h('div', { class: 'card list' }, cats),
        theme.practices ? h('h2', { class: 'section-title' }, '実践課題') : null,
        theme.practices ? h('p', { class: 'small muted' }, '実際の作業でやり遂げたらチェック。知識を「使える」に変えるのはこの段階です。') : null,
        theme.practices ? h('div', { class: 'card list' }, practiceGroups) : null,
        theme.tips ? h('details', { class: 'card note' }, h('summary', null, 'このテーマの学び方'), h('p', { html: format(theme.tips) })) : null));
  }

  function levelCard(theme) {
    const { level, next } = S.themeLevel(theme);
    return h('section', { class: 'card level-card' },
      h('div', { class: 'level-head' },
        h('span', { class: 'level-badge', style: 'background:' + themeColor(theme) }, 'Lv' + level),
        h('div', null,
          h('div', { class: 'small muted' }, '現在のレベル'),
          h('div', { class: 'level-name' }, level ? S.LEVEL_NAMES[level - 1] : 'これから'))),
      next && next.reqs.length ? h('div', { class: 'level-next' },
        h('div', { class: 'small muted' }, '次: Lv' + next.level + ' ' + S.LEVEL_NAMES[next.level - 1]),
        next.reqs.map((r) => h('div', { class: 'row-meta' },
          h('span', { class: 'small req-label' }, r.label),
          bar(r.done, r.target),
          h('span', { class: 'small muted' }, Math.min(r.done, r.target) + '/' + r.target)))) : null,
      !next ? h('div', { class: 'small muted level-next' }, 'すべてのレベルを達成しました。') : null);
  }

  // ---- 学習セッション ----
  function startSession(theme, mode, questions, kind, category) {
    const s = { theme, mode, kind, category, queue: questions.slice(), index: 0, first: new Map(), retried: new Set(), medals: 0 };
    renderQuestion(s);
  }

  function categoryTitle(theme, id) {
    const c = (theme.categories || []).find((x) => x.id === id);
    return c ? c.title : id;
  }

  function renderQuestion(s) {
    if (s.index >= s.queue.length) { renderResult(s); return; }
    const q = s.queue[s.index];
    const isRetry = s.first.has(q.id);
    const body = h('div', { class: 'question-body' });
    const quit = () => {
      if (s.index === 0 || confirm('学習を中断しますか？ここまでの回答は保存されています。')) renderTheme(s.theme);
    };

    show(
      h('header', { class: 'topbar' },
        h('button', { class: 'icon-btn', onclick: quit, 'aria-label': '中断' }, '×'),
        h('div', { class: 'topbar-progress' }, bar(s.index, s.queue.length, 'thin')),
        h('span', { class: 'small muted counter' }, (s.index + 1) + '/' + s.queue.length)),
      h('main', { class: 'container' },
        h('div', { class: 'q-meta' },
          h('span', { class: 'pill' }, categoryTitle(s.theme, q.category)),
          h('span', { class: 'pill stars' }, '★'.repeat(q.difficulty || 2)),
          isRetry ? h('span', { class: 'pill warn' }, 'もう一度') : null),
        body));

    let finished = false;
    s.mode.render(body, q, {
      theme: s.theme,
      difficulty: S.game.difficulty().id,
      onKey(fn) { keyHandler = fn; },
      finish(grade) {
        if (finished) return;
        finished = true;
        const before = S.getCard(s.theme.id, s.mode.id, q.id);
        S.record(s.theme.id, s.mode.id, q.id, grade);
        // メダルはセッション内の初回の正解でだけ抽選する
        if (grade !== 'wrong' && !s.first.has(q.id) && S.game.rollMedal(q, before)) {
          s.medals++;
          toast('小さなメダルを 手に入れた！');
        }
        if (!s.first.has(q.id)) s.first.set(q.id, grade);
        // 間違えた問題は数問後に1回だけ再出題する
        if (grade === 'wrong' && !s.retried.has(q.id)) {
          s.retried.add(q.id);
          s.queue.splice(Math.min(s.index + 4, s.queue.length), 0, q);
        }
        s.index++;
        renderQuestion(s);
      },
    });
  }

  function renderResult(s) {
    const firsts = [...s.first.entries()];
    const total = firsts.length;
    const confident = firsts.filter(([, g]) => g === 'confident').length;
    const unsure = firsts.filter(([, g]) => g === 'unsure').length;
    const wrong = total - confident - unsure;
    const pct = total ? Math.round(((confident + unsure) / total) * 100) : 0;
    const review = firsts.filter(([, g]) => g !== 'confident')
      .map(([id, g]) => ({ q: s.theme.questions.find((x) => x.id === id), g }));
    const hasMore = S.buildSession(s.theme, s.mode, 'recommended').length > 0;
    const labels = Object.assign({ confident: '確信あり', unsure: '迷った', wrong: '不正解' }, s.mode.gradeLabels);

    show(
      header('結果', () => renderTheme(s.theme)),
      h('main', { class: 'container' },
        h('section', { class: 'card result-hero' },
          h('div', { class: 'result-score' }, pct + '%'),
          h('div', { class: 'muted' }, s.mode.title + ' / 初回の達成率（' + (confident + unsure) + '/' + total + '）'),
          h('div', { class: 'result-breakdown' },
            h('span', { class: 'pill ok' }, labels.confident + ' ' + confident),
            h('span', { class: 'pill warn' }, labels.unsure + ' ' + unsure),
            h('span', { class: 'pill ng' }, labels.wrong + ' ' + wrong)),
          s.medals ? h('div', { class: 'result-medal' }, h('span', { class: 'medal-icon' }), '小さなメダル ×' + s.medals) : null),
        review.length ? h('h2', { class: 'section-title' }, '要点の振り返り') : null,
        review.length ? h('div', { class: 'stack' }, review.map(({ q, g }) =>
          h('div', { class: 'card review-item ' + (g === 'wrong' ? 'ng' : 'warn') },
            h('div', { class: 'review-q', html: format(q.question) }),
            q.point ? h('div', { class: 'review-point', html: format(q.point) }) : null))) : h('p', { class: 'muted' }, 'すべて確信を持って正解できました。'),
        h('div', { class: 'stack actions-end' },
          hasMore ? h('button', { class: 'btn primary block', onclick: () => startSession(s.theme, s.mode, S.buildSession(s.theme, s.mode, 'recommended'), 'recommended') }, '続けて学習') : null,
          h('button', { class: 'btn block', onclick: () => renderTheme(s.theme) }, 'テーマに戻る'))));

    keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); renderTheme(s.theme); } };
  }

  // ---- メダル交換所 ----
  function renderMedals() {
    const G = S.game;
    const st = G.state();
    const rerender = () => { const y = window.scrollY; renderMedals(); window.scrollTo(0, y); };

    const shopRows = (kind, items) => items.map((item) => {
      const owned = G.owns(kind, item.id);
      const equipped = st[kind] === item.id;
      const label = equipped ? '装備中' : owned ? '装備する' : item.cost + '枚';
      return h('div', { class: 'row shop-row' },
        h('div', { class: 'row-main' }, item.name),
        h('button', { class: 'btn small-btn' + (owned && !equipped ? ' primary' : ''), disabled: equipped || (!owned && st.medals < item.cost), onclick: () => {
          if (!owned && !confirm('「' + item.name + '」をメダル' + item.cost + '枚と交換しますか？')) return;
          if (G.equip(kind, item)) { if (!owned) toast('「' + item.name + '」を 手に入れた！'); rerender(); }
        } }, label));
    });

    const nameInput = h('input', { class: 'text-input', placeholder: 'ごほうびの内容', maxlength: '40' });
    const costInput = h('input', { class: 'text-input cost-input', type: 'number', min: '1', value: '5', inputmode: 'numeric' });
    const addReward = () => {
      const name = nameInput.value.trim();
      const cost = Math.floor(Number(costInput.value));
      if (!name || !(cost > 0)) { alert('内容と必要枚数（1以上）を入力してください'); return; }
      G.addReward(name, cost);
      rerender();
    };

    const rewardRows = st.rewards.map((r) =>
      h('div', { class: 'row shop-row' },
        h('div', { class: 'row-main' }, r.name),
        h('button', { class: 'btn small-btn primary', disabled: st.medals < r.cost, onclick: () => {
          if (!confirm('「' + r.name + '」をメダル' + r.cost + '枚と交換しますか？')) return;
          if (G.redeem(r)) { toast('「' + r.name + '」と 交換した！ 楽しんでね'); rerender(); }
        } }, r.cost + '枚'),
        h('button', { class: 'icon-btn small', 'aria-label': '削除', onclick: () => {
          if (confirm('「' + r.name + '」を一覧から削除しますか？')) { G.removeReward(r.id); rerender(); }
        } }, '×')));

    show(
      header('メダル交換所', renderHome),
      h('main', { class: 'container' },
        h('section', { class: 'card medal-hero' },
          h('div', { class: 'medal-count' }, h('span', { class: 'medal-icon big' }), st.medals + '枚'),
          h('div', { class: 'small muted' }, 'これまでに集めたメダル ' + st.earned + '枚')),
        h('details', { class: 'card note' },
          h('summary', null, 'メダルの集め方'),
          h('ul', null,
            h('li', null, '正解するとランダムで手に入る（セッション内の初回の正解のみ）'),
            h('li', null, '問題の ★ が多いほど出やすい'),
            h('li', null, '一度正解したことがある問題は出にくい'),
            G.DIFFICULTIES.filter((d) => d.enabled).length > 1 ? h('li', null, '難易度が Normal のとき最も出やすい') : null)),
        h('h2', { class: 'section-title' }, 'ごほうび（リアル）'),
        h('div', { class: 'card list' }, rewardRows,
          h('div', { class: 'row add-row' }, nameInput, costInput, h('button', { class: 'btn small-btn', onclick: addReward }, '追加'))),
        h('h2', { class: 'section-title' }, '称号'),
        h('div', { class: 'card list' }, shopRows('title', G.TITLES)),
        h('h2', { class: 'section-title' }, '画面カラー'),
        h('div', { class: 'card list' }, shopRows('skin', G.SKINS)),
        st.history.length ? h('h2', { class: 'section-title' }, '交換の記録') : null,
        st.history.length ? h('div', { class: 'card list' }, st.history.slice(0, 20).map((x) =>
          h('div', { class: 'row shop-row' },
            h('div', { class: 'row-main' }, x.name, h('div', { class: 'small muted' }, new Date(x.at).toLocaleDateString('ja-JP'))),
            h('span', { class: 'small muted' }, '-' + x.cost + '枚')))) : null));
  }

  // RPG 風のメッセージウィンドウ。画面遷移しても消えないよう body 直下に置く
  function toast(text) {
    const el = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(el);
    setTimeout(() => el.classList.add('out'), 1800);
    setTimeout(() => el.remove(), 2300);
  }

  // ---- データ管理 ----
  function renderData() {
    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        S.importData(await file.text());
        S.game.applySkin();
        alert('読み込みました');
        renderHome();
      } catch (e) {
        alert('読み込みに失敗しました: ' + e.message);
      }
    });

    const exportFile = () => {
      const blob = new Blob([S.exportData()], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'study-backup-' + S.util.dayKey(Date.now()) + '.json' });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const resets = [...S.themes.values()].map((theme) =>
      h('button', { class: 'row', onclick: () => {
        if (confirm('「' + theme.title + '」の学習記録をリセットします。元に戻せません。よろしいですか？')) { S.resetTheme(theme.id); alert('リセットしました'); }
      } }, h('div', { class: 'row-main' }, theme.title), h('span', { class: 'small ng-text' }, 'リセット')));

    show(
      header('データ管理', renderHome),
      h('main', { class: 'container' },
        h('p', { class: 'muted small' }, '学習記録はこの端末のブラウザ内（localStorage）にのみ保存されます。端末間での共有や、ブラウザのデータ削除に備えて定期的にバックアップしてください。iPhone の Safari ではホーム画面に追加して使うと記録が消えにくくなります。'),
        h('div', { class: 'stack' },
          h('button', { class: 'btn block', onclick: exportFile }, 'バックアップを保存（JSON）'),
          h('button', { class: 'btn block', onclick: () => fileInput.click() }, 'バックアップから復元'),
          fileInput),
        h('h2', { class: 'section-title' }, 'テーマ別リセット'),
        h('div', { class: 'card list' }, resets)));
  }

  // 外部の AI チャットに渡す。スマホは共有シート（各 AI アプリを選べる）、PC はクリップボードへコピー
  async function shareToAI(text, button) {
    try {
      if (navigator.share && matchMedia('(hover: none)').matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      const label = button.textContent;
      button.textContent = 'コピーしました。AI チャットに貼り付けて質問してください';
      setTimeout(() => { button.textContent = label; }, 2500);
    } catch (e) {
      if (e.name !== 'AbortError') alert('コピーに失敗しました: ' + e.message);
    }
  }

  S.start = () => { S.game.applySkin(); renderHome(); };
  S.ui = { h, append, shareToAI, show, header, renderHome, toast, bar, setKeyHandler: (fn) => { keyHandler = fn; } };
})();
