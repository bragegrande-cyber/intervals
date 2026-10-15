/*
 * audio.js — EarAudio: sound engine for the interval ear trainer.
 *
 * Classic script (no ES modules, works from file://). Defines window.EarAudio.
 * No external files or libraries. All instrument sounds are synthesized in JS
 * into AudioBuffers (cached per instrument + MIDI note), then played through:
 *
 *   voice gain -> [per-voice lowpass for piano] -> instrument bus
 *     guitar bus: body resonance filters -> mix
 *     piano bus:  -> mix
 *   mix -> dry + small room reverb -> master gain -> compressor -> limiter -> destination
 *
 * API
 *   EarAudio.init()                     -> Promise. Create/resume the AudioContext.
 *                                          Call from a user gesture (click/tap/key).
 *                                          Also unlocks iOS Safari (incl. ringer/silent switch
 *                                          workaround where the platform allows it).
 *   EarAudio.setInstrument('guitar'|'piano')
 *   EarAudio.getInstrument()            -> 'guitar' | 'piano'
 *   EarAudio.midiToFreq(midi)           -> Hz, A4 (MIDI 69) = 440, 12-TET.
 *   EarAudio.playInterval(rootMidi, semitones, mode) -> Promise (resolves when playback ends
 *                                          or when stop() cuts it; value: true = finished, false = stopped)
 *       mode 'up'       : rootMidi first, then rootMidi + semitones   (ascending)
 *       mode 'down'     : rootMidi + semitones first, then rootMidi   (descending TO the root;
 *                         the root is always the LOWER note, so 'down' with the same root and
 *                         semitones plays exactly the same two pitches as 'up', reversed)
 *       mode 'harmonic' : both together (guitar: ~15 ms low-to-high strum offset)
 *       Melodic notes start 0.75 s apart and each rings ~1.2 s before a soft release.
 *   EarAudio.playSequence([{rootMidi, semitones, mode}, ...], gapSec = 0.6) -> Promise
 *                                          Plays items one after another with gapSec silence
 *                                          between them (e.g. "your answer" vs "correct").
 *   EarAudio.playNotes(midis, stepSec = 0.18) -> Promise
 *                                          Single notes in order, stepSec apart (scales). true = finished.
 *   EarAudio.stop()                     Fades out everything currently playing (~60 ms, click-free)
 *                                          and cancels any pending sequence.
 *   EarAudio.setNoteLength(0.4..1)      Scales how long interval notes ring (1 = default). Timing only.
 *   EarAudio.setVolume(0..1)            Master volume (smoothed). Default 0.8.
 *   EarAudio.prewarm(midis?)            Optional: pre-render buffers (default: MIDI 40–76).
 *   EarAudio.isPlaying()                -> boolean
 *   EarAudio.RANGE                      -> { min: 40, max: 76 } recommended note range.
 *   EarAudio._renderNote(instrument, midi, sampleRate?) -> Float32Array (testing/inspection).
 */
(function (global) {
  'use strict';

  var RANGE = { min: 40, max: 76 };
  var MELODIC_GAP = 0.75;   // s between note onsets (melodic)
  var MELODIC_RING = 1.2;   // s each melodic note rings before release
  var HARMONIC_RING = 1.8;  // s for harmonic intervals
  var RELEASE_TAU = 0.09;   // s, exponential release time constant
  var RELEASE_TAIL = 0.55;  // s after release start before the source is stopped
  var STRUM_OFFSET = 0.015; // s, guitar harmonic strum
  var LOOKAHEAD = 0.06;     // s scheduling lookahead
  var STOP_FADE = 0.06;     // s fade on stop()
  var lenScale = 1;         // note-length factor (setNoteLength); timing only, synthesis unchanged

  var ctx = null;
  var nodes = null;          // audio graph
  var instrument = 'guitar';
  var volume = 0.8;
  var voices = [];           // active voices
  var pending = [];          // { timer, resolve }
  var generation = 0;        // incremented by stop() to cancel sequences
  var cache = {};            // key -> AudioBuffer
  var unlockInstalled = false;
  var silentAudioEl = null;

  // ---------------------------------------------------------------- utils
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (Number(midi) - 69) / 12);
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
    };
  }
  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // Post-processing shared by both instruments: DC block, tail fade, normalize.
  function finish(out, sr, peakTarget) {
    // DC blocker
    var x1 = 0, y1 = 0, R = 0.995, i;
    for (i = 0; i < out.length; i++) {
      var x = out[i];
      var y = x - x1 + R * y1;
      x1 = x; y1 = y; out[i] = y;
    }
    // Fade the last 80 ms so the buffer never ends abruptly
    var fadeN = Math.min(out.length, Math.floor(0.08 * sr));
    for (i = 0; i < fadeN; i++) {
      out[out.length - 1 - i] *= i / fadeN;
    }
    var peak = 0;
    for (i = 0; i < out.length; i++) { var a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 0) {
      var g = peakTarget / peak;
      for (i = 0; i < out.length; i++) out[i] *= g;
    }
    return out;
  }

  // ------------------------------------------------- guitar: Karplus-Strong
  // Loop: y[n] = exc[n] + AP( rho * 0.5 * (y[n-L] + y[n-L-1]) )
  // Total loop delay = L + 0.5 (averager) + frac (allpass) = sr / f  -> exact tuning.
  function renderGuitar(midi, sr) {
    var f = midiToFreq(midi);
    var t = clamp((midi - 40) / 36, 0, 1);                // 0 low .. 1 high
    var dur = 3.4 - 1.2 * t;                              // buffer length (s)
    var T60 = 3.2 - 1.5 * t;                              // fundamental decay time (s)
    var len = Math.ceil(dur * sr);
    var out = new Float64Array(len);
    var rnd = mulberry32(1000 + midi * 7919);

    var P = sr / f;
    var D = P - 0.5;
    var L = Math.floor(D - 0.1);                          // keep frac in [0.1, 1.1)
    var frac = D - L;
    var c = (1 - frac) / (1 + frac);                      // first-order allpass coefficient

    var perPeriod = Math.pow(10, -3 / (f * T60));
    var rho = Math.min(0.99995, perPeriod / Math.cos(Math.PI * f / sr));

    // Excitation: one period of lowpassed noise, pluck-position comb, zero mean.
    var excLen = Math.max(2, Math.round(P));
    var exc = new Float64Array(excLen);
    var bright = 0.55 - 0.15 * t;                         // one-pole coefficient (lower = brighter)
    var lp = 0, i;
    for (i = 0; i < excLen; i++) {
      var w = rnd() * 2 - 1;
      lp = (1 - bright) * w + bright * lp;
      exc[i] = lp;
    }
    var pos = Math.max(1, Math.round(excLen * 0.14));    // pluck ~1/7 from the bridge
    var shaped = new Float64Array(excLen);
    var mean = 0;
    for (i = 0; i < excLen; i++) {
      shaped[i] = exc[i] - (i >= pos ? exc[i - pos] : 0);
      mean += shaped[i];
    }
    mean /= excLen;
    for (i = 0; i < excLen; i++) shaped[i] -= mean;

    // String loop
    var hist = new Float64Array(L + 2);                   // circular history of y
    var hLen = L + 2, wIdx = 0;
    var apX1 = 0, apY1 = 0;
    for (i = 0; i < len; i++) {
      var iA = wIdx - L; if (iA < 0) iA += hLen;          // y[n-L]
      var iB = iA - 1; if (iB < 0) iB += hLen;            // y[n-L-1]
      var avg = rho * 0.5 * (hist[iA] + hist[iB]);
      var ap = c * avg + apX1 - c * apY1;
      apX1 = avg; apY1 = ap;
      var y = (i < excLen ? shaped[i] : 0) + ap;
      hist[wIdx] = y;
      wIdx++; if (wIdx >= hLen) wIdx = 0;
      out[i] = y;
    }

    // Pick transient: brightness that decays fast (filtered noise click, ~6 ms).
    var clickN = Math.floor(0.012 * sr), hp = 0, prev = 0;
    for (i = 0; i < clickN; i++) {
      var nz = rnd() * 2 - 1;
      hp = 0.6 * (hp + nz - prev); prev = nz;            // crude highpass
      out[i] += 0.12 * hp * Math.exp(-i / (0.0025 * sr));
    }
    // Soft 1.5 ms onset so the pluck never clicks at sample 0
    var onN = Math.floor(0.0015 * sr);
    for (i = 0; i < onN; i++) out[i] *= i / onN;

    var f32 = new Float32Array(len);
    for (i = 0; i < len; i++) f32[i] = out[i];
    // Low strings are perceptually quieter; tilt the level a bit.
    return finish(f32, sr, 0.62 + 0.12 * (1 - t));
  }

  // --------------------------------------------- piano: additive partials
  // f_n = n * f * sqrt((1 + B n^2) / (1 + B))  -> partial 1 is exactly f (stretched upper partials)
  function renderPiano(midi, sr) {
    var f = midiToFreq(midi);
    var t = clamp((midi - 40) / 36, 0, 1);
    var dur = 3.6 - 1.2 * t;
    var len = Math.ceil(dur * sr);
    var out = new Float64Array(len);
    var rnd = mulberry32(5000 + midi * 104729);
    var B = 0.00008 * Math.pow(2, (midi - 48) / 18);      // inharmonicity, grows with pitch
    var tauBase = 1.9 - 0.8 * t;                          // slow decay (s) of the fundamental
    var maxF = Math.min(sr * 0.45, 9000);
    var hammer = 0.12;                                     // strike position (fraction of string)
    var detuneCents = [-0.7, 0.7];                         // two strings -> gentle beating/chorus
    var i, n, s;
    // One hammer strikes all strings at once: each partial starts in phase on every string.
    var phases = [];
    for (n = 0; n <= 28; n++) phases.push(rnd() * 2 * Math.PI);

    for (s = 0; s < detuneCents.length; s++) {
      var dF = Math.pow(2, detuneCents[s] / 1200);
      for (n = 1; n <= 28; n++) {
        // Fundamentals carry a smaller (symmetric) detune so the pitch centre stays exact.
        var fn = n === 1
          ? f * Math.pow(2, (detuneCents[s] * 0.3) / 1200)
          : n * f * Math.sqrt((1 + B * n * n) / (1 + B)) * dF;
        if (fn > maxF) break;
        var amp = Math.abs(Math.sin(Math.PI * n * hammer)) / Math.pow(n, 1.05);
        amp *= 1 / (1 + Math.pow(fn / 3500, 2));          // soft-felt hammer rolloff
        if (amp < 1e-4) continue;
        var tauSlow = tauBase / (1 + 0.32 * (n - 1)) / (1 + fn / 6000);
        var tauFast = Math.max(0.05, tauSlow * 0.18);
        var dS = Math.exp(-1 / (tauSlow * sr)), dFa = Math.exp(-1 / (tauFast * sr));
        var eS = 0.45, eF = 0.55;                          // two-stage decay
        var w = 2 * Math.PI * fn / sr, cw = Math.cos(w), sw = Math.sin(w);
        var ph = phases[n];
        var sn = Math.sin(ph), cs = Math.cos(ph);
        for (i = 0; i < len; i++) {
          out[i] += amp * (eS + eF) * sn;
          var ns = sn * cw + cs * sw;
          cs = cs * cw - sn * sw;
          sn = ns;
          eS *= dS; eF *= dFa;
          if (eS + eF < 1e-5) break;
        }
      }
    }
    // Hammer thump: very short lowpassed noise
    var thN = Math.floor(0.02 * sr), lp = 0;
    for (i = 0; i < thN; i++) {
      lp = 0.92 * lp + 0.08 * (rnd() * 2 - 1);
      out[i] += 0.5 * lp * Math.exp(-i / (0.005 * sr));
    }
    // 2.5 ms attack
    var aN = Math.floor(0.0025 * sr);
    for (i = 0; i < aN; i++) out[i] *= i / aN;

    var f32 = new Float32Array(len);
    for (i = 0; i < len; i++) f32[i] = out[i];
    return finish(f32, sr, 0.6);
  }

  function renderNote(inst, midi, sr) {
    sr = sr || (ctx ? ctx.sampleRate : 48000);
    return inst === 'piano' ? renderPiano(midi, sr) : renderGuitar(midi, sr);
  }

  function getBuffer(inst, midi) {
    var key = inst + ':' + midi;
    if (cache[key]) return cache[key];
    var data = renderNote(inst, midi, ctx.sampleRate);
    var buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    if (buf.copyToChannel) buf.copyToChannel(data, 0);
    else buf.getChannelData(0).set(data);
    cache[key] = buf;
    return buf;
  }

  // ------------------------------------------------------------ graph
  function makeImpulse(seconds) {
    var sr = ctx.sampleRate, len = Math.floor(seconds * sr);
    var imp = ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = imp.getChannelData(ch), rnd = mulberry32(77 + ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var tt = i / sr;
        var damp = 0.35 + 0.5 * Math.min(1, tt / seconds);  // darker as it decays
        lp = damp * lp + (1 - damp) * (rnd() * 2 - 1);
        var pre = tt < 0.012 ? 0 : 1;                        // short predelay
        d[i] = lp * pre * Math.exp(-tt * 3.4);
      }
    }
    return imp;
  }

  function biquad(type, freq, q, gain) {
    var b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = freq;
    if (q !== undefined) b.Q.value = q;
    if (gain !== undefined) b.gain.value = gain;
    return b;
  }

  function buildGraph() {
    var master = ctx.createGain();
    master.gain.value = volume;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3;
    comp.attack.value = 0.005; comp.release.value = 0.25;

    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.001; limiter.release.value = 0.1;

    master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);

    var mix = ctx.createGain(); mix.gain.value = 1;
    var dry = ctx.createGain(); dry.gain.value = 0.9;
    var wet = ctx.createGain(); wet.gain.value = 0.16;
    var reverb = ctx.createConvolver();
    try { reverb.buffer = makeImpulse(1.4); } catch (e) { wet.gain.value = 0; }
    mix.connect(dry); dry.connect(master);
    mix.connect(reverb); reverb.connect(wet); wet.connect(master);

    // Guitar body: air resonance, top-plate resonance, slight mid scoop, gentle top cut.
    var gBus = ctx.createGain(); gBus.gain.value = 1;
    var hp = biquad('highpass', 65, 0.7);
    var air = biquad('peaking', 105, 1.4, 4);
    var top = biquad('peaking', 220, 1.6, 3);
    var plate = biquad('peaking', 480, 2.0, 1.5);
    var scoop = biquad('peaking', 1400, 0.8, -2);
    var lp = biquad('lowpass', 6500, 0.5);
    gBus.connect(hp); hp.connect(air); air.connect(top); top.connect(plate);
    plate.connect(scoop); scoop.connect(lp); lp.connect(mix);

    var pBus = ctx.createGain(); pBus.gain.value = 0.95;
    var pHp = biquad('highpass', 45, 0.7);
    pBus.connect(pHp); pHp.connect(mix);

    nodes = { master: master, comp: comp, limiter: limiter, mix: mix, guitar: gBus, piano: pBus };
  }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) throw new Error('Web Audio API not supported in this browser');
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    buildGraph();
    ctx.onstatechange = function () {
      // iOS can move to 'interrupted' (calls, Siri) — resume on the next gesture.
      if (ctx.state !== 'running') installUnlock();
    };
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && ctx && ctx.state !== 'running') { ctx.resume().catch(function () {}); }
    });
    return ctx;
  }

  // ------------------------------------------------------------ iOS unlock
  function silentWavDataURI() {
    // 0.5 s of 8 kHz 8-bit mono silence (value 128)
    var n = 4000, bytes = new Uint8Array(44 + n), dv = new DataView(bytes.buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true);
    dv.setUint16(34, 8, true); str(36, 'data'); dv.setUint32(40, n, true);
    for (var i = 0; i < n; i++) bytes[44 + i] = 128;
    var bin = ''; for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
    return 'data:audio/wav;base64,' + btoa(bin);
  }

  function unlockOnce() {
    if (!ctx) return;
    // Silent-switch workaround:
    //  1) Safari 16.4+/17: navigator.audioSession.type = 'playback' makes Web Audio ignore the ringer switch.
    //  2) Older iOS: a looping silent <audio> element moves the page's audio session to "playback".
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
        navigator.audioSession.type = 'playback';
      }
    } catch (e) {}
    if (!navigator.audioSession && isIOS() && !silentAudioEl) {
      try {
        silentAudioEl = document.createElement('audio');
        silentAudioEl.setAttribute('playsinline', '');
        silentAudioEl.setAttribute('x-webkit-airplay', 'deny');
        silentAudioEl.preload = 'auto';
        silentAudioEl.loop = true;
        silentAudioEl.src = silentWavDataURI();
        var p = silentAudioEl.play();
        if (p && p.catch) p.catch(function () { silentAudioEl = null; });
      } catch (e) { silentAudioEl = null; }
    }
    // Play a 1-sample silent buffer inside the gesture (classic iOS unlock).
    try {
      var b = ctx.createBuffer(1, 1, ctx.sampleRate);
      var s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination);
      if (s.start) s.start(0); else s.noteOn(0);
    } catch (e) {}
    if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(function () {});
  }

  function installUnlock() {
    if (unlockInstalled) return;
    unlockInstalled = true;
    var evs = ['pointerdown', 'touchend', 'mousedown', 'keydown'];
    function handler() {
      unlockOnce();
      if (ctx && ctx.state === 'running') {
        evs.forEach(function (e) { document.removeEventListener(e, handler, true); });
        unlockInstalled = false;
      }
    }
    evs.forEach(function (e) { document.addEventListener(e, handler, true); });
  }

  function init() {
    ensureCtx();
    unlockOnce();
    installUnlock();
    if (ctx.state === 'running') return Promise.resolve(ctx);
    return ctx.resume().then(function () { return ctx; }, function () { return ctx; });
  }

  // ------------------------------------------------------------ voices
  function startVoice(inst, midi, when, ring, velocity) {
    var buf = getBuffer(inst, midi);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var g = ctx.createGain();
    var vel = velocity == null ? 0.9 : velocity;
    var relT = when + ring;
    var bufEnd = when + buf.duration;
    var stopT = Math.min(bufEnd, relT + RELEASE_TAIL);

    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.004);
    if (relT < bufEnd) {
      g.gain.setValueAtTime(vel, relT);
      g.gain.setTargetAtTime(0, relT, RELEASE_TAU);
    }

    var head = g;
    var dest = nodes[inst] || nodes.guitar;
    if (inst === 'piano') {
      // Lowpass that closes over time (bright strike, mellow sustain).
      var f = midiToFreq(midi);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.6;
      var start = Math.min(16000, Math.max(3500, f * 14));
      var end = Math.min(start, Math.max(900, f * 3.5));
      lp.frequency.setValueAtTime(start, when);
      lp.frequency.exponentialRampToValueAtTime(end, when + 1.6);
      g.connect(lp); lp.connect(dest);
      head = lp;
    } else {
      g.connect(dest);
    }
    src.connect(g);
    src.start(when);
    src.stop(stopT + 0.02);

    var v = { src: src, gain: g, extra: head !== g ? head : null, end: stopT + 0.02 };
    src.onended = function () {
      try { src.disconnect(); g.disconnect(); if (v.extra) v.extra.disconnect(); } catch (e) {}
      var k = voices.indexOf(v); if (k >= 0) voices.splice(k, 1);
    };
    voices.push(v);
    return v;
  }

  function waitUntil(ctxTime) {
    return new Promise(function (resolve) {
      var ms = Math.max(0, (ctxTime - ctx.currentTime) * 1000) + 15;
      var entry = { resolve: resolve, timer: 0 };
      entry.timer = setTimeout(function () {
        var k = pending.indexOf(entry); if (k >= 0) pending.splice(k, 1);
        resolve(true);
      }, ms);
      pending.push(entry);
    });
  }

  function scheduleInterval(rootMidi, semitones, mode, when) {
    var inst = instrument;
    var low = Math.round(Number(rootMidi));
    var high = low + Math.round(Number(semitones));
    if (!isFinite(low) || !isFinite(high)) throw new Error('playInterval: invalid notes');
    var end;
    if (mode === 'harmonic') {
      var off = inst === 'guitar' ? STRUM_OFFSET : 0.004;
      var hr = HARMONIC_RING * lenScale;
      startVoice(inst, low, when, hr, 0.78);
      startVoice(inst, high, when + off, hr - off, 0.72);
      end = when + hr + RELEASE_TAIL;
    } else {
      var first = mode === 'down' ? high : low;
      var second = mode === 'down' ? low : high;
      var gap = MELODIC_GAP * Math.max(0.7, lenScale), ring = MELODIC_RING * lenScale;
      startVoice(inst, first, when, ring, 0.9);
      startVoice(inst, second, when + gap, ring, 0.9);
      end = when + gap + ring + RELEASE_TAIL;
    }
    return end;
  }

  function playInterval(rootMidi, semitones, mode) {
    mode = mode || 'up';
    if (mode !== 'up' && mode !== 'down' && mode !== 'harmonic') {
      return Promise.reject(new Error("mode must be 'up', 'down' or 'harmonic'"));
    }
    var gen = generation;
    return init().then(function () {
      if (gen !== generation) return false;
      var end = scheduleInterval(rootMidi, semitones, mode, ctx.currentTime + LOOKAHEAD);
      return waitUntil(end).then(function (ok) { return ok && gen === generation; });
    });
  }

  function playSequence(items, gapSec) {
    var gap = gapSec == null ? 0.6 : Math.max(0, Number(gapSec));
    var list = (items || []).slice();
    var gen = generation;
    return init().then(function () {
      var i = 0;
      function next() {
        if (gen !== generation) return false;
        if (i >= list.length) return true;
        var it = list[i++];
        return playInterval(it.rootMidi, it.semitones, it.mode).then(function (ok) {
          if (!ok || gen !== generation) return false;
          if (i >= list.length) return true;
          return waitUntil(ctx.currentTime + gap).then(next);
        });
      }
      return next();
    });
  }

  // Plays single notes one after another, `step` seconds apart (e.g. a scale).
  // Reuses startVoice; the last note rings a little longer. Resolves true when finished.
  function playNotes(midis, step) {
    var list = (midis || []).map(function (m) { return Math.round(Number(m)); });
    var dt = step == null ? 0.18 : Math.max(0.05, Number(step));
    var gen = generation;
    if (!list.length || list.some(function (m) { return !isFinite(m); })) {
      return Promise.reject(new Error('playNotes: invalid notes'));
    }
    return init().then(function () {
      if (gen !== generation) return false;
      var t0 = ctx.currentTime + LOOKAHEAD, inst = instrument;
      list.forEach(function (m, i) {
        var last = i === list.length - 1;
        startVoice(inst, m, t0 + i * dt, last ? 1.1 : 0.5, last ? 0.9 : 0.8);
      });
      return waitUntil(t0 + (list.length - 1) * dt + 1.1 + RELEASE_TAIL * 0.5).then(function (ok) { return ok && gen === generation; });
    });
  }

  function stop() {
    generation++;
    pending.splice(0).forEach(function (p) { clearTimeout(p.timer); p.resolve(false); });
    if (!ctx) return;
    var now = ctx.currentTime;
    voices.slice().forEach(function (v) {
      try {
        var gp = v.gain.gain;
        if (gp.cancelAndHoldAtTime) gp.cancelAndHoldAtTime(now);
        else { var cur = gp.value; gp.cancelScheduledValues(now); gp.setValueAtTime(cur, now); }
        gp.linearRampToValueAtTime(0, now + STOP_FADE);
        v.src.stop(now + STOP_FADE + 0.02);
      } catch (e) {}
    });
  }

  function setVolume(v) {
    volume = clamp(Number(v) || 0, 0, 1);
    if (ctx && nodes) {
      var g = nodes.master.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(volume, now, 0.03);
    }
  }

  function setInstrument(name) {
    if (name !== 'guitar' && name !== 'piano') throw new Error("instrument must be 'guitar' or 'piano'");
    instrument = name;
  }

  function prewarm(midis) {
    ensureCtx();
    var list = midis || [];
    if (!midis) for (var m = RANGE.min; m <= RANGE.max; m++) list.push(m);
    // Render in small idle chunks so the UI stays responsive.
    var inst = instrument, idx = 0;
    return new Promise(function (resolve) {
      (function step() {
        var t0 = Date.now();
        while (idx < list.length && Date.now() - t0 < 12) getBuffer(inst, list[idx++]);
        if (idx < list.length) setTimeout(step, 0); else resolve();
      })();
    });
  }

  global.EarAudio = {
    init: init,
    setInstrument: setInstrument,
    getInstrument: function () { return instrument; },
    setNoteLength: function (f) { lenScale = clamp(Number(f) || 1, 0.4, 1); },
    midiToFreq: midiToFreq,
    playInterval: playInterval,
    playSequence: playSequence,
    playNotes: playNotes,
    stop: stop,
    setVolume: setVolume,
    prewarm: prewarm,
    isPlaying: function () { return voices.length > 0 || pending.length > 0; },
    RANGE: RANGE,
    _renderNote: function (inst, midi, sr) { return renderNote(inst, midi, sr || 48000); }
  };
})(window);
