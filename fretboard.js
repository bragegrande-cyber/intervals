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
   * render(rootMidi, semis, opts) -> { svg, desc, caption, root, target }
   * opts.mode: 'up' | 'down' | 'harmonic' (caption order only; pitches are the same)
   */
  function render(rootMidi, semis, opts) {
    opts = opts || {};
    var p = place(rootMidi, semis);
    if (!p) return { svg: '', desc: '', caption: '' };
    var r = p.root, t = p.target, id = 'fb' + (++uid);
    var rName = noteName(rootMidi), tName = spell(rootMidi, semis);

    // Visible window
    var lo = Math.min(r.f || 99, t.f || 99), hi = Math.max(r.f, t.f);
    var hasOpen = r.f === 0 || t.f === 0;
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

    function where(pt) { return STRING_LABEL[pt.s] + ' string, ' + (pt.f === 0 ? 'open' : 'fret ' + pt.f); }
    var desc = 'Root ' + noteWithOctave(rootMidi) + ' on the ' + where(r) + '. ' +
      noteWithOctave(rootMidi + semis, tName) + ' on the ' + where(t) + '.';

    // Clean neck: rounded body, round inlays and markers. Colors live in styles.css (.fb-*).
    var o = [];
    function R(x) { return Math.round(x); }
    o.push('<svg class="fretboard" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' + id + 't">');
    o.push('<title id="' + id + 't">' + desc + '</title>');
    // Neck
    o.push('<rect class="fb-neck" x="' + LEFT + '" y="' + neckTop + '" width="' + (neckR - LEFT) + '" height="' + (neckBot - neckTop) + '" rx="6"/>');
    // Inlays
    var midY = (sy(2) + sy(3)) / 2;
    function covered(n) { return [r, t].some(function (pt) { return pt.f === n && (pt.s === 2 || pt.s === 3); }); }
    function inlay(x, y) { o.push('<circle class="fb-inlay" cx="' + R(x) + '" cy="' + R(y) + '" r="4.5"/>'); }
    [3, 5, 7, 9, 15].forEach(function (n) { if (n > start && n <= end && !covered(n)) inlay(fx(n), midY); });
    if (12 > start && 12 <= end) { inlay(fx(12), (sy(4) + sy(5)) / 2); inlay(fx(12), (sy(0) + sy(1)) / 2); }
    // Frets
    for (var n = start + 1; n <= end; n++) {
      var wx = wire(n);
      o.push('<rect class="fb-fret" x="' + (wx - 1.5).toFixed(1) + '" y="' + neckTop + '" width="3" height="' + (neckBot - neckTop) + '" rx="1.5"/>');
    }
    // Nut
    if (nut) o.push('<rect class="fb-nut" x="' + (LEFT - 6) + '" y="' + (neckTop - 2) + '" width="7" height="' + (neckBot - neckTop + 4) + '" rx="2"/>');
    // Strings: wound bass strings thicker and warmer
    var THICK = [3, 3, 2, 2, 2, 1];
    for (var s = 0; s < 6; s++) {
      var y = sy(s), x0 = nut ? LEFT - 3 : LEFT;
      o.push('<rect class="fb-string' + (s < 3 ? ' is-wound' : '') + '" x="' + x0 + '" y="' + R(y - THICK[s] / 2) + '" width="' + (neckR - x0) + '" height="' + THICK[s] + '"/>');
      o.push('<text class="fb-sname" x="' + (nut ? 12 : 10) + '" y="' + (y + 4) + '">' + SNAME[s] + '</text>');
    }
    // Fret numbers
    for (var k = Math.max(1, start + 1); k <= end; k++) {
      if ([3, 5, 7, 9, 12, 15].indexOf(k) >= 0 || (k === start + 1 && !nut)) {
        o.push('<text class="fb-num" x="' + fx(k).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle">' + k + '</text>');
      }
    }

    // Shape link + dots (round markers with the note name). Every dot = the exact played pitch.
    o.push('<line class="fb-link" x1="' + fx(r.f).toFixed(1) + '" y1="' + sy(r.s) + '" x2="' + fx(t.f).toFixed(1) + '" y2="' + sy(t.s) + '"/>');
    function dot(cls, pt, label) {
      var cx = fx(pt.f), cy = sy(pt.s);
      o.push('<g class="' + cls + (pt.f === 0 ? ' is-open' : '') + '">' +
        '<circle class="fb-dot-bg" cx="' + cx.toFixed(1) + '" cy="' + cy + '" r="12"/>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (cy + 4.4) + '" text-anchor="middle">' + label + '</text></g>');
    }
    dot('fb-dot fb-root', r, rName);
    dot('fb-dot fb-target', t, tName);
    o.push('</svg>');

    var a = noteWithOctave(rootMidi), b = noteWithOctave(rootMidi + semis, tName);
    var caption = opts.mode === 'down' ? b + ' → ' + a : opts.mode === 'harmonic' ? a + ' + ' + b : a + ' → ' + b;
    return {
      svg: o.join(''), desc: desc, caption: caption,
      root: { s: r.s, f: r.f, midi: TUNING[r.s] + r.f },
      target: { s: t.s, f: t.f, midi: TUNING[t.s] + t.f }
    };
  }

  global.Fretboard = { render: render, place: place, noteName: noteName, spell: spell, noteWithOctave: noteWithOctave, TUNING: TUNING };
})(window);
