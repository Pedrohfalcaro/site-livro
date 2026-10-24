/**
 * Áudio imersivo — Horrores Ocultos.
 *
 * Tudo é sintetizado no navegador com Web Audio (sem arquivos, sem direitos autorais):
 *  - scene(camadas): trilha ambiente de um ato, com crossfade entre cenas
 *  - sfx(id): efeito sonoro pontual (palavras clicáveis)
 *  - camada { tipo: "arquivo", src } toca um áudio de verdade, se você quiser trocar a síntese
 *
 * O navegador só libera áudio depois de um clique/toque: chame unlock() num handler de clique.
 * Evento 'ho:heartbeat' é disparado a cada batida da camada "coracao" (usado pelo visual).
 */
(function (global) {
  'use strict';

  const AC = global.AudioContext || global.webkitAudioContext;
  const LS = { on: 'ho1-som', sfx: 'ho1-efeitos', vol: 'ho1-volume' };

  const st = {
    ctx: null, master: null, bus: null, sfxBus: null, verb: null,
    scene: null, noise: {},
    enabled: lsGet(LS.on) !== '0',
    sfxOn: lsGet(LS.sfx) !== '0',
    vol: Number(lsGet(LS.vol)) || 0.7,
  };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* ok */ } }
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- infraestrutura ---------- */

  function ensure() {
    if (!AC) return false;
    if (!st.ctx) {
      const c = st.ctx = new AC();
      st.master = c.createGain();
      st.master.gain.value = st.enabled ? st.vol : 0;
      st.master.connect(c.destination);

      st.bus = c.createGain();       // trilha
      st.sfxBus = c.createGain();    // efeitos
      st.sfxBus.gain.value = 0.9;
      st.bus.connect(st.master);
      st.sfxBus.connect(st.master);

      st.verb = c.createConvolver(); // reverb de sala grande e fria
      st.verb.buffer = impulse(c, 2.8, 2.6);
      const vg = c.createGain();
      vg.gain.value = 0.5;
      st.verb.connect(vg);
      vg.connect(st.master);
    }
    if (st.ctx.state === 'suspended') st.ctx.resume();
    return true;
  }

  function impulse(c, sec, decay) {
    const len = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch += 1) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function noiseBuffer(type) {
    if (st.noise[type]) return st.noise[type];
    const c = st.ctx;
    const len = c.sampleRate * 5;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    if (type === 'white') {
      for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i += 1) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;   b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;   b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else { // brown
      let last = 0;
      for (let i = 0; i < len; i += 1) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    st.noise[type] = buf;
    return buf;
  }

  const gain = (v) => { const g = st.ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q) => {
    const n = st.ctx.createBiquadFilter();
    n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q;
    return n;
  };
  function noiseSrc(type, loop) {
    const s = st.ctx.createBufferSource();
    s.buffer = noiseBuffer(type);
    s.loop = loop !== false;
    return s;
  }
  function osc(type, f) {
    const o = st.ctx.createOscillator();
    o.type = type; o.frequency.value = f;
    return o;
  }
  /** LFO somado a um AudioParam. */
  function lfo(freq, depth, param, type, stopAt) {
    const o = osc(type || 'sine', freq);
    const g = gain(depth);
    o.connect(g); g.connect(param); o.start();
    if (stopAt != null) o.stop(stopAt);
    return o;
  }
  function toVerb(node, amount) {
    const g = gain(amount);
    node.connect(g); g.connect(st.verb);
  }

  /** Envelope simples num AudioParam. */
  function env(param, t, peak, attack, decay) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /* ---------- camadas da trilha ---------- */
  // Cada camada: (spec, out, scene) => void. Registra o que precisa parar em scene.stops/timers.

  function loopRandom(scene, fn, minMs, maxMs, firstMs) {
    const tick = () => {
      if (!scene.alive) return;
      if (st.ctx.state === 'running') fn();
      scene.timers.push(setTimeout(tick, rand(minMs, maxMs)));
    };
    scene.timers.push(setTimeout(tick, firstMs != null ? firstMs : rand(minMs, maxMs)));
  }

  const LAYERS = {
    chuva(s, out, scene) {
      const v = s.vol ?? 0.4;
      const a = noiseSrc('pink'); const hp = filt('highpass', 450); const lp = filt('lowpass', 9000);
      const g = gain(v);
      a.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
      const b = noiseSrc('white'); const bp = filt('bandpass', 5200, 0.6); const g2 = gain(v * 0.22);
      b.connect(bp); bp.connect(g2); g2.connect(out);
      scene.stops.push(lfo(0.12, v * 0.18, g.gain));
      a.start(0, rand(0, 3)); b.start(0, rand(0, 3));
      scene.stops.push(a, b);
    },

    vento(s, out, scene) {
      const v = s.vol ?? 0.2;
      const n = noiseSrc('brown'); const bp = filt('bandpass', 400, 0.9); const g = gain(v);
      n.connect(bp); bp.connect(g); g.connect(out);
      scene.stops.push(lfo(0.06, 220, bp.frequency));
      scene.stops.push(lfo(0.09, v * 0.5, g.gain));
      n.start(0, rand(0, 3));
      scene.stops.push(n);
    },

    drone(s, out, scene) {
      const v = s.vol ?? 0.3;
      const base = s.nota || 55;
      const ratios = s.acorde || [1, 1.5];
      const lp = filt('lowpass', s.corte || 380, 0.7);
      const g = gain(v);
      lp.connect(g); g.connect(out);
      toVerb(g, 0.35);
      ratios.forEach((r, i) => {
        const o = osc(s.onda || (i === 0 ? 'sawtooth' : 'sine'), base * r);
        o.detune.value = rand(-7, 7);
        const og = gain(0.5 / ratios.length);
        o.connect(og); og.connect(lp); o.start();
        scene.stops.push(o);
      });
      scene.stops.push(lfo(0.05 + Math.random() * 0.04, (s.corte || 380) * 0.35, lp.frequency));
    },

    zumbido(s, out, scene) {
      const v = s.vol ?? 0.15;
      const f = s.freq || 50;
      const lp = filt('lowpass', 600, 0.5); const g = gain(v);
      lp.connect(g); g.connect(out);
      [1, 2, 3, 5].forEach((m, i) => {
        const o = osc('sawtooth', f * m);
        const og = gain(0.5 / (i + 1));
        o.connect(og); og.connect(lp); o.start();
        scene.stops.push(o);
      });
      scene.stops.push(lfo(0.4, v * 0.12, g.gain));
    },

    maquina(s, out, scene) {
      const v = s.vol ?? 0.3;
      const bus = gain(v); bus.connect(out); toVerb(bus, 0.25);
      const beat = () => {
        const c = st.ctx; const t = c.currentTime;
        const o = osc('sine', 58); const og = gain(0.0001);
        o.frequency.exponentialRampToValueAtTime(34, t + 0.18);
        env(og.gain, t, 0.9, 0.01, 0.22);
        o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.3);
        const n = noiseSrc('white', false); const bp = filt('bandpass', 900, 1.2); const ng = gain(0.0001);
        env(ng.gain, t, 0.25, 0.005, 0.12);
        n.connect(bp); bp.connect(ng); ng.connect(bus); n.start(t); n.stop(t + 0.2);
      };
      loopRandom(scene, beat, 650, 820, 100);
      const rumble = noiseSrc('brown'); const lp = filt('lowpass', 160); const rg = gain(0.5);
      rumble.connect(lp); lp.connect(rg); rg.connect(bus); rumble.start(0, rand(0, 3));
      scene.stops.push(rumble);
    },

    gotas(s, out, scene) {
      const bus = gain(s.vol ?? 0.25); bus.connect(out); toVerb(bus, 0.9);
      loopRandom(scene, () => drip(bus, rand(700, 1500), 0.7), 1300, 4800);
    },

    relogio(s, out, scene) {
      const bus = gain(s.vol ?? 0.15); bus.connect(out);
      let alt = false;
      const tick = () => {
        alt = !alt;
        const c = st.ctx; const t = c.currentTime;
        const n = noiseSrc('white', false); const bp = filt('bandpass', alt ? 2600 : 1900, 4); const g = gain(0.0001);
        env(g.gain, t, 0.9, 0.002, 0.04);
        n.connect(bp); bp.connect(g); g.connect(bus); n.start(t); n.stop(t + 0.08);
      };
      const loop = () => { if (!scene.alive) return; if (st.ctx.state === 'running') tick(); scene.timers.push(setTimeout(loop, 1000)); };
      loop();
    },

    coracao(s, out, scene) {
      const bus = gain(s.vol ?? 0.4); bus.connect(out);
      const started = Date.now();
      const bpmAt = () => {
        if (!s.bpmFim || !s.duracao) return s.bpm || 70;
        const k = Math.min(1, (Date.now() - started) / 1000 / s.duracao);
        return (s.bpm || 70) + (s.bpmFim - (s.bpm || 70)) * k;
      };
      const thump = (t, peak) => {
        const c = st.ctx;
        const o = osc('sine', 62); const g = gain(0.0001);
        o.frequency.exponentialRampToValueAtTime(34, t + 0.14);
        env(g.gain, t, peak, 0.012, 0.2);
        o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.3);
      };
      const beat = () => {
        if (!scene.alive) return;
        const bpm = bpmAt();
        if (st.ctx.state === 'running') {
          const t = st.ctx.currentTime;
          thump(t, 1); thump(t + 0.2, 0.7);
          global.dispatchEvent(new CustomEvent('ho:heartbeat', { detail: { bpm } }));
        }
        scene.timers.push(setTimeout(beat, 60000 / bpm));
      };
      beat();
    },

    trovao(s, out, scene) {
      const bus = gain(s.vol ?? 0.4); bus.connect(out); toVerb(bus, 0.5);
      loopRandom(scene, () => thunder(bus, rand(2.4, 4.2), false), 12000, 30000, rand(4000, 9000));
    },

    estatica(s, out, scene) {
      const v = s.vol ?? 0.1;
      const n = noiseSrc('white'); const bp = filt('bandpass', 3200, 0.5); const g = gain(v);
      n.connect(bp); bp.connect(g); g.connect(out);
      scene.stops.push(lfo(7, v * 0.5, g.gain, 'square'));
      n.start(0, rand(0, 3));
      scene.stops.push(n);
    },

    fogo(s, out, scene) {
      const bus = gain(s.vol ?? 0.3); bus.connect(out);
      loopRandom(scene, () => crackle(bus), 70, 280);
    },

    multidao(s, out, scene) {
      const v = s.vol ?? 0.2;
      const n = noiseSrc('pink');
      const f1 = filt('bandpass', 650, 1.4); const f2 = filt('bandpass', 1500, 1.8);
      const g = gain(v);
      n.connect(f1); n.connect(f2); f1.connect(g); f2.connect(g); g.connect(out);
      scene.stops.push(lfo(0.35, v * 0.4, g.gain));
      scene.stops.push(lfo(0.11, 200, f1.frequency));
      n.start(0, rand(0, 3));
      scene.stops.push(n);
    },

    tensao(s, out, scene) {
      const bus = gain(s.vol ?? 0.15); bus.connect(out); toVerb(bus, 0.6);
      const swell = () => {
        const c = st.ctx; const t = c.currentTime; const dur = rand(9, 14);
        const f = rand(70, 110);
        const o = osc('sawtooth', f); const o2 = osc('sawtooth', f * 1.0595);
        o.frequency.linearRampToValueAtTime(f * 1.07, t + dur);
        o2.frequency.linearRampToValueAtTime(f * 1.12, t + dur);
        const lp = filt('lowpass', 520, 0.8); const g = gain(0.0001);
        g.gain.exponentialRampToValueAtTime(0.55, t + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(bus);
        o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
      };
      loopRandom(scene, swell, 9000, 16000, 600);
    },

    // água batendo na margem; abafada = ouvida de debaixo d'água
    agua(s, out, scene) {
      const v = s.vol ?? 0.3;
      const a = noiseSrc('brown'); const lp = filt('lowpass', s.abafada ? 180 : 650); const g = gain(v);
      a.connect(lp); lp.connect(g); g.connect(out);
      scene.stops.push(lfo(0.18, v * 0.5, g.gain));
      a.start(0, rand(0, 3)); scene.stops.push(a);
      if (!s.abafada) {
        const b = noiseSrc('pink'); const bp = filt('bandpass', 1100, 0.8); const g2 = gain(v * 0.35);
        b.connect(bp); bp.connect(g2); g2.connect(out);
        scene.stops.push(lfo(0.31, v * 0.25, g2.gain));
        b.start(0, rand(0, 3)); scene.stops.push(b);
      }
    },

    bolhas(s, out, scene) {
      const bus = gain(s.vol ?? 0.25); bus.connect(out); toVerb(bus, 0.7);
      loopRandom(scene, () => bubble(bus), 500, 2600);
    },

    pulso(s, out, scene) {
      const v = s.vol ?? 0.12;
      const o = osc('sine', 38); const g = gain(v);
      o.connect(g); g.connect(out); o.start();
      scene.stops.push(o, lfo(0.6, v * 0.9, g.gain));
    },

    arquivo(s, out, scene) {
      const a = new Audio(s.src);
      a.loop = true; a.crossOrigin = 'anonymous';
      const src = st.ctx.createMediaElementSource(a);
      const g = gain(s.vol ?? 0.6);
      src.connect(g); g.connect(out);
      a.play().catch(() => { /* arquivo ausente: a trilha sintética continua */ });
      scene.stops.push({ stop() { a.pause(); a.src = ''; } });
    },
  };

  /* ---------- sons pontuais (usados pelas camadas e pelos efeitos) ---------- */

  function drip(dest, freq, peak) {
    const c = st.ctx; const t = c.currentTime;
    const o = osc('sine', freq); const g = gain(0.0001);
    o.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.12);
    env(g.gain, t, peak, 0.004, 0.16);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.25);
  }

  function thunder(dest, dur, crack) {
    const c = st.ctx; const t = c.currentTime;
    const n = noiseSrc('brown', false); const lp = filt('lowpass', 420); const g = gain(0.0001);
    lp.frequency.exponentialRampToValueAtTime(70, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.4, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp); lp.connect(g); g.connect(dest); n.start(t); n.stop(t + dur + 0.1);
    if (crack) {
      const w = noiseSrc('white', false); const hp = filt('highpass', 1800); const cg = gain(0.0001);
      env(cg.gain, t, 0.9, 0.003, 0.25);
      w.connect(hp); hp.connect(cg); cg.connect(dest); w.start(t); w.stop(t + 0.4);
    }
  }

  /** Bolha subindo: um "blub" curto cuja altura sobe rápido. */
  function bubble(dest) {
    const c = st.ctx; const t = c.currentTime;
    const f = rand(220, 520);
    const o = osc('sine', f); const g = gain(0.0001);
    o.frequency.exponentialRampToValueAtTime(f * rand(2.2, 3.4), t + 0.09);
    env(g.gain, t, rand(0.3, 0.7), 0.006, 0.12);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.2);
  }

  function crackle(dest) {
    const c = st.ctx; const t = c.currentTime;
    const n = noiseSrc('white', false); const bp = filt('bandpass', rand(1200, 4500), 1.5); const g = gain(0.0001);
    env(g.gain, t, rand(0.3, 0.9), 0.002, rand(0.015, 0.05));
    n.connect(bp); bp.connect(g); g.connect(dest); n.start(t); n.stop(t + 0.1);
  }

  /* ---------- efeitos das palavras ---------- */

  const SFX = {
    corte(d) {
      const t = st.ctx.currentTime;
      const n = noiseSrc('white', false); const bp = filt('bandpass', 2000, 1.2); const g = gain(0.0001);
      bp.frequency.exponentialRampToValueAtTime(9000, t + 0.16);
      env(g.gain, t, 0.8, 0.012, 0.16);
      n.connect(bp); bp.connect(g); g.connect(d); n.start(t); n.stop(t + 0.3);
      const w = noiseSrc('pink', false); const lp = filt('lowpass', 700); const wg = gain(0.0001);
      env(wg.gain, t + 0.1, 0.6, 0.01, 0.14);
      w.connect(lp); lp.connect(wg); wg.connect(d); w.start(t + 0.1); w.stop(t + 0.4);
    },
    gota(d) { drip(d, 820, 0.8); setTimeout(() => drip(d, 640, 0.5), 220); },
    tap(d) { drip(d, 520, 0.9); },
    tic(d) {
      const t = st.ctx.currentTime;
      [0, 0.32].forEach((dt, i) => {
        const n = noiseSrc('white', false); const bp = filt('bandpass', i ? 1700 : 2500, 4); const g = gain(0.0001);
        env(g.gain, t + dt, 0.9, 0.002, 0.05);
        n.connect(bp); bp.connect(g); g.connect(d); n.start(t + dt); n.stop(t + dt + 0.1);
      });
    },
    trovao(d) { thunder(d, 3.4, true); },
    chuva(d) {
      const t = st.ctx.currentTime;
      const n = noiseSrc('pink', false); const hp = filt('highpass', 600); const g = gain(0.0001);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
      n.connect(hp); hp.connect(g); g.connect(d); n.start(t); n.stop(t + 3.1);
    },
    maquina(d) {
      const t = st.ctx.currentTime;
      const o = osc('sawtooth', 120); const lp = filt('lowpass', 900); const g = gain(0.0001);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      lfo(34, 0.3, g.gain, 'square', t + 1.2);
      o.connect(lp); lp.connect(g); g.connect(d); o.start(t); o.stop(t + 1.2);
    },
    sirene(d) {
      const t = st.ctx.currentTime;
      const o = osc('sawtooth', 420); const lp = filt('lowpass', 1800); const g = gain(0.0001);
      for (let i = 0; i < 3; i += 1) {
        o.frequency.linearRampToValueAtTime(820, t + i * 0.9 + 0.45);
        o.frequency.linearRampToValueAtTime(420, t + i * 0.9 + 0.9);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      o.connect(lp); lp.connect(g); g.connect(d); o.start(t); o.stop(t + 2.9);
    },
    vidro(d) {
      const t = st.ctx.currentTime;
      const w = noiseSrc('white', false); const hp = filt('highpass', 3500); const wg = gain(0.0001);
      env(wg.gain, t, 0.9, 0.003, 0.18);
      w.connect(hp); hp.connect(wg); wg.connect(d); w.start(t); w.stop(t + 0.3);
      for (let i = 0; i < 9; i += 1) {
        const dt = rand(0.04, 0.55);
        const o = osc('sine', rand(3000, 8200)); const g = gain(0.0001);
        env(g.gain, t + dt, rand(0.15, 0.4), 0.002, rand(0.05, 0.2));
        o.connect(g); g.connect(d); o.start(t + dt); o.stop(t + dt + 0.3);
      }
    },
    estatica(d) {
      const t = st.ctx.currentTime;
      const n = noiseSrc('white', false); const bp = filt('bandpass', 3500, 0.5); const g = gain(0.0001);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.03);
      g.gain.setValueAtTime(0.6, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      lfo(18, 0.3, g.gain, 'square', t + 0.8);
      n.connect(bp); bp.connect(g); g.connect(d); n.start(t); n.stop(t + 0.8);
    },
    fogo(d) { for (let i = 0; i < 28; i += 1) setTimeout(() => crackle(d), i * rand(25, 70)); },
    sussurro(d) {
      const t = st.ctx.currentTime;
      const n = noiseSrc('white', false); const bp = filt('bandpass', 3000, 2.5); const bp2 = filt('bandpass', 1400, 3); const g = gain(0.0001);
      g.gain.setValueAtTime(0.0001, t);
      [0, 0.35, 0.8].forEach((dt, i) => {
        g.gain.exponentialRampToValueAtTime(0.5 - i * 0.1, t + dt + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.3);
      });
      n.connect(bp); n.connect(bp2); bp.connect(g); bp2.connect(g); toVerb(g, 0.8); g.connect(d);
      n.start(t); n.stop(t + 1.3);
    },
    coracao(d) {
      const t = st.ctx.currentTime;
      [0, 0.22].forEach((dt, i) => {
        const o = osc('sine', 62); const g = gain(0.0001);
        o.frequency.exponentialRampToValueAtTime(34, t + dt + 0.14);
        env(g.gain, t + dt, i ? 0.8 : 1.2, 0.012, 0.2);
        o.connect(g); g.connect(d); o.start(t + dt); o.stop(t + dt + 0.3);
      });
    },
    respiracao(d) {
      const t = st.ctx.currentTime;
      const n = noiseSrc('pink', false); const lp = filt('lowpass', 1300); const g = gain(0.0001);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      n.connect(lp); lp.connect(g); toVerb(g, 0.5); g.connect(d); n.start(t); n.stop(t + 1.9);
    },
    dentes(d) {
      const t = st.ctx.currentTime;
      for (let i = 0; i < 9; i += 1) {
        const dt = i * rand(0.05, 0.09);
        const n = noiseSrc('white', false); const bp = filt('bandpass', rand(2500, 4200), 5); const g = gain(0.0001);
        env(g.gain, t + dt, 0.7, 0.002, 0.03);
        n.connect(bp); bp.connect(g); g.connect(d); n.start(t + dt); n.stop(t + dt + 0.08);
      }
    },
    rangido(d) {
      const t = st.ctx.currentTime;
      const o = osc('sawtooth', 90); const lp = filt('lowpass', 700); const g = gain(0.0001);
      o.frequency.linearRampToValueAtTime(150, t + 0.9);
      lfo(11, 14, o.frequency, 'sine', t + 1.3);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(lp); lp.connect(g); toVerb(g, 0.4); g.connect(d); o.start(t); o.stop(t + 1.3);
    },
    estalo(d) {
      const t = st.ctx.currentTime;
      [0, 0.09].forEach((dt) => {
        const n = noiseSrc('white', false); const lp = filt('lowpass', 1500); const g = gain(0.0001);
        env(g.gain, t + dt, 1, 0.001, 0.05);
        n.connect(lp); lp.connect(g); toVerb(g, 0.3); g.connect(d); n.start(t + dt); n.stop(t + dt + 0.1);
      });
    },
    batida(d) {
      const t = st.ctx.currentTime;
      const o = osc('sine', 90); const g = gain(0.0001);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      env(g.gain, t, 1.2, 0.004, 0.3);
      o.connect(g); toVerb(g, 0.5); g.connect(d); o.start(t); o.stop(t + 0.45);
      const n = noiseSrc('white', false); const lp = filt('lowpass', 600); const ng = gain(0.0001);
      env(ng.gain, t, 0.6, 0.002, 0.12);
      n.connect(lp); lp.connect(ng); ng.connect(d); n.start(t); n.stop(t + 0.2);
    },
    papel(d) {
      const t = st.ctx.currentTime;
      for (let i = 0; i < 9; i += 1) {
        const dt = i * rand(0.03, 0.08);
        const n = noiseSrc('white', false); const bp = filt('bandpass', rand(3500, 8000), 1.1); const g = gain(0.0001);
        env(g.gain, t + dt, rand(0.25, 0.6), 0.004, rand(0.03, 0.08));
        n.connect(bp); bp.connect(g); g.connect(d); n.start(t + dt); n.stop(t + dt + 0.15);
      }
    },
    risco(d) {
      const t = st.ctx.currentTime;
      [0, 0.28].forEach((dt) => {
        const n = noiseSrc('white', false); const bp = filt('bandpass', 2600, 2.5); const g = gain(0.0001);
        bp.frequency.linearRampToValueAtTime(4200, t + dt + 0.22);
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.5, t + dt + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.24);
        n.connect(bp); bp.connect(g); g.connect(d); n.start(t + dt); n.stop(t + dt + 0.3);
      });
    },
    agua(d) {
      const t = st.ctx.currentTime;
      const n = noiseSrc('white', false); const bp = filt('bandpass', 1400, 0.7); const g = gain(0.0001);
      bp.frequency.exponentialRampToValueAtTime(400, t + 0.6);
      env(g.gain, t, 0.8, 0.02, 0.7);
      n.connect(bp); bp.connect(g); toVerb(g, 0.5); g.connect(d); n.start(t); n.stop(t + 0.9);
      for (let i = 0; i < 6; i += 1) setTimeout(() => bubble(d), 120 + i * rand(60, 140));
    },
    bolhas(d) { for (let i = 0; i < 7; i += 1) setTimeout(() => bubble(d), i * rand(60, 150)); },
    tosse(d) {
      const t = st.ctx.currentTime;
      [0, 0.22, 0.46].forEach((dt, i) => {
        const n = noiseSrc('pink', false); const bp = filt('bandpass', 900 - i * 80, 1.4); const g = gain(0.0001);
        env(g.gain, t + dt, 0.9 - i * 0.15, 0.008, 0.14);
        n.connect(bp); bp.connect(g); toVerb(g, 0.25); g.connect(d); n.start(t + dt); n.stop(t + dt + 0.25);
      });
    },
    taca(d) {
      const t = st.ctx.currentTime;
      [2093, 2099, 3136].forEach((f, i) => {
        const o = osc('sine', f); const g = gain(0.0001);
        env(g.gain, t, 0.35 - i * 0.08, 0.002, 1.4 - i * 0.3);
        o.connect(g); toVerb(g, 0.6); g.connect(d); o.start(t); o.stop(t + 1.5);
      });
    },
    arrastar(d) {
      const t = st.ctx.currentTime;
      const n = noiseSrc('brown', false); const lp = filt('lowpass', 320); const g = gain(0.0001);
      lp.frequency.linearRampToValueAtTime(110, t + 1.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1.1, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      lfo(5, 0.4, g.gain, 'sine', t + 1.7);
      n.connect(lp); lp.connect(g); toVerb(g, 0.4); g.connect(d); n.start(t); n.stop(t + 1.8);
    },
    passos(d) {
      const t = st.ctx.currentTime;
      for (let i = 0; i < 4; i += 1) {
        const dt = i * 0.46;
        const n = noiseSrc('brown', false); const lp = filt('lowpass', 260); const g = gain(0.0001);
        env(g.gain, t + dt, 1.1 - i * 0.12, 0.01, 0.16);
        n.connect(lp); lp.connect(g); toVerb(g, 0.3); g.connect(d); n.start(t + dt); n.stop(t + dt + 0.25);
      }
    },
    vibra(d) {
      const t = st.ctx.currentTime;
      [0, 0.22, 0.44].forEach((dt) => {
        const o = osc('square', 150); const lp = filt('lowpass', 700); const g = gain(0.0001);
        env(g.gain, t + dt, 0.35, 0.01, 0.12);
        o.connect(lp); lp.connect(g); g.connect(d); o.start(t + dt); o.stop(t + dt + 0.2);
      });
    },
    mensagem(d) {
      const t = st.ctx.currentTime;
      [[880, 0], [1320, 0.13]].forEach(([f, dt]) => {
        const o = osc('sine', f); const g = gain(0.0001);
        env(g.gain, t + dt, 0.4, 0.004, 0.22);
        o.connect(g); toVerb(g, 0.25); g.connect(d); o.start(t + dt); o.stop(t + dt + 0.3);
      });
    },
    brilho(d) {
      const t = st.ctx.currentTime;
      [880, 884.5, 1320].forEach((f, i) => {
        const o = osc('sine', f); const g = gain(0.0001);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12 - i * 0.02, t + 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
        o.frequency.linearRampToValueAtTime(f * 1.02, t + 2);
        o.connect(g); toVerb(g, 0.9); g.connect(d); o.start(t); o.stop(t + 2.1);
      });
    },
  };

  /* ---------- API pública ---------- */

  function stopScene(scene, fadeSec) {
    if (!scene) return;
    scene.alive = false;
    const t = st.ctx.currentTime;
    scene.gain.gain.cancelScheduledValues(t);
    scene.gain.gain.setValueAtTime(scene.gain.gain.value, t);
    scene.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
    scene.timers.forEach(clearTimeout);
    setTimeout(() => {
      scene.stops.forEach((s) => { try { s.stop(); } catch (_) { /* já parado */ } });
      try { scene.gain.disconnect(); } catch (_) { /* ok */ }
    }, fadeSec * 1000 + 300);
  }

  function scene(layers, opts) {
    const fade = (opts && opts.fade) ?? 2.5;
    st.wanted = { layers, opts };
    if (!AC || !st.ctx) return; // sem gesto ainda: aplicamos no unlock()
    if (st.scene && st.scene.layers === layers) return;

    const prev = st.scene;
    const sc = { alive: true, timers: [], stops: [], layers, gain: st.ctx.createGain() };
    sc.gain.gain.value = 0;
    sc.gain.connect(st.bus);
    (layers || []).forEach((spec) => {
      const build = LAYERS[spec.tipo];
      if (!build) return;
      try { build(spec, sc.gain, sc); } catch (err) { console.warn('camada de áudio falhou:', spec.tipo, err); }
    });
    const t = st.ctx.currentTime;
    sc.gain.gain.linearRampToValueAtTime(1, t + fade);
    st.scene = sc;
    stopScene(prev, fade);
  }

  function unlock() {
    if (!ensure()) return false;
    if (st.wanted && !st.scene) scene(st.wanted.layers, st.wanted.opts);
    return true;
  }

  function applyMaster() {
    if (!st.ctx) return;
    const t = st.ctx.currentTime;
    st.master.gain.cancelScheduledValues(t);
    st.master.gain.setTargetAtTime(st.enabled ? st.vol : 0, t, 0.15);
  }

  global.addEventListener('visibilitychange', () => {
    if (!st.ctx) return;
    if (document.hidden) st.ctx.suspend(); else if (st.enabled) st.ctx.resume();
  });

  global.HorroresAudio = {
    supported: !!AC,
    unlock,
    scene,
    stop(fade) { if (st.ctx && st.scene) { stopScene(st.scene, fade ?? 1.5); st.scene = null; } },
    sfx(id) {
      if (!st.enabled || !st.sfxOn || !ensure() || !SFX[id]) return;
      SFX[id](st.sfxBus);
    },
    isEnabled: () => st.enabled,
    sfxEnabled: () => st.sfxOn,
    volume: () => st.vol,
    setEnabled(on) {
      st.enabled = !!on; lsSet(LS.on, on ? '1' : '0');
      if (on) unlock();
      applyMaster();
    },
    setSfxEnabled(on) { st.sfxOn = !!on; lsSet(LS.sfx, on ? '1' : '0'); },
    setVolume(v) { st.vol = Math.max(0, Math.min(1, v)); lsSet(LS.vol, String(st.vol)); applyMaster(); },
  };
})(window);
