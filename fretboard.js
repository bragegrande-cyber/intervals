/*
 * fretboard.js: guitar neck SVG (window.Fretboard).
 *
 * Every dot is the exact pitch that was played: the root at rootMidi and the
 * target at rootMidi + semitones (standard tuning, sounding pitch E2 = MIDI 40).
 * Among all real positions we pick the most natural fingering (compact span,
 * the usual string jump for the interval), then crop the neck around it so the
 * note names stay legible on a phone.
 */
(function (global) {
  'use strict';

  var TUNING = [40, 45, 50, 55, 59, 64];        // low E .. high e
  var SNAME = ['E', 'A', 'D', 'G', 'B', 'E'];
  var STRING_LABEL = ['low E', 'A', 'D', 'G', 'B', 'high E'];
  var MAXF = 15;
  var NOTE = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  var uid = 0;

  function noteName(midi) { return NOTE[((midi % 12) + 12) % 12]; }
  function noteWithOctave(midi, name) { return (name || noteName(midi)) + (Math.floor(midi / 12) - 1); }

  // Spell the upper note from the interval (E + M7 = D sharp, not E flat).
  var LETTERS = 'CDEFGAB', LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  var STEPS = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7];
  function spell(rootMidi, semis) {
    var rn = noteName(rootMidi), li = LETTERS.indexOf(rn.charAt(0));
    var ti = (li + STEPS[semis]) % 7, tpc = ((rootMidi + semis) % 12 + 12) % 12;
    var d = ((tpc - LETTER_PC[ti]) % 12 + 12) % 12; if (d > 6) d -= 12;
    var L = LETTERS.charAt(ti);
    // Keep guitar-friendly names: no double accidentals, no C flat / F flat / E sharp / B sharp.
    if (d === 0) return L;
    if (d === 1 && L !== 'E' && L !== 'B') return L + '\u266F';
    if (d === -1 && L !== 'C' && L !== 'F') return L + '\u266D';
    return noteName(rootMidi + semis);
  }

  function positions(midi) {
    var out = [];
    for (var s = 0; s < 6; s++) { var f = midi - TUNING[s]; if (f >= 0 && f <= MAXF) out.push({ s: s, f: f }); }
    return out;
  }

  /** Best real-pitch fingering for root -> root + semis. */
  function place(rootMidi, semis) {
    var tgt = rootMidi + semis;
    var ideal = semis <= 2 ? 0 : (semis <= 9 ? 1 : 2);
    var best = null;
    positions(rootMidi).forEach(function (r) {
      positions(tgt).forEach(function (t) {
        if (t.s < r.s || (t.s === r.s && t.f <= r.f)) return;
        var fretted = [r.f, t.f].filter(function (f) { return f > 0; });
        var reach = fretted.length > 1 ? Math.abs(fretted[0] - fretted[1]) : 0;
        var hi = Math.max(r.f, t.f);
        var jump = t.s - r.s;
        var cost = Math.max(0, reach - 4) * 4 +
          Math.abs(jump - ideal) * 2.5 +
          (jump > 2 ? 6 : 0) +
          Math.max(0, hi - 9) * 0.6 +
          (r.s <= 3 && t.s >= 4 && jump > 0 ? 0.5 : 0) +  // G-B quirk: less canonical
          (r.f === 0 || t.f === 0 ? 0.3 : 0) +
          hi * 0.02;
        if (!best || cost < best.cost) best = { root: r, target: t, cost: cost };
      });
    });
    return best;
  }

  /**
   * Draws a cropped neck with round note markers.
   * pts: [{ s, f, label, cls }] (cls 'fb-root' | 'fb-target'); link: draw the dashed shape line between pts[0] and pts[1].
   */
  function drawNeck(pts, desc, link) {
    var id = 'fb' + (++uid);
    var fretted = pts.filter(function (p) { return p.f > 0; }).map(function (p) { return p.f; });
    var lo = fretted.length ? Math.min.apply(null, fretted) : 0, hi = Math.max.apply(null, pts.map(function (p) { return p.f; }));
    var hasOpen = pts.some(function (p) { return p.f === 0; });
    var start = hasOpen || lo <= 2 ? 0 : lo - 1;
    var end = Math.min(MAXF, Math.max(start + 5, hi + 1));
    var nut = start === 0;

    // Geometry (real fret spacing within the window)
    var W = 360, LEFT = nut ? 46 : 34, RIGHT = 10, TOP = 20, GAP = 22, NECK_PAD = 12;
    var H = TOP + 5 * GAP + NECK_PAD + 26;
    function pos(n) { return 1 - Math.pow(2, -n / 12); }
    var p0 = pos(start), p1 = pos(end + 0.35);
    function wire(n) { return LEFT + (pos(n) - p0) / (p1 - p0) * (W - LEFT - RIGHT); }
    function fx(f) { return f === 0 ? LEFT - 17 : wire(f - 1) + (wire(f) - wire(f - 1)) * 0.56; }
    function sy(s) { return TOP + (5 - s) * GAP; }
    var neckTop = TOP - NECK_PAD, neckBot = sy(0) + NECK_PAD, neckR = W - RIGHT;

    // Clean neck: rounded body, round inlays and markers. Colors live in styles.css (.fb-*).
    var o = [];
    function R(x) { return Math.round(x); }
    o.push('<svg class="fretboard" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' + id + 't">');
    o.push('<title id="' + id + 't">' + desc + '</title>');
    o.push('<rect class="fb-neck" x="' + LEFT + '" y="' + neckTop + '" width="' + (neckR - LEFT) + '" height="' + (neckBot - neckTop) + '" rx="6"/>');
    var midY = (sy(2) + sy(3)) / 2;
    function covered(n) { return pts.some(function (pt) { return pt.f === n && (pt.s === 2 || pt.s === 3); }); }
    function inlay(x, y) { o.push('<circle class="fb-inlay" cx="' + R(x) + '" cy="' + R(y) + '" r="4.5"/>'); }
    [3, 5, 7, 9, 15].forEach(function (n) { if (n > start && n <= end && !covered(n)) inlay(fx(n), midY); });
    if (12 > start && 12 <= end) { inlay(fx(12), (sy(4) + sy(5)) / 2); inlay(fx(12), (sy(0) + sy(1)) / 2); }
    for (var n = start + 1; n <= end; n++) {
      var wx = wire(n);
      o.push('<rect class="fb-fret" x="' + (wx - 1.5).toFixed(1) + '" y="' + neckTop + '" width="3" height="' + (neckBot - neckTop) + '" rx="1.5"/>');
    }
    if (nut) o.push('<rect class="fb-nut" x="' + (LEFT - 6) + '" y="' + (neckTop - 2) + '" width="7" height="' + (neckBot - neckTop + 4) + '" rx="2"/>');
    var THICK = [3, 3, 2, 2, 2, 1];
    for (var s = 0; s < 6; s++) {
      var y = sy(s), x0 = nut ? LEFT - 3 : LEFT;
      o.push('<rect class="fb-string' + (s < 3 ? ' is-wound' : '') + '" x="' + x0 + '" y="' + R(y - THICK[s] / 2) + '" width="' + (neckR - x0) + '" height="' + THICK[s] + '"/>');
      o.push('<text class="fb-sname" x="' + (nut ? 12 : 10) + '" y="' + (y + 4) + '">' + SNAME[s] + '</text>');
    }
    for (var k = Math.max(1, start + 1); k <= end; k++) {
      if ([3, 5, 7, 9, 12, 15].indexOf(k) >= 0 || (k === start + 1 && !nut)) {
        o.push('<text class="fb-num" x="' + fx(k).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + k + '</text>');
      }
    }
    if (link && pts.length === 2) {
      o.push('<line class="fb-link" x1="' + fx(pts[0].f).toFixed(1) + '" y1="' + sy(pts[0].s) + '" x2="' + fx(pts[1].f).toFixed(1) + '" y2="' + sy(pts[1].s) + '"/>');
    }
    pts.forEach(function (pt) {
      var cx = fx(pt.f), cy = sy(pt.s);
      o.push('<g class="fb-dot ' + pt.cls + (pt.f === 0 ? ' is-open' : '') + '">' +
        '<circle class="fb-dot-bg" cx="' + cx.toFixed(1) + '" cy="' + cy + '" r="12"/>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (cy + 4.4) + '" text-anchor="middle">' + pt.label + '</text></g>');
    });
    o.push('</svg>');
    return o.join('');
  }
  function where(pt) { return STRING_LABEL[pt.s] + ' string, ' + (pt.f === 0 ? 'open' : 'fret ' + pt.f); }

  /**
   * render(rootMidi, semis, opts) -> { svg, desc, caption, root, target }
   * opts.mode: 'up' | 'down' | 'harmonic' (caption order only; pitches are the same)
   */
  function render(rootMidi, semis, opts) {
    opts = opts || {};
    var p = place(rootMidi, semis);
    if (!p) return { svg: '', desc: '', caption: '' };
    var r = p.root, t = p.target;
    var rName = noteName(rootMidi), tName = spell(rootMidi, semis);
    var desc = 'Root ' + noteWithOctave(rootMidi) + ' on the ' + where(r) + '. ' +
      noteWithOctave(rootMidi + semis, tName) + ' on the ' + where(t) + '.';
    var svg = drawNeck([{ s: r.s, f: r.f, label: rName, cls: 'fb-root' }, { s: t.s, f: t.f, label: tName, cls: 'fb-target' }], desc, true);
    var a = noteWithOctave(rootMidi), b = noteWithOctave(rootMidi + semis, tName);
    var caption = opts.mode === 'down' ? b + ' → ' + a : opts.mode === 'harmonic' ? a + ' + ' + b : a + ' → ' + b;
    return {
      svg: svg, desc: desc, caption: caption,
      root: { s: r.s, f: r.f, midi: TUNING[r.s] + r.f },
      target: { s: t.s, f: t.f, midi: TUNING[t.s] + t.f }
    };
  }

  // ---------------------------------------------------------------- chords
  // Letter steps from the root per chord-tone offset (mod 12): 3rd = 2 letters up, 5th = 4, 7th = 6, 9th = 1.
  var DEG = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6 };
  function spellTone(rootMidi, off, degOverride) {
    var pc = ((off % 12) + 12) % 12, steps = degOverride && degOverride[pc] != null ? degOverride[pc] : DEG[pc];
    var rn = noteName(rootMidi), li = LETTERS.indexOf(rn.charAt(0));
    var ti = (li + steps) % 7, tpc = ((rootMidi + off) % 12 + 12) % 12;
    var d = ((tpc - LETTER_PC[ti]) % 12 + 12) % 12; if (d > 6) d -= 12;
    var L = LETTERS.charAt(ti);
    if (d === 0) return L;
    if (d === 1 && L !== 'E' && L !== 'B') return L + '\u266F';
    if (d === -1 && L !== 'C' && L !== 'F') return L + '\u266D';
    return noteName(rootMidi + off);
  }
  /** Exact pitches on distinct strings. Prefers low strings for low notes and a compact, playable span. */
  function placeChord(midis) {
    var best = null;
    function cost(pl) {
      var fr = pl.filter(function (p) { return p.f > 0; }).map(function (p) { return p.f; });
      var span = fr.length ? Math.max.apply(null, fr) - Math.min.apply(null, fr) : 0;
      var hi = Math.max.apply(null, pl.map(function (p) { return p.f; }));
      var ss = pl.map(function (p) { return p.s; }).sort(), gaps = 0, order = 0;
      for (var i = 1; i < ss.length; i++) gaps += ss[i] - ss[i - 1] - 1;
      for (var j = 1; j < pl.length; j++) if (pl[j].s < pl[j - 1].s) order++;
      return Math.max(0, span - 3) * 5 + span * 0.4 + Math.max(0, hi - 9) * 0.5 + hi * 0.05 + gaps * 0.9 + order * 8;
    }
    function rec(i, used, acc, ascending) {
      if (i === midis.length) { var c = cost(acc); if (!best || c < best.cost) best = { pts: acc.slice(), cost: c }; return; }
      var minS = ascending && acc.length ? acc[acc.length - 1].s + 1 : 0;
      for (var s = minS; s < 6; s++) {
        if (used[s]) continue;
        var f = midis[i] - TUNING[s];
        if (f < 0 || f > MAXF) continue;
        used[s] = 1; acc.push({ s: s, f: f }); rec(i + 1, used, acc, ascending); acc.pop(); used[s] = 0;
      }
    }
    rec(0, {}, [], true);
    if (!best) rec(0, {}, [], false);
    return best ? best.pts : null;
  }
  /** 2 = exact notes form a compact shape (span <= 5 frets), 1 = they fit on the neck, 0 = they do not. */
  function chordGrade(midis) {
    var pl = placeChord(midis);
    if (!pl) return 0;
    var fr = pl.filter(function (p) { return p.f > 0; }).map(function (p) { return p.f; });
    var span = fr.length ? Math.max.apply(null, fr) - Math.min.apply(null, fr) : 0;
    return span <= 5 ? 2 : 1;
  }

  /**
   * renderChord(rootMidi, offsets, opts) -> { svg, desc, caption, names }
   * offsets: semitones above rootMidi of every played note (ascending). Each dot is one played pitch.
   * opts.deg: spelling overrides ({ 9: 6 } for dim7). opts.hideNames: dots without letters.
   */
  function renderChord(rootMidi, offsets, opts) {
    opts = opts || {};
    var midis = offsets.map(function (x) { return rootMidi + x; });
    var names = offsets.map(function (x) { return spellTone(rootMidi, x, opts.deg); });
    var pl = placeChord(midis);
    var noteList = names.map(function (n, i) { return noteWithOctave(midis[i], n); });
    var caption = noteList.join(' · ');
    if (!pl) return { svg: '', desc: '', caption: caption, names: names };
    var rootPc = ((rootMidi % 12) + 12) % 12;
    var pts = pl.map(function (p, i) {
      var isRoot = ((midis[i] % 12) + 12) % 12 === rootPc;
      return { s: p.s, f: p.f, label: opts.hideNames ? '' : names[i], cls: isRoot ? 'fb-root' : 'fb-target' };
    });
    var desc = pl.map(function (p, i) { return noteList[i] + ' on the ' + where(p); }).join('. ') + '.';
    return { svg: drawNeck(pts, desc, false), desc: desc, caption: caption, names: names };
  }

  /** Notes played one after another may share a string (no chord shape needed): the most compact exact placement. */
  function placeSingles(midis) {
    var cands = midis.map(positions), best = null;
    if (cands.some(function (c) { return !c.length; })) return null;
    (function rec(i, acc) {
      if (i === midis.length) {
        var fr = acc.filter(function (p) { return p.f > 0; }).map(function (p) { return p.f; });
        var span = fr.length ? Math.max.apply(null, fr) - Math.min.apply(null, fr) : 0;
        var c = span * 3 + Math.max.apply(null, acc.map(function (p) { return p.f; })) * 0.2;
        if (!best || c < best.cost) best = { pts: acc.slice(), cost: c };
        return;
      }
      cands[i].forEach(function (p) { acc.push(p); rec(i + 1, acc); acc.pop(); });
    })(0, []);
    return best ? best.pts : null;
  }

  /**
   * renderNotes([{ midi, label, cls }]) -> { svg, desc }
   * Exact pitches with free labels (scale degrees). Duplicate pitches are drawn once (first label wins).
   */
  function renderNotes(list) {
    var seen = {}, items = [];
    (list || []).forEach(function (x) { if (!seen[x.midi]) { seen[x.midi] = 1; items.push(x); } });
    items.sort(function (a, b) { return a.midi - b.midi; });
    var pl = placeChord(items.map(function (x) { return x.midi; })) || placeSingles(items.map(function (x) { return x.midi; }));
    if (!pl) return { svg: '', desc: '' };
    var desc = pl.map(function (p, i) { return (items[i].name || items[i].label) + ' on the ' + where(p); }).join('. ') + '.';
    var pts = pl.map(function (p, i) { return { s: p.s, f: p.f, label: items[i].label, cls: items[i].cls || 'fb-target' }; });
    return { svg: drawNeck(pts, desc, false), desc: desc };
  }

  global.Fretboard = { render: render, renderChord: renderChord, renderNotes: renderNotes, placeChord: placeChord, chordGrade: chordGrade, spellTone: spellTone, place: place, noteName: noteName, spell: spell, noteWithOctave: noteWithOctave, TUNING: TUNING };
})(window);
