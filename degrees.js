/*
 * degrees.js: scale-degree ear training (window.EarDeg), Functional Ear Trainer style. Pure logic, no DOM.
 * A cadence sets the key, then one or more notes play; name each note's degree (1, ♭2, 2 ... 7).
 * After the answer every note walks stepwise to the nearest tonic. Stats live in s.deg.
 */
(function (global) {
  'use strict';

  var E = global.EarEngine, H = global.EarHarmony;

  var LABEL = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];
  var NAME = ['Tonic', 'Flat two', 'Two', 'Flat three', 'Three', 'Four', 'Sharp four / flat five', 'Five', 'Flat six', 'Six', 'Flat seven', 'Seven'];
  var FEEL = [
    'Home. Completely at rest.',
    'Dark and tense. Sinks straight down to 1.',
    'One step above home. Wants to fall to 1.',
    'The minor third. A sad color that leans down to 2 and 1.',
    'The major third. Bright and settled.',
    'Leans down to 3. Sounds unfinished.',
    'The tritone. The most restless note in the key.',
    'Strong and open. The second home after 1.',
    'Dark and heavy. Borrowed from the minor key.',
    'Sweet and light. Climbs through 7 to home.',
    'Bluesy and relaxed. The seven of rock and blues.',
    'The leading tone. Pulls hard up to 1.'
  ];
  var SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  var ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  function label(d) { return LABEL[+d]; }
  function name(d) { return NAME[+d]; }
  function feel(d) { return FEEL[+d]; }

  var PACKS = [
    { id: 'triad', name: 'Major: 1 3 5', mode: 'major', degs: [0, 4, 7], mood: 'The home chord’s notes.', moodLong: 'Start with the three notes of the tonic chord. Each one feels at rest in its own way.' },
    { id: 'major', name: 'Major: all seven', mode: 'major', degs: SCALE.major.slice(), mood: 'The whole major scale.', moodLong: 'All seven notes of the major key. Feel which ones lean and where they want to go.' },
    { id: 'minor', name: 'Minor: all seven', mode: 'minor', degs: SCALE.minor.slice(), mood: 'Natural minor.', moodLong: 'The key is set with i–iv–V–i. Listen for the dark ♭3, ♭6 and ♭7.' },
    { id: 'chromatic', name: 'Chromatic', mode: 'major', degs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], mood: 'All twelve notes.', moodLong: 'Every note against a major key, including the five outside the scale.' },
    { id: 'melodic', name: 'Melodic', mode: 'major', degs: SCALE.major.slice(), minNotes: [2, 2, 2, 3, 3], mood: 'Short melodies.', moodLong: 'Two or three notes in a row from the major scale. Name each one in order.' }
  ];
  function packById(id) { for (var i = 0; i < PACKS.length; i++) if (PACKS[i].id === id) return PACKS[i]; return null; }

  var LEVELS = [
    { n: 1, name: 'Home key', notes: 1, fixedKey: true, range: 'mid', tool: true, replays: Infinity, mixInst: false, hints: false,
      desc: 'One key for the whole level. Notes sit in the octave above the tonic.' },
    { n: 2, name: 'Any key', notes: 1, fixedKey: false, range: 'mid', tool: true, replays: Infinity, mixInst: false, hints: false,
      desc: 'A new key every question.' },
    { n: 3, name: 'Wide range', notes: 1, fixedKey: false, range: 'wide', tool: true, replays: Infinity, mixInst: false, hints: false,
      desc: 'The note may sit below the tonic or above its octave.' },
    { n: 4, name: 'Two notes', notes: 2, fixedKey: false, range: 'wide', tool: true, replays: Infinity, mixInst: false, hints: false,
      desc: 'Two notes in a row. Name both, in order.' },
    { n: 5, name: 'Master', notes: 3, fixedKey: false, range: 'wide', tool: false, replays: 1, mixInst: true, hints: false,
      desc: 'Three notes, random instrument. No key replay before you answer. One replay.' }
  ];
  var LEVEL_LEN = 20, FREE_LEN = 20, MIN_POOL = 3;
  var S_ = H.store('deg'), B = H.levelBook('deg', PACKS, LEVELS);

  function normalize(s) {
    S_.normalize(s, { mode: 'major', pool: [0, 4, 7, 5, 2], notes: 1 });
    var f = s.deg.free;
    if (f.mode !== 'minor') f.mode = 'major';
    f.pool = (f.pool || []).map(Number).filter(function (x, i, a) { return x >= 0 && x < 12 && a.indexOf(x) === i; });
    if ([1, 2, 3].indexOf(f.notes) < 0) f.notes = 1;
    return s;
  }

  // ---------------------------------------------------------------- resolution
  /** Stepwise walk from the note to the nearest tonic through the key's scale. Fewer steps wins; a tie goes down. */
  function resolution(note, tonic, mode) {
    var sc = SCALE[mode === 'minor' ? 'minor' : 'major'], d = H.pc(note - tonic), base = note - d;
    if (d === 0) return [note];
    var down = [note], up = [note];
    sc.filter(function (x) { return x < d; }).sort(function (a, b) { return b - a; }).forEach(function (x) { down.push(base + x); });
    sc.filter(function (x) { return x > d; }).forEach(function (x) { up.push(base + x); });
    up.push(base + 12);
    var okD = H.inRange(down), okU = H.inRange(up);
    if (okD && !okU) return down;
    if (okU && !okD) return up;
    if (down.length !== up.length) return down.length < up.length ? down : up;
    return d <= 6 ? down : up;
  }
  function resolvable(note, tonic, mode) { return H.inRange(resolution(note, tonic, mode)); }

  // ---------------------------------------------------------------- sessions
  function tonicFor(pcv) { return 52 + H.pc(pcv - 52); }                // 52..63 (E3..E♭4)
  function windowFor(T, range) { return range === 'wide' ? { lo: Math.max(H.LO, T - 7), hi: Math.min(H.HI, T + 14) } : { lo: T, hi: T + 11 }; }

  function newSession(s, opts, rnd) {
    rnd = rnd || Math.random;
    var sess = { kind: 'deg', answers: [], q: null, lastTonic: null, last: null };
    if (opts.mode === 'free') {
      sess.free = true; sess.packName = 'Free practice'; sess.mode = opts.keyMode; sess.pool = opts.pool.slice().sort(function (a, b) { return a - b; }); sess.length = FREE_LEN;
      sess.lv = { n: 0, name: opts.notes === 1 ? 'One note' : opts.notes + ' notes', notes: opts.notes, fixedKey: false, range: 'mid', tool: true, replays: Infinity, mixInst: false, hints: false, free: true };
      sess.notes = opts.notes;
    } else {
      var p = packById(opts.pack), L = LEVELS[(opts.level || 1) - 1];
      sess.pack = p.id; sess.packName = p.name; sess.level = L.n; sess.lv = L; sess.mode = p.mode; sess.pool = p.degs.slice(); sess.length = LEVEL_LEN;
      sess.notes = p.minNotes ? Math.max(L.notes, p.minNotes[L.n - 1]) : L.notes;
    }
    if (sess.lv.fixedKey) sess.fixedTonic = tonicFor(H.pickPc(rnd, null));
    return sess;
  }
  function weightFor(s, d) {
    var a = S_.accuracy(s, String(d)), acc = a.n < 3 ? 0.6 : a.acc;
    return 0.3 + (1 - acc) * 1.4;
  }
  function nextQuestion(s, sess, rnd) {
    rnd = rnd || Math.random;
    var L = sess.lv, T = sess.fixedTonic != null ? sess.fixedTonic : tonicFor(H.pickPc(rnd, sess.lastTonic != null ? H.pc(sess.lastTonic) : null));
    var win = windowFor(T, L.range), notes = [], items = [];
    for (var k = 0; k < sess.notes; k++) {
      var prevNote = notes.length ? notes[notes.length - 1] : null, prevDeg = items.length ? items[items.length - 1] : (sess.notes === 1 ? sess.last : null);
      var cands = [], weights = [], adaptive = rnd() < 0.5;
      for (var m = win.lo; m <= win.hi; m++) {
        var d = H.pc(m - T);
        if (sess.pool.indexOf(d) < 0 || d === prevDeg || !resolvable(m, T, sess.mode)) continue;
        if (prevNote != null && Math.abs(m - prevNote) > 9) continue;
        cands.push(m); weights.push(adaptive ? weightFor(s, d) : 1);
      }
      if (!cands.length) {            // safety: drop the leap limit
        for (var m2 = win.lo; m2 <= win.hi; m2++) { var d2 = H.pc(m2 - T); if (sess.pool.indexOf(d2) >= 0 && d2 !== prevDeg && resolvable(m2, T, sess.mode)) { cands.push(m2); weights.push(1); } }
      }
      var note = H.weighted(cands, weights, rnd);
      notes.push(note); items.push(H.pc(note - T));
    }
    var inst = L.mixInst ? (rnd() < 0.5 ? 'guitar' : 'piano') : null;
    sess.lastTonic = T; sess.last = items[items.length - 1];
    sess.q = { kind: 'deg', tonic: T, mode: sess.mode, notes: notes, items: items, given: 0, n: items.length, picks: [],
      cue: true, inst: inst, plays: 0, answered: false, hinted: false };
    return sess.q;
  }

  // ---------------------------------------------------------------- audio events
  var NOTE_STEP = 0.8, RES_STEP = 0.4;
  function noteEvents(notes, at) {
    return notes.map(function (m, i) { return { at: at + i * NOTE_STEP, midis: [m], ring: i === notes.length - 1 ? 1.4 : 0.95 }; });
  }
  function questionEvents(q) {
    var c = H.cadence(q.tonic, q.mode, 0);
    return c.events.concat(noteEvents(q.notes, c.end));
  }
  function cadenceEvents(q) { return H.cadence(q.tonic, q.mode, 0).events; }
  /** Each note walks home in turn. */
  function resolutionEvents(notes, tonic, mode) {
    var ev = [], t = 0;
    notes.forEach(function (n) {
      var path = resolution(n, tonic, mode);
      path.forEach(function (m, i) { ev.push({ at: t + i * RES_STEP, midis: [m], ring: i === path.length - 1 ? 1.1 : 0.46 }); });
      t += (path.length - 1) * RES_STEP + 1.0;
    });
    return ev;
  }
  /** Library: cadence, the degree, then its walk home. */
  function demoEvents(deg, tonic, mode) {
    var c = H.cadence(tonic, mode, 0), note = tonic + deg;
    var ev = c.events.concat([{ at: c.end, midis: [note], ring: 1.0 }]);
    resolution(note, tonic, mode).slice(1).forEach(function (m, i, a) { ev.push({ at: c.end + 1.0 + i * RES_STEP, midis: [m], ring: i === a.length - 1 ? 1.1 : 0.46 }); });
    return ev;
  }
  /** Same notes as the question would have if the guesses were right (nearest octave to each played note). */
  function guessNotes(q) {
    return q.picks.map(function (g, i) { var n = q.notes[i], d = H.pc(n - q.tonic); var x = n - d + g; if (x - n > 6) x -= 12; if (n - x > 6) x += 12; return x; });
  }

  // ---------------------------------------------------------------- answers
  function record(s, q) {
    var items = q.items.map(function (id, i) { return { id: String(id), guess: String(q.picks[i]), given: false }; });
    var ev = S_.recordItems(s, items);
    ev.items = items;
    return ev;
  }
  function answerXp(sess, ev, combo) { return H.questionXp(sess.lv.n, ev.right, ev.n, combo); }
  function summarize(sess) { return H.summarizeItems(sess, ORDER); }
  function noteName(m, tonic, mode) {
    var d = H.pc(m - tonic), steps = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6][d];
    if (d === 6) steps = 3;           // ♯4
    return H.spell(tonic, mode, d, steps) + (Math.floor(m / 12) - 1);
  }

  // ---------------------------------------------------------------- achievements
  function ds(s) { return s.deg || { levels: {}, right: 0 }; }
  if (E && E.ACHIEVEMENTS) {
    E.ACHIEVEMENTS.push(
      { id: 'deg-50', name: 'Finding home', desc: 'Name 50 scale degrees correctly.', test: function (s) { return ds(s).right >= 50; } },
      { id: 'deg-star', name: 'First degree star', desc: 'Earn a star in any scale-degree pack.', test: function (s) { return B.anyLevel(s, function (r) { return r.stars >= 1; }); } },
      { id: 'deg-chromatic', name: 'Chromatic ear', desc: 'Get three stars on a Chromatic level.', test: function (s) { return B.anyLevel(s, function (r, p) { return p === 'chromatic' && r.stars === 3; }); } },
      { id: 'deg-500', name: 'Tonal center', desc: 'Name 500 scale degrees correctly.', test: function (s) { return ds(s).right >= 500; } }
    );
  }

  global.EarDeg = {
    LABEL: LABEL, NAME: NAME, SCALE: SCALE, ORDER: ORDER, PACKS: PACKS, LEVELS: LEVELS, LEVEL_LEN: LEVEL_LEN, FREE_LEN: FREE_LEN, MIN_POOL: MIN_POOL,
    label: label, name: name, feel: feel, packById: packById, normalize: normalize, resolution: resolution,
    accuracy: S_.accuracy, mixups: S_.mixups, record: record, answerXp: answerXp, summarize: summarize,
    newSession: newSession, nextQuestion: nextQuestion,
    questionEvents: questionEvents, cadenceEvents: cadenceEvents, resolutionEvents: resolutionEvents, demoEvents: demoEvents, guessNotes: guessNotes, noteName: noteName,
    levelRow: B.levelRow, levelUnlocked: B.levelUnlocked, packStars: B.packStars, totalStars: B.totalStars, recordLevel: B.recordLevel
  };
})(window);
