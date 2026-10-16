/*
 * app.js: UI for the ear trainer (intervals, chords, progressions, scale degrees; XP/rank progression).
 * Tabs: Train · Library · Progress · Settings. Uses window.EarAudio, EarEngine, EarChords, EarProg, EarDeg, EarHarmony, EarSfx, Fretboard, ANCHORS.
 * Note: countUp() animates every [data-count] element. Use data-count ONLY for animated numbers.
 */
(function () {
  'use strict';

  var E = window.EarEngine, C = window.EarChords, A = window.EarAudio, FB = window.Fretboard, SFX = window.EarSfx;
  var P = window.EarProg, D = window.EarDeg, HM = window.EarHarmony;
  var SECTIONS = [['intervals', 'Intervals'], ['chords', 'Chords'], ['progressions', 'Progressions'], ['degrees', 'Degrees']];
  var KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  var ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  var TABS = ['train', 'library', 'progress', 'settings'];
  var HINT_RULE = 'Hinted answers count in your stats, not toward unlocks or stars.';
  var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  C.setPlaceable(FB.chordGrade);

  function norm(s) { C.normalize(s); P.normalize(s); D.normalize(s); return s; }
  var S = norm(E.load());
  var view = 'train';
  var sess = null;          // current session (interval or chord)
  var fb = null;            // feedback for the answered question
  var curPack = { kind: 'intervals', id: 'major' };  // pack on the level map
  var audioReady = false;
  var playing = false;
  var showAnchorAnyway = false;
  var resetArmed = 0;
  var libRoot = 45, libOpen = null;
  var clibRoot = 48, clibOpen = null;
  var plibTonic = 0, plibOpen = null, dlibTonic = 60, dlibOpen = null;
  var progSec = null;
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
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h4v4M4 20L20 4M20 16v4h-4M14.5 14.5L20 20M4 4l5 5"/></svg>',
    modes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19h4v-4h4v-4h4V7h4"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.2 2.5L5 13.2h6l-1.2 8.3 8.2-10.7h-6z"/></svg>',
    path: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h8M16 7h4M4 17h4M12 17h8"/><circle cx="14" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>'
  };

  // ------------------------------------------------------------ helpers
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function info(semis) { return E.info(semis); }
  function code(semis) { return info(semis).short; }
  function full(semis) { var i = info(semis); return i.short + ' · ' + i.name; }
  function pct(x) { return x === null || x === undefined ? '–' : Math.round(x * 100) + '%'; }
  function persist() { E.save(S); }
  function sec() { return S.ui.section; }
  function stageIndex(st) { return E.STAGES.indexOf(st) + 1; }
  function badge(text, extra) { return '<span class="badge' + (extra ? ' ' + extra : '') + '">' + esc(text) + '</span>'; }
  function ibadge(semis, extra) { return badge(code(semis), extra); }
  function ct(id) { return C.type(id); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function chordName(root, id) { return FB.noteName(root) + ' ' + lowerFirst(ct(id).name); }
  function stars(n, max, cls) {
    var o = '<span class="stars' + (cls ? ' ' + cls : '') + '" role="img" aria-label="' + n + ' of ' + (max || 3) + ' stars">';
    for (var i = 0; i < (max || 3); i++) o += '<span class="st' + (i < n ? ' on' : '') + '" style="--i:' + i + '">' + I.star + '</span>';
    return o + '</span>';
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function applyPrefs() { SFX.setEnabled(!!S.settings.sfx); SFX.setVolume(S.settings.volume); }
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

  // Pack helpers: one interface for interval game modes and chord packs.
  function modOf(kind) { return kind === 'progressions' ? P : kind === 'degrees' ? D : null; }
  function K(kind) {
    var M = modOf(kind);
    if (M) return {
      kind: kind, levels: M.LEVELS, list: M.PACKS, get: M.packById,
      row: function (id, n) { return M.levelRow(S, id, n); }, unlocked: function (id, n) { return M.levelUnlocked(S, id, n); },
      stars: function (id) { return M.packStars(S, id); }, total: function () { return M.totalStars(S); }
    };
    if (kind === 'chords') return {
      kind: 'chords', levels: C.LEVELS, list: C.PACKS, get: C.packById,
      row: function (id, n) { return C.levelRow(S, id, n); }, unlocked: function (id, n) { return C.levelUnlocked(S, id, n); },
      stars: function (id) { return C.packStars(S, id); }, total: function () { return C.totalStars(S); }
    };
    return {
      kind: 'intervals', levels: E.LEVELS, list: E.MODES, get: E.modeById,
      row: function (id, n) { return E.levelRow(S, id, n); }, unlocked: function (id, n) { return E.levelUnlocked(S, id, n); },
      stars: function (id) { return E.modeStars(S, id); }, total: function () { return E.totalStars(S); }
    };
  }
  function maxStars(kind) { var k = K(kind); return k.list.length * k.levels.length * 3; }
  /** First unlocked level without a star, else first level below 3 stars, else null. */
  function nextLevel(kind, id) {
    var k = K(kind), n;
    for (n = 1; n <= k.levels.length; n++) { var r = k.row(id, n); if (k.unlocked(id, n) && !(r && r.stars)) return n; }
    for (n = 1; n <= k.levels.length; n++) { var r2 = k.row(id, n); if (!r2 || r2.stars < 3) return n; }
    return null;
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
  /** Runs one playback (start() returns the audio promise) with play-state UI. */
  function run(inst, btn, start) {
    A.stop();
    if (playBtn) playBtn.classList.remove('is-playing');
    if (inst) A.setInstrument(inst);
    setPlaying(true);
    playBtn = btn || null;
    if (playBtn) playBtn.classList.add('is-playing');
    var mine = playBtn;
    return start().then(function (ok) { if (playBtn === mine) setPlaying(false); return ok; }, function () { if (playBtn === mine) setPlaying(false); });
  }
  function play(items, inst, btn) {
    return run(inst, btn, function () {
      return items.length === 1 ? A.playInterval(items[0].rootMidi, items[0].semitones, items[0].mode) : A.playSequence(items, 0.55);
    });
  }
  function playChordItems(items, inst, btn) {
    return run(inst, btn, function () { return items.length === 1 ? A.playChord(items[0].midis, items[0].style) : A.playChords(items, 0.5); });
  }
  function isChord() { return !!(sess && sess.kind === 'chord'); }
  /** Progressions and scale degrees: slot answers, timed events. */
  function isHarm() { return !!(sess && (sess.kind === 'prog' || sess.kind === 'deg')); }
  function HMod() { return sess.kind === 'prog' ? P : D; }
  function sessKind() { return !sess ? null : sess.kind === 'prog' ? 'progressions' : sess.kind === 'deg' ? 'degrees' : sess.kind === 'chord' ? 'chords' : 'intervals'; }
  function playEvents(events, inst, btn) { return run(inst, btn, function () { return A.playEvents(events); }); }
  /** Events that follow one another: each list starts after the previous one ends plus `gap`. */
  function chain(lists, gap) {
    var out = [], t = 0;
    lists.forEach(function (l) {
      var end = 0;
      l.forEach(function (ev) { out.push({ at: t + ev.at, midis: ev.midis, ring: ev.ring }); end = Math.max(end, ev.at + ev.ring); });
      t += end + (gap || 0.6);
    });
    return out;
  }
  function chordMidis(q, id) {
    var off = !id || id === q.id ? q.offsets : C.voicingLike(id, q);
    return off.map(function (x) { return q.root + x; });
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
    if (isHarm()) playEvents(HMod().questionEvents(q), instrumentFor(q));
    else if (isChord()) playChordItems([{ midis: chordMidis(q), style: q.style }], instrumentFor(q));
    else play([{ rootMidi: q.root, semitones: q.semis, mode: q.stage }], instrumentFor(q));
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
  function playFrom(guess) {
    var q = sess.q;
    if (isChord()) playChordItems([{ midis: chordMidis(q, guess), style: q.style }], instrumentFor(q));
    else play([{ rootMidi: q.root, semitones: guess, mode: q.stage }], instrumentFor(q));
  }
  function playContrast() {
    var q = sess.q;
    if (isChord()) {
      playChordItems([{ midis: chordMidis(q, fb.guess), style: q.style }, { midis: chordMidis(q), style: q.style }], instrumentFor(q));
      return;
    }
    play([{ rootMidi: q.root, semitones: fb.guess, mode: q.stage }, { rootMidi: q.root, semitones: q.semis, mode: q.stage }], instrumentFor(q));
  }
  function sample(semis, stage, btn) {
    ensureAudio().then(function () {
      A.setNoteLength(1);
      var root = 48 + Math.floor(Math.random() * 8);
      play([{ rootMidi: root, semitones: semis, mode: stage || 'up' }], baseInstrument(), btn);
    });
  }
  function libPlay(semis, mode, btn) {
    ensureAudio().then(function () { A.setNoteLength(1); play([{ rootMidi: libRoot, semitones: semis, mode: mode }], baseInstrument(), btn); });
  }
  function clibPlay(id, style, btn) {
    ensureAudio().then(function () {
      A.setNoteLength(1);
      playChordItems([{ midis: C.voicing(id, 0, false).map(function (x) { return clibRoot + x; }), style: style }], baseInstrument(), btn);
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
  function tabOf(v) { return TABS.indexOf(v) >= 0 ? v : (v === 'pack' || v === 'guided' || v === 'free') ? 'train' : null; }
  var lastView = null;
  function render() {
    document.body.dataset.view = view;
    var tab = tabOf(view);
    document.body.classList.toggle('has-tabs', !!tab);
    document.querySelectorAll('.tabbar .tab').forEach(function (b) {
      if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var fresh = view !== lastView || (view === 'practice' && sess && sess.q && !sess.q.answered && !sess.q.hinted && sess.q.plays === 0);
    lastView = view;
    if (fresh) { app.classList.remove('animate'); void app.offsetWidth; app.classList.add('animate'); }
    else app.classList.remove('animate');
    var html = '';
    if (view === 'train') html = trainView();
    else if (view === 'guided') html = guidedView();
    else if (view === 'free') html = sec() === 'chords' ? chordFreeView() : sec() === 'progressions' ? progFreeView() : sec() === 'degrees' ? degFreeView() : freeView();
    else if (view === 'pack') html = packView();
    else if (view === 'practice') html = practiceView();
    else if (view === 'summary') html = summaryView();
    else if (view === 'progress') html = progressView();
    else if (view === 'library') html = sec() === 'chords' ? chordLibraryView() : sec() === 'progressions' ? progLibraryView() : sec() === 'degrees' ? degLibraryView() : libraryView();
    else if (view === 'settings') html = settingsView();
    app.innerHTML = html;
    applyPrefs();
    if (fresh) countUp();
  }
  /** Animate [data-count] numbers from data-from to their value. Only the XP gain uses data-count. */
  function countUp() {
    var els = app.querySelectorAll('[data-count]');
    if (!els.length || RM.matches) return;
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
  /** Four-way section switch: 2×2 on phones, one row from 520px. The sliding pill follows data-i. */
  function switcher(label, action, current, extra) {
    var cur = current || sec(), idx = 0;
    var btns = SECTIONS.map(function (x, i) {
      var on = cur === x[0]; if (on) idx = i;
      return '<button type="button" class="sw-btn' + (on ? ' is-on' : '') + '" role="tab" aria-selected="' + on + '" data-action="' + (action || 'section') + '" data-section="' + x[0] + '">' + x[1] + '</button>';
    }).join('');
    return '<div class="switcher sw4' + (extra ? ' ' + extra : '') + '" role="tablist" aria-label="' + (label || 'Training type') + '" data-on="' + cur + '" data-i="' + idx + '">' + btns + '</div>';
  }
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
      '<div class="cell unlock-head">' + (r.next !== null ? ibadge(r.next, 'is-ghost') : '') + '<span class="cell-title">' + esc(target) + '</span>' + I.lock + '</div>' +
      meter('Answers since last unlock', Math.min(r.since, r.needSince) + ' / ' + r.needSince, r.since / r.needSince, r.sinceOk) +
      meter('Accuracy, last 20', r.recentN ? pct(r.recentAcc) : '–', r.recentN ? r.recentAcc / r.needAcc * (r.recentN / 20) : 0, r.accOk, r.recentN && r.recentN < 20 ? r.recentN + ' answers' : 'goal 90%') +
      meter('Weakest interval', eachText, eachFrac, eachOk, r.unproven.length ? '' : 'goal 75%') +
      '</div>' +
      '<p class="group-foot">' + HINT_RULE + '</p>';
  }
  function backBtn(label, action) {
    return '<button class="back" type="button" data-action="' + (action || 'tab') + '"' + (action ? '' : ' data-tab="train"') + '>' + I.back + '<span>' + (label || 'Train') + '</span></button>';
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
  /** Chord tones of the exact played voicing on the neck. Every dot is a played pitch. */
  function chordFretCard(root, offsets, id, extraClass) {
    var t = ct(id), f = FB.renderChord(root, offsets, { deg: t.deg });
    return '<div class="fret-card' + (extraClass ? ' ' + extraClass : '') + '">' +
      (f.svg ? '<div class="fret-scroll">' + f.svg + '</div>' : '') +
      '<div class="fret-meta"><span class="legend"><span class="lg lg-root"></span>Root</span><span class="legend"><span class="lg lg-target"></span>Chord tone</span></div>' +
      '<p class="fret-caption num">' + esc(f.caption) + '</p>' +
      (f.desc ? '<p class="fret-desc">' + esc(f.desc) + '</p>' : '') + '</div>';
  }

  // ------------------------------------------------------------ train tab
  function rankStrip() {
    var ri = E.rankInfo(S.xp), st = E.streak(S);
    return '<button class="rank-strip" type="button" data-action="tab" data-tab="progress" aria-label="' + esc(ri.name) + ', rank ' + ri.n + '. ' + st.days + ' day streak. Open progress.">' +
      rankBadge(ri, 'sm') +
      '<span class="rs-main"><span class="rs-top"><span class="rs-name">' + esc(ri.name) + '</span>' +
      '<span class="rs-xp num">' + (ri.next !== null ? fmt(ri.toNext) + ' XP to next' : 'Top rank') + '</span></span>' + xpBar(ri.frac) + '</span>' +
      '<span class="rs-streak' + (st.today ? ' is-lit' : '') + '" title="Day streak">' + I.flame + '<span class="num">' + st.days + '</span></span></button>';
  }
  function continueTarget() {
    var lp = S.lastPlay[sec()];
    if (sec() === 'intervals') {
      if (lp && lp.kind === 'level' && E.modeById(lp.pack)) { var n = nextLevel('intervals', lp.pack); if (n) return { kind: 'intervals', id: lp.pack, level: n }; }
      return { kind: 'guided' };
    }
    var k = K(sec()), list = k.list;
    var start = lp && k.get(lp.pack) ? lp.pack : list[0].id, ids = [start].concat(list.map(function (p) { return p.id; }));
    for (var i = 0; i < ids.length; i++) { var m = nextLevel(k.kind, ids[i]); if (m) return { kind: k.kind, id: ids[i], level: m }; }
    return { kind: k.kind, id: list[list.length - 1].id, level: k.levels.length };
  }
  function continueCard() {
    var t = continueTarget(), fresh = !S.lastPlay[sec()];
    if (t.kind === 'guided') {
      var stage = S.guided, n = E.active(S, stage).length, first = S.total === 0;
      return '<div class="hero-card">' +
        '<p class="hero-k">' + (first ? 'Start here' : 'Continue') + '</p>' +
        '<h2 class="hero-title">Guided path</h2>' +
        '<p class="hero-meta">' + E.STAGE_LABEL[stage] + ' · ' + n + ' intervals · 30 questions</p>' +
        (first ? '<p class="hero-desc">Hear two notes, name the gap. New intervals unlock as your ear grows.</p>' : '') +
        '<button class="btn btn-hero" type="button" data-action="start"><span class="btn-ic">' + I.play + '</span><span>' + (first ? 'Start first session' : 'Start session') + '</span></button></div>';
    }
    var k = K(t.kind), p = k.get(t.id), L = k.levels[t.level - 1], r = k.row(t.id, t.level);
    return '<div class="hero-card">' +
      '<p class="hero-k">' + (fresh ? 'Start here' : 'Continue') + '</p>' +
      '<h2 class="hero-title">' + esc(p.name) + '</h2>' +
      '<p class="hero-meta"><span>Level ' + t.level + ' · ' + L.name + '</span>' + (r ? stars(r.stars, 3, 'sm on-dark') : '') + '</p>' +
      '<p class="hero-desc">' + esc(L.desc) + '</p>' +
      '<button class="btn btn-hero" type="button" data-action="start-level" data-kind="' + t.kind + '" data-pack="' + t.id + '" data-level="' + t.level + '"><span class="btn-ic">' + I.play + '</span><span>Play level ' + t.level + '</span></button></div>';
  }
  function packRow(kind, p) {
    var k = K(kind), ms = k.stars(p.id), pips = '';
    for (var n = 1; n <= k.levels.length; n++) {
      var r = k.row(p.id, n), un = k.unlocked(p.id, n);
      pips += '<span class="pip' + (r && r.stars ? ' s' + r.stars : un ? ' open' : '') + '"></span>';
    }
    var done = ms === k.levels.length * 3;
    return '<button class="pack' + (done ? ' is-mastered' : '') + '" type="button" data-action="open-pack" data-kind="' + kind + '" data-id="' + p.id + '">' +
      '<span class="pack-text"><span class="pack-name">' + esc(p.name) + '</span><span class="pack-mood">' + esc(p.mood) + '</span></span>' +
      '<span class="pack-side">' + (done ? '<span class="mastered">' + I.check + 'Mastered</span>' : '<span class="pack-stars num">' + I.star + ms + '<small>/15</small></span>') +
      '<span class="pips" aria-hidden="true">' + pips + '</span></span>' + I.chev + '</button>';
  }
  function trainView() {
    var kind = sec(), k = K(kind), ts = k.total();
    var more = kind === 'intervals'
      ? quietRow('open-guided', I.path, 'Guided path', 'Stage ' + stageIndex(S.guided) + ' · ' + E.STAGE_LABEL[S.guided] + ' · ' + E.active(S, S.guided).length + ' of 12 unlocked') +
        quietRow('free', I.sliders, 'Free practice', 'Pick direction and intervals')
      : kind === 'progressions' ? quietRow('free', I.sliders, 'Free practice', 'Pick major or minor, the chords and the length')
      : kind === 'degrees' ? quietRow('free', I.sliders, 'Free practice', 'Pick the degrees and how many notes')
      : quietRow('free', I.sliders, 'Free practice', 'Pick chord types and how they sound');
    return '<section class="screen train">' +
      '<h1 class="sr-only">Train</h1>' + switcher() +
      rankStrip() + continueCard() +
      '<div class="sec-head"><h2>' + ({ chords: 'Chord packs', progressions: 'Progression packs', degrees: 'Scale-degree packs' }[kind] || 'Scales and modes') + '</h2>' +
      '<span class="sec-aside num" aria-label="' + ts + ' of ' + maxStars(kind) + ' stars">' + I.star + ts + '<small> / ' + maxStars(kind) + '</small></span></div>' +
      '<div class="packs">' + k.list.map(function (p) { return packRow(kind, p); }).join('') + '</div>' +
      '<div class="sec-head"><h2>More ways to practice</h2></div>' +
      '<div class="quiet">' + more + '</div>' +
      '</section>';
  }
  function quietRow(action, icon, title, sub) {
    return '<button class="quiet-row" type="button" data-action="' + action + '"><span class="q-ic">' + icon + '</span>' +
      '<span class="cell-text"><span class="cell-title">' + title + '</span><span class="cell-sub">' + esc(sub) + '</span></span>' + I.chev + '</button>';
  }

  // ------------------------------------------------------------ guided path
  function guidedView() {
    var stage = S.guided, list = E.active(S, stage), first = S.total === 0;
    var rows = list.map(function (semis) {
      var i = info(semis), a = E.accuracy(S, stage, semis);
      return '<button class="cell cell-btn" type="button" data-action="sample" data-semis="' + semis + '" data-stage="' + stage + '">' +
        ibadge(semis) + '<span class="cell-title">' + esc(i.name) + '</span>' +
        '<span class="cell-value num">' + (a.n ? pct(a.acc) : 'New') + '</span>' +
        '<span class="mini-play">' + I.play + '</span></button>';
    }).join('');
    return '<section class="screen guided">' + backBtn() +
      '<div class="title-block"><p class="kicker">Stage ' + stageIndex(stage) + ' of 3</p><h1>' + E.STAGE_LABEL[stage] + '</h1>' +
      '<p class="lede">' + (first ? 'Hear two notes, name the gap. You start with three intervals; new ones unlock as you improve.' : '30 questions, about six minutes. New intervals unlock as you improve.') + '</p></div>' +
      '<button class="btn btn-primary btn-lg btn-block" type="button" data-action="start"><span class="btn-ic">' + I.play + '</span><span>' + (first ? 'Start first session' : 'Start session') + '</span></button>' +
      '<h2 class="group-label"><span>Your intervals</span><span class="group-aside">Tap to hear</span></h2>' +
      '<div class="group">' + rows + '</div>' +
      unlockBlock(stage) +
      '</section>';
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
        ibadge(semis) + '<span class="cell-title">' + esc(i.name) + '</span><span class="check">' + I.check + '</span></button>';
    }).join('');
    var n = f.pool.length, need = E.MIN_POOL;
    return '<section class="screen free">' + backBtn() +
      '<div class="title-block"><h1>Free practice</h1>' +
      '<p class="lede">Choose the direction and intervals. Answers count in your stats, not toward unlocks.</p></div>' +
      '<h2 class="group-label">Direction</h2>' +
      '<div class="seg" role="radiogroup" aria-label="Direction">' + stagesHtml + '</div>' +
      '<h2 class="group-label"><span>Intervals</span><span class="group-tools">' +
      '<button class="link" type="button" data-action="free-unlocked">Unlocked</button>' +
      '<button class="link" type="button" data-action="free-all">All</button></span></h2>' +
      '<div class="group">' + rows + '</div>' +
      startBar(n, need, 'start-free', 'intervals') +
      '</section>';
  }
  function startBar(n, need, action, noun) {
    return '<div class="actions sticky-actions">' +
      (n < need ? '<p class="need-hint">Pick at least ' + need + '. The same answer never comes twice in a row, so with two it would just alternate.</p>' : '') +
      '<button class="btn btn-primary btn-lg" type="button" data-action="' + action + '"' + (n < need ? ' disabled' : '') + '>' +
      (n < need ? 'Choose ' + (need - n) + ' more' : 'Start with ' + n + ' ' + noun) + '</button></div>';
  }
  function chordFreeView() {
    var f = S.chords.free;
    var styles = C.FREE_STYLES.map(function (id) {
      return '<label><input type="radio" name="cfree-style" value="' + id + '"' + (f.style === id ? ' checked' : '') + '><span>' + C.FREE_STYLE_LABEL[id] + '</span></label>';
    }).join('');
    var rows = C.TYPES.map(function (t) {
      var on = f.pool.indexOf(t.id) >= 0;
      return '<button class="cell cell-btn cell-check' + (on ? ' is-on' : '') + '" type="button" role="checkbox" aria-checked="' + on + '" data-action="cfree-toggle" data-id="' + t.id + '">' +
        badge(t.sym, 'chord') + '<span class="cell-title">' + esc(t.name) + '</span><span class="check">' + I.check + '</span></button>';
    }).join('');
    var n = f.pool.length;
    return '<section class="screen free">' + backBtn() +
      '<div class="title-block"><h1>Free practice</h1>' +
      '<p class="lede">Pick the chord types and how they are played. ' + C.FREE_LEN + ' questions, a new root each time.</p></div>' +
      '<h2 class="group-label">Sound</h2>' +
      '<div class="seg" role="radiogroup" aria-label="How chords are played">' + styles + '</div>' +
      '<h2 class="group-label"><span>Chords</span><span class="group-tools">' +
      '<button class="link" type="button" data-action="cfree-basic">Basics</button>' +
      '<button class="link" type="button" data-action="cfree-all">All</button></span></h2>' +
      '<div class="group">' + rows + '</div>' +
      startBar(n, C.MIN_POOL, 'start-cfree', 'chords') +
      '</section>';
  }

  // ------------------------------------------------------------ level map (interval modes + chord packs)
  function packView() {
    var k = K(curPack.kind), m = k.get(curPack.id), ms = k.stars(m.id), isC = k.kind === 'chords';
    var nextOpen = 0;
    for (var j = 1; j <= k.levels.length; j++) { var rr = k.row(m.id, j); if (k.unlocked(m.id, j) && !(rr && rr.stars)) { nextOpen = j; break; } }
    var nodes = k.levels.map(function (L, idx) {
      var r = k.row(m.id, L.n), un = k.unlocked(m.id, L.n);
      var cls = 'lvl' + (un ? '' : ' is-locked') + (r && r.stars ? ' is-done' : '') + (L.n === nextOpen ? ' is-next' : '') + (r && r.stars === 3 ? ' is-perfect' : '');
      return '<li class="' + cls + '" style="--i:' + idx + '">' +
        '<button class="lvl-btn" type="button" data-action="start-level" data-kind="' + k.kind + '" data-pack="' + m.id + '" data-level="' + L.n + '"' + (un ? '' : ' disabled aria-disabled="true"') + ' aria-label="Level ' + L.n + ', ' + L.name + (un ? '' : ', locked') + '">' +
        '<span class="lvl-node num">' + (un ? L.n : I.lock) + '</span>' +
        '<span class="lvl-card"><span class="lvl-top"><span class="lvl-name">' + L.name + '</span>' + stars(r ? r.stars : 0, 3, 'sm') + '</span>' +
        '<span class="lvl-desc">' + L.desc + '</span>' +
        '<span class="lvl-meta num">' + (r ? 'Best ' + r.best + '% · ' + r.runs + (r.runs === 1 ? ' run' : ' runs') : un ? (L.n === nextOpen ? 'Ready. Tap to play' : 'Not played yet') : 'Earn 1 star on level ' + (L.n - 1)) + '</span>' +
        '</span></button></li>';
    }).join('');
    var isH = k.kind === 'progressions' || k.kind === 'degrees';
    var chips = k.kind === 'progressions' ? P.sortPool(m.chords).map(function (id) { return '<span class="chip">' + esc(P.label(id)) + '</span>'; }).join('')
      : k.kind === 'degrees' ? m.degs.map(function (d) { return '<span class="chip">' + esc(D.label(d)) + '</span>'; }).join('')
      : isC
      ? m.types.map(function (id) { return '<span class="chip">' + esc(ct(id).sym) + '</span>'; }).join('')
      : m.semis.map(function (x) { return '<span class="chip">' + code(x) + '</span>'; }).join('');
    var done = ms === k.levels.length * 3;
    return '<section class="screen pack">' + backBtn() +
      '<div class="title-block"><p class="kicker">' + esc(m.mood) + '</p><h1>' + esc(m.name) + '</h1>' +
      '<p class="lede">' + esc(m.moodLong) + '</p>' +
      '<div class="chips" aria-label="' + (isH ? (k.kind === 'progressions' ? 'Chords' : 'Degrees') : isC ? 'Chord types' : 'Intervals') + '">' + chips + '</div></div>' +
      '<div class="mastery' + (done ? ' is-done' : '') + '"><div class="mastery-top"><span class="mode-stars num">' + I.star + ms + '<small>/15</small></span>' +
      (done ? '<span class="mastered">' + I.check + 'Mastered</span>' : '<span class="mastery-l">' + (15 - ms) + ' stars to mastery</span>') + '</div>' +
      '<span class="total-track"><span style="--p:' + (ms / 15).toFixed(4) + '"></span></span></div>' +
      '<ol class="map">' + nodes + '</ol>' +
      '<p class="group-foot">' + (k.kind === 'progressions' ? P.LEVEL_LEN + ' progressions per level. Stars at 70%, 85% and 95%; a progression counts when every chord is right. One star opens the next level.'
        : k.kind === 'degrees' ? D.LEVEL_LEN + ' questions per level. Stars at 70%, 85% and 95%; with several notes, every note must be right. One star opens the next level.'
        : (isC ? '' : 'You only hear the scale’s intervals, measured from the tonic, in a new key every question. ') + 'Stars at 70%, 85% and 95%. One star opens the next level. Hints count as wrong.') + '</p>' +
      '</section>';
  }

  // ------------------------------------------------------------ practice
  function sessTitle() {
    if (isHarm()) return esc(sess.packName) + (sess.free ? ' · ' + esc(sess.lv.name) : ' · Level ' + sess.level);
    if (isChord()) return esc(sess.packName) + (sess.lv && !sess.free ? ' · Level ' + sess.level : ' · ' + esc(sess.lv.name));
    if (sess.scale) return esc(sess.scaleName) + ' · Level ' + sess.level;
    return sess.guided ? 'Guided · ' + E.STAGE_LABEL[sess.stage] : 'Free practice';
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
  function poolNow() { return isChord() || isHarm() ? sess.pool : E.poolOf(S, sess); }
  function answerGrid() {
    var q = sess.q, pool = poolNow(), anim = fb && fb.anim;
    var boost = !isChord() && sess.guided && S.stages[sess.stage].boost ? S.stages[sess.stage].boost.semis : null;
    var grid = pool.map(function (v, i) {
      var cls = 'answer', correctV = isChord() ? q.id : q.semis;
      if (q.answered) cls += v === correctV ? ' is-correct' : v === fb.guess ? ' is-wrong' : ' is-dim';
      var codeTxt, name;
      if (isChord()) { codeTxt = ct(v).sym; name = ct(v).name; } else { codeTxt = info(v).short; name = info(v).name; }
      return '<button class="' + cls + '" type="button" data-action="answer" data-v="' + v + '">' +
        '<span class="answer-code">' + esc(codeTxt) + '</span><span class="answer-name">' + esc(name) + '</span>' +
        (KEYS[i] ? '<kbd class="answer-key">' + KEYS[i] + '</kbd>' : '') +
        (v === boost ? '<span class="answer-new">New</span>' : '') +
        (anim && fb.correct && v === correctV && fb.xp ? '<span class="xp-pop" aria-hidden="true">+' + fb.xp + ' XP</span>' : '') +
        '</button>';
    }).join('');
    return '<div class="answers' + (isChord() ? ' is-chords' : '') + '" data-n="' + pool.length + '">' + grid + '</div>';
  }
  function practiceView() {
    if (isHarm()) return harmPracticeView();
    var q = sess.q, chord = isChord();
    var num = Math.min(sess.answers.length + (q.answered ? 0 : 1), sess.length);
    var hintAllowed = !sess.lv || sess.lv.hints;
    var tools = '';
    if (!q.answered) {
      if (!chord && sess.scale && sess.lv.n <= 4) tools += toolBtn('hear-cue', I.modes, sess.lv.cue === 'chord' ? 'Hear chord' : 'Hear scale', 'H');
      if (hintAllowed && !q.hinted) tools += toolBtn('hint', I.guitar, 'Hint', 'F');
    }
    var hint = '';
    if (!q.answered && q.hinted) {
      hint = '<div class="hint-panel">' + (chord ? chordFretCard(q.root, q.offsets, q.id, 'is-hint') : fretCard(q.root, q.semis, q.stage, 'is-hint')) +
        '<p class="hint-note">Hint used. ' + (chord ? 'Hinted answers count as wrong for stars.' : HINT_RULE) + '</p></div>';
    }
    var what;
    if (chord) what = q.answered ? cap(C.invLabel(q.inv, q.open)) : (sess.lv.style === 'arp-block' ? 'Arpeggio, then chord' : 'Chord');
    else {
      var dirWord = q.stage === 'harmonic' ? 'Together' : q.stage === 'down' ? 'Falling' : 'Rising';
      what = sess.scale && sess.lv.dirs.length > 1 && !q.answered ? 'Any direction' : dirWord;
    }
    var combo = sess.combo >= 3 ? '<span class="combo' + (fb && fb.anim && fb.correct ? ' bump' : '') + (sess.combo >= 5 ? ' hot' : '') + '">' + I.flame + '<span class="num">' + sess.combo + '</span><span class="sr-only"> in a row</span></span>' : '';
    return '<section class="screen practice">' +
      '<div class="session-bar">' +
      '<button class="icon-btn" type="button" data-action="quit" aria-label="End session" title="End session (Esc)">' + I.x + '</button>' +
      segBar() +
      '<span class="session-count num">' + num + '<small>/' + sess.length + '</small></span>' +
      '</div>' +
      '<p class="session-title">' + sessTitle() + '</p>' +
      '<div class="listen' + (q.answered ? (fb.correct ? ' is-ok' : ' is-bad') : '') + '">' +
      '<button id="replay" class="play' + (playing ? ' is-playing' : '') + '" type="button" data-action="replay" aria-label="Play again">' +
      '<span class="play-face">' + I.play + '</span><span class="play-wave" aria-hidden="true"></span></button>' +
      '<p class="listen-q">' + (q.answered ? 'Tap any answer to compare' : 'What do you hear?') + '</p>' +
      '<p class="listen-sub"><span>' + what + '</span>' + combo + replayInfo() + '</p>' +
      (tools ? '<div class="tools">' + tools + '</div>' : '') +
      '</div>' +
      hint +
      answerGrid() +
      (q.answered ? feedbackView() : '') +
      '</section>';
  }
  function toolBtn(action, icon, label, key) {
    return '<button class="tool" type="button" data-action="' + action + '" aria-label="' + label + '" title="' + label + ' (' + key + ')"><span class="tool-ic">' + icon + '</span><span class="tool-l">' + label + '</span></button>';
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
  function soundRow(id) {
    var t = ct(id);
    return '<div class="cell sound-row">' + badge(t.sym, 'chord') + '<span class="cell-text"><span class="cell-title">' + esc(t.name) + '</span><span class="cell-sub">' + esc(t.sound) + '</span></span></div>';
  }

  function feedbackView() {
    var q = sess.q, head, chord = isChord();
    var tag = q.hinted ? '<span class="tag">Hinted</span>' : '';
    var okTitle = q.hinted ? 'Correct' : sess.combo >= 5 ? 'On fire!' : sess.combo >= 3 ? 'Nice streak!' : 'Correct!';
    var gName = chord ? ct(fb.guess).name : full(fb.guess), gCode = chord ? ct(fb.guess).sym : code(fb.guess);
    var cCode = chord ? ct(q.id).sym : code(q.semis);
    var detail = chord ? chordName(q.root, q.id) + ', ' + C.invLabel(q.inv, q.open)
      : full(q.semis) + ', ' + (q.stage === 'harmonic' ? 'together' : q.stage === 'down' ? 'falling' : 'rising');
    if (fb.correct) {
      head = '<div class="result is-ok"><span class="result-icon">' + I.check + '</span>' +
        '<div class="result-text"><p class="result-title">' + okTitle + tag + '</p><p class="result-sub">' + esc(detail) + '</p></div></div>';
    } else {
      head = '<div class="result is-bad"><span class="result-icon">' + I.x + '</span>' +
        '<div class="result-text"><p class="result-title">Not quite' + tag + '</p><p class="result-sub">You answered <strong>' + esc(gName) + '</strong>. It was <strong>' + esc(detail) + '</strong>.</p></div></div>' +
        '<div class="contrast">' +
        '<button class="btn btn-tinted is-bad" type="button" data-action="play-guess">' + I.play + '<span>You said ' + esc(gCode) + '</span></button>' +
        '<button class="btn btn-tinted is-ok" type="button" data-action="play-correct">' + I.play + '<span>Correct ' + esc(cCode) + '</span></button>' +
        '<button class="btn btn-plain" type="button" data-action="play-both">Play both</button>' +
        '</div>';
    }
    var unlock = '';
    if (!chord && fb.ev && fb.ev.unlocked !== null) {
      unlock = '<div class="unlocked" role="status"><div class="unlocked-text"><p class="unlocked-k">New interval unlocked</p><p class="unlocked-name">' + esc(full(fb.ev.unlocked)) + '</p>' +
        '<p class="unlocked-sub">It will come up more often for the next sessions.</p></div>' +
        '<button class="btn btn-tinted" type="button" data-action="sample" data-semis="' + fb.ev.unlocked + '" data-stage="' + q.stage + '">' + I.play + '<span>Hear it</span></button></div>';
    } else if (!chord && fb.ev && fb.ev.mastered) {
      unlock = '<div class="unlocked" role="status"><div class="unlocked-text"><p class="unlocked-k">Stage complete</p><p class="unlocked-name">' + E.STAGE_LABEL[fb.ev.mastered] + '</p>' +
        (fb.ev.opened ? '<p class="unlocked-sub">Your next session starts ' + E.STAGE_LABEL[fb.ev.opened].toLowerCase() + ' with four intervals.</p>' : '<p class="unlocked-sub">You have completed all three stages.</p>') + '</div></div>';
    }
    var learn = chord
      ? '<div class="fb-learn"><div><h3 class="group-label">How it sounds</h3><div class="group">' + soundRow(q.id) + (fb.correct ? '' : soundRow(fb.guess)) + '</div></div>' +
        '<div class="fb-guitar"><h3 class="group-label">On guitar</h3>' + chordFretCard(q.root, q.offsets, q.id) + '</div></div>'
      : '<div class="fb-learn">' + anchorView(q) + '<div class="fb-guitar"><h3 class="group-label">On guitar</h3>' + fretCard(q.root, q.semis, q.stage) + '</div></div>';
    var last = sess.answers.length >= sess.length;
    return '<div class="next-row" id="feedback">' + head + '</div>' +
      '<div class="feedback">' + unlock + learn + '</div>' +
      '<div class="next-bar"><button class="btn btn-primary btn-lg btn-next" type="button" data-action="next" id="next">' +
      '<span>' + (last ? 'See results' : 'Next question') + '</span><kbd class="kbd-desk">Enter</kbd>' + I.chev + '</button></div>';
  }

  // ------------------------------------------------------------ progressions + scale degrees (slot answers)
  function hLabel(v) { return HMod().label(v); }
  function hSub(v) { return sess.kind === 'prog' ? P.quality(v) : D.name(v); }
  function keyText(q) { return P.keyLabel(q.tonic, q.mode); }
  function slotMode(q) { return q.n - q.given > 1; }
  function harmWhat(q) {
    if (sess.kind === 'prog') return q.cue ? 'Key, then ' + q.n + ' chords' : q.n + ' chords, no key cue';
    return 'Key, then ' + (q.n === 1 ? 'one note' : q.n + ' notes');
  }
  function slotsView(q) {
    var o = '';
    for (var i = 0; i < q.n; i++) {
      var given = i < q.given, v = q.picks[i], cls = 'slot', sub = '';
      if (q.answered) {
        var ok = String(v) === String(q.items[i]);
        cls += given ? ' is-given' : ok ? ' is-ok' : ' is-bad';
        sub = given ? 'Given' : ok ? '' : esc(hLabel(q.items[i]));
      } else {
        if (given) { cls += ' is-given'; sub = 'Given'; }
        else if (v !== undefined) cls += ' is-filled';
        else if (i === q.picks.length) cls += ' is-cur';
      }
      o += '<div class="' + cls + '" role="listitem" aria-label="' + (i + 1) + ': ' + (v !== undefined ? esc(hLabel(v)) : 'empty') + (given ? ', given' : '') + '">' +
        '<span class="slot-v">' + (v !== undefined ? esc(hLabel(v)) : '') + '</span>' +
        (sub ? '<span class="slot-sub">' + (q.answered && !given ? 'was ' : '') + sub + '</span>' : '') + '</div>';
    }
    var full = q.picks.length >= q.n, canUndo = q.picks.length > q.given;
    var tools = q.answered ? '' : '<div class="slot-tools">' +
      '<button class="btn btn-plain" type="button" data-action="undo"' + (canUndo ? '' : ' disabled') + '>Undo</button>' +
      '<button class="btn btn-plain" type="button" data-action="clear-slots"' + (canUndo ? '' : ' disabled') + '>Clear</button>' +
      '<button class="btn btn-primary" type="button" data-action="submit" id="submit"' + (full ? '' : ' disabled') + '>' + (full ? 'Check' : (q.n - q.picks.length) + ' to go') + '</button></div>';
    var pop = fb && fb.anim && fb.xp ? '<span class="xp-pop" aria-hidden="true">+' + fb.xp + ' XP</span>' : '';
    return '<div class="slots-wrap"><div class="slots" role="list" aria-label="Your answer" data-n="' + q.n + '">' + o + pop + '</div>' + tools + '</div>';
  }
  function harmGrid(q) {
    var single = !slotMode(q), pool = sess.pool, anim = fb && fb.anim;
    var grid = pool.map(function (v, i) {
      var cls = 'answer';
      if (q.answered && single) cls += String(v) === String(q.items[q.n - 1]) ? ' is-correct' : String(v) === String(q.picks[q.n - 1]) ? ' is-wrong' : ' is-dim';
      return '<button class="' + cls + '" type="button" data-action="pick" data-v="' + v + '">' +
        '<span class="answer-code">' + esc(hLabel(v)) + '</span><span class="answer-name">' + esc(hSub(v)) + '</span>' +
        (KEYS[i] ? '<kbd class="answer-key">' + KEYS[i] + '</kbd>' : '') +
        (anim && single && fb.correct && String(v) === String(q.items[q.n - 1]) && fb.xp ? '<span class="xp-pop" aria-hidden="true">+' + fb.xp + ' XP</span>' : '') +
        '</button>';
    }).join('');
    return '<div class="answers is-chords is-harm' + (sess.kind === 'prog' ? ' is-roman' : ' is-degrees') + '" data-n="' + pool.length + '">' + grid + '</div>';
  }
  function harmPracticeView() {
    var q = sess.q, num = Math.min(sess.answers.length + (q.answered ? 0 : 1), sess.length), L = sess.lv;
    var keyTool = !q.answered && (sess.kind === 'prog' ? L.cue : L.tool !== false);
    var combo = sess.combo >= 3 ? '<span class="combo' + (fb && fb.anim && fb.correct ? ' bump' : '') + (sess.combo >= 5 ? ' hot' : '') + '">' + I.flame + '<span class="num">' + sess.combo + '</span><span class="sr-only"> in a row</span></span>' : '';
    var ask = sess.kind === 'prog' ? (q.answered ? 'Tap a chord to hear it in the key' : 'Which chords?') : (q.answered ? 'Tap a degree to hear it resolve' : q.n > 1 ? 'Which degrees, in order?' : 'Which degree?');
    return '<section class="screen practice harm">' +
      '<div class="session-bar">' +
      '<button class="icon-btn" type="button" data-action="quit" aria-label="End session" title="End session (Esc)">' + I.x + '</button>' +
      segBar() + '<span class="session-count num">' + num + '<small>/' + sess.length + '</small></span></div>' +
      '<p class="session-title">' + sessTitle() + '</p>' +
      '<div class="listen' + (q.answered ? (fb.correct ? ' is-ok' : ' is-bad') : '') + '">' +
      '<button id="replay" class="play' + (playing ? ' is-playing' : '') + '" type="button" data-action="replay" aria-label="Play again">' +
      '<span class="play-face">' + I.play + '</span><span class="play-wave" aria-hidden="true"></span></button>' +
      '<p class="listen-q">' + ask + '</p>' +
      '<p class="listen-sub"><span>' + (q.answered ? esc(keyText(q)) : harmWhat(q)) + '</span>' + combo + replayInfo() + '</p>' +
      (keyTool ? '<div class="tools">' + toolBtn('hear-key', I.modes, 'Hear key', 'H') + '</div>' : '') +
      '</div>' +
      (slotMode(q) ? slotsView(q) : '') +
      harmGrid(q) +
      (q.answered ? harmFeedbackView() : '') +
      '</section>';
  }
  function progStrip(q) {
    return '<div class="prog-strip" data-n="' + q.n + '">' + q.items.map(function (id, i) {
      var given = i < q.given, ok = given || String(q.picks[i]) === String(id);
      return '<div class="pchord' + (ok ? '' : ' is-bad') + '"><span class="pchord-n">' + esc(P.label(id)) + '</span>' +
        '<span class="pchord-name">' + esc(P.chordName(id, q.tonic, q.mode, q.voiced[i].inv)) + '</span>' +
        (ok ? '' : '<span class="pchord-you">You: ' + esc(P.label(q.picks[i])) + '</span>') + '</div>';
    }).join('') + '</div>';
  }
  function songsView(seq) {
    var f = P.famousFor(seq);
    if (!f || !f.songs.length) return '';
    return '<div><h3 class="group-label">You know this one</h3><div class="group">' +
      f.songs.map(function (x) { return '<div class="cell song"><span class="cell-text"><span class="cell-title">' + esc(x) + '</span><span class="cell-sub">' + esc(f.name) + ' · ' + f.seq.map(P.label).join('–') + '</span></span></div>'; }).join('') +
      '</div></div>';
  }
  function degFret(tonic, mode, notes, items) {
    var list = [{ midi: tonic, label: HM.keyName(tonic, mode), name: 'Tonic ' + D.noteName(tonic, tonic, mode), cls: 'fb-root' }];
    notes.forEach(function (m, i) { list.push({ midi: m, label: D.label(items[i]), name: 'Degree ' + D.label(items[i]) + ', ' + D.noteName(m, tonic, mode), cls: 'fb-target' }); });
    var f = FB.renderNotes(list);
    var cap = 'Tonic ' + D.noteName(tonic, tonic, mode) + ' · ' + notes.map(function (m, i) { return D.label(items[i]) + ' = ' + D.noteName(m, tonic, mode); }).join(' · ');
    return '<div class="fret-card">' + (f.svg ? '<div class="fret-scroll">' + f.svg + '</div>' : '') +
      '<div class="fret-meta"><span class="legend"><span class="lg lg-root"></span>Tonic</span><span class="legend"><span class="lg lg-target"></span>Degree</span></div>' +
      '<p class="fret-caption num">' + esc(cap) + '</p>' + (f.desc ? '<p class="fret-desc">' + esc(f.desc) + '</p>' : '') + '</div>';
  }
  function harmFeedbackView() {
    var q = sess.q, isP = sess.kind === 'prog', ev = fb.ev, head;
    var okTitle = sess.combo >= 5 ? 'On fire!' : sess.combo >= 3 ? 'Nice streak!' : 'Correct!';
    var answerText = q.items.map(hLabel).join(isP ? ' – ' : ' · '), yours = q.picks.map(hLabel).join(isP ? ' – ' : ' · ');
    var inKey = isP ? q.items.map(function (id, i) { return P.chordName(id, q.tonic, q.mode, q.voiced[i].inv); }).join(' – ') + ' in ' + keyText(q)
      : answerText + ' in ' + keyText(q);
    if (fb.correct) {
      head = '<div class="result is-ok"><span class="result-icon">' + I.check + '</span><div class="result-text"><p class="result-title">' + okTitle + '</p><p class="result-sub">' + esc(inKey) + '</p></div></div>';
    } else {
      var title = ev.n > 1 && ev.right ? ev.right + ' of ' + ev.n + ' right' : 'Not quite';
      head = '<div class="result is-bad"><span class="result-icon">' + I.x + '</span><div class="result-text"><p class="result-title">' + title + '</p>' +
        '<p class="result-sub">You answered <strong>' + esc(yours) + '</strong>. It was <strong>' + esc(answerText) + '</strong>' + (isP ? '' : ' in ' + esc(keyText(q))) + '.</p></div></div>';
    }
    var btns = isP
      ? (fb.correct ? '<button class="btn btn-tinted is-ok" type="button" data-action="h-correct">' + I.play + '<span>Play it again</span></button>'
        : '<button class="btn btn-tinted is-bad" type="button" data-action="h-yours">' + I.play + '<span>Yours</span></button>' +
          '<button class="btn btn-tinted is-ok" type="button" data-action="h-correct">' + I.play + '<span>Correct</span></button>' +
          '<button class="btn btn-plain" type="button" data-action="h-both">Both</button>')
      : '<button class="btn btn-tinted is-ok" type="button" data-action="h-resolve">' + I.play + '<span>Resolution</span></button>' +
        (fb.correct ? '' : '<button class="btn btn-tinted is-bad" type="button" data-action="h-yours">' + I.play + '<span>Yours</span></button>') +
        '<button class="btn btn-plain" type="button" data-action="h-correct">With key</button>';
    var learn = isP
      ? '<div class="fb-learn"><div><h3 class="group-label">In ' + esc(keyText(q)) + '</h3>' + progStrip(q) + '</div>' + songsView(q.items) + '</div>'
      : '<div class="fb-learn"><div><h3 class="group-label">How it feels</h3><div class="group">' +
          q.items.filter(function (d, i, a) { return a.indexOf(d) === i; }).map(function (d) {
            return '<div class="cell sound-row">' + badge(D.label(d), 'chord') + '<span class="cell-text"><span class="cell-title">' + esc(D.name(d)) + '</span><span class="cell-sub">' + esc(D.feel(d)) + '</span></span></div>';
          }).join('') + '</div></div>' +
        '<div class="fb-guitar"><h3 class="group-label">On guitar</h3>' + degFret(q.tonic, q.mode, q.notes, q.items) + '</div></div>';
    var last = sess.answers.length >= sess.length;
    return '<div class="next-row" id="feedback">' + head + '<div class="contrast">' + btns + '</div></div>' +
      '<div class="feedback">' + learn + '</div>' +
      '<div class="next-bar"><button class="btn btn-primary btn-lg btn-next" type="button" data-action="next" id="next">' +
      '<span>' + (last ? 'See results' : 'Next question') + '</span><kbd class="kbd-desk">Enter</kbd>' + I.chev + '</button></div>';
  }
  // playback after an answer
  function hPlayCorrect(btn) {
    var q = sess.q;
    if (sess.kind === 'prog') playEvents(P.correctEvents(q), instrumentFor(q), btn);
    else playEvents(D.questionEvents(q), instrumentFor(q), btn);
  }
  function hPlayYours(btn) {
    var q = sess.q;
    if (sess.kind === 'prog') playEvents(P.guessEvents(q), instrumentFor(q), btn);
    else playEvents(D.resolutionEvents(D.guessNotes(q), q.tonic, q.mode), instrumentFor(q), btn);
  }
  function hPlayBoth(btn) { var q = sess.q; playEvents(chain([P.guessEvents(q), P.correctEvents(q)], 0.8), instrumentFor(q), btn); }
  function hResolve(btn) { var q = sess.q; playEvents(D.resolutionEvents(q.notes, q.tonic, q.mode), instrumentFor(q), btn); }
  function hHearKey() { var q = sess.q; playEvents(HM.cadence(q.tonic, q.mode, 0).events, instrumentFor(q)); }
  /** Tapping a numeral or degree after the answer: hear it in the question's key. */
  function hPlayOne(v, btn) {
    var q = sess.q;
    if (sess.kind === 'prog') playEvents(P.seqEvents([v], q.tonic, 1.2), instrumentFor(q), btn);
    else playEvents(D.resolutionEvents([q.tonic + (+v)], q.tonic, q.mode), instrumentFor(q), btn);
  }
  function pick(v, btn) {
    var q = sess.q;
    if (q.answered) { hPlayOne(v, btn); return; }
    if (q.picks.length >= q.n) return;
    q.picks.push(sess.kind === 'deg' ? +v : v);
    if (!slotMode(q)) { submitHarm(); return; }
    render();
    if (q.picks.length >= q.n) { var b = document.getElementById('submit'); if (b) b.focus({ preventScroll: true }); }
  }
  function undoPick() { var q = sess.q; if (!q.answered && q.picks.length > q.given) { q.picks.pop(); render(); } }
  function clearPicks() { var q = sess.q; if (!q.answered) { q.picks = q.items.slice(0, q.given); render(); } }
  function submitHarm() {
    var q = sess.q, M = HMod();
    if (q.answered || q.picks.length < q.n) return;
    clearTimeout(askTimer);
    q.answered = true;
    var ev = M.record(S, q);
    sess.answers.push({ correct: ev.correct, hinted: false, items: ev.items, right: ev.right, n: ev.n });
    if (ev.correct) { sess.combo++; sess.bestCombo = Math.max(sess.bestCombo, sess.combo); } else sess.combo = 0;
    S.bestCombo = Math.max(S.bestCombo || 0, sess.bestCombo);
    var xp = M.answerXp(sess, ev, sess.combo), xpBase = M.answerXp(sess, ev, 0);
    gain(xpBase, 'xpAnswers'); gain(xp - xpBase, 'xpCombo');
    if (sess.answers.length >= sess.length) {
      if (sess.pack) { var r = M.recordLevel(S, sess); sess.xp += r.xpBonus; sess.xpStars += r.xpBonus; }
      else gain(E.SESSION_BONUS, 'xpSession');
    }
    newAchievements();
    persist();
    fb = { guess: q.picks.slice(), correct: ev.correct, ev: ev, anim: true, xp: xp };
    render();
    fb.anim = false;
    var d = sfx(ev.correct ? 'right' : 'wrong');
    if (sess.kind === 'deg' || !ev.correct) {
      askTimer = setTimeout(function () {
        if (!sess || sess.q !== q || view !== 'practice') return;
        if (sess.kind === 'deg') hResolve(); else hPlayBoth();
      }, d + 160);
    }
    var n = document.getElementById('next'); if (n) n.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------ free practice: progressions + degrees
  function segRadios(name, opts, cur, label) {
    return '<div class="seg" role="radiogroup" aria-label="' + label + '">' + opts.map(function (o) {
      return '<label><input type="radio" name="' + name + '" value="' + o[0] + '"' + (String(cur) === String(o[0]) ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
    }).join('') + '</div>';
  }
  function progFreeView() {
    var f = S.prog.free, list = P.sortPool(P.MODE_CHORDS[f.mode]);
    var rows = list.map(function (id) {
      var on = f.pool.indexOf(id) >= 0;
      return '<button class="cell cell-btn cell-check' + (on ? ' is-on' : '') + '" type="button" role="checkbox" aria-checked="' + on + '" data-action="pfree-toggle" data-id="' + id + '">' +
        badge(P.label(id), 'chord') + '<span class="cell-title">' + esc(P.quality(id)) + '</span><span class="check">' + I.check + '</span></button>';
    }).join('');
    return '<section class="screen free">' + backBtn() +
      '<div class="title-block"><h1>Free practice</h1>' +
      '<p class="lede">Pick the key type, the chords and the length. ' + P.FREE_LEN + ' progressions in a new key each time.</p></div>' +
      '<h2 class="group-label">Key</h2>' + segRadios('pfree-mode', [['major', 'Major'], ['minor', 'Minor']], f.mode, 'Key type') +
      '<h2 class="group-label">Length</h2>' + segRadios('pfree-len', [[3, '3 chords'], [4, '4 chords']], f.len, 'Chords per progression') +
      '<h2 class="group-label"><span>Chords</span><span class="group-tools"><button class="link" type="button" data-action="pfree-basic">Basics</button>' +
      '<button class="link" type="button" data-action="pfree-all">All</button></span></h2>' +
      '<div class="group">' + rows + '</div>' +
      startBar(f.pool.length, P.MIN_POOL, 'start-pfree', 'chords') + '</section>';
  }
  function degFreeView() {
    var f = S.deg.free, scale = D.SCALE[f.mode];
    var rows = D.ORDER.map(Number).map(function (d) {
      var on = f.pool.indexOf(d) >= 0;
      return '<button class="cell cell-btn cell-check' + (on ? ' is-on' : '') + '" type="button" role="checkbox" aria-checked="' + on + '" data-action="dfree-toggle" data-d="' + d + '">' +
        badge(D.label(d), 'chord') + '<span class="cell-text"><span class="cell-title">' + esc(D.name(d)) + '</span>' + (scale.indexOf(d) < 0 ? '<span class="cell-sub">Outside the ' + f.mode + ' scale</span>' : '') + '</span><span class="check">' + I.check + '</span></button>';
    }).join('');
    return '<section class="screen free">' + backBtn() +
      '<div class="title-block"><h1>Free practice</h1>' +
      '<p class="lede">Pick the key type, the degrees and how many notes per question. ' + D.FREE_LEN + ' questions in a new key each time.</p></div>' +
      '<h2 class="group-label">Key</h2>' + segRadios('dfree-mode', [['major', 'Major'], ['minor', 'Minor']], f.mode, 'Key type') +
      '<h2 class="group-label">Notes per question</h2>' + segRadios('dfree-notes', [[1, 'One'], [2, 'Two'], [3, 'Three']], f.notes, 'Notes per question') +
      '<h2 class="group-label"><span>Degrees</span><span class="group-tools"><button class="link" type="button" data-action="dfree-scale">Scale</button>' +
      '<button class="link" type="button" data-action="dfree-all">All</button></span></h2>' +
      '<div class="group">' + rows + '</div>' +
      startBar(f.pool.length, D.MIN_POOL, 'start-dfree', 'degrees') + '</section>';
  }

  // ------------------------------------------------------------ library: progressions + degrees
  function keyCell(text, sub, action) {
    return '<div class="group"><div class="cell root-cell"><span class="cell-text"><span class="cell-title">Key</span><span class="cell-sub">' + sub + '</span></span>' +
      '<span class="root-val">' + esc(text) + '</span>' +
      '<button class="pill-btn small" type="button" data-action="' + action + '">' + I.shuffle + '<span>New key</span></button></div></div>';
  }
  function progLibraryView() {
    var T = 60 + plibTonic;
    var items = P.LIB.map(function (x) {
      var open = plibOpen === x.id, body = '';
      var names = x.seq.map(function (id) { return P.chordName(id, T, x.mode, 0); });
      if (open) {
        body = '<div class="lib-body" id="plib-' + x.id + '">' +
          '<div class="duo">' +
          '<button class="btn btn-tinted" type="button" data-action="plib-play" data-id="' + x.id + '">' + I.play + '<span>Play</span></button>' +
          '<button class="btn btn-tinted" type="button" data-action="plib-play" data-cue="1" data-id="' + x.id + '">' + I.play + '<span>Key first</span></button>' +
          '</div>' +
          '<p class="sound-line"><strong>In ' + esc(P.keyLabel(T, x.mode)) + ':</strong> ' + esc(names.join(' – ')) + '</p>' +
          (x.songs.length ? '<p class="sub-label">Heard in</p><div class="inner-group">' + x.songs.map(function (sg) { return '<div class="cell song"><span class="cell-text"><span class="cell-title">' + esc(sg) + '</span></span></div>'; }).join('') + '</div>' : '') +
          '</div>';
      }
      return '<div class="lib-item' + (open ? ' is-open' : '') + '">' +
        '<button class="cell cell-btn lib-row" type="button" data-action="plib-toggle" data-id="' + x.id + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="plib-' + x.id + '"' : '') + '>' +
        '<span class="cell-text"><span class="cell-title">' + esc(x.name) + '</span><span class="cell-sub roman">' + esc(x.seq.map(P.label).join(' – ')) + '</span></span>' +
        (x.mode === 'minor' ? '<span class="song-tag">Minor</span>' : '') + I.chev + '</button>' + body + '</div>';
    }).join('');
    return '<section class="screen library">' +
      '<h1 class="tab-title">Library</h1>' + switcher('Library type') +
      keyCell(HM.keyName(T, 'major'), 'Major and minor progressions start here', 'plib-key') +
      '<div class="group lib-list">' + items + '</div>' +
      '<p class="group-foot">Song examples are listed only where the chords match exactly.</p>' +
      '</section>';
  }
  function degLibraryView() {
    var T = dlibTonic;
    var items = D.ORDER.map(Number).map(function (d) {
      var open = dlibOpen === d, a = D.accuracy(S, String(d)), body = '';
      if (open) {
        body = '<div class="lib-body" id="dlib-' + d + '">' +
          '<div class="duo">' +
          '<button class="btn btn-tinted" type="button" data-action="dlib-play" data-d="' + d + '">' + I.play + '<span>Hear in key</span></button>' +
          '<button class="btn btn-tinted" type="button" data-action="dlib-play" data-d="' + d + '" data-bare="1">' + I.play + '<span>Walk home</span></button>' +
          '</div>' +
          '<p class="sound-line"><strong>' + esc(D.label(d)) + ' in ' + esc(P.keyLabel(T, 'major')) + ' is ' + esc(D.noteName(T + d, T, 'major').replace(/-?\d+$/, '')) + '.</strong> ' + esc(D.feel(d)) + '</p>' +
          '<p class="sub-label">On guitar</p>' + degFret(T, 'major', [T + d], [d]) +
          '</div>';
      }
      return '<div class="lib-item' + (open ? ' is-open' : '') + '">' +
        '<button class="cell cell-btn lib-row" type="button" data-action="dlib-toggle" data-d="' + d + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="dlib-' + d + '"' : '') + '>' +
        badge(D.label(d), 'chord') + '<span class="cell-text"><span class="cell-title">' + esc(D.name(d)) + '</span><span class="cell-sub">' + esc(D.feel(d)) + '</span></span>' +
        (a.n ? '<span class="cell-value num">' + pct(a.acc) + '</span>' : '') + I.chev + '</button>' + body + '</div>';
    }).join('');
    return '<section class="screen library">' +
      '<h1 class="tab-title">Library</h1>' + switcher('Library type') +
      keyCell(P.keyLabel(T, 'major'), 'Every degree is heard against this key', 'dlib-key') +
      '<div class="group lib-list">' + items + '</div>' +
      '<p class="group-foot">Each degree plays after a short I–IV–V–I, then walks stepwise to the nearest tonic.</p>' +
      '</section>';
  }
  function plibPlay(id, cue, btn) {
    var x = null; P.LIB.forEach(function (y) { if (y.id === id) x = y; });
    if (!x) return;
    ensureAudio().then(function () {
      var T = 60 + plibTonic, ev = P.seqEvents(x.seq, T, x.fast ? 0.62 : 0.9);
      if (cue) ev = chain([HM.cadence(T, x.mode, 0).events, ev], 0.5);
      playEvents(ev, baseInstrument(), btn);
    });
  }
  function dlibPlay(d, bare, btn) {
    ensureAudio().then(function () {
      playEvents(bare ? D.resolutionEvents([dlibTonic + d], dlibTonic, 'major') : D.demoEvents(d, dlibTonic, 'major'), baseInstrument(), btn);
    });
  }

  // ------------------------------------------------------------ progress: progressions + degrees
  function harmStats(kind) {
    var M = modOf(kind), isP = kind === 'progressions', st = isP ? S.prog : S.deg;
    var ids = isP ? P.ORDER.filter(function (id) { return st.hist[id]; }) : D.ORDER;
    var rows = ids.map(function (id) {
      var a = M.accuracy(S, id);
      return '<div class="cell stat-row">' + badge(M.label(id), 'chord') + '<span class="cell-title">' + esc(isP ? P.quality(id) : D.name(id)) + '</span>' +
        (a.n ? '<span class="rbar"><span style="width:' + (a.acc * 100) + '%"></span></span><span class="num cell-value">' + pct(a.acc) + '</span>'
          : '<span class="num cell-value muted">–</span>') + '</div>';
    }).join('');
    var mix = M.mixups(S, 5).map(function (m) {
      return '<div class="cell"><span class="cell-title">' + esc(M.label(m.correct)) + ' heard as ' + esc(M.label(m.guess)) + '</span><span class="cell-value num">' + m.count + '×</span></div>';
    }).join('');
    return '<h2 class="group-label"><span>Biggest mix-ups</span></h2>' +
      '<div class="group">' + (mix || '<div class="cell"><span class="cell-sub">No mix-ups yet. They show up here once you miss a ' + (isP ? 'chord' : 'degree') + '.</span></div>') + '</div>' +
      '<h2 class="group-label"><span>' + (isP ? 'By numeral' : 'By degree') + '</span><span class="group-aside">Last 20 answers</span></h2>' +
      '<div class="group">' + (rows || '<div class="cell"><span class="cell-sub">Play a progression pack to see each numeral here.</span></div>') + '</div>' +
      '<p class="group-foot">' + st.total + (isP ? ' progressions, ' : ' questions, ') + st.right + ' of ' + st.items + (isP ? ' chords' : ' notes') + ' right.</p>';
  }

  // ------------------------------------------------------------ summary
  function summaryView() {
    var harm = isHarm(), M = harm ? HMod() : null, isP = M === P;
    var chord = isChord(), sum = harm ? M.summarize(sess) : chord ? C.summarize(sess) : E.summarize(S, sess);
    var rows = sum.rows.map(function (r) {
      var b = harm ? badge(M.label(r.id), 'chord') : chord ? badge(ct(r.id).sym, 'chord') : ibadge(r.semis);
      var nm = harm ? (isP ? P.quality(r.id) : D.name(r.id)) : chord ? ct(r.id).name : info(r.semis).name;
      return '<div class="cell stat-row">' + b + '<span class="cell-title">' + esc(nm) + '</span>' +
        '<span class="rbar"><span style="width:' + (r.acc * 100) + '%"></span></span><span class="num cell-value">' + r.ok + '/' + r.n + '</span></div>';
    }).join('');
    function nameOf(v) { return harm ? M.label(v) : chord ? ct(v).name : full(v); }
    function codeOf(v) { return harm ? M.label(v) : chord ? ct(v).sym : code(v); }
    var notes = [];
    if (harm && sum.items > sum.n) notes.push('<div class="cell"><span class="cell-title">' + (isP ? 'Chords right' : 'Notes right') + '</span><span class="cell-value num">' + sum.right + ' of ' + sum.items + '</span></div>');
    if (sum.weakest) notes.push('<div class="cell"><span class="cell-title">Weakest</span><span class="cell-value">' + esc(nameOf(chord || harm ? sum.weakest.id : sum.weakest.semis)) + ' <span class="num muted">' + pct(sum.weakest.acc) + '</span></span></div>');
    if (sum.confusion) notes.push('<div class="cell"><span class="cell-title">Biggest mix-up</span><span class="cell-value">' + esc(codeOf(sum.confusion.correct)) + ' heard as ' + esc(codeOf(sum.confusion.guess)) + ' <span class="num muted">' + sum.confusion.count + '×</span></span></div>');
    if (sum.hinted) notes.push('<div class="cell"><span class="cell-title">With hint</span><span class="cell-value num">' + sum.hinted + '</span></div>');
    if (sess.bestCombo >= 2) notes.push('<div class="cell"><span class="cell-title">Best combo</span><span class="cell-value num">' + sess.bestCombo + ' in a row</span></div>');
    if (!sum.weakest && !sum.confusion) notes.push('<div class="cell"><span class="cell-title">Mistakes</span><span class="cell-value">None. Clean run.</span></div>');

    var res = sess.result, complete = sess.answers.length >= sess.length, isLevel = chord || harm ? !!sess.pack : !!sess.scale;
    var levels = harm ? M.LEVELS : chord ? C.LEVELS : E.LEVELS, packName = chord || harm ? sess.packName : sess.scaleName, packId = chord || harm ? sess.pack : sess.scale;
    var top, actions;
    if (isLevel && res) {
      var msg = res.stars === 3 ? (res.pct === 100 ? 'Perfect!' : 'Superb!') : res.stars === 2 ? 'Great run!' : res.stars === 1 ? 'Level clear!' : 'So close';
      var hasNext = sess.level < levels.length && K(sessKind()).unlocked(packId, sess.level + 1);
      top = '<div class="win' + (res.stars === 3 ? ' is-perfect' : '') + '">' +
        '<p class="kicker">' + esc(packName) + ' · Level ' + sess.level + ' · ' + sess.lv.name + '</p>' +
        stars(res.stars, 3, 'big pop') +
        '<h1 class="win-title">' + msg + '</h1>' +
        '<p class="win-score num"><span>' + res.pct + '%</span> ' + res.ok + ' of ' + res.n + (sum.hinted ? ' · hints count as wrong' : '') + '</p>' +
        (res.newBest && res.runsBefore ? '<p class="badge-line">New best</p>' : '') +
        (res.unlockedNext ? '<p class="unlock-line">' + I.lock + 'Level ' + (sess.level + 1) + ' unlocked: ' + levels[sess.level].name + '</p>' : '') +
        (res.stars === 0 ? '<p class="lede">You need 70% (' + Math.ceil(0.7 * res.n) + ' of ' + res.n + ') for the first star.</p>' : '') +
        '</div>';
      actions = (hasNext ? '<button class="btn btn-primary btn-lg" type="button" data-action="next-level">Level ' + (sess.level + 1) + ': ' + levels[sess.level].name + '</button>' : '') +
        '<button class="btn ' + (hasNext ? 'btn-plain' : 'btn-primary') + ' btn-lg" type="button" data-action="again">Retry level</button>' +
        '<button class="btn btn-plain btn-lg" type="button" data-action="to-map">Level map</button>';
    } else {
      var score = sum.n ? sum.ok / sum.n : 0;
      var unlockedNow = !chord && sess.guided && S.stages[sess.stage].unlocked > sess.startedWith;
      top = '<div class="win">' +
        '<p class="kicker">' + (isLevel ? esc(packName) + ' · stopped early' : sess.guided ? E.STAGE_LABEL[sess.stage] : chord ? 'Chords · free practice' : harm ? (isP ? 'Progressions' : 'Scale degrees') + ' · free practice' : 'Free practice') + '</p>' +
        '<h1 class="win-title">' + (complete ? 'Session complete' : 'Session ended') + '</h1>' +
        '<p class="win-score num"><span>' + Math.round(score * 100) + '%</span> ' + sum.ok + ' of ' + sum.n + '</p>' +
        (unlockedNow ? '<p class="unlock-line">' + I.lock + 'Unlocked ' + E.ORDER.slice(sess.startedWith, S.stages[sess.stage].unlocked).map(full).map(esc).join(' and ') + '</p>' : '') +
        (isLevel ? '<p class="lede">Finish all ' + sess.length + ' questions to earn stars.</p>' : '') +
        '</div>';
      actions = '<button class="btn btn-primary btn-lg" type="button" data-action="again">' + (isLevel ? 'Retry level' : 'New session') + '</button>' +
        '<button class="btn btn-plain btn-lg" type="button" data-action="' + (isLevel ? 'to-map' : 'done') + '">' + (isLevel ? 'Level map' : 'Done') + '</button>';
    }
    return '<section class="screen summary">' + top + xpCard() +
      '<div class="actions">' + actions + '</div>' +
      '<div class="group">' + notes.join('') + '</div>' +
      (rows ? '<h2 class="group-label">' + (harm ? (isP ? 'By numeral' : 'By degree') : chord ? 'By chord' : 'By interval') + '</h2><div class="group">' + rows + '</div>' : '') +
      (!chord && sess.guided ? unlockBlock(S.guided) : '') +
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
      // only show it while the summary is still on screen; otherwise it waits for the next summary
      setTimeout(function () {
        if (view !== 'summary') return;
        S.rankSeen = ri.index; persist();
        rankUp(ri);
      }, delay + 700);
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

  // ------------------------------------------------------------ progress tab
  function niceDate(k) {
    var d = new Date(k + 'T12:00:00');
    return isNaN(d) ? k : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function rankCard() {
    var ri = E.rankInfo(S.xp), st = E.streak(S), tx = E.todayXp(S), ts = E.totalStars(S) + C.totalStars(S) + P.totalStars(S) + D.totalStars(S);
    var goalHit = tx >= E.DAILY_GOAL;
    return '<div class="rank-card">' +
      '<div class="rank-top">' + rankBadge(ri, 'lg') +
      '<span class="rank-text"><span class="rank-k">Rank ' + ri.n + ' of ' + E.RANKS.length + '</span><span class="rank-name">' + esc(ri.name) + '</span></span></div>' +
      xpBar(ri.frac) + xpLine(ri) +
      '<div class="today">' +
      '<div class="today-item">' + ring(tx / E.DAILY_GOAL, goalHit ? 'is-done' : '') +
      '<span class="today-text"><span class="today-v num">' + (goalHit ? E.DAILY_GOAL : fmt(tx)) + '<small>/' + E.DAILY_GOAL + '</small></span><span class="today-l">' + (goalHit ? 'Goal met today' : 'Daily goal') + '</span></span></div>' +
      '<div class="today-item"><span class="today-ic flame' + (st.today ? ' is-lit' : '') + '">' + I.flame + '</span>' +
      '<span class="today-text"><span class="today-v num">' + st.days + '</span><span class="today-l">' + (st.days && !st.today ? 'Practice to keep it' : 'Day streak') + '</span></span></div>' +
      '<div class="today-item"><span class="today-ic gold">' + I.star + '</span>' +
      '<span class="today-text"><span class="today-v num">' + ts + '</span><span class="today-l">Stars</span></span></div>' +
      '</div></div>';
  }
  function intervalStats() {
    return E.STAGES.map(function (id) {
      var s = S.stages[id], status;
      if (s.mastered) status = '<span class="pill is-ok">Complete</span>';
      else if (s.open) status = '<span class="pill is-on">' + (S.guided === id ? 'Current' : 'Open') + '</span>';
      else status = '<span class="pill">Locked</span>';
      var rows = E.ORDER.map(function (semis, i) {
        var unlocked = s.open && i < s.unlocked, a = E.accuracy(S, id, semis);
        return '<div class="cell stat-row' + (unlocked ? '' : ' is-locked') + '">' + ibadge(semis) + '<span class="cell-title">' + esc(info(semis).name) + '</span>' +
          (unlocked
            ? '<span class="rbar"><span style="width:' + ((a.acc || 0) * 100) + '%"></span></span><span class="num cell-value">' + (a.n ? pct(a.acc) : '–') + '</span>'
            : '<span class="cell-value muted lock-ic">' + I.lock + '</span>') + '</div>';
      }).join('');
      var count = s.open ? s.unlocked : 0;
      return '<h2 class="group-label"><span>Guided · ' + E.STAGE_LABEL[id] + '</span>' + status + '</h2>' +
        '<div class="group">' + rows + '</div>' +
        '<p class="group-foot">' + count + ' of 12 unlocked' + (s.open ? ' · accuracy over the last 20 answers' : '') + '</p>';
    }).join('');
  }
  function chordStats() {
    var rows = C.TYPES.map(function (t) {
      var a = C.accuracy(S, t.id);
      return '<div class="cell stat-row">' + badge(t.sym, 'chord') + '<span class="cell-title">' + esc(t.name) + '</span>' +
        (a.n ? '<span class="rbar"><span style="width:' + (a.acc * 100) + '%"></span></span><span class="num cell-value">' + pct(a.acc) + '</span>'
          : '<span class="num cell-value muted">–</span>') + '</div>';
    }).join('');
    var mix = C.mixups(S, 5).map(function (m) {
      return '<div class="cell"><span class="cell-title">' + esc(ct(m.correct).name) + ' heard as ' + esc(ct(m.guess).name) + '</span><span class="cell-value num">' + m.count + '×</span></div>';
    }).join('');
    return '<h2 class="group-label"><span>Biggest mix-ups</span></h2>' +
      '<div class="group">' + (mix || '<div class="cell"><span class="cell-sub">No mix-ups yet. They show up here once you miss a chord.</span></div>') + '</div>' +
      '<h2 class="group-label"><span>By chord type</span><span class="group-aside">Last 20 answers</span></h2>' +
      '<div class="group">' + rows + '</div>' +
      '<p class="group-foot">' + S.chords.total + ' chord answers' + (S.chords.hinted ? ', ' + S.chords.hinted + ' with a hint' : '') + '.</p>';
  }
  function progressView() {
    var st = E.streak(S), got = 0, ri = E.rankInfo(S.xp);
    var ach = E.ACHIEVEMENTS.map(function (a) {
      var d = S.ach[a.id]; if (d) got++;
      return '<li class="ach' + (d ? ' is-got' : '') + '"><span class="ach-ic">' + (d ? I.trophy : I.lock) + '</span>' +
        '<span class="ach-text"><span class="ach-name">' + esc(a.name) + '</span><span class="ach-desc">' + esc(a.desc) + '</span>' +
        (d ? '<span class="ach-date">Earned ' + esc(niceDate(d)) + '</span>' : '') + '</span></li>';
    }).join('');
    var ladder = E.RANKS.map(function (r, i) {
      var state = i < ri.index ? 'is-past' : i === ri.index ? 'is-current' : 'is-future';
      return '<div class="cell rung ' + state + '">' + rankBadge(E.rankInfo(r.xp), 'sm') +
        '<span class="cell-text"><span class="cell-title">' + esc(r.name) + '</span>' +
        (i === ri.index ? '<span class="cell-sub">You are here' + (ri.next !== null ? ' · ' + Math.round(ri.frac * 100) + '% to the next rank' : '') + '</span>' : '') + '</span>' +
        '<span class="cell-value num">' + (i < ri.index ? I.check : '') + fmt(r.xp) + ' XP</span></div>';
    }).join('');
    var ps = progSec || sec();
    return '<section class="screen progress">' +
      '<h1 class="tab-title">Progress</h1>' +
      rankCard() +
      '<div class="stats">' +
      '<div><span class="stat-val num">' + fmt(S.total) + '</span><span class="stat-label">Interval answers</span></div>' +
      '<div><span class="stat-val num">' + fmt(S.chords.total + S.prog.total + S.deg.total) + '</span><span class="stat-label">Chord, progression and degree answers</span></div>' +
      '<div><span class="stat-val num">' + st.total + '</span><span class="stat-label">Days practiced</span></div>' +
      '<div><span class="stat-val num">' + (S.bestCombo || 0) + '</span><span class="stat-label">Best combo</span></div></div>' +
      '<h2 class="group-label"><span>Achievements</span><span class="group-aside num">' + got + ' of ' + E.ACHIEVEMENTS.length + '</span></h2>' +
      '<ul class="ach-grid">' + ach + '</ul>' +
      '<h2 class="group-label">Your ear</h2>' +
      switcher('Stats for', 'prog-sec', ps, 'small') +
      (ps === 'chords' ? chordStats() : ps === 'progressions' || ps === 'degrees' ? harmStats(ps) : intervalStats()) +
      '<h2 class="group-label">Rank ladder</h2>' +
      '<div class="group ladder">' + ladder + '</div>' +
      '<p class="group-foot">XP per correct answer: 10 on the guided path, 10 to 18 in levels, plus up to 5 for a combo. Progressions and multi-note degrees pay per chord or note, and more for longer questions. Stars add 15 each; a first three-star run adds 60.</p>' +
      '</section>';
  }

  // ------------------------------------------------------------ library tab
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
        ibadge(semis) + '<span class="cell-text"><span class="cell-title">' + esc(inf.name) + '</span><span class="cell-sub">' + sub + '</span></span>' +
        (isUn ? '' : '<span class="lock-ic">' + I.lock + '</span>') + I.chev + '</button>' + body + '</div>';
    }).join('');
    return '<section class="screen library">' +
      '<h1 class="tab-title">Library</h1>' + switcher('Library type') +
      rootCell(libRoot, 'Every interval starts here', 'lib-root') +
      '<div class="group lib-list">' + items + '</div>' +
      '</section>';
  }
  function rootCell(root, sub, action) {
    return '<div class="group"><div class="cell root-cell"><span class="cell-text"><span class="cell-title">Root note</span><span class="cell-sub">' + sub + '</span></span>' +
      '<span class="root-val num">' + FB.noteWithOctave(root) + '</span>' +
      '<button class="pill-btn small" type="button" data-action="' + action + '">' + I.shuffle + '<span>New root</span></button></div></div>';
  }
  function chordLibraryView() {
    var items = C.TYPES.map(function (t) {
      var open = clibOpen === t.id, a = C.accuracy(S, t.id), body = '';
      if (open) {
        var off = C.voicing(t.id, 0, false);
        body = '<div class="lib-body" id="clib-' + t.id + '">' +
          '<div class="duo">' +
          '<button class="btn btn-tinted" type="button" data-action="clib-play" data-style="arp" data-id="' + t.id + '">' + I.play + '<span>Arpeggio</span></button>' +
          '<button class="btn btn-tinted" type="button" data-action="clib-play" data-style="block" data-id="' + t.id + '">' + I.play + '<span>Block</span></button>' +
          '</div>' +
          '<p class="sound-line"><strong>' + esc(chordName(clibRoot, t.id)) + '.</strong> ' + esc(t.sound) + '</p>' +
          '<p class="sub-label">On guitar</p>' + chordFretCard(clibRoot, off, t.id) +
          '</div>';
      }
      return '<div class="lib-item' + (open ? ' is-open' : '') + '">' +
        '<button class="cell cell-btn lib-row" type="button" data-action="clib-toggle" data-id="' + t.id + '" aria-expanded="' + open + '"' + (open ? ' aria-controls="clib-' + t.id + '"' : '') + '>' +
        badge(t.sym, 'chord') + '<span class="cell-text"><span class="cell-title">' + esc(t.name) + '</span><span class="cell-sub">' + esc(t.sound) + '</span></span>' +
        (a.n ? '<span class="cell-value num">' + pct(a.acc) + '</span>' : '') + I.chev + '</button>' + body + '</div>';
    }).join('');
    return '<section class="screen library">' +
      '<h1 class="tab-title">Library</h1>' + switcher('Library type') +
      rootCell(clibRoot, 'Every chord is built on it', 'clib-root') +
      '<div class="group lib-list">' + items + '</div>' +
      '</section>';
  }

  // ------------------------------------------------------------ settings tab
  function settingsView() {
    var set = S.settings;
    var inst = ['guitar', 'piano', 'mix'].map(function (v) {
      return '<label><input type="radio" name="inst" value="' + v + '"' + (set.instrument === v ? ' checked' : '') + '><span>' + { guitar: 'Guitar', piano: 'Piano', mix: 'Alternate' }[v] + '</span></label>';
    }).join('');
    return '<section class="screen settings">' +
      '<h1 class="tab-title">Settings</h1>' +
      '<h2 class="group-label" id="inst-label">Instrument</h2>' +
      '<div class="seg" role="radiogroup" aria-labelledby="inst-label">' + inst + '</div>' +
      '<p class="group-foot">Alternate switches sound from question to question, so you learn the sound, not the timbre. Master levels always pick at random.</p>' +
      '<h2 class="group-label">Sound</h2>' +
      '<div class="group">' +
      '<div class="cell cell-vol"><label class="cell-title" for="set-volume">Volume</label><input type="range" id="set-volume" min="0" max="1" step="0.01" value="' + set.volume + '"></div>' +
      '<label class="cell cell-toggle"><span class="cell-text"><span class="cell-title">Sound effects</span>' +
      '<span class="cell-sub">Soft chimes for right, wrong, stars and rank-ups. Never over the music.</span></span>' +
      '<input type="checkbox" id="set-sfx" class="switch" role="switch"' + (set.sfx ? ' checked' : '') + '></label>' +
      '</div>' +
      (E.storageOk() ? '' : '<p class="group-foot warn">Your browser is not saving progress right now. The app still works, but it will forget this session when you close it.</p>') +
      '<div class="desk-only"><h2 class="group-label">Keyboard</h2>' +
      '<div class="group keys">' +
      '<div class="cell"><span>Replay</span><span><kbd>Space</kbd></span></div>' +
      '<div class="cell"><span>Answer</span><span><kbd>1</kbd>&ndash;<kbd>9</kbd> <kbd>0</kbd> <kbd>-</kbd> <kbd>=</kbd></span></div>' +
      '<div class="cell"><span>Next question</span><span><kbd>Enter</kbd> / <kbd>Space</kbd></span></div>' +
      '<div class="cell"><span>Hint</span><span><kbd>F</kbd></span></div>' +
      '<div class="cell"><span>Undo last pick</span><span><kbd>Backspace</kbd></span></div>' +
      '<div class="cell"><span>Hear scale, chord or key</span><span><kbd>H</kbd></span></div>' +
      '<div class="cell"><span>Library</span><span><kbd>L</kbd></span></div>' +
      '</div></div>' +
      '<h2 class="group-label">Data</h2>' +
      '<div class="group"><button class="cell cell-btn danger' + (resetArmed ? ' is-armed' : '') + '" type="button" data-action="reset">' +
      '<span class="cell-title">' + (resetArmed ? 'Tap again to erase everything' : 'Reset progress') + '</span></button></div>' +
      '<p class="group-foot">Erases all progress, stats and stars in every section. Settings are kept.</p>' +
      '</section>';
  }

  // ------------------------------------------------------------ flow
  function startSession(opts, btn) {
    if (!audioReady && btn) { btn.disabled = true; btn.innerHTML = '<span>Loading sound…</span>'; }
    ensureAudio().then(function () {
      var HMk = modOf(opts.kind);
      if (HMk) {
        sess = HMk.newSession(S, opts);
        var store = opts.kind === 'progressions' ? S.prog : S.deg;
        if (sess.pack) { store.tried[sess.pack] = 1; S.lastPlay[opts.kind] = { kind: 'level', pack: sess.pack, level: sess.level }; curPack = { kind: opts.kind, id: sess.pack }; }
      } else if (opts.kind === 'chords') {
        sess = C.newSession(S, opts);
        if (sess.pack) { S.chords.tried[sess.pack] = 1; S.lastPlay.chords = { kind: 'level', pack: sess.pack, level: sess.level }; curPack = { kind: 'chords', id: sess.pack }; }
      } else {
        sess = E.newSession(S, opts);
        sess.kind = 'interval';
        if (sess.scale) { S.tried[sess.scale] = 1; S.lastPlay.intervals = { kind: 'level', pack: sess.scale, level: sess.level }; curPack = { kind: 'intervals', id: sess.scale }; }
        else if (sess.guided) S.lastPlay.intervals = { kind: 'guided' };
      }
      sess.opts = opts;
      sess.combo = 0; sess.bestCombo = 0;
      sess.xp = 0; sess.xpAnswers = 0; sess.xpCombo = 0; sess.xpStars = 0; sess.xpSession = 0;
      sess.xpStart = S.xp; sess.newAch = [];
      persist();
      A.setNoteLength(sess.lv ? sess.lv.notes : 1);
      ask();
    });
  }
  function startLevel(kind, id, n, btn) {
    startSession(kind === 'intervals' ? { mode: 'scale', scale: id, level: n } : { kind: kind, pack: id, level: n }, btn);
  }
  function ask() {
    clearTimeout(askTimer);
    showAnchorAnyway = false;
    fb = null;
    var q = isHarm() ? HMod().nextQuestion(S, sess) : isChord() ? C.nextQuestion(S, sess) : E.nextQuestion(S, sess);
    if (isHarm()) q.picks = q.items.slice(0, q.given);
    view = 'practice';
    render();
    window.scrollTo(0, 0);
    // never start the sound while an effect is still sounding
    var wait = Math.max(220, SFX.busyMs() + 80);
    askTimer = setTimeout(function () {
      if (!sess || sess.q !== q || view !== 'practice') return;
      if (!isChord() && !isHarm() && sess.scale && sess.lv.cue === 'chord') {
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
    var ev;
    if (isChord()) {
      ev = C.record(S, q, guess);
      sess.answers.push({ id: q.id, guess: guess, correct: ev.correct, hinted: !!q.hinted });
    } else {
      ev = E.record(S, q, guess);
      sess.answers.push({ semis: q.semis, guess: guess, correct: ev.correct, hinted: !!q.hinted });
    }
    if (ev.correct && !q.hinted) { sess.combo++; sess.bestCombo = Math.max(sess.bestCombo, sess.combo); } else if (!ev.correct) sess.combo = 0;
    S.bestCombo = Math.max(S.bestCombo || 0, sess.bestCombo);
    var xp = E.answerXp(sess, ev.correct, !!q.hinted, sess.combo), xpBase = E.answerXp(sess, ev.correct, !!q.hinted, 0);
    gain(xpBase, 'xpAnswers'); gain(xp - xpBase, 'xpCombo');
    if (sess.answers.length >= sess.length) {
      if (isChord() && sess.pack) { var r1 = C.recordLevel(S, sess); sess.xp += r1.xpBonus; sess.xpStars += r1.xpBonus; }
      else if (!isChord() && sess.scale) { var r2 = E.recordLevel(S, sess); sess.xp += r2.xpBonus; sess.xpStars += r2.xpBonus; }
      else gain(E.SESSION_BONUS, 'xpSession');
    }
    newAchievements();
    persist();
    fb = { guess: guess, correct: ev.correct, ev: ev, anim: true, xp: xp };
    render();
    fb.anim = false;
    var news = ev.unlocked != null || ev.mastered;
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
  function isLevelSess() { return !!(sess && (sess.pack || sess.scale)); }
  function quit() {
    if (sess && sess.answers.length) { go('summary'); celebrate(); } else go(isLevelSess() ? 'pack' : sess && sess.guided ? 'guided' : 'train');
  }
  function setSection(s) { if (!SECTIONS.some(function (x) { return x[0] === s; })) return; S.ui.section = s; persist(); render(); }

  // ------------------------------------------------------------ events
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t || t.disabled) return;
    var a = t.dataset.action, semis = t.dataset.semis !== undefined ? +t.dataset.semis : null;
    if (a !== 'reset' && resetArmed) { resetArmed = 0; }
    switch (a) {
      case 'tab':
        if (view === 'practice' && sess && sess.answers.length) { go('summary'); celebrate(); break; }
        go(t.dataset.tab); break;
      case 'section': setSection(t.dataset.section); break;
      case 'prog-sec': progSec = t.dataset.section; render(); break;
      case 'close-rankup': closeRankUp(); break;
      case 'free': go('free'); break;
      case 'done': go(sess && sess.guided ? 'train' : 'train'); break;
      case 'open-guided': go('guided'); break;
      case 'start': startSession({ mode: 'guided' }, t); break;
      case 'open-pack': curPack = { kind: t.dataset.kind, id: t.dataset.id }; go('pack'); break;
      case 'to-map': go('pack'); break;
      case 'start-level': startLevel(t.dataset.kind, t.dataset.pack, +t.dataset.level, t); break;
      case 'next-level': startLevel(sessKind(), sess.pack || sess.scale, sess.level + 1, t); break;
      case 'hear-cue': playCue(); break;
      case 'again': startSession(sess.opts, t); break;
      case 'start-free': if (S.free.pool.length >= E.MIN_POOL) startSession({ mode: 'free', stage: S.free.stage, pool: S.free.pool }, t); break;
      case 'start-pfree': if (S.prog.free.pool.length >= P.MIN_POOL) startSession({ kind: 'progressions', mode: 'free', keyMode: S.prog.free.mode, pool: S.prog.free.pool, len: S.prog.free.len }, t); break;
      case 'start-dfree': if (S.deg.free.pool.length >= D.MIN_POOL) startSession({ kind: 'degrees', mode: 'free', keyMode: S.deg.free.mode, pool: S.deg.free.pool, notes: S.deg.free.notes }, t); break;
      case 'pick': pick(t.dataset.v, t); break;
      case 'undo': undoPick(); break;
      case 'clear-slots': clearPicks(); break;
      case 'submit': submitHarm(); break;
      case 'hear-key': hHearKey(); break;
      case 'h-yours': hPlayYours(t); break;
      case 'h-correct': hPlayCorrect(t); break;
      case 'h-both': hPlayBoth(t); break;
      case 'h-resolve': hResolve(t); break;
      case 'plib-toggle': plibOpen = plibOpen === t.dataset.id ? null : t.dataset.id; render(); break;
      case 'plib-play': plibPlay(t.dataset.id, !!t.dataset.cue, t); break;
      case 'plib-key': plibTonic = HM.pickPc(Math.random, plibTonic); render(); toast('New key: ' + HM.keyName(plibTonic, 'major')); break;
      case 'dlib-toggle': var dd = +t.dataset.d; dlibOpen = dlibOpen === dd ? null : dd; render(); break;
      case 'dlib-play': dlibPlay(+t.dataset.d, !!t.dataset.bare, t); break;
      case 'dlib-key': dlibTonic = 55 + HM.pc(HM.pickPc(Math.random, HM.pc(dlibTonic)) - 55); render(); toast('New key: ' + P.keyLabel(dlibTonic, 'major')); break;
      case 'pfree-toggle':
        var pp = S.prog.free.pool, pi = pp.indexOf(t.dataset.id);
        if (pi >= 0) pp.splice(pi, 1); else pp.push(t.dataset.id);
        persist(); render(); break;
      case 'pfree-all': S.prog.free.pool = P.MODE_CHORDS[S.prog.free.mode].slice(); persist(); render(); break;
      case 'pfree-basic': S.prog.free.pool = S.prog.free.mode === 'minor' ? ['i', 'iv', 'VI', 'VII'] : ['I', 'IV', 'V', 'vi']; persist(); render(); break;
      case 'dfree-toggle':
        var dp = S.deg.free.pool, di = dp.indexOf(+t.dataset.d);
        if (di >= 0) dp.splice(di, 1); else dp.push(+t.dataset.d);
        persist(); render(); break;
      case 'dfree-all': S.deg.free.pool = D.ORDER.map(Number); persist(); render(); break;
      case 'dfree-scale': S.deg.free.pool = D.SCALE[S.deg.free.mode].slice(); persist(); render(); break;
      case 'start-cfree': if (S.chords.free.pool.length >= C.MIN_POOL) startSession({ kind: 'chords', mode: 'free', pool: S.chords.free.pool, style: S.chords.free.style }, t); break;
      case 'sample': sample(semis, t.dataset.stage, t); break;
      case 'replay': playQuestion(!!(sess.q.plays) || sess.q.answered); break;
      case 'hint': showHint(); break;
      case 'answer': answer(isChord() ? t.dataset.v : +t.dataset.v); break;
      case 'next': next(); break;
      case 'quit': quit(); break;
      case 'play-guess': playFrom(fb.guess); break;
      case 'play-correct': playFrom(isChord() ? sess.q.id : sess.q.semis); break;
      case 'play-both': playContrast(); break;
      case 'show-anchor': showAnchorAnyway = true; var fbEl = app.querySelector('.fb-anchor'); if (fbEl) fbEl.outerHTML = anchorView(sess.q); break;
      case 'more-songs': app.querySelectorAll('[data-more="' + t.dataset.target + '"]').forEach(function (el) { el.hidden = false; }); t.remove(); break;
      case 'lib-toggle': libOpen = libOpen === semis ? null : semis; render(); break;
      case 'lib-play': libPlay(semis, t.dataset.mode, t); break;
      case 'lib-root': libRoot = E.randomRoot(null, libRoot); render(); toast('New root: ' + FB.noteWithOctave(libRoot)); break;
      case 'clib-toggle': clibOpen = clibOpen === t.dataset.id ? null : t.dataset.id; render(); break;
      case 'clib-play': clibPlay(t.dataset.id, t.dataset.style, t); break;
      case 'clib-root':
        var rr = C.rootsFor(C.TYPES.map(function (x) { return C.voicing(x.id, 0, false); })).filter(function (r) { return r !== clibRoot; });
        clibRoot = rr[Math.floor(Math.random() * rr.length)]; render(); toast('New root: ' + FB.noteWithOctave(clibRoot)); break;
      case 'free-toggle':
        var i = S.free.pool.indexOf(semis);
        if (i >= 0) S.free.pool.splice(i, 1); else S.free.pool.push(semis);
        persist(); render(); break;
      case 'free-all': S.free.pool = E.ORDER.slice(); persist(); render(); break;
      case 'free-unlocked':
        S.free.pool = E.active(S, S.free.stage).slice();
        if (S.free.pool.length < E.MIN_POOL) S.free.pool = E.ORDER.slice(0, E.MIN_POOL);
        persist(); render(); break;
      case 'cfree-toggle':
        var cp = S.chords.free.pool, ci = cp.indexOf(t.dataset.id);
        if (ci >= 0) cp.splice(ci, 1); else cp.push(t.dataset.id);
        persist(); render(); break;
      case 'cfree-all': S.chords.free.pool = C.ALL_IDS.slice(); persist(); render(); break;
      case 'cfree-basic': S.chords.free.pool = ['maj', 'min', '7', 'm7']; persist(); render(); break;
      case 'reset':
        if (!resetArmed) { resetArmed = 1; render(); setTimeout(function () { if (resetArmed && view === 'settings') { resetArmed = 0; render(); } }, 4000); }
        else { var keep = S.settings, ui = S.ui; S = norm(E.clearAll()); S.settings = keep; S.ui = ui; persist(); resetArmed = 0; sess = null; render(); toast('Progress has been reset.'); }
        break;
    }
  });

  app.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'free-stage') { S.free.stage = t.value; persist(); }
    else if (t.name === 'cfree-style') { S.chords.free.style = t.value; persist(); }
    else if (t.name === 'pfree-mode') {
      var pf = S.prog.free; pf.mode = t.value;
      pf.pool = pf.pool.filter(function (id) { return P.MODE_CHORDS[pf.mode].indexOf(id) >= 0; });
      if (pf.pool.length < P.MIN_POOL) pf.pool = pf.mode === 'minor' ? ['i', 'iv', 'VI', 'VII'] : ['I', 'IV', 'V', 'vi'];
      persist(); render();
    }
    else if (t.name === 'pfree-len') { S.prog.free.len = +t.value; persist(); }
    else if (t.name === 'dfree-mode') { S.deg.free.mode = t.value; persist(); render(); }
    else if (t.name === 'dfree-notes') { S.deg.free.notes = +t.value; persist(); }
    else if (t.name === 'inst') {
      S.settings.instrument = t.value;
      var inst = t.value === 'piano' ? 'piano' : 'guitar';
      try { A.setInstrument(inst); } catch (err) {}
      if (audioReady) { A.prewarm(); if (t.value === 'mix') { A.setInstrument('piano'); A.prewarm(); A.setInstrument(inst); } }
      persist();
    } else if (t.id === 'set-sfx') {
      S.settings.sfx = t.checked; SFX.setEnabled(t.checked); if (t.checked) { SFX.unlock(); SFX.play('right'); }
      persist();
    }
  });
  app.addEventListener('input', function (e) {
    if (e.target.id === 'set-volume') { S.settings.volume = parseFloat(e.target.value); applyAudioSettings(); persist(); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector('.rankup')) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeRankUp(); } return; }
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (view === 'practice' && sess && sess.q && isHarm()) {
      var hq = sess.q;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (hq.answered) next(); else playQuestion(true); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (hq.answered) next(); else submitHarm(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); undoPick(); return; }
      if ((e.key === 'h' || e.key === 'H') && !hq.answered && (sess.kind === 'prog' ? sess.lv.cue : sess.lv.tool !== false)) { e.preventDefault(); hHearKey(); return; }
      var hk = KEYS.indexOf(e.key);
      if (hk >= 0 && hk < sess.pool.length) { e.preventDefault(); pick(String(sess.pool[hk])); return; }
      if (e.key === 'Escape') quit();
      return;
    }
    if (view === 'practice' && sess && sess.q) {
      var answered = sess.q.answered;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (answered) next(); else playQuestion(true); return; }
      if (e.key === 'Enter') { e.preventDefault(); if (answered) next(); return; }
      if ((e.key === 'h' || e.key === 'H') && !isChord() && sess.scale && sess.lv.n <= 4) { e.preventDefault(); playCue(); return; }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); showHint(); return; }
      var k = KEYS.indexOf(e.key);
      if (k >= 0) { var pool = poolNow(); if (k < pool.length) { e.preventDefault(); answer(pool[k]); } }
      if (e.key === 'Escape') quit();
    } else if (e.key === 'l' || e.key === 'L') {
      e.preventDefault(); go('library');
    } else if (e.key === 'Escape' && view !== 'train') {
      go(view === 'summary' && isLevelSess() ? 'pack' : 'train');
    } else if (e.key === 'Enter' && tag !== 'button') {
      var p = view === 'train' ? app.querySelector('.btn-hero') : view === 'summary' ? app.querySelector('.actions .btn-primary') : null;
      if (p) { e.preventDefault(); p.click(); }
    }
  });

  // tiny hook for automated checks
  window.EarApp = {
    state: function () { return S; }, session: function () { return sess; }, answer: answer, next: next, hint: showHint,
    view: function () { return view; }, go: go, reload: function () { S = norm(E.load()); render(); }, rankUp: function () { rankUp(E.rankInfo(S.xp)); }
  };

  applyAudioSettings();
  // optional deep links: #train, #chords, #library, #progress, #settings, #free, #mode/<id>, #pack/<id>
  (function () {
    var h = (location.hash || '').slice(1).split('/');
    if (h[0] === 'mode' && E.modeById(h[1])) { curPack = { kind: 'intervals', id: h[1] }; S.ui.section = 'intervals'; view = 'pack'; }
    else if (h[0] === 'pack' && C.packById(h[1])) { curPack = { kind: 'chords', id: h[1] }; S.ui.section = 'chords'; view = 'pack'; }
    else if (h[0] === 'chords' || h[0] === 'progressions' || h[0] === 'degrees') S.ui.section = h[0];
    else if (h[0] === 'modes' || h[0] === 'awards') view = h[0] === 'awards' ? 'progress' : 'train';
    else if (['library', 'progress', 'settings', 'free', 'guided'].indexOf(h[0]) >= 0) view = h[0];
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
