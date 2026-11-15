// Dibujo del juego en canvas 2D. Solo lee el estado; nunca lo cambia.
import { W, H, CAMPO, AUTOS, GOLES_PARA_GANAR, FPS, paredes } from './sim.js';

const PARED = paredes();
const COLOR = { fondo: '#0b1a12', pasto1: '#2e7d3c', pasto2: '#287035', linea: 'rgba(255,255,255,.82)', pared: '#e9edf2' };

export function crearPintor(canvas) {
  const ctx = canvas.getContext('2d');
  // capa persistente para las marcas de derrape
  const marcas = document.createElement('canvas');
  marcas.width = W; marcas.height = H;
  const mctx = marcas.getContext('2d');
  const chispas = [];

  function ajustar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const esc = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = `${Math.floor(W * esc)}px`;
    canvas.style.height = `${Math.floor(H * esc)}px`;
    canvas.width = Math.floor(W * esc * dpr);
    canvas.height = Math.floor(H * esc * dpr);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }
  ajustar();
  window.addEventListener('resize', ajustar);

  function camino() {
    ctx.beginPath();
    PARED.puntos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }

  function cancha(s) {
    ctx.fillStyle = COLOR.fondo;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    camino(); ctx.clip();
    for (let y = 0, k = 0; y < H; y += 40, k++) { ctx.fillStyle = k % 2 ? COLOR.pasto1 : COLOR.pasto2; ctx.fillRect(0, y, W, 40); }
    // redes de los arcos
    const { T, B, arcoAncho, arcoFondo } = CAMPO, g0 = W / 2 - arcoAncho / 2;
    [[T - arcoFondo, 0], [B, 1]].forEach(([y, i]) => {
      ctx.fillStyle = 'rgba(10,15,20,.55)'; ctx.fillRect(g0, y, arcoAncho, arcoFondo);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
      for (let x = g0; x <= g0 + arcoAncho; x += 10) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + arcoFondo); ctx.stroke(); }
      for (let yy = y; yy <= y + arcoFondo; yy += 10) { ctx.beginPath(); ctx.moveTo(g0, yy); ctx.lineTo(g0 + arcoAncho, yy); ctx.stroke(); }
    });
    ctx.drawImage(marcas, 0, 0);
    // líneas
    ctx.strokeStyle = COLOR.linea; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(CAMPO.L, H / 2); ctx.lineTo(CAMPO.R, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = COLOR.linea; ctx.beginPath(); ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeRect(W / 2 - 110, T, 220, 78); ctx.strokeRect(W / 2 - 110, B - 78, 220, 78);
    ctx.beginPath(); ctx.moveTo(g0, T); ctx.lineTo(g0 + arcoAncho, T); ctx.moveTo(g0, B); ctx.lineTo(g0 + arcoAncho, B); ctx.stroke();
    // goles grandes y tenues en cada mitad
    ctx.font = '800 150px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(47,124,246,.16)'; ctx.fillText(s.autos[0].goles, W / 2, H / 2 - 170);
    ctx.fillStyle = 'rgba(229,56,59,.16)'; ctx.fillText(s.autos[1].goles, W / 2, H / 2 + 170);
    ctx.restore();
    // paredes
    ctx.lineJoin = 'round';
    camino(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 10; ctx.stroke();
    camino(); ctx.strokeStyle = COLOR.pared; ctx.lineWidth = 5; ctx.stroke();
    // palos con el color de quien defiende
    [[T, AUTOS[0].color], [B, AUTOS[1].color]].forEach(([y, col]) => {
      [g0, g0 + arcoAncho].forEach((x) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); });
    });
  }

  function pastillas(s) {
    const t = s.cuadro / FPS;
    for (const p of s.pastillas) {
      if (p.activa) {
        const brillo = 0.5 + 0.5 * Math.sin(t * 5 + p.x);
        ctx.fillStyle = `rgba(255,170,40,${0.18 + brillo * 0.2})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,200,120,.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function auto(c, a, t) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.rot * Math.PI / 180);
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,.35)'; redondo(-20, -9, 44, 24, 6); ctx.fill();
    // fuego del nitro
    if (c.nitroActivo) {
      const largo = 14 + Math.random() * 12;
      const g = ctx.createLinearGradient(-22, 0, -22 - largo, 0);
      g.addColorStop(0, '#fff6c2'); g.addColorStop(0.4, '#ffb02e'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-21, -6); ctx.lineTo(-22 - largo, 0); ctx.lineTo(-21, 6); ctx.closePath(); ctx.fill();
    }
    // ruedas
    ctx.fillStyle = '#111';
    [[-14, -13], [8, -13], [-14, 9], [8, 9]].forEach(([x, y]) => { redondo(x, y, 9, 4, 1.5); ctx.fill(); });
    // carrocería
    ctx.fillStyle = a.color; redondo(-22, -11, 44, 22, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)'; redondo(-12, -9, 20, 18, 4); ctx.fill();
    ctx.fillStyle = 'rgba(190,225,255,.9)'; redondo(4, -8, 7, 16, 2); ctx.fill();        // parabrisas
    ctx.fillStyle = 'rgba(190,225,255,.6)'; redondo(-14, -7, 4, 14, 1.5); ctx.fill();    // luneta
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(-20, -2, 30, 4);                 // franja
    ctx.fillStyle = '#fff8c8'; ctx.fillRect(19, -9, 3, 5); ctx.fillRect(19, 4, 3, 5);    // faros
    ctx.fillStyle = c.vel < 0 || c.frenoActivo ? '#ff3030' : '#8a1010'; ctx.fillRect(-22, -9, 2, 5); ctx.fillRect(-22, 4, 2, 5);
    ctx.restore();
    // marcas de derrape
    if (Math.abs(c.lat || 0) > 0.9) {
      const co = Math.cos(c.rot * Math.PI / 180), si = Math.sin(c.rot * Math.PI / 180);
      mctx.fillStyle = `rgba(20,30,20,${Math.min(0.45, Math.abs(c.lat) * 0.12)})`;
      if (Math.random() < 0.5) chispazo(c.x - co * 18, c.y - si * 18, 1, 'rgba(230,230,230,.7)');
      [-1, 1].forEach((lado) => {
        const x = c.x - co * 12 - si * 10 * lado, y = c.y - si * 12 + co * 10 * lado;
        mctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      });
    }
  }

  function redondo(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function pelota(b) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(b.x + 3, b.y + 4, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.giro);
    ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, 11, 0, Math.PI * 2); ctx.stroke();
  }

  function hud(s) {
    // barras de nitro a los costados
    s.autos.forEach((c, i) => {
      const x = i === 0 ? 5 : W - 13, alto = 260, y0 = i === 0 ? 90 : H - 90 - alto;
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y0, 8, alto);
      ctx.fillStyle = c.nitroActivo ? '#fff3c4' : '#ffb02e';
      const h = alto * c.nitro / 100; ctx.fillRect(x, y0 + alto - h, 8, h);
      ctx.fillStyle = AUTOS[i].color; ctx.fillRect(x, y0 - 6, 8, 4);
    });
  }

  function cartel(texto, sub, color) {
    ctx.fillStyle = 'rgba(5,10,8,.55)'; ctx.fillRect(0, H / 2 - 70, W, sub ? 140 : 110);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 64px system-ui, sans-serif'; ctx.fillStyle = color || '#fff';
    ctx.fillText(texto, W / 2, H / 2 - (sub ? 14 : 0) - 15);
    if (sub) { ctx.font = '600 18px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(sub, W / 2, H / 2 + 42); }
  }

  function chispazo(x, y, n, col) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
      chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 20 + Math.random() * 15, col });
    }
  }

  function efectos(s) {
    for (const e of s.eventos) {
      if (e.t === 'toque' && e.fuerza > 6) chispazo(s.pelota.x, s.pelota.y, 8, '#fff');
      if (e.t === 'gol') chispazo(s.pelota.x, s.pelota.y, 60, AUTOS[e.quien].color);
      if (e.t === 'nitro') { const c = s.autos[e.quien]; chispazo(c.x, c.y, e.grande ? 18 : 6, '#ffb02e'); }
    }
    for (let k = chispas.length - 1; k >= 0; k--) {
      const p = chispas[k]; p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94;
      if (--p.vida <= 0) { chispas.splice(k, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.vida / 20); ctx.fillStyle = p.col; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function limpiarMarcas() { mctx.clearRect(0, 0, W, H); }

  function dibujar(s, extra = {}) {
    cancha(s);
    pastillas(s);
    s.autos.forEach((c, i) => auto(c, AUTOS[i]));
    pelota(s.pelota);
    efectos(s);
    hud(s);
    if (extra.portada) return portada();
    if (extra.pausa) return cartel('Pausa', 'Esc sigue · R reinicia');
    if (s.fase === 'cuenta') {
      const n = Math.ceil(s.reloj / FPS);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 96px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillText(n, W / 2, H / 2);
    } else if (s.fase === 'gol' && s.ganador < 0) {
      cartel('¡GOL!', `del ${AUTOS[s.ultimoGol].nombre.toLowerCase()}`, AUTOS[s.ultimoGol].color);
    } else if (s.fase === 'gol' || s.fase === 'fin') {
      const g = AUTOS[s.ganador];
      cartel(`Ganó el ${g.nombre.toLowerCase()}`, `${s.autos[0].goles} a ${s.autos[1].goles} · Enter para la revancha`, g.color);
    }
  }

  function portada() {
    ctx.fillStyle = 'rgba(5,10,8,.78)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 58px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('AUTOBOL', W / 2, 170);
    ctx.font = '600 15px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('Programación II · 2016, revivido en 2026', W / 2, 212);
    const fila = (y, col, titulo, lineas) => {
      ctx.fillStyle = col; ctx.font = '700 20px system-ui, sans-serif'; ctx.fillText(titulo, W / 2, y);
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.font = '500 16px system-ui, sans-serif';
      lineas.forEach((l, k) => ctx.fillText(l, W / 2, y + 28 + k * 22));
    };
    fila(290, AUTOS[0].color, 'Azul · más ágil', ['W A S D para manejar', 'Shift izq. o C: freno de mano', 'Espacio o V: nitro']);
    fila(430, AUTOS[1].color, 'Rojo · más rápido', ['Flechas para manejar', 'Shift der. o punto: freno de mano', 'Ctrl der. o barra: nitro']);
    ctx.fillStyle = '#ffb02e'; ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(`Gana el primero en hacer ${GOLES_PARA_GANAR} goles`, W / 2, 570);
    ctx.fillStyle = '#fff'; ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText((Date.now() / 500 | 0) % 2 ? 'Enter para jugar' : '', W / 2, 625);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText('Esc pausa · M sonido', W / 2, 668);
  }

  return { dibujar, limpiarMarcas };
}
