/*
 * app.js: UI for the interval trainer (clean modern skin + XP/rank progression).
 * Uses window.EarAudio, EarEngine, EarSfx, Fretboard, ANCHORS.
 */
(function () {
  'use strict';

  var E = window.EarEngine, A = window.EarAudio, FB = window.Fretboard, SFX = window.EarSfx;
  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  var ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var HINT_RULE = 'Hinted answers count in your stats, not toward unlocks or stars.';
  var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var S = E.load();
  var view = 'home';
  var sess = null;          // current session
  var fb = null;            // feedback for the answered question
  var curMode = null;       // mode id on the level map
  var audioReady = false;
  var playing = false;
  var showAnchorAnyway = false;
  var resetArmed = 0;
  var libRoot = 45;
  var libOpen = null;
  var askTimer = 0;
  var app = document.getElementById('app');

  // ------------------------------------------------------------ icons (round caps, 2px stroke)
  var I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.4-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" d="M12 3.2l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.5l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c.5 3.2 2.3 4.9 3.9 6.6C17.4 10.2 19 12 19 14.8 19 18.8 15.9 22 12 22s-7-3.2-7-7.2c0-2.3 1-4 2.4-5.3.3 1.6 1 2.8 2.2 3.4C9.4 9.2 10.2 5.2 12 2z"/><path class="flame-core" d="M12 13.5c1.2 1.3 2.3 2.4 2.3 4.1A2.3 2.3 0 0 1 12 20a2.3 2.3 0 0 1-2.3-2.4c0-1.7 1.1-2.8 2.3-4.1z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    guitar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M9 6v12M15 6v12M3 10h18M3 14h18"/></svg>',
    lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19.5V5.5A1.5 1.5 0 0 1 6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5 1.5 1.5 0 0 0 6.5 20H19"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h4v4M4 20L20 4M20 16v4h-4M14.5 14.5L20 20M4 4l5 5"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h8M16 7h4M4 17h4M12 17h8"/><circle cx="14" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    modes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h4v-4h4v-4h4V7h4"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.2 2.5L5 13.2h6l-1.2 8.3 8.2-10.7h-6z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>'
  };

  // ------------------------------------------------------------ helpers
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function info(semis) { return E.info(semis); }
  function code(semis) { return info(semis).short; }
  function full(semis) { var i = info(semis); return i.short + ' · ' + i.name; }
  function pct(x) { return x === null || x === undefined ? '–' : Math.round(x * 100) + '%'; }
  function persist() { E.save(S); }
  function stageIndex(st) { return E.STAGES.indexOf(st) + 1; }
  function badge(semis, extra) { return '<span class="badge' + (extra ? ' ' + extra : '') + '">' + code(semis) + '</span>'; }
  function stars(n, max, cls) {
    var o = '<span class="stars' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + n + ' of ' + (max || 3) + ' stars">';
    for (var i = 0; i < (max || 3); i++) o += '<span class="st' + (i < n ? ' on' : '') + '" style="--i:' + i + '">' + I.star + '</span>';
    return o + '</span>';
  }
  function maxStars() { return E.MODES.length * E.LEVELS.length * 3; }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function applyPrefs() {
    SFX.setEnabled(!!S.settings.sfx);
    SFX.setVolume(S.settings.volume);
    var st = E.streak(S), hs = document.getElementById('hdr-streak');
    if (hs) {
      hs.querySelector('.num').textContent = st.days;
      hs.classList.toggle('is-lit', st.today);
      hs.title = st.days + '-day streak' + (st.today ? '' : '. Practice today to keep it.');
    }
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function tierOf(i) { return i >= 9 ? 'maestro' : i >= 6 ? 'gold' : i >= 3 ? 'silver' : 'bronze'; }
  function rankBadge(ri, size) {
    return '<span class="rank-badge t-' + tierOf(ri.index) + (size ? ' ' + size : '') + '" aria-hidden="true"><span class="num">' + ri.n + '</span></span>';
  }
  function ring(frac, cls) {
    var p = Math.max(0, Math.min(1, frac)) * 100;
    return '<svg class="ring' + (cls ? ' ' + cls : '') + '" viewBox="0 0 44 44" aria-hidden="true"><circle class="ring-bg" cx="22" cy="22" r="18"/>' +
      '<circle class="ring-fg" cx="22" cy="22" r="18" pathLength="100" style="--p:' + p.toFixed(1) + '"/></svg>';
  }
  function xpBar(frac, from) {
    return '<div class="xpbar" role="presentation"><span style="--p:' + Math.max(0, Math.min(1, frac)).toFixed(4) + (from !== undefined ? ';--from:' + Math.max(0, Math.min(1, from)).toFixed(4) : '') + '"></span></div>';
  }
  function xpLine(ri) {
    return '<p class="xp-line"><span class="num">' + fmt(ri.xp) + ' XP</span><span>' +
      (ri.next !== null ? '<span class="num">' + fmt(ri.toNext) + '</span> to ' + esc(ri.nextName) : 'Top rank reached') + '</span></p>';
  }

  // ------------------------------------------------------------ audio
  function applyAudioSettings() { try { A.setVolume(S.settings.volume); } catch (e) {} SFX.setVolume(S.settings.volume); }
  function ensureAudio() {
    if (audioReady) return Promise.resolve();
    applyAudioSettings();
    var inst = baseInstrument();
    A.setInstrument(inst);
    return A.init().then(function () {
      audioReady = true;
      return A.prewarm();
    }).then(function () {
      if (S.settings.instrument === 'mix') {
        A.setInstrument(inst === 'guitar' ? 'piano' : 'guitar');
        return A.prewarm().then(function () { A.setInstrument(inst); });
      }
    }).catch(function () { audioReady = true; });
  }
  function instrumentFor(q) {
    if (q.inst) return q.inst;                         // Master level: random per question
    if (S.settings.instrument !== 'mix') return S.settings.instrument;
    q.inst = Math.random() < 0.5 ? 'guitar' : 'piano';
    return q.inst;
  }
  // iOS: audio may only start inside a user gesture. Unlock both contexts on the very first tap.
  function firstTap() {
    document.removeEventListener('pointerdown', firstTap, true);
    document.removeEventListener('keydown', firstTap, true);
    try { A.init().catch(function () {}); } catch (e) {}
    SFX.unlock();
  }
  document.addEventListener('pointerdown', firstTap, true);
  document.addEventListener('keydown', firstTap, true);
  function baseInstrument() { return S.settings.instrument === 'piano' ? 'piano' : 'guitar'; }
  var playBtn = null;
  function setPlaying(v) {
    playing = v;
    var b = document.getElementById('replay');
    if (b) b.classList.toggle('is-playing', v);
    if (!v && playBtn) { playBtn.classList.remove('is-playing'); playBtn = null; }
  }
  function play(items, inst, btn) {
    A.stop();
    if (playBtn) playBtn.classList.remove('is-playing');
    if (inst) A.setInstrument(inst);
    setPlaying(true);
    playBtn = btn || null;
    if (playBtn) playBtn.classList.add('is-playing');
    var p = items.length === 1 ? A.playInterval(items[0].rootMidi, items[0].semitones, items[0].mode) : A.playSequence(items, 0.55);
    var mine = playBtn;
    return p.then(function (ok) { if (playBtn === mine) setPlaying(false); return ok; }, function () { if (playBtn === mine) setPlaying(false); });
  }
  function replaysLeft() {
    if (!sess || !sess.lv || sess.q.answered) return Infinity;
    return Math.max(0, 1 + sess.lv.replays - sess.q.plays);
  }
  function playQuestion(isReplay) {
    if (!sess || !sess.q) return;
    var q = sess.q;
    if (isReplay && replaysLeft() <= 0) { toast('No replays left on this level.'); return; }
    if (!q.answered) q.plays++;
    play([{ rootMidi: q.root, semitones: q.semis, mode: q.stage }], instrumentFor(q));
    var rl = app.querySelector('.replays-left');
    if (rl && sess.lv && sess.lv.replays !== Infinity) rl.outerHTML = replayInfo();
  }
  function cueNotes() {
    var q = sess.q, m = E.modeById(sess.scale);
    if (sess.lv.cue === 'chord') {
      var third = m.semis.indexOf(4) >= 0 ? 4 : 3, fifth = m.semis.indexOf(7) >= 0 ? 7 : 6;
      return { midis: [q.root, q.root + third, q.root + fifth], step: 0.03 };
    }
    return { midis: [q.root].concat(m.semis.map(function (x) { return q.root + x; })), step: 0.18 };
  }
  function playCue() {
    if (!sess || !sess.scale || !sess.q) return Promise.resolve(false);
    var q = sess.q, c = cueNotes();
    A.stop();
    A.setInstrument(instrumentFor(q));
    setPlaying(true);
    return A.playNotes(c.midis, c.step).then(function (ok) { setPlaying(false); return ok; }, function () { setPlaying(false); return false; });
  }
  function playFrom(semis) {
    var q = sess.q;
    play([{ rootMidi: q.root, semitones: semis, mode: q.stage }], instrumentFor(q));
  }
  function playContrast() {
    var q = sess.q;
    play([
      { rootMidi: q.root, semitones: fb.guess, mode: q.stage },
      { rootMidi: q.root, semitones: q.semis, mode: q.stage }
    ], instrumentFor(q));
  }
  function sample(semis, stage, btn) {
    ensureAudio().then(function () {
      A.setNoteLength(1);
      var root = 48 + Math.floor(Math.random() * 8);
      play([{ rootMidi: root, semitones: semis, mode: stage || 'up' }], baseInstrument(), btn);
    });
  }
  function libPlay(semis, mode, btn) {
    ensureAudio().then(function () {
      A.setNoteLength(1);
      play([{ rootMidi: libRoot, semitones: semis, mode: mode }], baseInstrument(), btn);
    });
  }
  /** Effect sounds never overlap an interval: stop it first. */
  function sfx(name) { try { A.stop(); } catch (e) {} setPlaying(false); return SFX.play(name); }

  // ------------------------------------------------------------ navigation
  function go(v) {
    clearTimeout(askTimer);
    if (v !== 'practice') { try { A.stop(); } catch (e) {} setPlaying(false); }
    view = v;
    render();
    window.scrollTo(0, 0);
  }
  var lastView = null;
  function render() {
    document.body.dataset.view = view;
    var fresh = view !== lastView || (view === 'practice' && sess && sess.q && !sess.q.answered && !sess.q.hinted && sess.q.plays === 0);
    lastView = view;
    if (fresh) { app.classList.remove('animate'); void app.offsetWidth; app.classList.add('animate'); }
    else app.classList.remove('animate');
    var html = '';
    if (view === 'home') html = homeView();
    else if (view === 'free') html = freeView();
    else if (view === 'modes') html = modesView();
    else if (view === 'mode') html = modeView();
    else if (view === 'practice') html = practiceView();
    else if (view === 'summary') html = summaryView();
    else if (view === 'progress') html = progressView();
    else if (view === 'library') html = libraryView();
    else if (view === 'awards') html = awardsView();
    app.innerHTML = html;
    applyPrefs();
    if (fresh) countUp();
  }
  /** Animate [data-count] numbers from data-from to their value. */
  function countUp() {
    var els = app.querySelectorAll('[data-count]');
    if (!els.length) return;
    if (RM.matches) return;
    els.forEach(function (el) {
      var to = +el.dataset.count, from = +(el.dataset.from || 0), t0 = null, dur = 900;
      el.textContent = fmt(from);
      function step(ts) {
        if (!t0) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step);
      }
      setTimeout(function () { requestAnimationFrame(step); }, +(el.dataset.delay || 250));
    });
  }

  // ------------------------------------------------------------ shared bits
  function meter(label, valueText, frac, ok, goalText) {
    frac = Math.max(0, Math.min(1, frac || 0));
    return '<div class="cell meter' + (ok ? ' is-ok' : '') + '">' +
      '<div class="meter-top"><span>' + label + '</span><span class="meter-val num">' + (ok ? '<span class="meter-check">' + I.check + '</span>' : '') + valueText +
      (goalText ? ' <span class="goal">' + goalText + '</span>' : '') + '</span></div>' +
      '<div class="meter-track"><div class="meter-fill" style="width:' + (frac * 100).toFixed(1) + '%"></div></div></div>';
  }
  function unlockBlock(stage) {
    var r = E.readiness(S, stage);
    if (r.mastered) return '<h2 class="group-label">Next unlock</h2><div class="group"><div class="cell"><span class="cell-sub">All twelve intervals are mastered at this stage.</span></div></div>';
    var target = r.next !== null ? info(r.next).name : 'Stage complete';
    var eachText, eachFrac, eachOk = r.eachOk;
    if (r.unproven.length) {
      eachText = r.unproven.length === 1 ? code(r.unproven[0]) + ' needs more answers' : 'Needs more answers';
      eachFrac = 0.4;
    } else if (r.weakest) {
      eachText = code(r.weakest.semis) + ' ' + pct(r.weakest.acc);
      eachFrac = r.weakest.acc / r.needEach;
    } else { eachText = '–'; eachFrac = 0; }
    return '<h2 class="group-label">' + (r.next !== null ? 'Next unlock' : 'Last step') + '</h2>' +
      '<div class="group unlock">' +
      '<div class="cell unlock-head">' + (r.next !== null ? badge(r.next, 'is-ghost') : '') + '<span class="cell-title">' + esc(target) + '</span>' + I.lock + '</div>' +
      meter('Answers since last unlock', Math.min(r.since, r.needSince) + ' / ' + r.needSince, r.since / r.needSince, r.sinceOk) +
      meter('Accuracy, last 20', r.recentN ? pct(r.recentAcc) : '–', r.recentN ? r.recentAcc / r.needAcc * (r.recentN / 20) : 0, r.accOk, r.recentN && r.recentN < 20 ? r.recentN + ' answers' : 'goal 90%') +
      meter('Weakest interval', eachText, eachFrac, eachOk, r.unproven.length ? '' : 'goal 75%') +
      '</div>' +
      '<p class="group-foot">' + HINT_RULE + '</p>';
  }
  function backBtn(label, action) {
    return '<button class="back" type="button" data-action="' + (action || 'home') + '">' + I.back + '<span>' + (label || 'Home') + '</span></button>';
  }
  function fretCard(rootMidi, semis, mode, extraClass) {
    var inf = info(semis), f = FB.render(rootMidi, semis, { mode: mode });
    var isHint = extraClass === 'is-hint';
    return '<div class="fret-card' + (extraClass ? ' ' + extraClass : '') + '">' +
      '<div class="fret-scroll">' + f.svg + '</div>' +
      '<div class="fret-meta"><span class="legend"><span class="lg lg-root"></span>Root</span><span class="legend"><span class="lg lg-target"></span>' + (isHint ? 'Second note' : esc(inf.short)) + '</span>' +
      '<span class="fret-caption num">' + esc(f.caption) + '</span></div>' +
      '<p class="fret-desc">' + esc(f.desc) + '</p>' +
      (isHint ? '' : '<p class="fret-tip">' + esc(inf.guitar.tip) + '</p>') + '</div>';
  }

  // ------------------------------------------------------------ home
  function rankCard(link) {
    var ri = E.rankInfo(S.xp), st = E.streak(S), tx = E.todayXp(S), ts = E.totalStars(S);
    var goalHit = tx >= E.DAILY_GOAL;
    return '<div class="rank-card">' +
      '<' + (link ? 'button type="button" data-action="awards"' : 'div') + ' class="rank-top">' + rankBadge(ri, 'lg') +
      '<span class="rank-text"><span class="rank-k">Rank ' + ri.n + ' of ' + E.RANKS.length + '</span><span class="rank-name">' + esc(ri.name) + '</span></span>' +
      (link ? I.chev + '</button>' : '</div>') +
      xpBar(ri.frac) + xpLine(ri) +
      '<div class="today">' +
      '<div class="today-item">' + ring(tx / E.DAILY_GOAL, goalHit ? 'is-done' : '') +
      '<span class="today-text"><span class="today-v num">' + (goalHit ? E.DAILY_GOAL : fmt(tx)) + '<small>/' + E.DAILY_GOAL + (goalHit ? ' \u2713' : '') + '</small></span><span class="today-l">' + (goalHit ? 'Goal met today' : 'Daily goal') + '</span></span></div>' +
      '<div class="today-item"><span class="today-ic flame' + (st.today ? ' is-lit' : '') + '">' + I.flame + '</span>' +
      '<span class="today-text"><span class="today-v num">' + st.days + '</span><span class="today-l">' + (st.days && !st.today ? 'Practice to keep it' : 'Day streak') + '</span></span></div>' +
      '<div class="today-item"><span class="today-ic gold">' + I.star + '</span>' +
      '<span class="today-text"><span class="today-v num">' + ts + '</span><span class="today-l">Stars</span></span></div>' +
      '</div></div>';
  }
  function homeView() {
    var stage = S.guided, list = E.active(S, stage);
    var first = S.total === 0, ts = E.totalStars(S);
    var achN = Object.keys(S.ach).length;
    var rows = list.map(function (semis) {
      var i = info(semis), a = E.accuracy(S, stage, semis);
      return '<button class="cell cell-btn" type="button" data-action="sample" data-semis="' + semis + '" data-stage="' + stage + '">' +
        badge(semis) + '<span class="cell-title">' + esc(i.name) + '</span>' +
        '<span class="cell-value num">' + (a.n ? pct(a.acc) : 'New') + '</span>' +
        '<span class="mini-play">' + I.play + '</span></button>';
    }).join('');
    return '<section class="screen home"><div class="home-grid"><div class="home-main">' +
      rankCard(true) +
      '<div class="path-card">' +
      '<p class="kicker">Guided path · Stage ' + stageIndex(stage) + ' of 3 · ' + list.length + ' intervals</p>' +
      '<h1 class="hero-title">' + E.STAGE_LABEL[stage] + '</h1>' +
      (first
        ? '<p class="lede">Hear two notes, name the gap. Start with three intervals; new ones unlock as your ear grows.</p>'
        : '<p class="lede">30 questions, about six minutes. New intervals unlock as you improve.</p>') +
      '<button class="btn btn-primary btn-xl" type="button" data-action="start"><span class="btn-ic">' + I.play + '</span><span>' + (first ? 'Start your first session' : 'Start session') + '</span></button>' +
      '</div></div>' +
      '<div class="home-side">' +
      '<div class="group menu">' +
      '<button class="cell cell-btn menu-row" type="button" data-action="modes"><span class="tile t-accent">' + I.modes + '</span>' +
      '<span class="cell-text"><span class="cell-title">Game modes</span><span class="cell-sub">13 scales and modes, 5 levels each</span></span>' +
      '<span class="cell-value num gold-num">' + I.star + ts + '<small>/' + maxStars() + '</small></span>' + I.chev + '</button>' +
      '<button class="cell cell-btn menu-row" type="button" data-action="awards"><span class="tile t-gold">' + I.trophy + '</span>' +
      '<span class="cell-text"><span class="cell-title">Ranks and achievements</span><span class="cell-sub">Your ladder and badges</span></span>' +
      '<span class="cell-value num">' + achN + '<small>/' + E.ACHIEVEMENTS.length + '</small></span>' + I.chev + '</button>' +
      '<button class="cell cell-btn menu-row" type="button" data-action="library"><span class="tile t-blue">' + I.lib + '</span>' +
      '<span class="cell-text"><span class="cell-title">Interval library</span><span class="cell-sub">Hear all 12, with songs and guitar shapes</span></span>' + I.chev + '</button>' +
      '<button class="cell cell-btn menu-row" type="button" data-action="free"><span class="tile t-gray">' + I.sliders + '</span>' +
      '<span class="cell-text"><span class="cell-title">Free practice</span><span class="cell-sub">Pick direction and intervals yourself</span></span>' + I.chev + '</button>' +
      '</div>' +
      '<h2 class="group-label"><span>Your intervals</span><span class="group-aside">Tap to hear</span></h2>' +
      '<div class="group">' + rows + '</div>' +
      unlockBlock(stage) +
      '</div></div></section>';
  }

  // ------------------------------------------------------------ free practice
  function freeView() {
    var f = S.free;
    var stagesHtml = E.STAGES.map(function (id) {
      return '<label><input type="radio" name="free-stage" value="' + id + '"' + (f.stage === id ? ' checked' : '') + '><span>' + E.STAGE_SHORT[id] + '</span></label>';
    }).join('');
    var rows = ALL.map(function (semis) {
      var i = info(semis), on = f.pool.indexOf(semis) >= 0;
      return '<button class="cell cell-btn cell-check' + (on ? ' is-on' : '') + '" type="button" role="checkbox" aria-checked="' + on + '" data-action="free-toggle" data-semis="' + semis + '">' +
        badge(semis) + '<span class="cell-title">' + esc(i.name) + '</span><span class="check">' + I.check + '</span></button>';
    }).join('');
    var n = f.pool.length, need = E.MIN_POOL;
    return '<section class="screen free">' + backBtn() +
      '<div class="title-block"><h1>Free practice</h1>' +
      '<p class="lede">Choose the direction and intervals. Answers count in your stats but do not unlock new intervals.</p></div>' +
      '<h2 class="group-label">Direction</h2>' +
      '<div class="seg" id="free-stage" role="radiogroup" aria-label="Direction">' + stagesHtml + '</div>' +
      '<h2 class="group-label"><span>Intervals</span><span class="group-tools">' +
      '<button class="link" type="button" data-action="free-unlocked">Unlocked</button>' +
      '<button class="link" type="button" data-action="free-all">All</button></span></h2>' +
      '<div class="group">' + rows + '</div>' +
      '<div class="actions sticky-actions">' +
      (n < need ? '<p class="need-hint">Pick at least ' + need + '. The same interval never comes twice in a row, so with two the answer would just alternate.</p>' : '') +
      '<button class="btn btn-primary btn-lg" type="button" data-action="start-free"' + (n < need ? ' disabled' : '') + '>' +
      (n < need ? 'Choose ' + (need - n) + ' more' : 'Start with ' + n + ' intervals') + '</button></div>' +
      '</section>';
  }

  // ------------------------------------------------------------ game modes
  function modesView() {
    var ts = E.totalStars(S);
    var groups = E.MODE_GROUPS.map(function (g) {
      var rows = E.MODES.filter(function (m) { return m.group === g; }).map(function (m) {
        var ms = E.modeStars(S, m.id), pips = '';
        for (var n = 1; n <= E.LEVELS.length; n++) {
          var r = E.levelRow(S, m.id, n), un = E.levelUnlocked(S, m.id, n);
          pips += '<span class="pip' + (r && r.stars ? ' s' + r.stars : un ? ' open' : '') + '"></span>';
        }
        var done = ms === E.LEVELS.length * 3;
        return '<button class="cell cell-btn mode-row' + (done ? ' is-mastered' : '') + '" type="button" data-action="open-mode" data-mode="' + m.id + '">' +
          '<span class="mode-main"><span class="cell-title mode-name">' + esc(m.name) + '</span><span class="mode-mood">' + esc(m.mood) + '</span></span>' +
          '<span class="mode-side">' + (done ? '<span class="mastered">' + I.check + 'Mastered</span>' : '<span class="mode-stars num">' + I.star + ms + '<small>/15</small></span>') +
          '<span class="pips" aria-hidden="true">' + pips + '</span></span>' + I.chev + '</button>';
      }).join('');
      return '<div class="mgroup"><h2 class="group-label">' + g + '</h2><div class="group">' + rows + '</div></div>';
    }).join('');
    return '<section class="screen modes">' + backBtn() +
      '<div class="title-block"><h1>Game modes</h1>' +
      '<p class="lede">Pick a scale. You only hear its intervals, measured from the tonic, in a new key every question. Five levels, ' + E.LEVEL_LEN + ' questions each.</p></div>' +
      '<div class="total-bar"><span class="total-ic">' + I.star + '</span><span class="total-n num">' + ts + '<small> / ' + maxStars() + '</small></span>' +
      '<span class="total-track"><span style="--p:' + (ts / maxStars()).toFixed(4) + '"></span></span></div>' +
      '<div class="mode-groups">' + groups + '</div>' +
      '<p class="group-foot">Stars: 1 at 70%, 2 at 85%, 3 at 95%. One star opens the next level. Hinted answers count as wrong for stars.</p>' +
      '</section>';
  }

  function modeView() {
    var m = E.modeById(curMode), ms = E.modeStars(S, m.id);
    var nextOpen = 0;
    for (var k = 1; k <= E.LEVELS.length; k++) { var rr = E.levelRow(S, m.id, k); if (E.levelUnlocked(S, m.id, k) && !(rr && rr.stars)) { nextOpen = k; break; } }
    var nodes = E.LEVELS.map(function (L, idx) {
      var r = E.levelRow(S, m.id, L.n), un = E.levelUnlocked(S, m.id, L.n);
      var cls = 'lvl' + (un ? '' : ' is-locked') + (r && r.stars ? ' is-done' : '') + (L.n === nextOpen ? ' is-next' : '') + (r && r.stars === 3 ? ' is-perfect' : '');
      return '<li class="' + cls + '" style="--i:' + idx + '">' +
        '<button class="lvl-btn" type="button" data-action="start-level" data-mode="' + m.id + '" data-level="' + L.n + '"' + (un ? '' : ' disabled aria-disabled="true"') + ' aria-label="Level ' + L.n + ', ' + L.name + (un ? '' : ', locked') + '">' +
        '<span class="lvl-node num">' + (un ? L.n : I.lock) + '</span>' +
        '<span class="lvl-card"><span class="lvl-top"><span class="lvl-name">' + L.name + '</span>' + stars(r ? r.stars : 0, 3, 'sm') + '</span>' +
        '<span class="lvl-desc">' + L.desc + '</span>' +
        '<span class="lvl-meta num">' + (r ? 'Best ' + r.best + '% · ' + r.runs + (r.runs === 1 ? ' run' : ' runs') : un ? (L.n === nextOpen ? 'Ready. Tap to play' : 'Not played yet') : 'Earn 1 star on level ' + (L.n - 1)) + '</span>' +
        '</span></button></li>';
    }).join('');
    var chips = m.semis.map(function (x) { return '<span class="chip">' + code(x) + '</span>'; }).join('');
    var done = ms === E.LEVELS.length * 3;
    return '<section class="screen mode">' + backBtn('All modes', 'modes') +
      '<div class="title-block"><p class="kicker">' + m.group + ' · ' + esc(m.mood) + '</p><h1>' + esc(m.name) + '</h1>' +
      '<p class="lede">' + esc(m.moodLong) + '</p>' +
      '<div class="mastery' + (done ? ' is-done' : '') + '"><div class="mastery-top"><span class="mode-stars big num">' + I.star + ms + '<small>/15</small></span>' +
      (done ? '<span class="mastered">' + I.check + 'Mastered</span>' : '<span class="mastery-l">' + (15 - ms) + ' stars to mastery</span>') + '</div>' +
      '<span class="total-track"><span style="--p:' + (ms / 15).toFixed(4) + '"></span></span></div>' +
      '<div class="chips">' + chips + '</div></div>' +
      '<ol class="map">' + nodes + '</ol>' +
      '</section>';
  }

  // ------------------------------------------------------------ practice
  function sessTitle() {
    if (sess.scale) return esc(sess.scaleName);
    return E.STAGE_LABEL[sess.stage];
  }
  function sessSub() {
    if (sess.scale) return 'Level ' + sess.level + ' · ' + sess.lv.name;
    return sess.guided ? 'Stage ' + stageIndex(sess.stage) : 'Free practice';
  }
  function segBar() {
    var o = '';
    for (var i = 0; i < sess.length; i++) {
      var a = sess.answers[i], c = a ? (a.hinted ? ' h' : a.correct ? ' ok' : ' bad') : (i === sess.answers.length ? ' cur' : '');
      o += '<span class="seg-b' + c + '"></span>';
    }
    return '<div class="segbar" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="' + sess.length + '" aria-valuenow="' + sess.answers.length + '">' + o + '</div>';
  }
  function replayInfo() {
    if (!sess.lv || sess.lv.replays === Infinity || sess.q.answered) return '<span class="replays-left" hidden></span>';
    var left = replaysLeft();
    return '<span class="replays-left' + (left ? '' : ' is-out') + '">' + (left ? left + ' replay left' : 'No replays left') + '</span>';
  }
  function practiceView() {
    var q = sess.q, pool = E.poolOf(S, sess);
    var num = Math.min(sess.answers.length + (q.answered ? 0 : 1), sess.length);
    var boost = sess.guided && S.stages[sess.stage].boost ? S.stages[sess.stage].boost.semis : null;
    var anim = fb && fb.anim;
    var grid = pool.map(function (semis, i) {
      var cls = 'answer';
      if (q.answered) {
        if (semis === q.semis) cls += ' is-correct';
        else if (semis === fb.guess) cls += ' is-wrong';
        else cls += ' is-dim';
      }
      var inf = info(semis);
      return '<button class="' + cls + '" type="button" data-action="answer" data-semis="' + semis + '">' +
        '<span class="answer-code">' + inf.short + '</span>' +
        '<span class="answer-name">' + esc(inf.name) + '</span>' +
        (KEYS[i] ? '<kbd class="answer-key">' + KEYS[i] + '</kbd>' : '') +
        (semis === boost ? '<span class="answer-new">New</span>' : '') +
        (anim && fb.correct && semis === q.semis && fb.xp ? '<span class="xp-pop" aria-hidden="true">+' + fb.xp + ' XP</span>' : '') +
        '</button>';
    }).join('');
    var hintAllowed = !sess.lv || sess.lv.hints;
    var hint = '';
    if (!q.answered && hintAllowed) {
      hint = q.hinted
        ? '<div class="hint-panel">' + fretCard(q.root, q.semis, q.stage, 'is-hint') + '<p class="hint-note">Hint used. ' + HINT_RULE + '</p></div>'
        : '<button class="pill-btn small" type="button" data-action="hint">' + I.guitar + '<span>Fretboard hint</span><kbd class="kbd-desk">F</kbd></button>';
    }
    var combo = sess.combo >= 2 ? '<span class="combo' + (anim && fb.correct ? ' bump' : '') + (sess.combo >= 5 ? ' hot' : '') + '" aria-label="Combo ' + sess.combo + '">' + I.flame + '<span class="num">x' + sess.combo + '</span></span>' : '';
    var dirWord = q.stage === 'harmonic' ? 'together' : q.stage === 'down' ? 'falling' : 'rising';
    var cueBtn = sess.scale && sess.lv.n <= 4 ? '<button class="pill-btn small" type="button" data-action="hear-cue">' + I.modes + '<span>' + (sess.lv.cue === 'chord' ? 'Hear chord' : 'Hear scale') + '</span><kbd class="kbd-desk">H</kbd></button>' : '';
    return '<section class="screen practice">' +
      '<div class="session-bar">' +
      '<button class="icon-btn" type="button" data-action="quit" aria-label="End session" title="End session (Esc)">' + I.x + '</button>' +
      '<div class="session-mid"><div class="session-title"><span class="st-main">' + sessTitle() + '</span><span class="st-sub">' + sessSub() + '</span></div>' + segBar() + '</div>' +
      '<span class="session-count num"><span>' + num + '<small>/' + sess.length + '</small></span><span class="session-xp">' + I.bolt + fmt(sess.xp) + '</span></span>' +
      '</div>' +
      '<div class="listen' + (q.answered ? (fb.correct ? ' is-ok' : ' is-bad') : '') + '">' +
      '<div class="listen-tags"><span class="dir-tag dir-' + q.stage + '">' + (sess.scale && sess.lv.dirs.length > 1 && !q.answered ? '?' : dirWord) + '</span>' + combo + '</div>' +
      '<button id="replay" class="play' + (playing ? ' is-playing' : '') + '' + '" type="button" data-action="replay" aria-label="Play the interval again">' +
      '<span class="play-face">' + I.play + '</span><span class="play-wave" aria-hidden="true"></span></button>' +
      '<p class="listen-q">' + (q.answered ? 'Tap any interval to compare' : 'What do you hear?') + '</p>' +
      '<p class="listen-sub">' + (q.answered ? 'Same root, played the same way' : '<span class="kbd-desk"><kbd>Space</kbd> replays</span><span class="kbd-touch">Tap to replay</span>') + ' ' + replayInfo() + '</p>' +
      '</div>' +
      (cueBtn || (hint && !q.hinted) ? '<div class="mode-tools">' + cueBtn + (q.hinted ? '' : hint) + '</div>' : '') +
      (q.hinted ? hint : '') +
      '<div class="answers" data-n="' + pool.length + '">' + grid + '</div>' +
      (q.answered ? feedbackView() : '') +
      '</section>';
  }

  function anchorView(q) {
    var inf = info(q.semis), dir = q.stage === 'down' ? 'down' : 'up';
    var list = inf[dir] || [], note = '';
    if (q.stage === 'harmonic') note = 'Together: sing the lower note, then the upper one.';
    if (dir === 'down' && !list.length) { list = inf.up; note = 'No well-known song goes down. Use the upward anchor and hear it in reverse.'; }
    var hidden = E.anchorsHidden(S, q.stage, q.semis) && !showAnchorAnyway;
    var head = '<h3 class="group-label">Song anchor · ' + (dir === 'down' && inf.down.length ? 'down' : 'up') + '</h3>';
    if (hidden) {
      return '<div class="fb-anchor">' + head + '<div class="group"><div class="cell"><span class="cell-sub">Hidden: you are above 90% on this interval, so your ear knows it now. ' +
        '<button class="link" type="button" data-action="show-anchor">Show anyway</button></span></div></div></div>';
    }
    return '<div class="fb-anchor">' + head + '<div class="group">' + songCells(list, '') + '</div>' + (note ? '<p class="group-foot">' + note + '</p>' : '') + '</div>';
  }

  var SONGS_VISIBLE = 3, songSeq = 0;
  var TAG_LABEL = { film: 'Film', pop: 'Pop', riff: 'Riff', game: 'Game', norwegian: 'Norwegian', christmas: 'Christmas', classical: 'Classical', kids: 'Kids' };
  function songCells(list, dirLabel) {
    var id = 'songs-' + (++songSeq), extra = list.length - SONGS_VISIBLE;
    var rows = list.map(function (x, i) {
      var tag = TAG_LABEL[x.tag] ? '<span class="song-tag">' + TAG_LABEL[x.tag] + '</span>' : '';
      return '<div class="cell song"' + (i >= SONGS_VISIBLE ? ' data-more="' + id + '" hidden' : '') + '>' +
        (dirLabel ? '<span class="dir">' + dirLabel + '</span>' : '') +
        '<span class="cell-text"><span class="cell-title">' + esc(x.song) + '</span><span class="cell-sub">' + esc(x.note) + '</span></span>' + tag + '</div>';
    }).join('');
    if (extra > 0) rows += '<button class="cell cell-btn more-songs" type="button" data-action="more-songs" data-target="' + id + '">' +
      (dirLabel ? '<span class="dir" aria-hidden="true"></span>' : '') + '<span class="cell-title">More songs (' + extra + ')</span>' + I.chev + '</button>';
    return rows;
  }

  function feedbackView() {
    var q = sess.q, head;
    var tag = q.hinted ? '<span class="tag">Hinted</span>' : '';
    var dirTxt = q.stage === 'harmonic' ? 'together' : q.stage === 'down' ? 'falling' : 'rising';
    if (fb.correct) {
      head = '<div class="result is-ok"><span class="result-icon">' + I.check + '</span>' +
        '<div class="result-text"><p class="result-title">' + (q.hinted ? 'Correct' : sess.combo >= 5 ? 'On fire!' : sess.combo >= 3 ? 'Nice streak!' : 'Correct!') + tag + '</p><p class="result-sub">' + esc(full(q.semis)) + ', ' + dirTxt + '</p></div></div>';
    } else {
      head = '<div class="result is-bad"><span class="result-icon">' + I.x + '</span>' +
        '<div class="result-text"><p class="result-title">Not quite' + tag + '</p><p class="result-sub">You answered <strong>' + esc(full(fb.guess)) + '</strong>. It was <strong>' + esc(full(q.semis)) + '</strong>, ' + dirTxt + '.</p></div></div>' +
        '<div class="contrast">' +
        '<button class="btn btn-tinted is-bad" type="button" data-action="play-guess">' + I.play + '<span>You said ' + code(fb.guess) + '</span></button>' +
        '<button class="btn btn-tinted is-ok" type="button" data-action="play-correct">' + I.play + '<span>Correct ' + code(q.semis) + '</span></button>' +
        '<button class="btn btn-plain" type="button" data-action="play-both">Play both again</button>' +
        '</div>';
    }
    var unlock = '';
    if (fb.ev && fb.ev.unlocked !== null) {
      unlock = '<div class="unlocked" role="status"><div class="unlocked-text"><p class="unlocked-k">New interval unlocked</p><p class="unlocked-name">' + esc(full(fb.ev.unlocked)) + '</p>' +
        '<p class="unlocked-sub">It will come up more often for the next sessions.</p></div>' +
        '<button class="btn btn-tinted" type="button" data-action="sample" data-semis="' + fb.ev.unlocked + '" data-stage="' + q.stage + '">' + I.play + '<span>Hear it</span></button></div>';
    } else if (fb.ev && fb.ev.mastered) {
      unlock = '<div class="unlocked" role="status"><div class="unlocked-text"><p class="unlocked-k">Stage complete</p><p class="unlocked-name">' + E.STAGE_LABEL[fb.ev.mastered] + '</p>' +
        (fb.ev.opened ? '<p class="unlocked-sub">Your next session starts ' + E.STAGE_LABEL[fb.ev.opened].toLowerCase() + ' with four intervals.</p>' : '<p class="unlocked-sub">You have completed all three stages.</p>') + '</div></div>';
    }
    var last = sess.answers.length >= sess.length;
    return '<div class="next-row" id="feedback">' + head + '</div>' +
      '<div class="feedback">' + unlock +
      '<div class="fb-learn">' + anchorView(q) +
      '<div class="fb-guitar"><h3 class="group-label">On guitar</h3>' + fretCard(q.root, q.semis, q.stage) + '</div></div>' +
      '</div>' +
      '<div class="next-bar"><button class="btn btn-primary btn-lg btn-next" type="button" data-action="next" id="next">' +
      '<span>' + (last ? 'See results' : 'Next question') + '</span><kbd class="kbd-desk">Enter</kbd>' + I.chev + '</button></div>';
  }

  // ------------------------------------------------------------ summary
  function summaryView() {
    var sum = E.summarize(S, sess);
    var rows = sum.rows.map(function (r) {
      return '<div class="cell stat-row">' + badge(r.semis) + '<span class="cell-title">' + esc(info(r.semis).name) + '</span>' +
        '<span class="rbar"><span style="width:' + (r.acc * 100) + '%"></span></span><span class="num cell-value">' + r.ok + '/' + r.n + '</span></div>';
    }).join('');
    var notes = [];
    if (sum.weakest) notes.push('<div class="cell"><span class="cell-title">Weakest</span><span class="cell-value">' + esc(full(sum.weakest.semis)) + ' <span class="num muted">' + pct(sum.weakest.acc) + '</span></span></div>');
    if (sum.confusion) notes.push('<div class="cell"><span class="cell-title">Biggest mix-up</span><span class="cell-value">' + code(sum.confusion.correct) + ' heard as ' + code(sum.confusion.guess) + ' <span class="num muted">' + sum.confusion.count + '×</span></span></div>');
    if (sum.hinted) notes.push('<div class="cell"><span class="cell-title">With fretboard hint</span><span class="cell-value num">' + sum.hinted + '</span></div>');
    if (sess.bestCombo >= 2) notes.push('<div class="cell"><span class="cell-title">Best combo</span><span class="cell-value num">x' + sess.bestCombo + '</span></div>');
    if (!sum.weakest && !sum.confusion) notes.push('<div class="cell"><span class="cell-title">Mistakes</span><span class="cell-value">None. Clean run.</span></div>');

    var res = sess.result, complete = sess.answers.length >= sess.length;
    var top, actions;
    if (sess.scale && res) {
      var msg = res.stars === 3 ? (res.pct === 100 ? 'Perfect!' : 'Superb!') : res.stars === 2 ? 'Great run!' : res.stars === 1 ? 'Level clear!' : 'So close';
      var hasNext = sess.level < E.LEVELS.length && E.levelUnlocked(S, sess.scale, sess.level + 1);
      top = '<div class="win' + (res.stars === 3 ? ' is-perfect' : '') + '">' +
        '<p class="kicker">' + esc(sess.scaleName) + ' · Level ' + sess.level + ' · ' + sess.lv.name + '</p>' +
        stars(res.stars, 3, 'big pop') +
        '<h1 class="win-title">' + msg + '</h1>' +
        '<p class="win-score num"><span>' + res.pct + '%</span> ' + res.ok + ' of ' + res.n + (sum.hinted ? ' · hints count as wrong' : '') + '</p>' +
        (res.newBest && res.runsBefore ? '<p class="badge-line">New best</p>' : '') +
        (res.unlockedNext ? '<p class="unlock-line">' + I.lock + 'Level ' + (sess.level + 1) + ' unlocked: ' + E.LEVELS[sess.level].name + '</p>' : '') +
        (res.stars === 0 ? '<p class="lede">You need 70% (' + Math.ceil(0.7 * res.n) + ' of ' + res.n + ') for the first star.</p>' : '') +
        '</div>';
      actions = (hasNext ? '<button class="btn btn-primary btn-lg" type="button" data-action="next-level">Level ' + (sess.level + 1) + ': ' + E.LEVELS[sess.level].name + '</button>' : '') +
        '<button class="btn ' + (hasNext ? 'btn-plain' : 'btn-primary') + ' btn-lg" type="button" data-action="again">Retry level</button>' +
        '<button class="btn btn-plain btn-lg" type="button" data-action="to-map">Level map</button>';
    } else {
      var score = sum.n ? sum.ok / sum.n : 0;
      var unlockedNow = sess.guided && S.stages[sess.stage].unlocked > sess.startedWith;
      top = '<div class="win">' +
        '<p class="kicker">' + (sess.scale ? esc(sess.scaleName) + ' · stopped early' : sess.guided ? E.STAGE_LABEL[sess.stage] : 'Free practice') + '</p>' +
        '<h1 class="win-title">' + (complete ? 'Session complete' : 'Session ended') + '</h1>' +
        '<p class="win-score num"><span>' + Math.round(score * 100) + '%</span> ' + sum.ok + ' of ' + sum.n + '</p>' +
        (unlockedNow ? '<p class="unlock-line">' + I.lock + 'Unlocked ' + E.ORDER.slice(sess.startedWith, S.stages[sess.stage].unlocked).map(full).map(esc).join(' and ') + '</p>' : '') +
        (sess.scale ? '<p class="lede">Finish all ' + sess.length + ' questions to earn stars.</p>' : '') +
        '</div>';
      actions = '<button class="btn btn-primary btn-lg" type="button" data-action="again">' + (sess.scale ? 'Retry level' : 'New session') + '</button>' +
        '<button class="btn btn-plain btn-lg" type="button" data-action="' + (sess.scale ? 'to-map' : 'home') + '">' + (sess.scale ? 'Level map' : 'Done for now') + '</button>';
    }
    return '<section class="screen summary">' + top + xpCard() +
      '<div class="actions">' + actions + '</div>' +
      '<div class="group">' + notes.join('') + '</div>' +
      (rows ? '<h2 class="group-label">By interval</h2><div class="group">' + rows + '</div>' : '') +
      (sess.guided ? unlockBlock(S.guided) : '') +
      '</section>';
  }
  /** XP earned this session + rank progress, animated from where the session started. */
  function xpCard() {
    var ri = E.rankInfo(S.xp), r0 = E.rankInfo(sess.xpStart), up = ri.index > r0.index;
    var parts = [];
    if (sess.xpAnswers) parts.push('<li><span>Correct answers</span><span class="num">+' + fmt(sess.xpAnswers) + '</span></li>');
    if (sess.xpCombo) parts.push('<li><span>Combo bonus</span><span class="num">+' + fmt(sess.xpCombo) + '</span></li>');
    if (sess.xpStars) parts.push('<li><span>' + (sess.result && sess.result.firstPerfect ? 'Stars + first 3-star bonus' : 'Star bonus') + '</span><span class="num">+' + fmt(sess.xpStars) + '</span></li>');
    if (sess.xpSession) parts.push('<li><span>Full session</span><span class="num">+' + fmt(sess.xpSession) + '</span></li>');
    var ach = (sess.newAch || []).map(function (a) {
      return '<li class="ach-chip"><span class="ach-ic">' + I.trophy + '</span><span><strong>' + esc(a.name) + '</strong><small>' + esc(a.desc) + '</small></span></li>';
    }).join('');
    return '<div class="xp-card">' +
      '<div class="xp-head"><span class="xp-gain"><span class="xp-bolt">' + I.bolt + '</span>+<span class="num" data-count="' + sess.xp + '">' + fmt(sess.xp) + '</span> XP</span>' +
      '<span class="xp-rank">' + rankBadge(ri, 'sm') + '<span>' + esc(ri.name) + (up ? ' <span class="new-tag">New rank</span>' : '') + '</span></span></div>' +
      xpBar(ri.frac, up ? 0 : r0.frac) + xpLine(ri) +
      (parts.length ? '<ul class="xp-break">' + parts.join('') + '</ul>' : '') +
      (ach ? '<p class="sub-label">Achievement' + (sess.newAch.length > 1 ? 's' : '') + ' unlocked</p><ul class="ach-new">' + ach + '</ul>' : '') +
      '</div>';
  }
  function celebrate() {
    var res = sess && sess.result, delay = 0;
    if (res) {
      SFX.play('level');
      for (var i = 0; i < res.stars; i++) (function (k) { setTimeout(function () { if (view === 'summary') SFX.play('star'); }, 420 + k * 330); })(i);
      delay = 420 + res.stars * 330;
      if (res.stars === 3 && !RM.matches) setTimeout(confetti, 420 + 2 * 330 + 120);
    }
    var ri = E.rankInfo(S.xp);
    if (ri.index > S.rankSeen) {
      S.rankSeen = ri.index; persist();
      setTimeout(function () { rankUp(ri); }, delay + 700);
    }
  }
  /** Full-screen rank-up moment. Esc, the button or a backdrop tap closes it. */
  function rankUp(ri) {
    if (document.querySelector('.rankup')) return;
    var el = document.createElement('div');
    el.className = 'rankup'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'rankup-t');
    el.innerHTML = '<div class="rankup-card">' + rankBadge(ri, 'xl') +
      '<p class="kicker">New rank</p><h2 id="rankup-t" class="rankup-name">' + esc(ri.name) + '</h2>' +
      '<p class="rankup-sub">Rank ' + ri.n + ' of ' + E.RANKS.length + '. ' + (ri.nextName ? fmt(ri.toNext) + ' XP to ' + esc(ri.nextName) + '.' : 'You reached the top of the ladder.') + '</p>' +
      '<button class="btn btn-primary btn-lg" type="button" data-action="close-rankup">Keep going</button></div>';
    document.body.appendChild(el);
    SFX.play('rank');
    if (!RM.matches) confetti();
    var b = el.querySelector('button'); if (b) b.focus({ preventScroll: true });
  }
  function closeRankUp() { var el = document.querySelector('.rankup'); if (el) el.remove(); }
  function confetti() {
    var box = document.createElement('div');
    box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    var colors = ['var(--gold)', 'var(--accent)', 'var(--ok)', 'var(--accent-2)', 'var(--gold-2)'];
    for (var i = 0; i < 70; i++) {
      var p = document.createElement('i');
      var w = 6 + Math.random() * 5, round = i % 3 === 0;
      p.style.cssText = 'left:' + (8 + Math.random() * 84).toFixed(1) + '%;width:' + w.toFixed(1) + 'px;height:' + (round ? w : w * 0.45).toFixed(1) + 'px;' +
        (round ? 'border-radius:50%;' : '') + 'background:' + colors[i % colors.length] +
        ';--dx:' + ((Math.random() - 0.5) * 220).toFixed(0) + 'px;--rot:' + Math.round((Math.random() - 0.5) * 900) + 'deg;--d:' + (1.8 + Math.random() * 1.2).toFixed(2) + 's;--delay:' + (Math.random() * 0.25).toFixed(2) + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 3600);
  }

  // ------------------------------------------------------------ progress
  function progressView() {
    var st = E.streak(S);
    var stagesHtml = E.STAGES.map(function (id) {
      var s = S.stages[id], status;
      if (s.mastered) status = '<span class="pill is-ok">Complete</span>';
      else if (s.open) status = '<span class="pill is-on">' + (S.guided === id ? 'Current' : 'Open') + '</span>';
      else status = '<span class="pill">Locked</span>';
      var rows = E.ORDER.map(function (semis, i) {
        var unlocked = s.open && i < s.unlocked, a = E.accuracy(S, id, semis);
        return '<div class="cell stat-row' + (unlocked ? '' : ' is-locked') + '">' + badge(semis) + '<span class="cell-title">' + esc(info(semis).name) + '</span>' +
          (unlocked
            ? '<span class="rbar"><span style="width:' + ((a.acc || 0) * 100) + '%"></span></span><span class="num cell-value">' + (a.n ? pct(a.acc) : '–') + '</span>'
            : '<span class="cell-value muted lock-ic">' + I.lock + '</span>') + '</div>';
      }).join('');
      var count = s.open ? s.unlocked : 0;
      return '<h2 class="group-label"><span>' + stageIndex(id) + '. ' + E.STAGE_LABEL[id] + '</span>' + status + '</h2>' +
        '<div class="group">' + rows + '</div>' +
        '<p class="group-foot">' + count + ' of 12 unlocked' + (s.open ? ' · accuracy over the last 20 answers per interval' : '') + '</p>';
    }).join('');
    return '<section class="screen progress">' + backBtn() +
      '<div class="title-block"><h1>Progress</h1></div>' +
      '<div class="stats">' +
      '<div><span class="stat-val num">' + st.days + '</span><span class="stat-label">Day streak</span></div>' +
      '<div><span class="stat-val num">' + E.totalStars(S) + '</span><span class="stat-label">Stars</span></div>' +
      '<div><span class="stat-val num">' + S.total + '</span><span class="stat-label">Answers</span></div>' +
      '<div><span class="stat-val num">' + fmt(S.xp) + '</span><span class="stat-label">Total XP</span></div></div>' +
      '<p class="group-foot">' + (st.days && !st.today ? 'Practice today to keep your streak. ' : '') + st.total + (st.total === 1 ? ' day' : ' days') + ' practiced. ' + (S.hinted ? S.hinted + (S.hinted === 1 ? ' answer' : ' answers') + ' used the fretboard hint. ' : '') + '</p>' +
      stagesHtml +
      '<h2 class="group-label">Reset</h2>' +
      '<div class="group"><button class="cell cell-btn danger' + (resetArmed ? ' is-armed' : '') + '" type="button" data-action="reset">' +
      '<span class="cell-title">' + (resetArmed ? 'Tap again to erase everything' : 'Reset progress') + '</span></button></div>' +
      '<p class="group-foot">Erases all progress, stats and stars. Settings are kept.</p>' +
      '</section>';
  }

  // ------------------------------------------------------------ ranks + achievements
  function awardsView() {
    var ri = E.rankInfo(S.xp);
    var ladder = E.RANKS.map(function (r, i) {
      var state = i < ri.index ? 'is-past' : i === ri.index ? 'is-current' : 'is-future';
      var rr = E.rankInfo(r.xp);
      return '<div class="cell rung ' + state + '">' + rankBadge(rr, 'sm') +
        '<span class="cell-text"><span class="cell-title">' + esc(r.name) + '</span>' +
        (i === ri.index ? '<span class="cell-sub">You are here' + (ri.next !== null ? ' · ' + Math.round(ri.frac * 100) + '% to the next rank' : '') + '</span>' : '') + '</span>' +
        '<span class="cell-value num">' + (i <= ri.index ? (i < ri.index ? I.check : '') : '') + fmt(r.xp) + ' XP</span></div>';
    }).join('');
    var got = 0;
    var ach = E.ACHIEVEMENTS.map(function (a) {
      var d = S.ach[a.id]; if (d) got++;
      return '<li class="ach' + (d ? ' is-got' : '') + '"><span class="ach-ic">' + (d ? I.trophy : I.lock) + '</span>' +
        '<span class="ach-text"><span class="ach-name">' + esc(a.name) + '</span><span class="ach-desc">' + esc(a.desc) + '</span>' +
        (d ? '<span class="ach-date">Earned ' + esc(niceDate(d)) + '</span>' : '') + '</span></li>';
    }).join('');
    return '<section class="screen awards">' + backBtn() +
      '<div class="title-block"><h1>Ranks and achievements</h1>' +
      '<p class="lede">Every correct answer earns XP. Higher levels, combos and three-star runs earn more.</p></div>' +
      rankCard(false) +
      '<h2 class="group-label"><span>Achievements</span><span class="group-aside num">' + got + ' of ' + E.ACHIEVEMENTS.length + '</span></h2>' +
      '<ul class="ach-grid">' + ach + '</ul>' +
      '<h2 class="group-label">Rank ladder</h2>' +
      '<div class="group ladder">' + ladder + '</div>' +
      '<p class="group-foot">XP per correct answer: 10 on the guided path, 10 to 18 in game modes by level, plus up to 5 for a combo streak. Stars add 15 each; a first three-star run adds 60.</p>' +
      '</section>';
  }
  function niceDate(k) {
    var d = new Date(k + 'T12:00:00');
    return isNaN(d) ? k : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ------------------------------------------------------------ library
  function libraryView() {
    var stage = S.guided, unlocked = E.active(S, stage);
    var items = ALL.map(function (semis) {
      var inf = info(semis), open = libOpen === semis, isUn = unlocked.indexOf(semis) >= 0;
      var a = E.accuracy(S, stage, semis);
      var sub = isUn ? (a.n ? E.STAGE_LABEL[stage] + ' · ' + pct(a.acc) : 'Unlocked · not practiced yet') : 'Locked in ' + E.STAGE_LABEL[stage].toLowerCase();
      var body = '';
      if (open) {
        var songs = function (list, dirLabel) {
          if (!list.length) return '<div class="cell"><span class="cell-sub">' + dirLabel + ': no well-known song. Reverse the upward anchor.</span></div>';
          return songCells(list, dirLabel);
        };
        body = '<div class="lib-body" id="lib-' + semis + '">' +
          '<div class="trio">' +
          '<button class="btn btn-tinted" type="button" data-action="lib-play" data-mode="up" data-semis="' + semis + '">' + I.play + '<span>Up</span></button>' +
          '<button class="btn btn-tinted" type="button" data-action="lib-play" data-mode="down" data-semis="' + semis + '">' + I.play + '<span>Down</span></button>' +
          '<button class="btn btn-tinted" type="button" data-action="lib-play" data-mode="harmonic" data-semis="' + semis + '">' + I.play + '<span>Together</span></button>' +
          '</div>' +
          '<p class="sub-label">Songs</p><div class="inner-group">' + songs(inf.up, 'Up') + songs(inf.down, 'Down') + '</div>' +
          '<p class="sub-label">On guitar</p>' + fretCard(libRoot, semis, 'up') +
          '</div>';
      }
      return '<div class="lib-item' + (open ? ' is-open' : '') + (isUn ? '' : ' is-locked') + '">' +
        '<button class="cell cell-btn lib-row" type="button" data-action="lib-toggle" data-semis="' + semis + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="lib-' + semis + '"' : '') + '>' +
        badge(semis) + '<span class="cell-text"><span class="cell-title">' + esc(inf.name) + '</span><span class="cell-sub">' + sub + '</span></span>' +
        (isUn ? '' : '<span class="lock-ic">' + I.lock + '</span>') + I.chev + '</button>' + body + '</div>';
    }).join('');
    return '<section class="screen library">' + backBtn() +
      '<div class="title-block"><h1>Library</h1><p class="lede">All twelve intervals, locked ones too. Open one to hear it up, down and together, with its songs and guitar shape.</p></div>' +
      '<div class="group"><div class="cell root-cell"><span class="cell-text"><span class="cell-title">Root note</span><span class="cell-sub">Every interval starts here</span></span>' +
      '<span class="root-val num">' + FB.noteWithOctave(libRoot) + '</span>' +
      '<button class="pill-btn small" type="button" data-action="lib-root">' + I.shuffle + '<span>New root</span></button></div></div>' +
      '<h2 class="group-label"><span>Intervals</span><span class="group-aside">Smallest to largest</span></h2>' +
      '<div class="group lib-list">' + items + '</div>' +
      '</section>';
  }

  // ------------------------------------------------------------ flow
  function startSession(opts) {
    var b = app.querySelector('[data-action="start"],[data-action="start-free"],[data-action="again"],[data-action="next-level"]');
    if (!audioReady && b) { b.disabled = true; b.innerHTML = '<span>Loading sound…</span>'; }
    ensureAudio().then(function () {
      sess = E.newSession(S, opts);
      sess.combo = 0; sess.bestCombo = 0;
      sess.xp = 0; sess.xpAnswers = 0; sess.xpCombo = 0; sess.xpStars = 0; sess.xpSession = 0;
      sess.xpStart = S.xp; sess.newAch = [];
      if (sess.scale) { S.tried[sess.scale] = 1; persist(); }
      A.setNoteLength(sess.lv ? sess.lv.notes : 1);
      ask();
    });
  }
  function startLevel(modeId, n) {
    curMode = modeId;
    startSession({ mode: 'scale', scale: modeId, level: n });
  }
  function ask() {
    clearTimeout(askTimer);
    showAnchorAnyway = false;
    fb = null;
    var q = E.nextQuestion(S, sess);
    view = 'practice';
    render();
    window.scrollTo(0, 0);
    // never start the interval while an effect is still sounding
    var wait = Math.max(220, SFX.busyMs() + 80);
    askTimer = setTimeout(function () {
      if (!sess || sess.q !== q || view !== 'practice') return;
      if (sess.scale && sess.lv.cue === 'chord') {
        playCue().then(function (ok) { if (ok && sess && sess.q === q && !q.answered && view === 'practice') askTimer = setTimeout(function () { playQuestion(false); }, 380); });
      } else playQuestion(false);
    }, wait);
  }
  function showHint() {
    var q = sess && sess.q;
    if (!q || q.answered || q.hinted) return;
    if (sess.lv && !sess.lv.hints) return;
    q.hinted = true;
    render();
  }
  function gain(n, bucket) { if (!n) return; E.gainXp(S, n); sess.xp += n; sess[bucket] += n; }
  function newAchievements() {
    var got = E.checkAchievements(S);
    got.forEach(function (a) { sess.newAch.push(a); });
    if (got.length) toast('Achievement unlocked: ' + got.map(function (a) { return a.name; }).join(', '));
  }
  function answer(guess) {
    var q = sess.q;
    if (q.answered) { playFrom(guess); return; }
    clearTimeout(askTimer);
    q.answered = true;
    var ev = E.record(S, q, guess);
    sess.answers.push({ semis: q.semis, guess: guess, correct: ev.correct, hinted: !!q.hinted });
    if (ev.correct && !q.hinted) { sess.combo++; sess.bestCombo = Math.max(sess.bestCombo, sess.combo); } else if (!ev.correct) sess.combo = 0;
    S.bestCombo = Math.max(S.bestCombo || 0, sess.bestCombo);
    var xp = E.answerXp(sess, ev.correct, !!q.hinted, sess.combo), xpBase = E.answerXp(sess, ev.correct, !!q.hinted, 0);
    gain(xpBase, 'xpAnswers'); gain(xp - xpBase, 'xpCombo');
    if (sess.answers.length >= sess.length) {
      if (sess.scale) { var res = E.recordLevel(S, sess); sess.xp += res.xpBonus; sess.xpStars += res.xpBonus; }
      else gain(E.SESSION_BONUS, 'xpSession');
    }
    newAchievements();
    persist();
    fb = { guess: guess, correct: ev.correct, ev: ev, anim: true, xp: xp };
    render();
    fb.anim = false;
    var news = ev.unlocked !== null || ev.mastered;
    var d = sfx(news ? 'unlock' : ev.correct ? 'right' : 'wrong');
    if (!ev.correct) {
      askTimer = setTimeout(function () { if (sess && sess.q === q && view === 'practice') playContrast(); }, d + 140);
    }
    var n = document.getElementById('next'); if (n) n.focus({ preventScroll: true });
  }
  function next() {
    clearTimeout(askTimer);
    if (!sess || !sess.q || !sess.q.answered) return;
    if (sess.answers.length >= sess.length) { A.stop(); setPlaying(false); go('summary'); celebrate(); return; }
    ask();
  }
  function quit() {
    if (sess && sess.answers.length) { go('summary'); celebrate(); } else go(sess && sess.scale ? 'mode' : 'home');
  }

  // ------------------------------------------------------------ events
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t || t.disabled) return;
    var a = t.dataset.action, semis = t.dataset.semis !== undefined ? +t.dataset.semis : null;
    if (a !== 'reset' && resetArmed) { resetArmed = 0; }
    switch (a) {
      case 'home': if (view === 'practice' && sess && sess.answers.length) { go('summary'); celebrate(); } else go('home'); break;
      case 'awards': go('awards'); break;
      case 'close-rankup': closeRankUp(); break;
      case 'progress': go('progress'); break;
      case 'library': go('library'); break;
      case 'settings': openSettings(); break;
      case 'free': go('free'); break;
      case 'start': startSession({ mode: 'guided' }); break;
      case 'modes': go('modes'); break;
      case 'open-mode': curMode = t.dataset.mode; go('mode'); break;
      case 'to-map': go('mode'); break;
      case 'start-level': startLevel(t.dataset.mode, +t.dataset.level); break;
      case 'next-level': startLevel(sess.scale, sess.level + 1); break;
      case 'hear-cue': playCue(); break;
      case 'again': startSession(sess && sess.scale ? { mode: 'scale', scale: sess.scale, level: sess.level } : sess && !sess.guided ? { mode: 'free', stage: sess.stage, pool: sess.fixedPool } : { mode: 'guided' }); break;
      case 'start-free': if (S.free.pool.length >= E.MIN_POOL) startSession({ mode: 'free', stage: S.free.stage, pool: S.free.pool }); break;
      case 'sample': sample(semis, t.dataset.stage, t); break;
      case 'replay': playQuestion(!!(sess.q.plays) || sess.q.answered); break;
      case 'hint': showHint(); break;
      case 'answer': answer(semis); break;
      case 'next': next(); break;
      case 'quit': quit(); break;
      case 'play-guess': playFrom(fb.guess); break;
      case 'play-correct': playFrom(sess.q.semis); break;
      case 'play-both': playContrast(); break;
      case 'show-anchor': showAnchorAnyway = true; var fbEl = app.querySelector('.fb-anchor'); if (fbEl) fbEl.outerHTML = anchorView(sess.q); break;
      case 'more-songs': app.querySelectorAll('[data-more="' + t.dataset.target + '"]').forEach(function (el) { el.hidden = false; }); t.remove(); break;
      case 'lib-toggle': libOpen = libOpen === semis ? null : semis; render(); break;
      case 'lib-play': libPlay(semis, t.dataset.mode, t); break;
      case 'lib-root':
        libRoot = E.randomRoot(null, libRoot); render(); toast('New root: ' + FB.noteWithOctave(libRoot)); break;
      case 'free-toggle':
        var i = S.free.pool.indexOf(semis);
        if (i >= 0) S.free.pool.splice(i, 1); else S.free.pool.push(semis);
        persist(); render(); break;
      case 'free-all': S.free.pool = E.ORDER.slice(); persist(); render(); break;
      case 'free-unlocked':
        S.free.pool = E.active(S, S.free.stage).slice();
        if (S.free.pool.length < E.MIN_POOL) S.free.pool = E.ORDER.slice(0, E.MIN_POOL);
        persist(); render(); break;
      case 'reset':
        if (!resetArmed) { resetArmed = 1; render(); setTimeout(function () { if (resetArmed && view === 'progress') { resetArmed = 0; render(); } }, 4000); }
        else { var keep = S.settings; S = E.clearAll(); S.settings = keep; persist(); resetArmed = 0; sess = null; render(); toast('Progress has been reset.'); }
        break;
    }
  });

  app.addEventListener('change', function (e) {
    if (e.target.name === 'free-stage') { S.free.stage = e.target.value; persist(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.getElementById('settings').open) return;
    if (document.querySelector('.rankup')) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeRankUp(); } return; }
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (view === 'practice' && sess && sess.q) {
      var answered = sess.q.answered;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (answered) next(); else playQuestion(true); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (answered) next(); return; }
      if ((e.key === 'h' || e.key === 'H') && sess.scale && sess.lv.n <= 4) { e.preventDefault(); playCue(); return; }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); showHint(); return; }
      var k = KEYS.indexOf(e.key);
      if (k >= 0) {
        var pool = E.poolOf(S, sess);
        if (k < pool.length) { e.preventDefault(); answer(pool[k]); }
      }
      if (e.key === 'Escape') quit();
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault(); go('library');
    } else if (e.key === 'Escape' && view !== 'home') {
      go(view === 'mode' ? 'modes' : view === 'summary' && sess && sess.scale ? 'mode' : 'home');
    } else if (e.key === 'Enter' && tag !== 'button') {
      if (view === 'home') { e.preventDefault(); startSession({ mode: 'guided' }); }
      else if (view === 'summary') { var p = app.querySelector('.actions .btn-primary'); if (p) { e.preventDefault(); p.click(); } }
    }
  });

  // ------------------------------------------------------------ settings
  var dlg = document.getElementById('settings');
  function openSettings() {
    dlg.querySelectorAll('input[name="inst"]').forEach(function (r) { r.checked = r.value === S.settings.instrument; });
    document.getElementById('set-volume').value = S.settings.volume;
    document.getElementById('set-sfx').checked = S.settings.sfx;
    document.getElementById('storage-warn').hidden = E.storageOk();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'inst') {
      S.settings.instrument = t.value;
      var inst = t.value === 'piano' ? 'piano' : 'guitar';
      try { A.setInstrument(inst); } catch (err) {}
      if (audioReady) { A.prewarm(); if (t.value === 'mix') { A.setInstrument('piano'); A.prewarm(); A.setInstrument(inst); } }
      if (sess && sess.q && !(sess.lv && sess.lv.mixInst)) sess.q.inst = null;
    }
    if (t.id === 'set-sfx') { S.settings.sfx = t.checked; SFX.setEnabled(t.checked); if (t.checked) { SFX.unlock(); SFX.play('right'); } }
    persist(); applyPrefs();
  });
  document.getElementById('set-volume').addEventListener('input', function (e) {
    S.settings.volume = parseFloat(e.target.value); applyAudioSettings(); persist();
  });

  // tiny hook for automated checks
  window.EarApp = {
    state: function () { return S; }, session: function () { return sess; }, answer: answer, next: next, hint: showHint,
    view: function () { return view; }, go: go, startLevel: startLevel, openMode: function (id) { curMode = id; go('mode'); },
    reload: function () { S = E.load(); render(); }, rankUp: function () { rankUp(E.rankInfo(S.xp)); }
  };

  applyAudioSettings();
  // optional deep links: #modes, #mode/<id>, #library, #progress, #free
  (function () {
    var h = (location.hash || '').slice(1).split('/');
    if (h[0] === 'mode' && E.modeById(h[1])) { curMode = h[1]; view = 'mode'; }
    else if (['modes', 'library', 'progress', 'free', 'awards'].indexOf(h[0]) >= 0) view = h[0];
  })();
  render();

  // Offline + installable when served over http(s). file:// keeps working without it.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      var hadController = !!navigator.serviceWorker.controller, reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
      }).catch(function () {});
    });
  }
})();
