/* 《猜猜我》MVP v3 — 精简协议：URL 只携带题库 ID 与阶段状态，题目文字从本地题库还原。
 * 隐私红线：不发起网络请求；数据只经 URL Fragment 与内存；一切浏览器存储机制都不用。
 * 威胁模型（产品决策已确认）：拿到链接的人可以解码看到答案。Base64URL 只是编码，不是加密。
 */
(function () {
  'use strict';
  var PV = 3, QN = 5, OPTN = 4, LETTERS = ['A', 'B', 'C', 'D'];
  var HASH_MAX = 8000, JSON_MAX = 4000;
  var GAMEID_RE = /^[a-z0-9]{4,8}$/;
  var lastError = '';
  var bankMap = null, BV = null;
  var S = null; /* 内存会话 {st,g,qs,aa,bqs,bg,ba,ag,role}——唯一真相，不落盘 */

  function $(id) { return document.getElementById(id); }
  var screens = { home: $('screen-home'), answer: $('screen-answer'), share: $('screen-share'), result: $('screen-result'), error: $('screen-error') };
  function show(n) { Object.keys(screens).forEach(function (k) { screens[k].classList.toggle('hidden', k !== n); }); window.scrollTo(0, 0); }
  function fail(code) { lastError = code; S = null; var e = $('error-code'); if (e) e.textContent = 'ERR: ' + code; show('error'); }

  /* ---------- 题库加载自检 ---------- */
  function initBank() {
    var L = window.GUESS_ME_BANK;
    BV = window.QUESTION_BANK_VERSION;
    if (!Array.isArray(L) || typeof BV !== 'number' || L.length === 0) return false;
    var m = Object.create(null);
    for (var i = 0; i < L.length; i++) {
      var q = L[i];
      if (!q || typeof q.id !== 'string' || !q.id || typeof q.q !== 'string' || !q.q ||
        !Array.isArray(q.o) || q.o.length !== OPTN || q.o.some(function (s) { return typeof s !== 'string' || !s; })) return false;
      if (m[q.id]) return false;
      m[q.id] = q;
    }
    bankMap = m;
    return true;
  }

  /* ---------- 编解码 ---------- */
  function encode(o) {
    var bytes = new TextEncoder().encode(JSON.stringify(o)), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(s) {
    if (!s) throw { code: 'ERR_EMPTY_FRAGMENT' };
    if (s.length > HASH_MAX) throw { code: 'ERR_LENGTH' };
    if (!/^[A-Za-z0-9_-]+$/.test(s)) throw { code: 'ERR_BASE64' };
    var b = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b.length % 4) b += '=';
    var bin;
    try { bin = atob(b); } catch (e) { throw { code: 'ERR_BASE64' }; }
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var t;
    try { t = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { throw { code: 'ERR_UTF8' }; }
    if (t.length > JSON_MAX) throw { code: 'ERR_LENGTH' };
    return t;
  }

  /* ---------- 校验：错误抛内部码，用户界面统一文案 ---------- */
  function idsOk(qs) {
    if (!Array.isArray(qs) || qs.length !== QN) throw { code: 'ERR_QUESTION_COUNT' };
    for (var i = 0; i < QN; i++) if (typeof qs[i] !== 'string' || !bankMap[qs[i]]) throw { code: 'ERR_QUESTION_ID' };
  }
  function ansArr(a) {
    if (!Array.isArray(a) || a.length !== QN || !a.every(function (x) { return Number.isInteger(x) && x >= 0 && x < OPTN; })) throw { code: 'ERR_ANSWER' };
  }
  function validate(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw { code: 'ERR_PAYLOAD' };
    if (o.pv !== PV) throw { code: 'ERR_PROTOCOL_VERSION' };
    if (typeof o.bv !== 'number' || o.bv !== BV) throw { code: 'ERR_BANK_VERSION' };
    if (o.st !== 1 && o.st !== 2) throw { code: 'ERR_STAGE' };
    if (typeof o.g !== 'string' || !GAMEID_RE.test(o.g)) throw { code: 'ERR_GAME_ID' };
    idsOk(o.q); ansArr(o.aa);
    if (o.st === 2) {
      idsOk(o.bq);
      if (o.bq.some(function (id) { return o.q.indexOf(id) >= 0; })) throw { code: 'ERR_DUPLICATE_QUESTION' };
      ansArr(o.bg); ansArr(o.ba);
    }
    return true;
  }

  /* ---------- 抽题 ---------- */
  function sampleQuestions(excludeIds) {
    var ex = Object.create(null);
    (excludeIds || []).forEach(function (id) { ex[id] = true; });
    var byCat = Object.create(null);
    window.GUESS_ME_BANK.forEach(function (q) { if (!ex[q.id]) { (byCat[q.c] || (byCat[q.c] = [])).push(q); } });
    var cats = Object.keys(byCat).sort(function () { return Math.random() - .5; });
    if (cats.length < QN) return null;
    var out = [];
    for (var i = 0; i < QN; i++) { var a = byCat[cats[i]]; out.push(a[Math.floor(Math.random() * a.length)]); }
    return out;
  }
  function newGameId() {
    var c = 'abcdefghijklmnopqrstuvwxyz0123456789', s = '';
    while (s.length < 6) s += c[Math.floor(Math.random() * c.length)];
    return s;
  }
  function idOf(q) { return q.id; }
  function url(f) { return location.href.split('#')[0] + '#' + f; }

  /* ---------- 渲染 ---------- */
  function renderOptions(questions) {
    var wrap = $('answer-form'); wrap.innerHTML = ''; $('answer-error').textContent = '';
    questions.forEach(function (q, i) {
      var box = document.createElement('div'); box.className = 'ans-q';
      var title = document.createElement('p'); title.className = 'ans-title'; title.textContent = (i + 1) + '. ' + q.q; box.appendChild(title);
      q.o.forEach(function (opt, j) {
        var lab = document.createElement('label'); lab.className = 'ans-opt';
        var inp = document.createElement('input'); inp.type = 'radio'; inp.name = 'answer-' + i; inp.value = j;
        inp.addEventListener('change', function () { lab.parentElement.querySelectorAll('.ans-opt').forEach(function (e) { e.classList.remove('selected'); }); lab.classList.add('selected'); updateProgress(); });
        lab.appendChild(inp); lab.appendChild(document.createTextNode(opt)); box.appendChild(lab);
      });
      wrap.appendChild(box);
    });
    $('btn-submit-answers').disabled = true;
  }
  function renderSelfQuiz(questions) {
    renderOptions(questions);
    $('answer-title').textContent = '先选出“你自己的答案”';
    $('answer-sub').textContent = '这 5 题是从内置精选题库随机抽取的。先选最像你自己的答案。';
    $('btn-submit-answers').textContent = '确定我的答案';
  }
  function renderGuess(questions) {
    renderOptions(questions);
    $('answer-title').textContent = '猜 TA 的答案';
    $('answer-sub').textContent = '凭你对 TA 的了解，选出你认为 TA 会选的答案。';
    $('btn-submit-answers').textContent = '提交猜测';
  }
  function updateProgress() {
    var done = 0;
    for (var i = 0; i < QN; i++) if ($('answer-form').querySelector('input[name="answer-' + i + '"]:checked')) done++;
    $('answer-sub').textContent = $('answer-sub').textContent.replace(/已选择 \d+ \/ 5。/, '') + ' 已选择 ' + done + ' / 5。';
    $('btn-submit-answers').disabled = done < QN;
  }
  function collect() {
    var a = [];
    for (var i = 0; i < QN; i++) { var x = $('answer-form').querySelector('input[name="answer-' + i + '"]:checked'); if (!x) return null; a.push(Number(x.value)); }
    return a;
  }

  /* ---------- 分享 ---------- */
  function setShare(kind, frag) {
    $('share-title').textContent = kind === 'toB' ? '把链接发给对方' : '把链接发回给对方';
    $('share-sub').textContent = kind === 'toB' ? 'TA 打开后会先猜你的 5 个答案，然后回答 TA 自己的 5 个题。' : '对方打开后会猜你的 5 个答案，之后双方结果揭晓。';
    $('share-url').value = url(frag); $('copy-feedback').textContent = '';
    $('btn-native-share').classList.toggle('hidden', typeof navigator.share !== 'function');
    show('share');
  }
  function copy() {
    var u = $('share-url').value;
    var done = function () { $('copy-feedback').textContent = '链接已复制，发给对方即可。'; };
    var failC = function () { $('copy-feedback').textContent = '复制失败，请手动复制上方链接。'; $('share-url').focus(); $('share-url').select(); };
    var legacy = function (t) { try { var x = $('share-url'); x.focus(); x.select(); x.setSelectionRange(0, t.length); return document.execCommand('copy'); } catch (e) { return false; } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { legacy(u) ? done() : failC(); });
    else legacy(u) ? done() : failC();
  }
  function nativeShare() { try { navigator.share({ title: '猜猜我', text: '来玩「猜猜我」：看看你有多懂我！', url: $('share-url').value }).catch(copy); } catch (e) { copy(); } }

  /* ---------- 结果 ---------- */
  function result() {
    var ar = 0, br = 0, detail = $('result-detail'); detail.innerHTML = '';
    S.qs.forEach(function (q, i) { var ok = S.bg[i] === S.aa[i]; if (ok) ar++; appendDetail(detail, q, S.bg[i], S.aa[i], ok, '你'); });
    S.bqs.forEach(function (q, i) { var ok = S.ag[i] === S.ba[i]; if (ok) br++; appendDetail(detail, q, S.ag[i], S.ba[i], ok, 'TA'); });
    $('score-a').textContent = ar + '/5'; $('score-b').textContent = br + '/5';
    $('score-a-label').textContent = 'TA 猜中你的答案'; $('score-b-label').textContent = '你猜中 TA 的答案';
    detail.classList.add('hidden'); $('btn-detail-toggle').textContent = '逐题对照 ▾'; show('result');
  }
  function appendDetail(container, q, given, actual, ok, who) {
    var other = who === '你' ? 'TA' : '你';
    var p = document.createElement('p'); p.className = 'detail-item';
    p.innerHTML = '<b>' + escapeHtml(q.q) + '</b><br><span class="' + (ok ? 'mark-right' : 'mark-wrong') + '">' +
      (ok ? '✓ 猜对了：' + LETTERS[actual] + '（' + escapeHtml(q.o[actual]) + '）'
        : '✗ 猜错：' + who + '实际选 ' + LETTERS[actual] + '（' + escapeHtml(q.o[actual]) + '），' + other + '选了 ' + LETTERS[given] + '（' + escapeHtml(q.o[given]) + '）') + '</span>';
    container.appendChild(p);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- 流程 ---------- */
  function reset() { if (location.hash) history.replaceState(null, '', location.pathname + location.search); S = null; lastError = ''; var e = $('error-code'); if (e) e.textContent = ''; show('home'); }
  function start() {
    if (!bankMap) { fail('ERR_BANK_INTEGRITY'); return; }
    var qs = sampleQuestions([]);
    if (!qs) { fail('ERR_BANK_SMALL'); return; }
    S = { st: 1, g: newGameId(), qs: qs, aa: [], role: 'A_SELF' };
    renderSelfQuiz(qs); show('answer');
  }
  function submit() {
    if (!S) { fail('ERR_LOCAL_STATE_MISSING'); return; }
    var a = collect(); if (!a) { $('answer-error').textContent = '还有题目没选。'; return; }
    if (S.role === 'A_SELF') {
      S.aa = a; S.role = 'A_DONE';
      setShare('toB', encode({ pv: PV, bv: BV, st: 1, g: S.g, q: S.qs.map(idOf), aa: a }));
      return;
    }
    if (S.role === 'B_GUESS') {
      S.bg = a;
      var bqs = sampleQuestions(S.qs.map(idOf));
      if (!bqs) { fail('ERR_BANK_SMALL'); return; }
      S.bqs = bqs; S.role = 'B_SELF'; S.st = 2;
      renderSelfQuiz(bqs); show('answer'); return;
    }
    if (S.role === 'B_SELF') {
      S.ba = a; S.role = 'B_DONE';
      setShare('toA', encode({ pv: PV, bv: BV, st: 2, g: S.g, q: S.qs.map(idOf), aa: S.aa, bq: S.bqs.map(idOf), bg: S.bg, ba: a }));
      return;
    }
    if (S.role === 'A_GUESS') { S.ag = a; result(); return; }
    fail('ERR_STAGE');
  }

  /* ---------- 路由 ---------- */
  function route() {
    lastError = '';
    var f = location.hash.replace(/^#/, '');
    if (!f) { S = null; show('home'); return; }
    if (!bankMap) { fail('ERR_BANK_INTEGRITY'); return; }
    var o;
    try { o = JSON.parse(decode(f)); } catch (e) { fail(e && e.code ? e.code : 'ERR_JSON'); return; }
    try { validate(o); } catch (e) { fail(e && e.code ? e.code : 'ERR_PAYLOAD'); return; }
    var qs = o.q.map(function (id) { return bankMap[id]; });
    if (o.st === 1) {
      S = { st: 1, g: o.g, qs: qs, aa: o.aa, role: 'B_GUESS' };
      renderGuess(qs); show('answer');
    } else {
      var bqs = o.bq.map(function (id) { return bankMap[id]; });
      S = { st: 2, g: o.g, qs: qs, aa: o.aa, bqs: bqs, bg: o.bg, ba: o.ba, role: 'A_GUESS' };
      renderGuess(bqs); show('answer');
    }
  }

  /* ---------- 启动 ---------- */
  if (!initBank()) {
    /* script 位于 body 末尾，DOM 已就绪，直接同步 fail-closed */
    fail('ERR_BANK_INTEGRITY');
  } else {
    $('btn-start').addEventListener('click', start);
    $('btn-submit-answers').addEventListener('click', submit);
    $('btn-native-share').addEventListener('click', nativeShare);
    $('btn-copy').addEventListener('click', copy);
    $('btn-restart-from-share').addEventListener('click', reset);
    $('btn-home-from-error').addEventListener('click', reset);
    $('btn-home-from-result').addEventListener('click', reset);
    $('btn-detail-toggle').addEventListener('click', function () { var d = $('result-detail'), open = d.classList.contains('hidden'); d.classList.toggle('hidden'); this.textContent = open ? '逐题对照 ▴' : '逐题对照 ▾'; });
    addEventListener('hashchange', function () { route(); });
    route();
  }

  window.__guessMeTest = { encode: encode, decode: decode, validate: validate, route: route, session: function () { return S; }, lastError: function () { return lastError; }, pv: PV, bankVersion: function () { return BV; } };
})();
