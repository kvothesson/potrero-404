// Sonidos sintetizados con Web Audio: sin archivos. Arranca mudo hasta la primera tecla
// (los navegadores lo exigen) y M lo apaga o lo prende; la elección se recuerda.
// No hay música: suenan los motores, los golpes, los goles y la ruta.
export function crearSonido() {
  let ac = null, maestro = null;
  let prendido = (() => { try { return localStorage.getItem('potrero404.sonido') !== '0'; } catch { return true; } })();
  const motores = [];

  function despertar() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    maestro = ac.createGain(); maestro.gain.value = prendido ? 0.5 : 0; maestro.connect(ac.destination);
    for (let i = 0; i < 2; i++) {
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = 40; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(maestro); o.start();
      motores.push({ o, f, g });
    }
  }

  function alternar() {
    prendido = !prendido;
    try { localStorage.setItem('potrero404.sonido', prendido ? '1' : '0'); } catch { /* sin almacenamiento */ }
    despertar();
    if (maestro) maestro.gain.setTargetAtTime(prendido ? 0.5 : 0, ac.currentTime, 0.02);
    if (prendido) setTimeout(() => ruido(0.06, 2400, 0.5), 30);   // un clic para que se note que prendió
  }

  function ruido(dur, frec, vol) {
    if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / n) ** 2;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = frec; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(maestro); src.start();
  }

  function tono(frec, dur, vol, tipo = 'square', hasta = frec) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = tipo; o.frequency.setValueAtTime(frec, t); o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(maestro); o.start(t); o.stop(t + dur);
  }

  function eventos(s) {
    for (const e of s.eventos) {
      if (e.t === 'toque') { ruido(0.08, 900 + e.fuerza * 80, 0.5); tono(160, 0.07, 0.15, 'sine', 90); }
      else if (e.t === 'pared') ruido(0.06, 600, Math.min(0.4, e.fuerza / 20));
      else if (e.t === 'choque' || e.t === 'choqueAutos') ruido(0.18, 500, 0.45);
      else if (e.t === 'nitro') tono(e.grande ? 520 : 700, 0.15, 0.12, 'triangle', e.grande ? 1040 : 900);
      else if (e.t === 'derrape') ruido(0.25, 2500, 0.08);
      else if (e.t === 'salto') { tono(220, 0.18, 0.1, 'sine', 440); ruido(0.15, 3000, 0.1); }
      else if (e.t === 'aterriza') ruido(0.08, 400, 0.2);
      else if (e.t === 'bocina') { tono(155, 0.7, 0.16, 'sawtooth', 150); tono(196, 0.7, 0.12, 'sawtooth', 190); }
      else if (e.t === 'camion') { ruido(2.4, 220, 0.5); tono(70, 2.4, 0.18, 'sawtooth', 40); }
      else if (e.t === 'aplastado') { ruido(0.6, 900, 0.7); ruido(0.35, 3000, 0.3); tono(90, 0.5, 0.2, 'square', 30); }
      else if (e.t === 'cuantico') { tono(1200, 0.18, 0.1, 'square', 300); tono(300, 0.22, 0.08, 'triangle', 1500); }
      else if (e.t === 'revive') tono(440, 0.25, 0.1, 'triangle', 880);
      else if (e.t === 'tic') tono(440, 0.12, 0.12, 'square');
      else if (e.t === 'arranque') tono(880, 0.3, 0.14, 'square');
      else if (e.t === 'gol') { [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => tono(f, 0.35, 0.12, 'square'), k * 90)); ruido(1.2, 1800, 0.25); }
      else if (e.t === 'fin') [392, 523, 659, 784, 1047].forEach((f, k) => setTimeout(() => tono(f, 0.4, 0.13, 'triangle'), k * 130));
    }
  }

  function motoresSonido(s) {
    if (!ac) return;
    motores.forEach((m, i) => {
      const c = s && s.fase === 'juego' ? s.autos[i] : null;
      const v = c ? Math.abs(c.vel) : 0;
      const t = ac.currentTime;
      m.o.frequency.setTargetAtTime(38 + i * 6 + v * 9 + (c && c.nitroActivo ? 25 : 0), t, 0.05);
      m.f.frequency.setTargetAtTime(300 + v * 90, t, 0.05);
      m.g.gain.setTargetAtTime(c ? 0.025 + v * 0.006 : 0, t, 0.08);
    });
  }

  return { despertar, alternar, eventos, motores: motoresSonido, prendido: () => prendido };
}
