/*
 * progressions.js: chord-progression ear training (window.EarProg). Pure logic, no DOM.
 * Roman numerals in a key: hear a short cadence, then 3–4 voice-led block chords, name them in order.
 * Shares XP, ranks, streak and achievements with EarEngine; stats live in s.prog.
 */
(function (global) {
  'use strict';

  var E = global.EarEngine, H = global.EarHarmony;

  // Numerals. root = semitones above the tonic, q = EarChords type, steps = letter steps (spelling).
  var CH = {
    I: { label: 'I', root: 0, q: 'maj', steps: 0 }, ii: { label: 'ii', root: 2, q: 'min', steps: 1 }, iii: { label: 'iii', root: 4, q: 'min', steps: 2 },
    IV: { label: 'IV', root: 5, q: 'maj', steps: 3 }, V: { label: 'V', root: 7, q: 'maj', steps: 4 }, vi: { label: 'vi', root: 9, q: 'min', steps: 5 },
    bVII: { label: '♭VII', root: 10, q: 'maj', steps: 6 }, bVI: { label: '♭VI', root: 8, q: 'maj', steps: 5 }, iv: { label: 'iv', root: 5, q: 'min', steps: 3 },
    i: { label: 'i', root: 0, q: 'min', steps: 0 }, v: { label: 'v', root: 7, q: 'min', steps: 4 }, III: { label: 'III', root: 3, q: 'maj', steps: 2 },
    VI: { label: 'VI', root: 8, q: 'maj', steps: 5 }, VII: { label: 'VII', root: 10, q: 'maj', steps: 6 },
    I7: { label: 'I7', root: 0, q: '7', steps: 0 }, IV7: { label: 'IV7', root: 5, q: '7', steps: 3 }, V7: { label: 'V7', root: 7, q: '7', steps: 4 },
    ii7: { label: 'ii7', root: 2, q: 'm7', steps: 1 }, Imaj7: { label: 'Imaj7', root: 0, q: 'maj7', steps: 0 }, vi7: { label: 'vi7', root: 9, q: 'm7', steps: 5 }
  };
  var ORDER = ['I', 'Imaj7', 'I7', 'i', 'ii', 'ii7', 'iii', 'III', 'IV', 'IV7', 'iv', 'V', 'V7', 'v', 'bVI', 'VI', 'vi', 'vi7', 'bVII', 'VII'];
  var QUALITY = { maj: 'Major', min: 'Minor', '7': 'Dominant 7', m7: 'Minor 7', maj7: 'Major 7' };
  var SUFFIX = { maj: '', min: 'm', '7': '7', m7: 'm7', maj7: 'maj7' };
  function ch(id) { return CH[id] || null; }
  function label(id) { return CH[id] ? CH[id].label : String(id); }
  function quality(id) { return CH[id] ? QUALITY[CH[id].q] : ''; }

  // How strongly one chord moves to the next (functional harmony). Missing pairs get a small weight.
  var W = {
    I: { IV: 3, V: 3, vi: 3, ii: 2, iii: 1, bVII: 2, bVI: 1.2, iv: 1 },
    ii: { V: 4, IV: 1, vi: 0.6, iii: 0.6, I: 0.5 },
    iii: { vi: 3, IV: 2, ii: 1, I: 0.5 },
    IV: { V: 3, I: 3, ii: 1, vi: 1.2, iv: 2, bVII: 1, iii: 0.6 },
    V: { I: 4, vi: 3, IV: 2, ii: 0.3, iii: 0.5 },
    vi: { IV: 3, ii: 2, V: 2, iii: 1, I: 1 },
    bVII: { IV: 3, I: 3, bVI: 1, V: 0.5 },
    bVI: { bVII: 3, V: 1, I: 1.2, IV: 1, iv: 0.8 },
    iv: { I: 3, V: 1, bVII: 1, bVI: 0.6 },
    i: { iv: 3, VI: 3, VII: 3, v: 2, III: 2 },
    iv_m: { i: 3, v: 2, VII: 2, VI: 1, III: 0.6 },
    v: { i: 3, VI: 2, iv: 1, III: 0.5 },
    VI: { VII: 3, III: 2, iv: 2, i: 1, v: 1 },
    VII: { i: 3, III: 3, VI: 1, iv: 0.6 },
    III: { VI: 2, VII: 2, iv: 2, i: 1 },
    I7: { IV7: 3, V7: 2 }, IV7: { I7: 3, V7: 1 }, V7: { IV7: 3, I7: 3, Imaj7: 4, vi7: 1 },
    ii7: { V7: 4, Imaj7: 0.5 }, Imaj7: { vi7: 3, ii7: 2 }, vi7: { ii7: 4, V7: 1 }
  };
  function weight(a, b, mode) {
    var row = W[a === 'iv' && mode === 'minor' ? 'iv_m' : a] || {};
    return row[b] != null ? row[b] : 0.15;
  }

  // Well-known shapes get extra weight. Song examples only where the chords are certain.
  var LIB = [
    { id: 'pop', name: 'Pop four', mode: 'major', seq: ['I', 'V', 'vi', 'IV'], songs: ['“Let It Be” (verse), The Beatles', '“With or Without You,” U2', '“No Woman, No Cry,” Bob Marley & the Wailers'] },
    { id: 'pop-vi', name: 'Pop four from vi', mode: 'major', seq: ['vi', 'IV', 'I', 'V'], songs: ['“Zombie,” The Cranberries'] },
    { id: 'fifties', name: 'Fifties', mode: 'major', seq: ['I', 'vi', 'IV', 'V'], songs: ['“Stand By Me,” Ben E. King', '“Every Breath You Take,” The Police'] },
    { id: 'cadence', name: 'Full cadence', mode: 'major', seq: ['I', 'IV', 'V', 'I'], songs: [] },
    { id: 'plagal-minor', name: 'Minor plagal', mode: 'major', seq: ['I', 'IV', 'iv', 'I'], songs: [] },
    { id: 'mixo', name: 'Rock ♭VII', mode: 'major', seq: ['I', 'bVII', 'IV', 'I'], songs: [] },
    { id: 'aeolian', name: 'Epic ♭VI–♭VII', mode: 'major', seq: ['I', 'bVI', 'bVII', 'I'], songs: [] },
    { id: 'minor-pop', name: 'Minor pop', mode: 'minor', seq: ['i', 'VI', 'III', 'VII'], songs: ['“Despacito,” Luis Fonsi ft. Daddy Yankee'] },
    { id: 'minor-cad', name: 'Natural minor cadence', mode: 'minor', seq: ['i', 'iv', 'v', 'i'], songs: [] },
    { id: 'minor-rock', name: 'Minor rock', mode: 'minor', seq: ['i', 'VII', 'VI', 'VII'], songs: [] },
    { id: 'twofive', name: 'ii–V–I', mode: 'major', seq: ['ii7', 'V7', 'Imaj7'], songs: ['“Autumn Leaves” (opening)'] },
    { id: 'rhythm', name: 'Turnaround', mode: 'major', seq: ['Imaj7', 'vi7', 'ii7', 'V7'], songs: [] },
    { id: 'blues', name: '12-bar blues', mode: 'major', seq: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'], songs: ["“Johnny B. Goode,” Chuck Berry (same 12-bar form)"], fast: true }
  ];
  function famousFor(seq) {
    var key = seq.join(' ');
    for (var i = 0; i < LIB.length; i++) if (LIB[i].seq.join(' ') === key) return LIB[i];
    return null;
  }
  var EXTRA_FAMOUS = ['I7 IV7 I7 V7', 'I7 V7 IV7 I7', 'I7 IV7 V7 I7', 'ii7 V7 Imaj7 vi7', 'I V IV I', 'I IV V', 'i iv v'];

  var PACKS = [
    { id: 'three', name: 'Three chords', mode: 'major', chords: ['I', 'IV', 'V'], mood: 'I, IV and V.', moodLong: 'Home, away and the pull back home. The three chords behind folk, country and rock and roll.' },
    { id: 'pop', name: 'Pop four', mode: 'major', chords: ['I', 'V', 'vi', 'IV'], mood: 'Four chords, a thousand songs.', moodLong: 'Add the relative minor, vi, to the three chords and you can play most of the radio.' },
    { id: 'diatonic', name: 'Major diatonic', mode: 'major', chords: ['I', 'ii', 'iii', 'IV', 'V', 'vi'], mood: 'Every chord in a major key.', moodLong: 'All six common chords of a major key. ii and IV, iii and vi are the classic mix-ups.' },
    { id: 'minor', name: 'Minor keys', mode: 'minor', chords: ['i', 'iv', 'v', 'VI', 'VII', 'III'], mood: 'Natural minor harmony.', moodLong: 'Home is a minor chord now. The major VI, VII and III bring the light in.' },
    { id: 'borrowed', name: 'Borrowed & ♭VII', mode: 'major', chords: ['I', 'IV', 'V', 'bVII', 'bVI', 'iv'], mood: 'Rock and film colors.', moodLong: 'Chords borrowed from the parallel minor: the rock ♭VII, the epic ♭VI and the bittersweet minor iv.' },
    { id: 'blues', name: 'Blues', mode: 'major', chords: ['I7', 'IV7', 'V7'], mood: 'Dominant sevenths only.', moodLong: 'Pieces of the 12-bar blues. Every chord is a dominant 7, so listen to where the bass goes.' },
    { id: 'jazz', name: 'Jazz ii–V–I', mode: 'major', chords: ['ii7', 'V7', 'Imaj7', 'vi7'], starts: ['Imaj7', 'ii7'], mood: 'Seventh-chord turnarounds.', moodLong: 'The ii–V–I and the I–vi–ii–V turnaround, all in seventh chords. Here a question may also start on ii7.' }
  ];
  function packById(id) { for (var i = 0; i < PACKS.length; i++) if (PACKS[i].id === id) return PACKS[i]; return null; }
  var MODE_CHORDS = { major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'bVII', 'bVI', 'iv'], minor: ['i', 'III', 'iv', 'v', 'VI', 'VII'] };

  // Levels. len: chords per question. given: chords shown up front. step: seconds per chord.
  var LEVELS = [
    { n: 1, name: 'Home key', len: 3, given: 1, fixedKey: true, inv: false, startAny: false, cue: true, replays: Infinity, mixInst: false, step: 0.9, hints: false,
      desc: 'One key for the whole level. Three chords; the first one is given.' },
    { n: 2, name: 'Any key', len: 3, given: 0, fixedKey: false, inv: false, startAny: false, cue: true, replays: Infinity, mixInst: false, step: 0.9, hints: false,
      desc: 'A new key every question. Three chords, starting on the home chord.' },
    { n: 3, name: 'Four chords', len: 4, given: 0, fixedKey: false, inv: false, startAny: false, cue: true, replays: Infinity, mixInst: false, step: 0.9, hints: false,
      desc: 'Four chords in a new key every question.' },
    { n: 4, name: 'Inversions', len: 4, given: 0, fixedKey: false, inv: true, startAny: true, cue: true, replays: Infinity, mixInst: false, step: 0.9, hints: false,
      desc: 'Four chords with inversions and wider voice-leading. The first chord is not always home.' },
    { n: 5, name: 'Master', len: 4, given: 0, fixedKey: false, inv: true, startAny: false, cue: false, replays: 1, mixInst: true, step: 0.68, hints: false,
      desc: 'Four chords, faster, random instrument. No key cue: the progression sets the key. One replay.' }
  ];
  var LEVEL_LEN = 10, FREE_LEN = 10, MIN_POOL = 3;
  var S_ = H.store('prog'), B = H.levelBook('prog', PACKS, LEVELS);

  function normalize(s) {
    S_.normalize(s, { mode: 'major', pool: ['I', 'IV', 'V', 'vi'], len: 4 });
    var f = s.prog.free;
    if (f.mode !== 'minor') f.mode = 'major';
    f.pool = (f.pool || []).filter(function (x, i, a) { return MODE_CHORDS[f.mode].indexOf(x) >= 0 && a.indexOf(x) === i; });
    if (f.len !== 3) f.len = 4;
    return s;
  }
  function sortPool(list) { return list.slice().sort(function (a, b) { return CH[a].root - CH[b].root || ORDER.indexOf(a) - ORDER.indexOf(b); }); }
  function tonicOf(pool, mode) {
    for (var i = 0; i < pool.length; i++) if (CH[pool[i]].root === 0) return pool[i];
    return null;
  }

  // ---------------------------------------------------------------- generator
  /** All sequences of `len` chords from the pool (no chord twice in a row), weighted by how musical they are. */
  function enumerate(pool, len, starts, mode) {
    var out = [];
    function rec(seq, w) {
      if (seq.length === len) {
        var key = seq.join(' ');
        if (famousFor(seq) || EXTRA_FAMOUS.indexOf(key) >= 0) w *= 3;
        out.push({ seq: seq.slice(), w: w });
        return;
      }
      var last = seq[seq.length - 1];
      pool.forEach(function (id) {
        if (id === last) return;
        var x = weight(last, id, mode);
        seq.push(id); rec(seq, w * x); seq.pop();
      });
    }
    starts.forEach(function (st) { if (pool.indexOf(st) >= 0) rec([st], 1); });
    return out;
  }
  function genSequence(s, sess, rnd) {
    var L = sess.lv, len = sess.len, pool = sess.pool, tonic = tonicOf(pool, sess.mode);
    var starts;
    if (L.startAny) starts = pool.slice();
    else starts = (sess.starts || [tonic]).filter(Boolean);
    if (!starts.length) starts = pool.slice();
    var ck = starts.join(',') + '|' + len;
    sess.cache = sess.cache || {};
    var list = sess.cache[ck] = sess.cache[ck] || enumerate(pool, len, starts, sess.mode);
    var lastKey = sess.lastSeq ? sess.lastSeq.join(' ') : '';
    var given = sess.given;
    var weights = list.map(function (x) {
      if (x.seq.join(' ') === lastKey) return 0;
      var w = Math.pow(x.w, 0.6);
      if (L.startAny && x.seq[0] === tonic) w *= 0.5;
      // adaptive: chords you miss come up more
      var boost = 1;
      for (var i = given; i < x.seq.length; i++) { var a = S_.accuracy(s, x.seq[i]); boost += (a.n < 3 ? 0.2 : 1 - a.acc) * 0.5; }
      return w * boost;
    });
    var pick = H.weighted(list, weights, rnd);
    return pick.seq.slice();
  }

  /** Voice the sequence in a key. inv: some chords get the 3rd or 5th in the bass. */
  function voice(seq, tonicPc, opts, rnd) {
    rnd = rnd || Math.random;
    var bassIdx = [];
    var chords = seq.map(function (id, i) {
      var c = CH[id], rootPc = H.pc(tonicPc + c.root), bassPc = null, b = 0;
      if (opts.inv && rnd() < 0.4) {
        var tones = H.tonesOf(c.q);
        b = rnd() < 0.6 ? 1 : 2;
        bassPc = H.pc(rootPc + tones[b]);
      }
      bassIdx.push(b);
      return { rootPc: rootPc, q: c.q, bassPc: bassPc };
    });
    var v = H.voiceLead(chords, { loose: !!opts.inv, rnd: rnd });
    v.forEach(function (x, i) { x.inv = bassIdx[i]; });
    return v;
  }
  function newSession(s, opts, rnd) {
    rnd = rnd || Math.random;
    var sess = { kind: 'prog', answers: [], q: null, lastTonic: null, lastSeq: null };
    if (opts.mode === 'free') {
      var f = opts;
      sess.free = true; sess.packName = 'Free practice'; sess.mode = f.keyMode; sess.pool = sortPool(f.pool); sess.length = FREE_LEN;
      sess.lv = { n: 0, name: f.len + ' chords', len: f.len, given: 0, fixedKey: false, inv: false, startAny: !tonicOf(sess.pool), cue: true, replays: Infinity, mixInst: false, step: 0.9, hints: false, free: true };
    } else {
      var p = packById(opts.pack), L = LEVELS[(opts.level || 1) - 1];
      sess.pack = p.id; sess.packName = p.name; sess.level = L.n; sess.lv = L; sess.mode = p.mode; sess.pool = sortPool(p.chords); sess.length = LEVEL_LEN;
      sess.starts = p.starts || null;
    }
    sess.len = sess.lv.len; sess.given = sess.lv.given;
    if (sess.lv.fixedKey) sess.fixedTonic = H.pickPc(rnd, null);
    return sess;
  }
  function nextQuestion(s, sess, rnd) {
    rnd = rnd || Math.random;
    var L = sess.lv;
    var tonicPc = sess.fixedTonic != null ? sess.fixedTonic : H.pickPc(rnd, sess.lastTonic);
    var seq = genSequence(s, sess, rnd);
    var voiced = voice(seq, tonicPc, { inv: L.inv }, rnd);
    var inst = L.mixInst ? (rnd() < 0.5 ? 'guitar' : 'piano') : null;
    sess.lastTonic = tonicPc; sess.lastSeq = seq;
    sess.q = { kind: 'prog', tonic: 60 + tonicPc, mode: sess.mode, items: seq, voiced: voiced, given: sess.given, n: seq.length, picks: [],
      step: L.step, cue: L.cue, inst: inst, plays: 0, answered: false, hinted: false };
    return sess.q;
  }

  // ---------------------------------------------------------------- audio events
  function chordEvents(voiced, at, step) {
    return voiced.map(function (v, i) { return { at: at + i * step, midis: v.midis, ring: step * 1.08 }; });
  }
  function questionEvents(q) {
    var t = 0, ev = [];
    if (q.cue) { var c = H.cadence(q.tonic, q.mode, 0); ev = c.events; t = c.end; }
    return ev.concat(chordEvents(q.voiced, t, q.step));
  }
  /** Any numeral sequence in the question's key, root position, smooth leading. */
  function seqVoiced(seq, tonic) { return voice(seq, H.pc(tonic), { inv: false }); }
  function seqEvents(seq, tonic, step) { return chordEvents(seqVoiced(seq, tonic), 0, step || 0.9); }
  function correctEvents(q) { return chordEvents(q.voiced, 0, Math.max(0.8, q.step)); }
  function guessEvents(q) { return seqEvents(q.items.slice(0, q.given).concat(q.picks.slice(q.given)), q.tonic, Math.max(0.8, q.step)); }

  // ---------------------------------------------------------------- names
  function chordName(id, tonic, mode, bassInv) {
    var c = CH[id], root = H.spell(tonic, mode, c.root, c.steps), name = root + SUFFIX[c.q];
    if (bassInv) {
      var tones = H.tonesOf(c.q), off = tones[bassInv];
      name += '/' + H.spell(tonic, mode, c.root + off, c.steps + H.STEPS[off]);
    }
    return name;
  }
  function keyLabel(tonic, mode) { return H.keyName(tonic, mode) + (mode === 'minor' ? ' minor' : ' major'); }

  // ---------------------------------------------------------------- answers
  function record(s, q) {
    var items = q.items.map(function (id, i) { return { id: id, guess: i < q.given ? id : q.picks[i], given: i < q.given }; });
    var ev = S_.recordItems(s, items);
    if (ev.correct && q.n >= 4) s.prog.perfect4++;
    ev.items = items;
    return ev;
  }
  function answerXp(sess, ev, combo) { return H.questionXp(sess.lv.n, ev.right, ev.n, combo); }
  function summarize(sess) { return H.summarizeItems(sess, ORDER); }

  // ---------------------------------------------------------------- achievements
  function ps(s) { return s.prog || { levels: {}, tried: {}, total: 0, perfect4: 0 }; }
  if (E && E.ACHIEVEMENTS) {
    E.ACHIEVEMENTS.push(
      { id: 'prog-perfect', name: 'Perfect progression', desc: 'Name all four chords of a progression.', test: function (s) { return ps(s).perfect4 >= 1; } },
      { id: 'prog-star', name: 'First progression star', desc: 'Earn a star in any progression pack.', test: function (s) { return B.anyLevel(s, function (r) { return r.stars >= 1; }); } },
      { id: 'prog-master', name: 'Harmony detective', desc: 'Clear the Master level of a progression pack.', test: function (s) { return B.anyLevel(s, function (r, p, n) { return n === LEVELS.length && r.stars >= 1; }); } },
      { id: 'prog-100', name: 'Chord charts', desc: 'Answer 100 progressions.', test: function (s) { return ps(s).total >= 100; } }
    );
  }

  global.EarProg = {
    CH: CH, ORDER: ORDER, PACKS: PACKS, LEVELS: LEVELS, LEVEL_LEN: LEVEL_LEN, FREE_LEN: FREE_LEN, MIN_POOL: MIN_POOL, LIB: LIB, MODE_CHORDS: MODE_CHORDS,
    ch: ch, label: label, quality: quality, packById: packById, normalize: normalize, sortPool: sortPool,
    accuracy: S_.accuracy, mixups: S_.mixups, record: record, answerXp: answerXp, summarize: summarize,
    newSession: newSession, nextQuestion: nextQuestion, enumerate: enumerate, voice: voice,
    questionEvents: questionEvents, seqEvents: seqEvents, correctEvents: correctEvents, guessEvents: guessEvents,
    chordName: chordName, keyLabel: keyLabel, famousFor: famousFor,
    levelRow: B.levelRow, levelUnlocked: B.levelUnlocked, packStars: B.packStars, totalStars: B.totalStars, recordLevel: B.recordLevel
  };
})(window);
