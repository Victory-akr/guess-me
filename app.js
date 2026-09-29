/* 《猜猜我》MVP — app.js
 * 隐私红线：本文件不发起任何网络请求（无 fetch / XMLHttpRequest / WebSocket / sendBeacon），
 * 不写 Cookie、不用 localStorage。游戏数据只流经 URL Fragment 与内存。
 */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var VERSION = 1;
  var Q_COUNT = 5;
  var OPT_COUNT = 4;
  var Q_MAX = 80;
  var OPT_MAX = 30;
  var HASH_MAX = 64000;        // fragment 字符上限（防超长链接）
  var JSON_MAX = 30000;        // 解码后 JSON 文本上限
  var LETTERS = ['A', 'B', 'C', 'D'];

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }
  var screens = {
    home: $('screen-home'),
    create: $('screen-create'),
    share: $('screen-share'),
    answer: $('screen-answer'),
    result: $('screen-result'),
    error: $('screen-error')
  };

  /* ---------- 运行状态（仅内存） ---------- */
  var session = {
    stage: 0,        // 0=HOME/A 创建中, 1=B 打开的 stage1 数据, 2=A 打开的 stage2 数据
    payload: null    // 已解码并通过校验的游戏数据
  };

  function show(name) {
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('hidden', k !== name);
    });
    window.scrollTo(0, 0);
  }

  function showErrorScreen() {
    session.stage = 0;
    session.payload = null;
    show('error');
  }

  /* ---------- 编解码：JSON <-> Base64URL（仅编码，非加密） ---------- */
  function encodePayload(obj) {
    var json = JSON.stringify(obj);
    var bytes = new TextEncoder().encode(json);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeToText(b64url) {
    if (b64url.length > HASH_MAX) throw new Error('too-long-fragment');
    if (!/^[A-Za-z0-9\-_]+$/.test(b64url)) throw new Error('bad-chars');
    var b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.length > JSON_MAX) throw new Error('too-long-json');
    return text;
  }

  /* ---------- 校验（SRS §5） ---------- */
  function isIntInRange(v, lo, hi) {
    return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
  }

  function validateQuestionSet(qs) {
    if (!Array.isArray(qs) || qs.length !== Q_COUNT) return false;
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      if (!q || typeof q !== 'object') return false;
      if (typeof q.question !== 'string' || q.question.length === 0 || q.question.length > Q_MAX) return false;
      if (!Array.isArray(q.options) || q.options.length !== OPT_COUNT) return false;
      for (var j = 0; j < OPT_COUNT; j++) {
        var o = q.options[j];
        if (typeof o !== 'string' || o.length === 0 || o.length > OPT_MAX) return false;
      }
      if (!isIntInRange(q.answer, 0, OPT_COUNT - 1)) return false;
    }
    return true;
  }

  function validateAnswerArray(arr) {
    if (!Array.isArray(arr) || arr.length !== Q_COUNT) return false;
    for (var i = 0; i < Q_COUNT; i++) {
      if (!isIntInRange(arr[i], 0, OPT_COUNT - 1)) return false;
    }
    return true;
  }

  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    if (obj.version !== VERSION) return null;
    if (obj.stage === 1) {
      if (!obj.a || !validateQuestionSet(obj.a.questions)) return null;
      return obj;
    }
    if (obj.stage === 2) {
      if (!obj.a || !validateQuestionSet(obj.a.questions)) return null;
      if (!obj.b || !validateQuestionSet(obj.b.questions)) return null;
      if (!validateAnswerArray(obj.bAnswers)) return null;
      return obj;
    }
    return null;
  }

  function buildUrl(frag) {
    // file:// 与 http(s) 均可：只保留 path + ?search，替换 #fragment
    var base = location.href.split('#')[0];
    return base + '#' + frag;
  }

  /* ---------- 出题表单（A_CREATE / B_CREATE 共用） ---------- */
  var createMode = 'a'; // 'a' | 'b'

  function buildCreateForm() {
    var wrap = $('create-form');
    wrap.innerHTML = '';
    for (var i = 0; i < Q_COUNT; i++) {
      var card = document.createElement('div');
      card.className = 'qcard';
      card.innerHTML =
        '<h3>第 ' + (i + 1) + ' 题</h3>' +
        '<label class="field">题目（≤80 字）' +
        '<input type="text" class="in-q" maxlength="' + Q_MAX + '" data-i="' + i + '"></label>' +
        '<p class="answer-hint">选中圆点 = 该题的正确答案</p>';
      for (var j = 0; j < OPT_COUNT; j++) {
        var row = document.createElement('div');
        row.className = 'opt-row';
        row.innerHTML =
          '<span class="opt-key">' + LETTERS[j] + '</span>' +
          '<input type="text" class="in-opt" maxlength="' + OPT_MAX + '" placeholder="选项 ' + LETTERS[j] + '" data-i="' + i + '" data-j="' + j + '">' +
          '<input type="radio" name="ans-' + i + '" class="in-ans" value="' + j + '" aria-label="第' + (i + 1) + '题正确答案' + LETTERS[j] + '">';
        card.appendChild(row);
      }
      var err = document.createElement('p');
      err.className = 'card-error';
      card.appendChild(err);
      wrap.appendChild(card);
    }
    $('create-error').textContent = '';
  }

  function collectCreateForm() {
    var qs = [];
    var firstError = '';
    var cards = $('create-form').querySelectorAll('.qcard');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var qText = card.querySelector('.in-q').value.trim();
      var opts = [];
      card.querySelectorAll('.in-opt').forEach(function (inp) { opts.push(inp.value.trim()); });
      var ansRadio = card.querySelector('.in-ans:checked');
      var errEl = card.querySelector('.card-error');
      var msg = '';
      if (qText.length === 0) msg = '题目不能为空。';
      else if (qText.length > Q_MAX) msg = '题目超过 80 字。';
      for (var j = 0; !msg && j < OPT_COUNT; j++) {
        if (opts[j].length === 0) msg = '选项 ' + LETTERS[j] + ' 不能为空。';
        else if (opts[j].length > OPT_MAX) msg = '选项 ' + LETTERS[j] + ' 超过 30 字。';
      }
      if (!msg && !ansRadio) msg = '请勾选正确答案。';
      errEl.textContent = msg;
      if (msg && !firstError) firstError = '第 ' + (i + 1) + ' 题：' + msg;
      if (!msg) qs.push({ question: qText, options: opts, answer: parseInt(ansRadio.value, 10) });
    }
    return { questions: qs, error: firstError };
  }

  function enterCreate(mode) {
    createMode = mode;
    $('create-title').textContent = mode === 'a' ? '出 5 道题（你是 A）' : '现在轮到你出 5 道题（你是 B）';
    $('create-sub').textContent = '每题 4 个选项，勾选你认为的正确答案。题目 ≤80 字，选项 ≤30 字。';
    buildCreateForm();
    show('create');
  }

  function onGenerateLink() {
    var collected = collectCreateForm();
    var errBox = $('create-error');
    if (collected.error) {
      errBox.textContent = collected.error;
      return;
    }
    if (collected.questions.length !== Q_COUNT) {
      errBox.textContent = '需要完整填写 5 道题。';
      return;
    }

    var payload;
    var frag;
    if (createMode === 'a') {
      payload = { version: VERSION, stage: 1, a: { questions: collected.questions }, bAnswers: [], b: { questions: [] }, aAnswers: [] };
      // stage=1 分享出去时只携带 version/stage/a（见 SRS §3）
      frag = encodePayload({ version: VERSION, stage: 1, a: payload.a });
      session.stage = 1;
      session.payload = payload;
      enterShare('share-to-b');
    } else {
      // createMode === 'b'：session.payload 已含 a 题 + B 刚提交的 bAnswers
      payload = session.payload;
      payload.version = VERSION;
      payload.stage = 2;
      payload.b = { questions: collected.questions };
      frag = encodePayload({ version: VERSION, stage: 2, a: payload.a, bAnswers: payload.bAnswers, b: payload.b });
      session.stage = 2;
      session.payload = payload;
      enterShare('share-back');
    }
    $('share-url').value = buildUrl(frag);
  }

  /* ---------- 分享（navigator.share -> 复制回退） ---------- */
  var shareKind = 'share-to-b';

  function enterShare(kind) {
    shareKind = kind;
    if (kind === 'share-to-b') {
      $('share-title').textContent = '把链接发给对方（B）';
      $('share-sub').textContent = '对方打开链接回答你的 5 道题，然后反过来给你出题。';
    } else {
      $('share-title').textContent = '把链接发回给对方（A）';
      $('share-sub').textContent = 'A 打开这个链接回答你出的 5 道题，双方得分就会揭晓。';
    }
    // navigator.share 需要用户手势 + 安全上下文；API 存在则显示按钮，点击失败自动回退复制
    $('btn-native-share').classList.toggle('hidden', typeof navigator.share !== 'function');
    $('copy-feedback').textContent = '';
    show('share');
  }

  function nativeShare() {
    var url = $('share-url').value;
    try {
      navigator.share({ title: '猜猜我', text: '来玩「猜猜我」：看看你有多懂我！', url: url })
        .then(function () { $('copy-feedback').textContent = '分享完成。'; })
        .catch(function (e) { fallbackCopy(); });
    } catch (e) {
      fallbackCopy();
    }
  }

  function fallbackCopy() {
    var url = $('share-url').value;
    var done = function () { $('copy-feedback').textContent = '链接已复制，发给对方即可。'; };
    var fail = function () {
      $('copy-feedback').textContent = '复制失败：请长按/选中上方链接手动复制。';
      $('share-url').focus();
      $('share-url').select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { legacyCopy(url) ? done() : fail(); });
    } else {
      legacyCopy(url) ? done() : fail();
    }
  }

  function legacyCopy(text) {
    try {
      var ta = $('share-url');
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      return document.execCommand('copy');
    } catch (e) {
      return false;
    }
  }

  /* ---------- 答题页（B_ANSWER_A / A_ANSWER_B 共用） ---------- */
  var answerMode = 'b'; // 'b' = B 答 A 的题, 'a' = A 答 B 的题
  var answeredCount = 0;

  function renderQuiz(questions, mode) {
    answerMode = mode;
    var wrap = $('answer-form');
    wrap.innerHTML = '';
    answeredCount = 0;
    $('answer-error').textContent = '';
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var box = document.createElement('div');
      box.className = 'ans-q';
      var title = document.createElement('p');
      title.className = 'ans-title';
      title.textContent = (i + 1) + '. ' + q.question;
      box.appendChild(title);
      for (var j = 0; j < q.options.length; j++) {
        var lab = document.createElement('label');
        lab.className = 'ans-opt';
        var inp = document.createElement('input');
        inp.type = 'radio';
        inp.name = 'answer-' + i;
        inp.value = String(j);
        inp.dataset.qi = String(i);
        (function (lab2) {
          inp.addEventListener('change', function () {
            lab2.parentElement.querySelectorAll('.ans-opt').forEach(function (el) { el.classList.remove('selected'); });
            this.parentElement.classList.add('selected');
            updateProgress();
          });
        })(lab);
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(q.options[j]));
        box.appendChild(lab);
      }
      wrap.appendChild(box);
    }
    $('btn-submit-answers').disabled = true;
  }

  function updateProgress() {
    var wrap = $('answer-form');
    var done = 0;
    for (var i = 0; i < Q_COUNT; i++) {
      if (wrap.querySelector('input[name="answer-' + i + '"]:checked')) done++;
    }
    answeredCount = done;
    $('answer-sub').textContent = '已作答 ' + done + ' / ' + Q_COUNT + ' 题。';
    $('btn-submit-answers').disabled = (done < Q_COUNT);
  }

  function collectAnswers() {
    var arr = [];
    var wrap = $('answer-form');
    for (var i = 0; i < Q_COUNT; i++) {
      var checked = wrap.querySelector('input[name="answer-' + i + '"]:checked');
      if (!checked) return null;
      arr.push(parseInt(checked.value, 10));
    }
    return arr;
  }

  function onSubmitAnswers() {
    var ans = collectAnswers();
    if (!ans) { $('answer-error').textContent = '还有题目没答完。'; return; }
    if (answerMode === 'b') {
      // B 答完 A 的题 -> 进入 B 出题
      session.payload.bAnswers = ans;
      enterCreate('b');
    } else {
      // A 答完 B 的题 -> 本地算分
      session.payload.aAnswers = ans;
      renderResult();
    }
  }

  /* ---------- 结果（全部本地计算） ---------- */
  function calcScore(rightAnswers, questions, givenAnswers) {
    var score = 0;
    var detail = [];
    for (var i = 0; i < questions.length; i++) {
      var correct = givenAnswers[i] === questions[i].answer;
      if (correct) score++;
      detail.push({ q: questions[i], given: givenAnswers[i], correct: correct });
    }
    return { score: score, detail: detail };
  }

  function renderDetailList(container, title, items) {
    var block = document.createElement('div');
    block.className = 'detail-block';
    var h = document.createElement('h4');
    h.textContent = title;
    block.appendChild(h);
    items.forEach(function (d, idx) {
      var line = document.createElement('p');
      line.className = 'detail-item';
      var rightOpt = d.q.options[d.q.answer];
      line.innerHTML =
        '<b>' + (idx + 1) + '.</b> ' + escapeHtml(d.q.question) + '<br>' +
        '<span class="' + (d.correct ? 'mark-right' : 'mark-wrong') + '">' +
        (d.correct ? '✓ 答对（' + LETTERS[d.given] + '）'
          : '✗ 答错：TA 选 ' + LETTERS[d.given] + '，正确答案是 ' + LETTERS[d.q.answer] + '（' + escapeHtml(rightOpt) + '）') +
        '</span>';
      block.appendChild(line);
    });
    container.appendChild(block);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderResult() {
    var p = session.payload;
    // A 得分：B 对 A 题目的答案；B 得分：A 对 B 题目的答案
    var aResult = calcScore(p.a.questions, p.a.questions, p.bAnswers);
    var bResult = calcScore(p.b.questions, p.b.questions, p.aAnswers);
    $('score-a').textContent = aResult.score + '/5';
    $('score-b').textContent = bResult.score + '/5';
    $('score-a-label').textContent = 'B 有多懂你';
    $('score-b-label').textContent = '你有多懂 B';
    var detail = $('result-detail');
    detail.innerHTML = '';
    detail.classList.add('hidden');
    $('btn-detail-toggle').textContent = '逐题对照 ▾';
    renderDetailList(detail, '你出的题 · B 的回答', aResult.detail);
    renderDetailList(detail, 'B 出的题 · 你的回答', bResult.detail);
    show('result');
  }

  /* ---------- 路由：以 location.hash 为入口真相 ---------- */
  function route() {
    var frag = location.hash.replace(/^#/, '');
    if (frag === '') {
      session.stage = 0;
      session.payload = null;
      show('home');
      return;
    }
    var obj = null;
    try {
      obj = JSON.parse(decodeToText(frag));
    } catch (e) {
      showErrorScreen();
      return;
    }
    var valid = validate(obj);
    if (!valid) { showErrorScreen(); return; }
    // 补全内部字段，保持单一结构
    valid.bAnswers = valid.bAnswers || [];
    valid.b = valid.b || { questions: [] };
    valid.aAnswers = valid.aAnswers || [];
    session.payload = valid;
    if (valid.stage === 1) {
      session.stage = 1;
      $('answer-title').textContent = '回答 TA 出的 5 道题';
      renderQuiz(valid.a.questions, 'b');
      updateProgress();
      show('answer');
    } else {
      session.stage = 2;
      $('answer-title').textContent = '回答 TA 出的 5 道题';
      renderQuiz(valid.b.questions, 'a');
      updateProgress();
      show('answer');
    }
  }

  /* ---------- 事件绑定 ---------- */
  function resetToHome() {
    if (location.hash !== '') {
      // 用 # 前缀改写避免触发 reload；清掉 fragment
      history.replaceState(null, '', location.pathname + location.search);
    }
    session.stage = 0;
    session.payload = null;
    show('home');
  }

  $('btn-start').addEventListener('click', function () {
    enterCreate('a');
  });
  $('btn-generate').addEventListener('click', onGenerateLink);
  $('btn-native-share').addEventListener('click', nativeShare);
  $('btn-copy').addEventListener('click', fallbackCopy);
  $('btn-restart-from-share').addEventListener('click', resetToHome);
  $('btn-submit-answers').addEventListener('click', onSubmitAnswers);
  $('btn-home-from-error').addEventListener('click', resetToHome);
  $('btn-home-from-result').addEventListener('click', resetToHome);
  $('btn-detail-toggle').addEventListener('click', function () {
    var d = $('result-detail');
    var opening = d.classList.contains('hidden');
    d.classList.toggle('hidden');
    this.textContent = opening ? '逐题对照 ▴' : '逐题对照 ▾';
  });

  window.addEventListener('hashchange', function () {
    try { route(); } catch (e) { showErrorScreen(); }
  });

  /* ---------- 启动 ---------- */
  try { route(); } catch (e) { showErrorScreen(); }

  /* ---------- 测试钩子（供自动化测试注入/读取，不影响正常用户） ---------- */
  window.__guessMeTest = {
    encodePayload: encodePayload,
    decodeToText: decodeToText,
    validate: validate,
    route: route,
    screens: screens,
    session: session,
    show: show
  };
})();
