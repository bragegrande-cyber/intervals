/*
 * engine.js — learning engine for the interval trainer (window.EarEngine).
 * Pure logic + persistence. No DOM. Follows docs/method.md.
 */
(function (global) {
  'use strict';

  var ORDER = [7, 12, 4, 5, 3, 9, 2, 10, 8, 11, 1, 6]; // P5 P8 M3 P4 m3 M6 M2 m7 m6 M7 m2 TT
  var STAGES = ['up', 'down', 'harmonic'];
  var STAGE_LABEL = { up: 'Melodic up', down: 'Melodic down', harmonic: 'Harmonic' };
  var STAGE_SHORT = { up: 'Up', down: 'Down', harmonic: 'Together' };
  var STAGE_START = { up: 3, down: 4, harmonic: 4 }; // >= 3: with 2 intervals and no repeats, answers would just alternate
  var WINDOW = 20;           // answers in the unlock window
  var NEED_SINCE = 20;       // answers since last unlock
  var NEED_ACC = 0.9;        // over last 20 (active intervals)
  var NEED_EACH = 0.75;      // every active interval individually
  var MIN_EACH_N = 3;        // an interval needs this many answers before it counts as proven
  var BOOST_QUESTIONS = 60;  // ~2 sessions with the new interval at 2x
  var HIST_KEEP = 40;
  var SESSION_LEN = 30;
  var ROOT_MIN = 40, ROOT_MAX = 64; // 64 + 12 = 76: any interval (and any contrast) stays in RANGE
  var KEY = 'eartrainer.v1';
  var MIN_POOL = 3;          // every question pool has at least 3 intervals (no-repeat rule stays unpredictable)
  var LEVEL_LEN = 20;        // questions per game-mode level
  var STAR_AT = [0.7, 0.85, 0.95];

  // Game-mode levels. dirs: stages drawn per question. cue: context before each question.
  var LEVELS = [
    { n: 1, name: 'Rising', dirs: ['up'], cue: 'scale', hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'Upward. Tap Hear scale whenever you want the key. Hints and replays allowed.' },
    { n: 2, name: 'Falling', dirs: ['down'], cue: 'chord', hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'Downward: the higher note comes first. A tonic chord sets the key.' },
    { n: 3, name: 'Both ways', dirs: ['up', 'down'], cue: null, hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'Up or down at random. No context cue.' },
    { n: 4, name: 'Together', dirs: ['harmonic'], cue: null, hints: true, replays: Infinity, mixInst: false, notes: 1,
      desc: 'Both notes at once. Listen for the color of the pair.' },
    { n: 5, name: 'Master', dirs: ['up', 'down', 'harmonic'], cue: null, hints: false, replays: 1, mixInst: true, notes: 0.6,
      desc: 'Any direction, random instrument, shorter notes. One replay, no fretboard hint.' }
  ];

  // Game modes: semitones from the tonic (P8 = 12 included).
  var MODES = [
    { id: 'major', group: 'Scales', name: 'Major', semis: [2, 4, 5, 7, 9, 11, 12], mood: 'Bright, happy, confident.', moodLong: 'The sound of most pop songs and nursery rhymes. Sunny and resolved.' },
    { id: 'minor', group: 'Scales', name: 'Natural minor', semis: [2, 3, 5, 7, 8, 10, 12], mood: 'Sad, melancholy, reflective.', moodLong: 'The classic sad sound. Moody ballads and dark pop.' },
    { id: 'harmonic', group: 'Scales', name: 'Harmonic minor', semis: [2, 3, 5, 7, 8, 11, 12], mood: 'Dramatic, exotic, classical.', moodLong: 'Minor with a raised seventh that pulls hard toward home. Think baroque drama and neoclassical metal.' },
    { id: 'melodic', group: 'Scales', name: 'Melodic minor', semis: [2, 3, 5, 7, 9, 11, 12], mood: 'Smooth, bittersweet, jazzy.', moodLong: 'Minor that brightens on the way up. A favorite in jazz.' },
    { id: 'majpent', group: 'Scales', name: 'Major pentatonic', semis: [2, 4, 7, 9, 12], mood: 'Open, sunny, folky.', moodLong: 'Five notes, no tension. Country, folk and catchy hooks.' },
    { id: 'minpent', group: 'Scales', name: 'Minor pentatonic', semis: [3, 5, 7, 10, 12], mood: 'Bluesy, gritty, rock.', moodLong: "The guitarist's home base. Almost every rock solo starts here." },
    { id: 'blues', group: 'Scales', name: 'Blues', semis: [3, 5, 6, 7, 10, 12], mood: 'Soulful, gritty, raw.', moodLong: 'Minor pentatonic plus the blue note (b5) for that crying tension.' },
    { id: 'dorian', group: 'Modes', name: 'Dorian', semis: [2, 3, 5, 7, 9, 10, 12], mood: 'Cool, soulful, hopeful minor.', moodLong: "Minor with a brighter sixth. Santana's “Oye Como Va”, funk and jazz." },
    { id: 'phrygian', group: 'Modes', name: 'Phrygian', semis: [1, 3, 5, 7, 8, 10, 12], mood: 'Dark, Spanish, menacing.', moodLong: 'The flat second gives it a flamenco or metal edge.' },
    { id: 'lydian', group: 'Modes', name: 'Lydian', semis: [2, 4, 6, 7, 9, 11, 12], mood: 'Dreamy, floating, magical.', moodLong: 'Major with a raised fourth. Film-score wonder; think The Simpsons theme.' },
    { id: 'mixolydian', group: 'Modes', name: 'Mixolydian', semis: [2, 4, 5, 7, 9, 10, 12], mood: 'Laid-back, bluesy major.', moodLong: 'Major with a flat seventh. Classic rock like “Sweet Home Alabama”.' },
    { id: 'locrian', group: 'Modes', name: 'Locrian', semis: [1, 3, 5, 6, 8, 10, 12], mood: 'Unstable, tense, unsettled.', moodLong: 'The diminished fifth makes home feel shaky. Rare in songs, great for ear training.' },
    { id: 'chromatic', group: 'All', name: 'Chromatic', semis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], mood: 'Every color at once.', moodLong: 'All twelve intervals. The final exam.' }
  ];
  var MODE_GROUPS = ['Scales', 'Modes', 'All'];
  var MODE_DIRS = ['up', 'down', 'harmonic', 'mixed'];
  var MODE_DIR_SHORT = { up: 'Up', down: 'Down', harmonic: 'Together', mixed: 'Mixed' };
  function modeById(id) { for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }

  var BY_SEMIS = {};
  (global.ANCHORS || []).forEach(function (a) { BY_SEMIS[a.semitones] = a; });

  // ---------------------------------------------------------------- storage
  var mem = null;
  var storageOk = true;
  function load() {
    var raw = null;
    try { raw = global.localStorage.getItem(KEY); } catch (e) { storageOk = false; }
    var s = null;
    if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
    if (!s && mem) s = mem;
    return normalize(s);
  }
  function save(s) {
    mem = s;
    try { global.localStorage.setItem(KEY, JSON.stringify(s)); storageOk = true; } catch (e) { storageOk = false; }
  }
  function clearAll() {
    mem = null;
    try { global.localStorage.removeItem(KEY); } catch (e) {}
    return normalize(null);
  }

  function blankStage(id) {
    return { unlocked: STAGE_START[id], since: 0, recent: [], boost: null, mastered: false, open: id === 'up' };
  }
  function normalize(s) {
    if (!s || s.v !== 1) s = {};
    s.v = 1;
    s.guided = STAGES.indexOf(s.guided) >= 0 ? s.guided : 'up';
    s.stages = s.stages || {};
    s.hist = s.hist || {};
    s.conf = s.conf || {};
    STAGES.forEach(function (id) {
      var st = s.stages[id] || blankStage(id);
      if (typeof st.unlocked !== 'number') st.unlocked = STAGE_START[id];
      st.recent = st.recent || [];
      s.stages[id] = st;
      s.hist[id] = s.hist[id] || {};
      s.conf[id] = s.conf[id] || {};
    });
    s.days = s.days || [];
    s.total = s.total || 0;
    s.hinted = s.hinted || 0;
    s.settings = s.settings || {};
    var set = s.settings;
    if (['guitar', 'piano', 'mix'].indexOf(set.instrument) < 0) set.instrument = 'guitar';
    if (typeof set.volume !== 'number') set.volume = 0.8;
    delete set.autoAdvance;
    // v5: effects are soft UI tones now and start off (one-time reset of the old chiptune default)
    if (typeof set.sfx !== 'boolean' || !set.sfx5) { set.sfx = false; set.sfx5 = true; }
    delete set.crt;
    if (s.stages.up.unlocked < STAGE_START.up) s.stages.up.unlocked = STAGE_START.up;
    s.levels = s.levels || {};
    s.modes = s.modes || {};
    s.modes.opts = s.modes.opts || {};
    if (MODE_DIRS.indexOf(s.modes.opts.dir) < 0) s.modes.opts.dir = 'up';
    if (typeof s.modes.opts.hear !== 'boolean') s.modes.opts.hear = true;
    s.modes.scores = s.modes.scores || {};
    s.free = s.free || { stage: 'up', pool: [7, 12, 4, 5] };
    s.free.pool = (s.free.pool || []).filter(function (x, i, a) { return x >= 1 && x <= 12 && a.indexOf(x) === i; });
    // v5 progression: XP, ranks, daily goal, achievements. Older saves get XP estimated from their stats.
    s.tried = s.tried || {};
    if (typeof s.bestCombo !== 'number') s.bestCombo = 0;
    if (typeof s.bestStreak !== 'number') s.bestStreak = longestRun(s.days);
    if (!s.xpDay || typeof s.xpDay.xp !== 'number') s.xpDay = { date: today(), xp: 0 };
    if (typeof s.xp !== 'number') {
      var est = Math.round(s.total * 7.5);
      MODES.forEach(function (m) {
        for (var n = 1; n <= LEVELS.length; n++) {
          var r = (s.levels[m.id] || {})[n];
          if (r) { est += r.stars * 15 + (r.stars === 3 ? 60 : 0); s.tried[m.id] = 1; }
        }
      });
      s.xp = est;
      s.ach = s.ach || {};
      checkAchievements(s);           // silently: existing progress earns its badges
      s.rankSeen = rankInfo(s.xp).index;
    }
    s.ach = s.ach || {};
    if (typeof s.rankSeen !== 'number') s.rankSeen = rankInfo(s.xp).index;
    return s;
  }

  // ---------------------------------------------------------------- stats
  function accuracy(s, stage, semis, n) {
    var h = s.hist[stage][semis] || [];
    var w = h.slice(-(n || WINDOW));
    if (!w.length) return { n: 0, acc: null };
    var ok = 0; w.forEach(function (x) { ok += x; });
    return { n: w.length, acc: ok / w.length };
  }
  function active(s, stage) {
    return ORDER.slice(0, s.stages[stage].unlocked).sort(function (a, b) { return a - b; });
  }
  function nextToUnlock(s, stage) {
    var st = s.stages[stage];
    return st.unlocked < ORDER.length ? ORDER[st.unlocked] : null;
  }
  function anchorsHidden(s, stage, semis) {
    var a = accuracy(s, stage, semis, WINDOW);
    return a.n >= WINDOW && a.acc >= 0.9;
  }

  /** Unlock readiness for a stage: every number the UI needs to show progress. */
  function readiness(s, stage) {
    var st = s.stages[stage];
    var rec = st.recent.slice(-WINDOW);
    var ok = 0; rec.forEach(function (x) { ok += x; });
    var recentAcc = rec.length ? ok / rec.length : 0;
    var weakest = null, unproven = [];
    active(s, stage).forEach(function (semis) {
      var a = accuracy(s, stage, semis, WINDOW);
      if (a.n < MIN_EACH_N) { unproven.push(semis); return; }
      if (!weakest || a.acc < weakest.acc) weakest = { semis: semis, acc: a.acc, n: a.n };
    });
    var eachOk = !unproven.length && (!weakest || weakest.acc >= NEED_EACH);
    return {
      since: st.since, needSince: NEED_SINCE,
      recentAcc: recentAcc, recentN: rec.length, needAcc: NEED_ACC,
      weakest: weakest, unproven: unproven, needEach: NEED_EACH,
      sinceOk: st.since >= NEED_SINCE,
      accOk: rec.length >= WINDOW && recentAcc >= NEED_ACC,
      eachOk: eachOk,
      ready: st.since >= NEED_SINCE && rec.length >= WINDOW && recentAcc >= NEED_ACC && eachOk,
      next: nextToUnlock(s, stage),
      mastered: st.mastered
    };
  }

  function dayKey(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  /** Longest run of consecutive days in a sorted list of YYYY-MM-DD keys. */
  function longestRun(days) {
    var best = 0, run = 0, prev = null;
    (days || []).slice().sort().forEach(function (k) {
      var d = new Date(k + 'T12:00:00');
      if (prev) { var p = new Date(prev.getTime()); p.setDate(p.getDate() + 1); run = dayKey(p) === k ? run + 1 : (dayKey(prev) === k ? run : 1); }
      else run = 1;
      prev = d; if (run > best) best = run;
    });
    return best;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function streak(s) {
    var set = {}; s.days.forEach(function (d) { set[d] = 1; });
    var d = new Date(); var n = 0;
    function key(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
    if (!set[key(d)]) d.setDate(d.getDate() - 1); // streak still alive until today ends
    while (set[key(d)]) { n++; d.setDate(d.getDate() - 1); }
    return { days: n, today: !!set[today()], total: s.days.length };
  }

  /**
   * Record one answer. guided=true feeds the unlock rule.
   * q.hinted=true (fretboard shown before answering): counts in stats/history,
   * but never in the unlock window (since / recent / boost).
   * Returns { correct, unlocked: semis|null, mastered: stage|null, opened: stage|null }.
   */
  function record(s, q, guess) {
    var stage = q.stage, semis = q.semis, correct = guess === semis;
    var h = s.hist[stage][semis] = (s.hist[stage][semis] || []);
    h.push(correct ? 1 : 0);
    if (h.length > HIST_KEEP) h.splice(0, h.length - HIST_KEEP);
    if (!correct) {
      var row = s.conf[stage][semis] = (s.conf[stage][semis] || {});
      row[guess] = (row[guess] || 0) + 1;
    }
    s.total++;
    var t = today(); if (s.days[s.days.length - 1] !== t && s.days.indexOf(t) < 0) s.days.push(t);
    if (s.days.length > 400) s.days.splice(0, s.days.length - 400);
    s.bestStreak = Math.max(s.bestStreak || 0, streak(s).days);

    var ev = { correct: correct, unlocked: null, mastered: null, opened: null, hinted: !!q.hinted };
    if (q.hinted) s.hinted++;
    if (!q.guided || q.hinted) return ev;
    var st = s.stages[stage];
    st.since++;
    st.recent.push(correct ? 1 : 0);
    if (st.recent.length > WINDOW) st.recent.splice(0, st.recent.length - WINDOW);
    if (st.boost) { st.boost.left--; if (st.boost.left <= 0) st.boost = null; }

    if (!st.mastered && readiness(s, stage).ready) {
      if (st.unlocked < ORDER.length) {
        var nu = ORDER[st.unlocked];
        st.unlocked++;
        st.since = 0; st.recent = [];
        st.boost = { semis: nu, left: BOOST_QUESTIONS };
        ev.unlocked = nu;
      } else {
        st.mastered = true;
        ev.mastered = stage;
        var ni = STAGES.indexOf(stage) + 1;
        if (ni < STAGES.length) {
          var nid = STAGES[ni];
          s.stages[nid].open = true;
          if (s.guided === stage) s.guided = nid;
          ev.opened = nid;
        }
      }
    }
    return ev;
  }

  // ---------------------------------------------------------------- selection
  function confusionPairs(s, stage, pool) {
    var pairs = {};
    var c = s.conf[stage];
    pool.forEach(function (a) {
      var row = c[a] || {};
      Object.keys(row).forEach(function (g) {
        g = +g; if (pool.indexOf(g) < 0) return;
        var k = Math.min(a, g) + '-' + Math.max(a, g);
        pairs[k] = (pairs[k] || 0) + row[g];
      });
    });
    return pairs;
  }

  function weightedPick(items, weights, rnd) {
    var sum = 0; weights.forEach(function (w) { sum += w; });
    if (sum <= 0) return items[Math.floor(rnd() * items.length)];
    var r = rnd() * sum;
    for (var i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }

  /**
   * Choose the next interval. ~50 % weighted toward weak intervals and confusion
   * pairs, ~50 % uniform. New interval at 2x. Never the same interval twice in a row.
   */
  function pick(s, stage, pool, last, boostSemis, rnd) {
    rnd = rnd || Math.random;
    var weights;
    if (rnd() < 0.5) {
      var pairs = confusionPairs(s, stage, pool);
      weights = pool.map(function (semis) {
        var a = accuracy(s, stage, semis, WINDOW);
        var acc = a.n < MIN_EACH_N ? 0.6 : a.acc;
        var w = 0.15 + (1 - acc) * 1.5;
        Object.keys(pairs).forEach(function (k) {
          var p = k.split('-'); if (+p[0] === semis || +p[1] === semis) w += Math.min(pairs[k], 6) * 0.12;
        });
        return w;
      });
    } else {
      weights = pool.map(function () { return 1; });
    }
    pool.forEach(function (semis, i) { if (semis === boostSemis) weights[i] *= 2; });
    var li = pool.length > 1 ? pool.indexOf(last) : -1;
    if (li >= 0) {
      weights[li] = 0;
      var sum = 0; weights.forEach(function (w) { sum += w; });
      if (sum <= 0) weights = pool.map(function (x, i) { return i === li ? 0 : 1; });
    }
    return weightedPick(pool, weights, rnd);
  }

  /** Random root; never `avoid` (the previous root). ROOT_MAX + 12 <= EarAudio.RANGE.max. */
  function randomRoot(rnd, avoid) {
    rnd = rnd || Math.random;
    var r, tries = 0;
    do { r = ROOT_MIN + Math.floor(rnd() * (ROOT_MAX - ROOT_MIN + 1)); } while (r === avoid && ++tries < 50);
    if (r === avoid) r = avoid < ROOT_MAX ? avoid + 1 : avoid - 1;
    return r;
  }

  // ---------------------------------------------------------------- sessions
  function newSession(s, opts) {
    if (opts.mode === 'scale') {
      var m = modeById(opts.scale), L = LEVELS[(opts.level || 1) - 1];
      return {
        guided: false, scale: m.id, scaleName: m.name, level: L.n, lv: L,
        stage: L.dirs[0], fixedPool: m.semis.slice(), length: LEVEL_LEN,
        answers: [], last: null, lastRoot: null, q: null, startedWith: null
      };
    }
    var guided = opts.mode !== 'free';
    var stage = guided ? s.guided : opts.stage;
    return {
      guided: guided, stage: stage,
      fixedPool: guided ? null : opts.pool.slice().sort(function (a, b) { return a - b; }),
      length: SESSION_LEN, answers: [], last: null, lastRoot: null, q: null,
      startedWith: guided ? s.stages[stage].unlocked : null
    };
  }
  function poolOf(s, sess) { return sess.fixedPool || active(s, sess.stage); }
  function nextQuestion(s, sess, rnd) {
    rnd = rnd || Math.random;
    var pool = poolOf(s, sess), stg = sess.stage, boost = null, inst = null;
    if (sess.scale) {
      var L = sess.lv;
      stg = L.dirs[Math.floor(rnd() * L.dirs.length)];
      if (L.mixInst) inst = rnd() < 0.5 ? 'guitar' : 'piano';
    } else if (sess.guided && s.stages[sess.stage].boost) boost = s.stages[sess.stage].boost.semis;
    var semis = pick(s, stg, pool, sess.last, boost, rnd);
    var root = randomRoot(rnd, sess.lastRoot);
    sess.last = semis; sess.lastRoot = root;
    sess.q = { semis: semis, root: root, stage: stg, guided: !!sess.guided, answered: false, inst: inst, plays: 0 };
    return sess.q;
  }

  // ---------------------------------------------------------------- levels
  function starsFor(frac) { var n = 0; STAR_AT.forEach(function (t) { if (frac >= t - 1e-9) n++; }); return n; }
  function levelRow(s, modeId, n) { return (s.levels[modeId] || {})[n] || null; }
  function levelUnlocked(s, modeId, n) {
    if (n <= 1) return true;
    var prev = levelRow(s, modeId, n - 1);
    return !!prev && prev.stars >= 1;
  }
  function modeStars(s, modeId) {
    var t = 0; for (var n = 1; n <= LEVELS.length; n++) { var r = levelRow(s, modeId, n); if (r) t += r.stars; }
    return t;
  }
  function totalStars(s) { var t = 0; MODES.forEach(function (m) { t += modeStars(s, m.id); }); return t; }
  /** Finish a game-mode level. Hinted answers count as wrong. Saves the best result. */
  function recordLevel(s, sess) {
    var ok = 0; sess.answers.forEach(function (a) { if (a.correct && !a.hinted) ok++; });
    var frac = sess.answers.length ? ok / sess.answers.length : 0;
    var stars = starsFor(frac), pct = Math.round(frac * 100);
    var byMode = s.levels[sess.scale] = s.levels[sess.scale] || {};
    var row = byMode[sess.level] = byMode[sess.level] || { best: 0, stars: 0, runs: 0 };
    var wasUnlocked = levelUnlocked(s, sess.scale, sess.level + 1);
    var prevBest = row.best, prevStars = row.stars;
    row.runs++; row.last = pct;
    if (pct > row.best) row.best = pct;
    if (stars > row.stars) row.stars = stars;
    var bonus = stars * 15 + (stars === 3 ? (prevStars < 3 ? 60 : 15) : 0);
    gainXp(s, bonus);
    var res = { ok: ok, n: sess.answers.length, pct: pct, stars: stars, best: row.best, bestStars: row.stars,
      newBest: pct > prevBest || stars > prevStars, runsBefore: row.runs - 1, unlockedNext: false,
      xpBonus: bonus, firstPerfect: stars === 3 && prevStars < 3 };
    if (sess.level < LEVELS.length && !wasUnlocked && levelUnlocked(s, sess.scale, sess.level + 1)) res.unlockedNext = true;
    sess.result = res;
    return res;
  }
  function summarize(s, sess) {
    var per = {}, conf = {}, ok = 0, hinted = 0;
    sess.answers.forEach(function (a) {
      if (a.hinted) hinted++;
      var p = per[a.semis] = per[a.semis] || { n: 0, ok: 0 };
      p.n++; if (a.correct) { p.ok++; ok++; }
      else { var k = a.semis + '>' + a.guess; conf[k] = (conf[k] || 0) + 1; }
    });
    var rows = Object.keys(per).map(function (k) { return { semis: +k, n: per[k].n, ok: per[k].ok, acc: per[k].ok / per[k].n }; })
      .sort(function (a, b) { return a.semis - b.semis; });
    var weakest = rows.slice().filter(function (r) { return r.acc < 1; })
      .sort(function (a, b) { return a.acc - b.acc || b.n - a.n; })[0] || null;
    var big = null;
    Object.keys(conf).forEach(function (k) {
      if (!big || conf[k] > big.count) { var p = k.split('>'); big = { correct: +p[0], guess: +p[1], count: conf[k] }; }
    });
    return { n: sess.answers.length, ok: ok, hinted: hinted, rows: rows, weakest: weakest, confusion: big };
  }

  // ---------------------------------------------------------------- progression
  // Ranks: first rank-up inside the first session or two, the top takes weeks of daily practice.
  var RANKS = [
    { name: 'Rookie Ear', xp: 0 }, { name: 'Listener', xp: 250 }, { name: 'Apprentice', xp: 800 },
    { name: 'Tuned In', xp: 1800 }, { name: 'Sharp Ear', xp: 3500 }, { name: 'Interval Hunter', xp: 6000 },
    { name: 'Harmonic Hero', xp: 9500 }, { name: 'Perfect Pitch-ish', xp: 14000 }, { name: 'Golden Ear', xp: 20500 },
    { name: 'Maestro', xp: 30000 }
  ];
  var DAILY_GOAL = 150;     // XP: about one guided session
  var SESSION_BONUS = 20;   // finishing a full guided or free session
  function rankInfo(xp) {
    var i = 0;
    while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
    var cur = RANKS[i], nx = RANKS[i + 1] || null;
    return { index: i, n: i + 1, name: cur.name, xp: xp, floor: cur.xp, next: nx ? nx.xp : null, nextName: nx ? nx.name : null,
      frac: nx ? (xp - cur.xp) / (nx.xp - cur.xp) : 1, toNext: nx ? nx.xp - xp : 0 };
  }
  /** XP for one answer. Higher levels pay more; combos add up to +5; hinted answers earn a token 2. */
  function answerXp(sess, correct, hinted, combo) {
    if (!correct) return 0;
    if (hinted) return 2;
    var base = sess && sess.lv ? 8 + sess.lv.n * 2 : 10;
    return base + (combo >= 3 ? Math.min(5, combo - 2) : 0);
  }
  function gainXp(s, n) {
    if (!n) return;
    s.xp = (s.xp || 0) + n;
    var t = today();
    if (!s.xpDay || s.xpDay.date !== t) s.xpDay = { date: t, xp: 0 };
    s.xpDay.xp += n;
  }
  function todayXp(s) { return s.xpDay && s.xpDay.date === today() ? s.xpDay.xp : 0; }

  function anyLevel(s, fn) {
    return MODES.some(function (m) { for (var n = 1; n <= LEVELS.length; n++) { var r = levelRow(s, m.id, n); if (r && fn(r)) return true; } return false; });
  }
  var ACHIEVEMENTS = [
    { id: 'first-star', name: 'First star', desc: 'Earn a star on any level.', test: function (s) { return totalStars(s) >= 1; } },
    { id: 'flawless', name: 'Flawless', desc: 'Get three stars on a level.', test: function (s) { return anyLevel(s, function (r) { return r.stars === 3; }); } },
    { id: 'combo10', name: 'On a roll', desc: 'Answer 10 in a row correctly.', test: function (s) { return s.bestCombo >= 10; } },
    { id: 'combo25', name: 'Unbreakable', desc: 'Answer 25 in a row correctly.', test: function (s) { return s.bestCombo >= 25; } },
    { id: 'full-run', name: 'Full run', desc: 'Clear all five levels of one mode.', test: function (s) { return MODES.some(function (m) { var r = levelRow(s, m.id, LEVELS.length); return r && r.stars >= 1; }); } },
    { id: 'mastered', name: 'Mastered', desc: 'Earn all 15 stars in one mode.', test: function (s) { return MODES.some(function (m) { return modeStars(s, m.id) === LEVELS.length * 3; }); } },
    { id: 'explorer', name: 'Explorer', desc: 'Play every scale and mode at least once.', test: function (s) { return MODES.every(function (m) { return s.tried[m.id]; }); } },
    { id: 'growing', name: 'Growing ear', desc: 'Unlock six intervals on the guided path.', test: function (s) { return s.stages.up.unlocked >= 6; } },
    { id: 'stage', name: 'Stage clear', desc: 'Complete a stage of the guided path.', test: function (s) { return STAGES.some(function (id) { return s.stages[id].mastered; }); } },
    { id: 'week', name: 'One week', desc: 'Practice seven days in a row.', test: function (s) { return s.bestStreak >= 7; } },
    { id: 'month', name: 'Habit formed', desc: 'Practice 30 days in a row.', test: function (s) { return s.bestStreak >= 30; } },
    { id: 'answers500', name: 'Dedicated', desc: 'Answer 500 questions.', test: function (s) { return s.total >= 500; } }
  ];
  /** Marks newly earned achievements on s.ach and returns them. */
  function checkAchievements(s) {
    var got = [];
    ACHIEVEMENTS.forEach(function (a) {
      if (!s.ach[a.id] && a.test(s)) { s.ach[a.id] = today(); got.push(a); }
    });
    return got;
  }

  global.EarEngine = {
    RANKS: RANKS, DAILY_GOAL: DAILY_GOAL, SESSION_BONUS: SESSION_BONUS, ACHIEVEMENTS: ACHIEVEMENTS,
    rankInfo: rankInfo, answerXp: answerXp, gainXp: gainXp, todayXp: todayXp, checkAchievements: checkAchievements,
    ORDER: ORDER, STAGES: STAGES, STAGE_LABEL: STAGE_LABEL, STAGE_SHORT: STAGE_SHORT,
    MODES: MODES, MODE_GROUPS: MODE_GROUPS, MODE_DIRS: MODE_DIRS, MODE_DIR_SHORT: MODE_DIR_SHORT, modeById: modeById,
    LEVELS: LEVELS, LEVEL_LEN: LEVEL_LEN, STAR_AT: STAR_AT, MIN_POOL: MIN_POOL,
    recordLevel: recordLevel, levelRow: levelRow, levelUnlocked: levelUnlocked, modeStars: modeStars, totalStars: totalStars, starsFor: starsFor,
    SESSION_LEN: SESSION_LEN, WINDOW: WINDOW,
    info: function (semis) { return BY_SEMIS[semis]; },
    load: load, save: save, clearAll: clearAll, storageOk: function () { return storageOk; },
    accuracy: accuracy, active: active, readiness: readiness, nextToUnlock: nextToUnlock,
    anchorsHidden: anchorsHidden, streak: streak, record: record, pick: pick, randomRoot: randomRoot,
    newSession: newSession, poolOf: poolOf, nextQuestion: nextQuestion, summarize: summarize
  };
})(window);
