// 共通の画面部品とトップ（ジョブ選択）・データ管理の画面。スフィア盤は sphere.js、出題は challenge.js が担う。
(function () {
  'use strict';

  const S = window.StudyApp;
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

  // ---- トップ（ジョブ選択） ----
  function renderHome() {
    show(
      header('Study', null, h('button', { class: 'icon-btn', onclick: renderData, 'aria-label': 'データ管理' }, '⚙')),
      h('main', { class: 'container' },
        h('section', { class: 'stats-row' },
          stat(S.streak(), '連続学習日数'),
          stat(S.todayCount(), '今日の回答数')),
        S.sphere.jobList(),
        methodNote()));
  }

  function stat(value, label) {
    return h('div', { class: 'card stat' }, h('div', { class: 'stat-value' }, String(value)), h('div', { class: 'small muted' }, label));
  }

  function methodNote() {
    return h('details', { class: 'card note' },
      h('summary', null, 'このアプリに組み込んでいる学習法'),
      h('ul', null,
        h('li', null, h('strong', null, '想起練習'), ' 読むより「思い出す」方が記憶に残る。解説は自分で答えたあとにだけ出る。'),
        h('li', null, h('strong', null, '段階的に深める'), ' 熟練度が上がるほど、選ぶ → 見極める → 理由を説明する → 誤りを見抜く → 自分の言葉で語る、と求める理解が深くなる。'),
        h('li', null, h('strong', null, '確信度の自己評価'), ' 正解でも「迷った」なら弱点として扱う。まぐれ当たりを放置しない。'),
        h('li', null, h('strong', null, '弱点の再出題'), ' 間違えた問題と「迷った」問題は、他のマスでも優先して出題される。'),
        h('li', null, h('strong', null, '前提から順に'), ' スフィア盤は前提となる知識から順に開くので、土台のない状態で応用に進まない。'),
        h('li', null, h('strong', null, '精緻化フィードバック'), ' 正解の理由だけでなく、各誤答がなぜ誤りかも示す。'),
        h('li', null, h('strong', null, '短いセッション'), ' 1マス10問。毎日少しずつが最も効率がよい。')));
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

    const resets = [...S.jobs.values()].filter((job) => !job.planned).map((job) =>
      h('button', { class: 'row', onclick: () => {
        if (confirm('「' + job.title + '」の進行・熟練度・回答の記録をリセットします。元に戻せません。よろしいですか？')) { S.sphere.resetJob(job.id); alert('リセットしました'); }
      } }, h('div', { class: 'row-main' }, job.title), h('span', { class: 'small ng-text' }, 'リセット')));

    show(
      header('データ管理', renderHome),
      h('main', { class: 'container' },
        h('p', { class: 'muted small' }, '学習記録はこの端末のブラウザ内（localStorage）にのみ保存されます。端末間での共有や、ブラウザのデータ削除に備えて定期的にバックアップしてください。iPhone の Safari ではホーム画面に追加して使うと記録が消えにくくなります。'),
        h('div', { class: 'stack' },
          h('button', { class: 'btn block', onclick: exportFile }, 'バックアップを保存（JSON）'),
          h('button', { class: 'btn block', onclick: () => fileInput.click() }, 'バックアップから復元'),
          fileInput),
        h('h2', { class: 'section-title' }, 'ジョブ別リセット'),
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

  S.start = renderHome;
  S.ui = { h, append, shareToAI, show, header, renderHome, toast, bar, setKeyHandler: (fn) => { keyHandler = fn; } };
})();
