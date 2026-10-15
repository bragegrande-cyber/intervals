/*
 * sfx.js: subtle UI tones (window.EarSfx). Classic script.
 * Soft sine chimes with a gentle attack and short decay, quiet by design.
 * The app never plays an effect while an interval is sounding: it stops the
 * interval first and waits for busyMs() before playing the next one.
 */
(function (global) {
  'use strict';
  var ctx = null, out = null, enabled = false, vol = 0.8, busyUntil = 0;
  var LEVEL = 0.07; // effects sit well under the instrument

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    out = ctx.createGain(); out.gain.value = LEVEL * vol;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
    out.connect(lp); lp.connect(ctx.destination);
    return ctx;
  }
  function f(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  /** One soft bell-like note: sine + a faint octave partial, exponential decay. */
  function chime(midi, t, dur, gain) {
    var g = ctx.createGain(), peak = gain || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f(midi), t);
    o.connect(g); o.start(t); o.stop(t + dur + 0.03);
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'sine'; o2.frequency.setValueAtTime(f(midi + 12), t); g2.gain.value = 0.18;
    o2.connect(g2); g2.connect(g); o2.start(t); o2.stop(t + dur * 0.6);
  }
  /** Muted wooden tick: short sine with a quick pitch drop. */
  function tock(midi, t, dur, gain) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f(midi), t);
    o.frequency.exponentialRampToValueAtTime(f(midi - 5), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 1, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  var SOUNDS = {
    right: function (t) { chime(84, t, 0.32, 0.7); chime(91, t + 0.06, 0.42, 0.55); return 0.46; },
    wrong: function (t) { tock(57, t, 0.16, 0.8); tock(52, t + 0.1, 0.22, 0.6); return 0.32; },
    star: function (t) { chime(91, t, 0.38, 0.5); return 0.3; },
    level: function (t) { [76, 79, 84].forEach(function (m, i) { chime(m, t + i * 0.08, 0.6, 0.55); }); return 0.7; },
    unlock: function (t) { [79, 84, 88].forEach(function (m, i) { chime(m, t + i * 0.05, 0.5, 0.5); }); return 0.55; },
    rank: function (t) { [72, 76, 79, 84, 88].forEach(function (m, i) { chime(m, t + i * 0.07, 0.9, 0.5); }); return 1.1; }
  };

  function play(name) {
    if (!enabled || !SOUNDS[name]) return 0;
    if (!ensure()) return 0;
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
    var dur = SOUNDS[name](ctx.currentTime + 0.01);
    busyUntil = Math.max(busyUntil, Date.now() + dur * 1000 + 40);
    return dur * 1000;
  }
  global.EarSfx = {
    play: play,
    /** Call inside a user gesture: iOS only resumes an AudioContext from a tap. */
    unlock: function () { if (enabled && ensure() && ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} } },
    busyMs: function () { return Math.max(0, busyUntil - Date.now()); },
    setEnabled: function (v) { enabled = !!v; },
    setVolume: function (v) { vol = Math.max(0, Math.min(1, Number(v) || 0)); if (out) out.gain.value = LEVEL * vol; }
  };
})(window);
