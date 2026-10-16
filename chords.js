/*
 * chords.js: chord ear-training engine (window.EarChords). Pure logic, no DOM.
 * Shares XP, ranks, streak and achievements with EarEngine; its own stats live in s.chords.
 */
(function (global) {
  'use strict';

  var E = global.EarEngine;

  // Chord types: semitones from the root. sound = one-line character used in feedback and the library.
  var TYPES = [
    { id: 'maj', name: 'Major', sym: 'Maj', semis: [0, 4, 7], sound: 'Bright, stable, at rest.' },
    { id: 'min', name: 'Minor', sym: 'm', semis: [0, 3, 7], sound: 'Darker, sad, reflective.' },
    { id: 'dim', name: 'Diminished', sym: 'dim', semis: [0, 3, 6], sound: 'Tense, spooky, unstable.' },
    { id: 'aug', name: 'Augmented', sym: 'aug', semis: [0, 4, 8], sound: 'Dreamy and unresolved, like a question.' },
    { id: 'sus2', name: 'Sus2', sym: 'sus2', semis: [0, 2, 7], sound: 'Open and airy, neither happy nor sad.' },
    { id: 'sus4', name: 'Sus4', sym: 'sus4', semis: [0, 5, 7], sound: 'Hanging, wants to fall back to major.' },
    { id: '5', name: 'Power chord', sym: '5', semis: [0, 7, 12], sound: 'Hollow and punchy. No third at all.' },
    { id: 'maj7', name: 'Major 7', sym: 'maj7', semis: [0, 4, 7, 11], sound: 'Soft, lush, a little wistful.' },
    { id: '7', name: 'Dominant 7', sym: '7', semis: [0, 4, 7, 10], sound: 'Bluesy, wants to resolve.' },
    { id: 'm7', name: 'Minor 7', sym: 'm7', semis: [0, 3, 7, 10], sound: 'Mellow, smooth, soulful.' },
    { id: 'm7b5', name: 'Half-diminished', sym: 'm7♭5', semis: [0, 3, 6, 10], sound: 'Dark and searching. Jazzy tension.' },
    { id: 'dim7', name: 'Diminished 7', sym: 'dim7', semis: [0, 3, 6, 9], sound: 'Dramatic, silent-film suspense.', deg: { 9: 6 } },
    { id: 'mmaj7', name: 'Minor-major 7', sym: 'm(maj7)', semis: [0, 3, 7, 11], sound: 'Mysterious, film noir, spy movie.' },
    { id: '6', name: 'Major 6', sym: '6', semis: [0, 4, 7, 9], sound: 'Sweet and vintage. Swing era.' },
    { id: 'm6', name: 'Minor 6', sym: 'm6', semis: [0, 3, 7, 9], sound: 'Bittersweet, gypsy-jazz flavor.' },
    { id: 'add9', name: 'Add9', sym: 'add9', semis: [0, 4, 7, 14], sound: 'Bright and shimmering. Modern pop.' },
    { id: '9', name: 'Dominant 9', sym: '9', semis: [0, 4, 7, 10, 14], sound: 'Funky, rich, bluesy.' },
    { id: 'maj9', name: 'Major 9', sym: 'maj9', semis: [0, 4, 7, 11, 14], sound: 'Lush, warm, dreamy.' },
    { id: 'm9', name: 'Minor 9', sym: 'm9', semis: [0, 3, 7, 10, 14], sound: 'Smooth and soulful. Neo-soul.' }
  ];
  var ALL_IDS = TYPES.map(function (t) { return t.id; });
  var BY_ID = {}; TYPES.forEach(function (t) { BY_ID[t.id] = t; });
  function type(id) { return BY_ID[id] || null; }

  var PACKS = [
    { id: 'majmin', name: 'Major vs minor', types: ['maj', 'min', '5'], mood: 'Bright, dark, or neither.', moodLong: 'The first split every ear learns. The power chord has no third, so it sounds like neither.' },
    { id: 'triads', name: 'Triads', types: ['maj', 'min', 'dim', 'aug'], mood: 'The four three-note chords.', moodLong: 'Major, minor, diminished and augmented: every other chord is built on these.' },
    { id: 'sus', name: 'Suspended', types: ['maj', 'sus2', 'sus4'], mood: 'Open and hanging.', moodLong: 'Swap the third for a second or a fourth and the chord floats instead of landing.' },
    { id: 'guitar', name: 'Guitar essentials', types: ['maj', 'min', '7', 'm7', 'sus4', '5'], mood: 'The songbook basics.', moodLong: 'The chords in most songbooks, campfire sets and rock riffs.' },
    { id: 'sevenths', name: 'Seventh chords', types: ['maj7', '7', 'm7'], mood: 'Soft, bluesy, mellow.', moodLong: 'The three big sevenths. Listen for the top note: a half step or a whole step below the octave.' },
    { id: 'allsevenths', name: 'All sevenths', types: ['maj7', '7', 'm7', 'm7b5', 'dim7', 'mmaj7'], mood: 'From lush to sinister.', moodLong: 'Every common four-note chord, including the dark half-diminished and the spy-movie minor-major 7.' },
    { id: 'sixths', name: 'Sixths & add9', types: ['maj', '6', 'm6', 'add9'], mood: 'Sweet added colors.', moodLong: 'Plain triads with one extra note on top: vintage sixths and the shimmer of add9.' },
    { id: 'jazz', name: 'Jazz colors', types: ['maj9', '9', 'm9', '6', 'm7b5'], mood: 'Rich and extended.', moodLong: 'Extended chords from jazz, soul and neo-soul. Five notes, lots of color.' },
    { id: 'everything', name: 'Everything', types: ALL_IDS.slice(), mood: 'All 19 chord types.', moodLong: 'Every chord type in the app. The final exam.' }
  ];
  function packById(id) { for (var i = 0; i < PACKS.length; i++) if (PACKS[i].id === id) return PACKS[i]; return null; }

  // Levels. style: 'arp-block' | 'block'. fixedRoot: one root for the whole level.
  var LEVELS = [
    { n: 1, name: 'Same root', style: 'arp-block', fixedRoot: true, inv: false, open: false, hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'One root for the whole level. Each chord rolls up, then rings together.' },
    { n: 2, name: 'Any root', style: 'arp-block', fixedRoot: false, inv: false, open: false, hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'A new root every question. Arpeggio first, then the full chord.' },
    { n: 3, name: 'Block', style: 'block', fixedRoot: false, inv: false, open: false, hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'The whole chord at once, root in the bass.' },
    { n: 4, name: 'Inversions', style: 'block', fixedRoot: false, inv: true, open: false, hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'Block chords with any chord tone in the bass.' },
    { n: 5, name: 'Master', style: 'block', fixedRoot: false, inv: true, open: true, hints: false, replays: 1, mixInst: true, notes: 0.7,
      desc: 'Inversions or wide guitar voicings, random instrument, shorter. One replay, no hint.' }
  ];
  var LEVEL_LEN = 20, FREE_LEN = 20, HIST_KEEP = 40, WINDOW = 20, MIN_POOL = 3;
  var FREE_STYLES = ['arp-block', 'block', 'inv'];
  var FREE_STYLE_LABEL = { 'arp-block': 'Arp + block', block: 'Block', inv: 'Inversions' };
  var ROOT_LO = 45, ROOT_HI = 60, TOP = 76;   // EarAudio.RANGE is 40..76

  // ---------------------------------------------------------------- voicings
  /** Offsets from the root, ascending. inv: 0 = root position. open: spread guitar-style voicing. */
  function voicing(id, inv, open) {
    var t = type(id), core = t.semis.filter(function (x) { return x < 12; }), ext = t.semis.filter(function (x) { return x >= 12; });
    var v;
    if (open) {
      var rest = core.slice(1);
      v = [0].concat(rest.slice(1)).concat([rest[0] + 12]);
    } else {
      var k = Math.max(0, Math.min(core.length - 1, inv || 0));
      v = core.slice(k).concat(core.slice(0, k).map(function (x) { return x + 12; }));
    }
    v.sort(function (a, b) { return a - b; });
    ext.forEach(function (e) {
      var pc = e % 12, has = v.some(function (x) { return x % 12 === pc; });
      if (has) { var up = v[0] + 12; if (v.indexOf(up) < 0) v.push(up); }
      else { var x = pc; while (x <= v[1] || v.indexOf(x) >= 0) x += 12; v.push(x); }
      v.sort(function (a, b) { return a - b; });
    });
    return v;
  }
  function inversions(id) { return type(id).semis.filter(function (x) { return x < 12; }).length; }
  function invLabel(inv, open) {
    if (open) return 'open voicing';
    return ['root position', '1st inversion', '2nd inversion', '3rd inversion'][inv] || 'inversion';
  }
  /** Same treatment for another chord type (used for "hear your guess"). */
  function voicingLike(id, q) { return voicing(id, Math.min(q.inv || 0, inversions(id) - 1), q.open); }
  function rootRangeFor(offsets) {
    var hi = Math.min(ROOT_HI, TOP - Math.max.apply(null, offsets)), lo = ROOT_LO;
    return { lo: lo, hi: Math.max(lo, hi) };
  }
  // Optional fretboard check (set by the app): 2 = playable shape, 1 = exact pitches fit on the neck, 0 = no.
  var placeable = null;
  function setPlaceable(fn) { placeable = fn; }
  /** Roots that keep the voicing in range, preferring ones whose exact notes form a playable guitar shape. */
  function rootsFor(offsetsList) {
    var lo = ROOT_LO, hi = ROOT_HI;
    offsetsList.forEach(function (o) { var rr = rootRangeFor(o); hi = Math.min(hi, rr.hi); });
    var all = []; for (var r = lo; r <= Math.max(lo, hi); r++) all.push(r);
    if (!placeable) return all;
    function grade(r) { var g = 2; offsetsList.forEach(function (o) { g = Math.min(g, placeable(o.map(function (x) { return x + r; }))); }); return g; }
    var good = all.filter(function (r) { return grade(r) >= 2; });
    if (good.length >= 3) return good;
    var ok = all.filter(function (r) { return grade(r) >= 1; });
    return ok.length >= 2 ? ok : all;
  }
  function randomRootFrom(list, avoid, rnd) {
    var c = list.length > 1 ? list.filter(function (r) { return r !== avoid; }) : list;
    return c[Math.floor(rnd() * c.length)];
  }
  function midis(q) { return q.offsets.map(function (x) { return q.root + x; }); }

  // ---------------------------------------------------------------- state
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function normalize(s) {
    var c = s.chords = s.chords || {};
    c.levels = c.levels || {};
    c.hist = c.hist || {};
    c.conf = c.conf || {};
    c.tried = c.tried || {};
    if (typeof c.total !== 'number') c.total = 0;
    if (typeof c.hinted !== 'number') c.hinted = 0;
    c.free = c.free || { pool: ['maj', 'min', '7', 'm7'], style: 'arp-block' };
    c.free.pool = (c.free.pool || []).filter(function (x, i, a) { return BY_ID[x] && a.indexOf(x) === i; });
    if (FREE_STYLES.indexOf(c.free.style) < 0) c.free.style = 'arp-block';
    s.ui = s.ui || {};
    if (['intervals', 'chords', 'progressions', 'degrees'].indexOf(s.ui.section) < 0) s.ui.section = 'intervals';
    s.lastPlay = s.lastPlay || {};
    return s;
  }

  // ---------------------------------------------------------------- stats
  function accuracy(s, id, n) {
    var h = s.chords.hist[id] || [], w = h.slice(-(n || WINDOW));
    if (!w.length) return { n: 0, acc: null };
    var ok = 0; w.forEach(function (x) { ok += x; });
    return { n: w.length, acc: ok / w.length };
  }
  /** Most frequent mix-ups across all chord answers: [{ correct, guess, count }]. */
  function mixups(s, limit) {
    var out = [];
    Object.keys(s.chords.conf).forEach(function (a) {
      Object.keys(s.chords.conf[a]).forEach(function (g) { out.push({ correct: a, guess: g, count: s.chords.conf[a][g] }); });
    });
    out.sort(function (x, y) { return y.count - x.count; });
    return out.slice(0, limit || 5);
  }
  function record(s, q, guess) {
    var c = s.chords, correct = guess === q.id;
    var h = c.hist[q.id] = c.hist[q.id] || [];
    h.push(correct ? 1 : 0);
    if (h.length > HIST_KEEP) h.splice(0, h.length - HIST_KEEP);
    if (!correct) { var row = c.conf[q.id] = c.conf[q.id] || {}; row[guess] = (row[guess] || 0) + 1; }
    c.total++;
    if (q.hinted) c.hinted++;
    var t = today(); if (s.days.indexOf(t) < 0) s.days.push(t);
    if (s.days.length > 400) s.days.splice(0, s.days.length - 400);
    s.bestStreak = Math.max(s.bestStreak || 0, E.streak(s).days);
    return { correct: correct };
  }

  // ---------------------------------------------------------------- selection
  function pick(s, pool, last, rnd) {
    var weights;
    if (rnd() < 0.5) {
      weights = pool.map(function (id) {
        var a = accuracy(s, id), acc = a.n < 3 ? 0.6 : a.acc, w = 0.15 + (1 - acc) * 1.5;
        var row = s.chords.conf[id] || {};
        pool.forEach(function (o) { w += Math.min((row[o] || 0) + ((s.chords.conf[o] || {})[id] || 0), 6) * 0.12; });
        return w;
      });
    } else weights = pool.map(function () { return 1; });
    var li = pool.indexOf(last);
    if (li >= 0 && pool.length > 1) weights[li] = 0;
    var sum = 0; weights.forEach(function (w) { sum += w; });
    var r = rnd() * sum;
    for (var i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0 && weights[i] > 0) return pool[i]; }
    for (var j = pool.length - 1; j >= 0; j--) if (weights[j] > 0) return pool[j];
    return pool[0];
  }

  // ---------------------------------------------------------------- sessions
  function freeLevel(style) {
    return { n: 0, name: FREE_STYLE_LABEL[style], style: style === 'arp-block' ? 'arp-block' : 'block', fixedRoot: false, inv: style === 'inv', open: false,
      hints: true, replays: Infinity, mixInst: false, notes: 1, free: true };
  }
  function newSession(s, opts, rnd) {
    rnd = rnd || Math.random;
    var sess = { kind: 'chord', answers: [], last: null, lastRoot: null, q: null };
    if (opts.mode === 'free') {
      sess.free = true; sess.pool = opts.pool.slice(); sess.lv = freeLevel(opts.style); sess.length = FREE_LEN; sess.style = opts.style;
      sess.packName = 'Free practice';
    } else {
      var p = packById(opts.pack), L = LEVELS[(opts.level || 1) - 1];
      sess.pack = p.id; sess.packName = p.name; sess.level = L.n; sess.lv = L; sess.pool = p.types.slice(); sess.length = LEVEL_LEN;
    }
    // Pool in a stable, musical order (TYPES order)
    sess.pool.sort(function (a, b) { return ALL_IDS.indexOf(a) - ALL_IDS.indexOf(b); });
    if (sess.lv.fixedRoot) {
      sess.fixedRoot = randomRootFrom(rootsFor(sess.pool.map(function (id) { return voicing(id, 0, false); })), null, rnd);
    }
    return sess;
  }
  function nextQuestion(s, sess, rnd) {
    rnd = rnd || Math.random;
    var L = sess.lv, id = pick(s, sess.pool, sess.last, rnd);
    var open = false, inv = 0;
    if (L.open && rnd() < 0.5) open = true;
    else if (L.inv) inv = Math.floor(rnd() * inversions(id));
    var offsets = voicing(id, inv, open), root;
    if (sess.fixedRoot != null) root = sess.fixedRoot;
    else root = randomRootFrom(rootsFor([offsets]), sess.lastRoot, rnd);
    var inst = L.mixInst ? (rnd() < 0.5 ? 'guitar' : 'piano') : null;
    sess.last = id; sess.lastRoot = root;
    sess.q = { id: id, root: root, inv: inv, open: open, offsets: offsets, style: L.style, inst: inst, plays: 0, answered: false, hinted: false };
    return sess.q;
  }

  // ---------------------------------------------------------------- levels
  function levelRow(s, packId, n) { return (s.chords.levels[packId] || {})[n] || null; }
  function levelUnlocked(s, packId, n) { if (n <= 1) return true; var p = levelRow(s, packId, n - 1); return !!p && p.stars >= 1; }
  function packStars(s, packId) { var t = 0; for (var n = 1; n <= LEVELS.length; n++) { var r = levelRow(s, packId, n); if (r) t += r.stars; } return t; }
  function totalStars(s) { var t = 0; PACKS.forEach(function (p) { t += packStars(s, p.id); }); return t; }
  function recordLevel(s, sess) {
    var ok = 0; sess.answers.forEach(function (a) { if (a.correct && !a.hinted) ok++; });
    var frac = sess.answers.length ? ok / sess.answers.length : 0;
    var stars = E.starsFor(frac), pct = Math.round(frac * 100);
    var by = s.chords.levels[sess.pack] = s.chords.levels[sess.pack] || {};
    var row = by[sess.level] = by[sess.level] || { best: 0, stars: 0, runs: 0 };
    var wasUnlocked = levelUnlocked(s, sess.pack, sess.level + 1);
    var prevBest = row.best, prevStars = row.stars;
    row.runs++; row.last = pct;
    if (pct > row.best) row.best = pct;
    if (stars > row.stars) row.stars = stars;
    var bonus = stars * 15 + (stars === 3 ? (prevStars < 3 ? 60 : 15) : 0);
    E.gainXp(s, bonus);
    var res = { ok: ok, n: sess.answers.length, pct: pct, stars: stars, best: row.best, bestStars: row.stars,
      newBest: pct > prevBest || stars > prevStars, runsBefore: row.runs - 1, unlockedNext: false, xpBonus: bonus, firstPerfect: stars === 3 && prevStars < 3 };
    if (sess.level < LEVELS.length && !wasUnlocked && levelUnlocked(s, sess.pack, sess.level + 1)) res.unlockedNext = true;
    sess.result = res;
    return res;
  }
  function summarize(sess) {
    var per = {}, conf = {}, ok = 0, hinted = 0;
    sess.answers.forEach(function (a) {
      if (a.hinted) hinted++;
      var p = per[a.id] = per[a.id] || { n: 0, ok: 0 };
      p.n++; if (a.correct) { p.ok++; ok++; } else { var k = a.id + '>' + a.guess; conf[k] = (conf[k] || 0) + 1; }
    });
    var rows = Object.keys(per).map(function (k) { return { id: k, n: per[k].n, ok: per[k].ok, acc: per[k].ok / per[k].n }; })
      .sort(function (a, b) { return ALL_IDS.indexOf(a.id) - ALL_IDS.indexOf(b.id); });
    var weakest = rows.filter(function (r) { return r.acc < 1; }).sort(function (a, b) { return a.acc - b.acc || b.n - a.n; })[0] || null;
    var big = null;
    Object.keys(conf).forEach(function (k) { if (!big || conf[k] > big.count) { var p = k.split('>'); big = { correct: p[0], guess: p[1], count: conf[k] }; } });
    return { n: sess.answers.length, ok: ok, hinted: hinted, rows: rows, weakest: weakest, confusion: big };
  }

  // ---------------------------------------------------------------- achievements (shared list)
  function cs(s) { return s.chords || { levels: {}, tried: {}, total: 0 }; }
  function anyChordLevel(s, fn) {
    var lv = cs(s).levels;
    return Object.keys(lv).some(function (p) { return Object.keys(lv[p]).some(function (n) { return fn(lv[p][n]); }); });
  }
  if (E && E.ACHIEVEMENTS) {
    E.ACHIEVEMENTS.push(
      { id: 'chord-star', name: 'First chord star', desc: 'Earn a star in any chord pack.', test: function (s) { return anyChordLevel(s, function (r) { return r.stars >= 1; }); } },
      { id: 'chord-flawless', name: 'Perfect voicing', desc: 'Get three stars on a chord level.', test: function (s) { return anyChordLevel(s, function (r) { return r.stars === 3; }); } },
      { id: 'chord-run', name: 'Chord climber', desc: 'Clear all five levels of one chord pack.', test: function (s) { return PACKS.some(function (p) { var r = (cs(s).levels[p.id] || {})[LEVELS.length]; return r && r.stars >= 1; }); } },
      { id: 'chord-mastered', name: 'Chord master', desc: 'Earn all 15 stars in one chord pack.', test: function (s) { return !!s.chords && PACKS.some(function (p) { return packStars(s, p.id) === LEVELS.length * 3; }); } },
      { id: 'chord-explorer', name: 'Chord explorer', desc: 'Play every chord pack at least once.', test: function (s) { return PACKS.every(function (p) { return cs(s).tried[p.id]; }); } },
      { id: 'chord-200', name: 'Harmonic ear', desc: 'Answer 200 chord questions.', test: function (s) { return cs(s).total >= 200; } }
    );
  }

  global.EarChords = {
    TYPES: TYPES, ALL_IDS: ALL_IDS, PACKS: PACKS, LEVELS: LEVELS, LEVEL_LEN: LEVEL_LEN, FREE_LEN: FREE_LEN, MIN_POOL: MIN_POOL,
    FREE_STYLES: FREE_STYLES, FREE_STYLE_LABEL: FREE_STYLE_LABEL,
    type: type, packById: packById, voicing: voicing, voicingLike: voicingLike, inversions: inversions, invLabel: invLabel,
    rootRangeFor: rootRangeFor, rootsFor: rootsFor, setPlaceable: setPlaceable, midis: midis,
    normalize: normalize, accuracy: accuracy, mixups: mixups, record: record, pick: pick,
    newSession: newSession, nextQuestion: nextQuestion,
    levelRow: levelRow, levelUnlocked: levelUnlocked, packStars: packStars, totalStars: totalStars, recordLevel: recordLevel, summarize: summarize
  };
})(window);
