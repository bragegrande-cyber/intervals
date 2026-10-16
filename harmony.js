/*
 * harmony.js: shared helpers for the functional sections (window.EarHarmony). Pure logic, no DOM.
 * Keys and spelling, voice-led block chords inside EarAudio.RANGE, the key cadence,
 * per-item stats and the 5-level / 3-star bookkeeping used by progressions.js and degrees.js.
 */
(function (global) {
  'use strict';

  var E = global.EarEngine, C = global.EarChords;
  var LO = 40, HI = 76;                         // EarAudio.RANGE
  var UP_LO = 55, UP_HI = 74, BASS_LO = 40;     // upper voices G3..D5, bass E2..D♯3

  // ---------------------------------------------------------------- keys and spelling
  var LETTERS = 'CDEFGAB', LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  var KEY_NAME = {
    major: ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'],
    minor: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B']
  };
  var PLAIN = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  function pc(m) { return ((m % 12) + 12) % 12; }
  function keyName(tonic, mode) { return KEY_NAME[mode === 'minor' ? 'minor' : 'major'][pc(tonic)]; }
  /** Spell the note `semis` above the tonic, `steps` letters up (C♭ in E♭ major). Falls back to a plain name instead of double accidentals. */
  function spell(tonic, mode, semis, steps) {
    var tn = keyName(tonic, mode), li = LETTERS.indexOf(tn.charAt(0));
    var L = LETTERS.charAt((li + steps) % 7), target = pc(tonic + semis);
    var d = pc(target - LETTER_PC[LETTERS.indexOf(L)]); if (d > 6) d -= 12;
    if (d === 0) return L;
    if (d === 1) return L + '♯';
    if (d === -1) return L + '♭';
    return PLAIN[target];
  }
  // letter steps for a semitone offset from the tonic (used for chord tones above a chord root)
  var STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

  // ---------------------------------------------------------------- voicing
  function tonesOf(q) { return C.type(q).semis.filter(function (x) { return x < 12; }); }
  /** All close-position voicings of the chord (root pitch class + type) inside the upper window. */
  function candidates(rootPc, q) {
    var tones = tonesOf(q).map(function (x) { return pc(rootPc + x); }), out = [];
    for (var k = 0; k < tones.length; k++) {
      var order = tones.slice(k).concat(tones.slice(0, k));
      for (var start = UP_LO; start < UP_LO + 12; start++) {
        if (pc(start) !== order[0]) continue;
        for (var oct = 0; oct < 2; oct++) {
          var v = [start + oct * 12];
          for (var i = 1; i < order.length; i++) { var x = v[i - 1] + 1; while (pc(x) !== order[i]) x++; v.push(x); }
          if (v[v.length - 1] <= UP_HI) out.push(v);
        }
      }
    }
    return out;
  }
  function moveCost(a, b) {
    var c = 0;
    a.forEach(function (x) { c += Math.min.apply(null, b.map(function (y) { return Math.abs(x - y); })); });
    b.forEach(function (y) { c += Math.min.apply(null, a.map(function (x) { return Math.abs(x - y); })); });
    return c;
  }
  function bassFor(p) { return BASS_LO + pc(p - BASS_LO); }
  /**
   * chords: [{ rootPc, q, bassPc? }] -> [{ upper, bass, midis }]
   * Smooth voice-leading: each chord takes the closest voicing to the previous one.
   * opts.loose: pick among the three closest (less obvious leading). opts.rnd: random source.
   */
  function voiceLead(chords, opts) {
    opts = opts || {};
    var rnd = opts.rnd || Math.random, prev = opts.from || null;
    return chords.map(function (ch) {
      var cands = candidates(ch.rootPc, ch.q), pick;
      if (!prev) {
        cands.sort(function (a, b) { return Math.abs(mean(a) - 63) - Math.abs(mean(b) - 63); });
        pick = opts.loose ? cands[Math.floor(rnd() * Math.min(3, cands.length))] : cands[0];
      } else {
        cands.sort(function (a, b) { return moveCost(prev, a) - moveCost(prev, b); });
        pick = opts.loose ? cands[Math.floor(rnd() * Math.min(3, cands.length))] : cands[0];
      }
      prev = pick;
      var bass = bassFor(ch.bassPc != null ? ch.bassPc : ch.rootPc);
      return { upper: pick.slice(), bass: bass, midis: [bass].concat(pick) };
    });
  }
  function mean(a) { var t = 0; a.forEach(function (x) { t += x; }); return t / a.length; }

  /** Quick key cadence: I–IV–V–I (major) or i–iv–V–i (minor). Returns timed events and the end time. */
  var CAD_STEP = 0.48, CAD_RING = 0.56, CAD_PAUSE = 0.62;
  function cadence(tonic, mode, at) {
    var t = pc(tonic), m = mode === 'minor';
    var v = voiceLead([{ rootPc: t, q: m ? 'min' : 'maj' }, { rootPc: pc(t + 5), q: m ? 'min' : 'maj' }, { rootPc: pc(t + 7), q: 'maj' }, { rootPc: t, q: m ? 'min' : 'maj' }]);
    var start = at || 0;
    var ev = v.map(function (x, i) { return { at: start + i * CAD_STEP, midis: x.midis, ring: i === 3 ? CAD_RING + 0.25 : CAD_RING }; });
    return { events: ev, end: start + 3 * CAD_STEP + CAD_RING + 0.25 + CAD_PAUSE };
  }

  // ---------------------------------------------------------------- random keys
  /** Tonic midi (any octave) for a pitch class list, never the same as `avoid`. */
  function pickPc(rnd, avoid, allowed) {
    var list = (allowed || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).filter(function (p) { return p !== avoid; });
    return list[Math.floor(rnd() * list.length)];
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function weighted(list, weights, rnd) {
    var sum = 0; weights.forEach(function (w) { sum += w; });
    var r = rnd() * sum;
    for (var i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0 && weights[i] > 0) return list[i]; }
    return list[list.length - 1];
  }

  // ---------------------------------------------------------------- stats + levels (one store per section)
  var HIST_KEEP = 40, WINDOW = 20;
  function store(key) {
    function st(s) { return s[key]; }
    function normalize(s, defaults) {
      var c = s[key] = s[key] || {};
      c.levels = c.levels || {}; c.hist = c.hist || {}; c.conf = c.conf || {}; c.tried = c.tried || {};
      ['total', 'items', 'right', 'perfect4'].forEach(function (k) { if (typeof c[k] !== 'number') c[k] = 0; });
      c.free = c.free || {};
      Object.keys(defaults || {}).forEach(function (k) { if (c.free[k] === undefined) c.free[k] = defaults[k]; });
      return s;
    }
    function accuracy(s, id, n) {
      var h = (st(s) && st(s).hist[id]) || [], w = h.slice(-(n || WINDOW));
      if (!w.length) return { n: 0, acc: null };
      var ok = 0; w.forEach(function (x) { ok += x; });
      return { n: w.length, acc: ok / w.length };
    }
    function mixups(s, limit) {
      var out = [], conf = st(s).conf;
      Object.keys(conf).forEach(function (a) { Object.keys(conf[a]).forEach(function (g) { out.push({ correct: a, guess: g, count: conf[a][g] }); }); });
      out.sort(function (x, y) { return y.count - x.count; });
      return out.slice(0, limit || 5);
    }
    /** items: [{ id, guess, given }] for one question. Given items are not scored. */
    function recordItems(s, items) {
      var c = st(s), right = 0, n = 0;
      items.forEach(function (it) {
        if (it.given) return;
        n++;
        var ok = String(it.guess) === String(it.id);
        if (ok) right++;
        var h = c.hist[it.id] = c.hist[it.id] || [];
        h.push(ok ? 1 : 0);
        if (h.length > HIST_KEEP) h.splice(0, h.length - HIST_KEEP);
        if (!ok) { var row = c.conf[it.id] = c.conf[it.id] || {}; row[it.guess] = (row[it.guess] || 0) + 1; }
      });
      c.total++; c.items += n; c.right += right;
      var t = today(); if (s.days.indexOf(t) < 0) s.days.push(t);
      if (s.days.length > 400) s.days.splice(0, s.days.length - 400);
      s.bestStreak = Math.max(s.bestStreak || 0, E.streak(s).days);
      return { correct: right === n, right: right, n: n };
    }
    return { st: st, normalize: normalize, accuracy: accuracy, mixups: mixups, recordItems: recordItems };
  }
  function levelBook(key, packs, levels) {
    function row(s, packId, n) { return ((s[key] && s[key].levels[packId]) || {})[n] || null; }
    function unlocked(s, packId, n) { if (n <= 1) return true; var p = row(s, packId, n - 1); return !!p && p.stars >= 1; }
    function packStars(s, packId) { var t = 0; for (var n = 1; n <= levels.length; n++) { var r = row(s, packId, n); if (r) t += r.stars; } return t; }
    function totalStars(s) { var t = 0; packs.forEach(function (p) { t += packStars(s, p.id); }); return t; }
    function anyLevel(s, fn) {
      var lv = (s[key] && s[key].levels) || {};
      return Object.keys(lv).some(function (p) { return Object.keys(lv[p]).some(function (n) { return fn(lv[p][n], p, +n); }); });
    }
    function recordLevel(s, sess) {
      var ok = 0; sess.answers.forEach(function (a) { if (a.correct) ok++; });
      var frac = sess.answers.length ? ok / sess.answers.length : 0;
      var stars = E.starsFor(frac), pct = Math.round(frac * 100);
      var by = s[key].levels[sess.pack] = s[key].levels[sess.pack] || {};
      var r = by[sess.level] = by[sess.level] || { best: 0, stars: 0, runs: 0 };
      var wasUnlocked = unlocked(s, sess.pack, sess.level + 1), prevBest = r.best, prevStars = r.stars;
      r.runs++; r.last = pct;
      if (pct > r.best) r.best = pct;
      if (stars > r.stars) r.stars = stars;
      var bonus = stars * 15 + (stars === 3 ? (prevStars < 3 ? 60 : 15) : 0);
      E.gainXp(s, bonus);
      var res = { ok: ok, n: sess.answers.length, pct: pct, stars: stars, best: r.best, bestStars: r.stars,
        newBest: pct > prevBest || stars > prevStars, runsBefore: r.runs - 1, unlockedNext: false, xpBonus: bonus, firstPerfect: stars === 3 && prevStars < 3 };
      if (sess.level < levels.length && !wasUnlocked && unlocked(s, sess.pack, sess.level + 1)) res.unlockedNext = true;
      sess.result = res;
      return res;
    }
    return { levelRow: row, levelUnlocked: unlocked, packStars: packStars, totalStars: totalStars, recordLevel: recordLevel, anyLevel: anyLevel };
  }
  /** Session summary over item-level answers: rows per item id, weakest, biggest mix-up. */
  function summarizeItems(sess, order) {
    var per = {}, conf = {}, ok = 0, right = 0, items = 0;
    sess.answers.forEach(function (a) {
      if (a.correct) ok++;
      a.items.forEach(function (it) {
        if (it.given) return;
        items++;
        var p = per[it.id] = per[it.id] || { n: 0, ok: 0 }, good = String(it.guess) === String(it.id);
        p.n++; if (good) { p.ok++; right++; } else { var k = it.id + '>' + it.guess; conf[k] = (conf[k] || 0) + 1; }
      });
    });
    var rows = Object.keys(per).map(function (k) { return { id: k, n: per[k].n, ok: per[k].ok, acc: per[k].ok / per[k].n }; })
      .sort(function (a, b) { return order.indexOf(String(a.id)) - order.indexOf(String(b.id)); });
    var weakest = rows.filter(function (r) { return r.acc < 1; }).sort(function (a, b) { return a.acc - b.acc || b.n - a.n; })[0] || null;
    var big = null;
    Object.keys(conf).forEach(function (k) { if (!big || conf[k] > big.count) { var p = k.split('>'); big = { correct: p[0], guess: p[1], count: conf[k] }; } });
    return { n: sess.answers.length, ok: ok, hinted: 0, rows: rows, weakest: weakest, confusion: big, items: items, right: right };
  }
  /** XP for one question: per-item credit, scaled by level and question length. */
  function questionXp(lvN, right, n, combo) {
    if (!right || !n) return 0;
    var base = 8 + (lvN || 1) * 2;
    var xp = Math.round(base * (right / n) * (1 + 0.5 * (n - 1)));
    return xp + (right === n && combo >= 3 ? Math.min(5, combo - 2) : 0);
  }
  function inRange(list) { return list.every(function (m) { return m >= LO && m <= HI; }); }

  global.EarHarmony = {
    LO: LO, HI: HI, pc: pc, keyName: keyName, spell: spell, STEPS: STEPS, tonesOf: tonesOf, candidates: candidates,
    voiceLead: voiceLead, cadence: cadence, CAD_STEP: CAD_STEP, pickPc: pickPc, weighted: weighted, store: store, levelBook: levelBook,
    summarizeItems: summarizeItems, questionXp: questionXp, inRange: inRange, today: today
  };
})(window);
