/* ============================================================
   Musica ed effetti sonori del proiettore, sintetizzati con Web Audio:
   nessun file audio, nessun problema di diritti.
   - Suono.avvia(): da chiamare al primo tasto o clic (regola dei browser).
   - Suono.musica(on): accende o spegne la musica di sottofondo.
   - Suono.atmosfera('festa'|'pensiero'|'gioco'): cambia il volume del brano.
   - Suono.effetto('via'|'ding'|'tic'|'turbo'|'fanfara'|'whoosh').
   ============================================================ */
(function () {
  'use strict';
  var ctx = null;
  var master = null;
  var busMusica = null;
  var busEffetti = null;
  var musicaAccesa = true;
  var timer = null;
  var prossimo = 0;
  var passo = 0;

  var BPM = 112;
  var CROMA = 60 / BPM / 2; // durata di un ottavo
  var VOLUMI = { festa: 0.5, pensiero: 0.22, gioco: 0.6 };
  var atmosferaAttuale = 'festa';

  // giro armonico in Fa: Fa - Rem - Sib - Do (I vi IV V), un accordo per battuta
  var ACCORDI = [
    [53, 57, 60], // Fa
    [50, 53, 57], // Re minore
    [46, 50, 53], // Si bemolle
    [48, 52, 55], // Do
  ];
  var BASSI = [41, 38, 34, 36];
  // due melodie di 4 battute (8 ottavi a battuta, null = pausa), alternate
  var MELODIE = [
    [72, null, 69, 72, 74, null, 72, 69, 69, null, 65, 69, 72, null, 69, null,
     70, null, 69, 65, 62, null, 65, 67, 67, 69, 67, 64, 60, null, null, null],
    [65, 67, 69, null, 72, null, 74, 72, 69, null, 72, null, 69, 65, 62, null,
     62, 65, 70, null, 69, 65, 62, null, 64, null, 67, 72, 70, 67, 64, null],
  ];

  var freq = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  function crea() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    var comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    busMusica = ctx.createGain();
    busMusica.gain.value = musicaAccesa ? VOLUMI[atmosferaAttuale] : 0;
    busMusica.connect(master);
    busEffetti = ctx.createGain();
    busEffetti.gain.value = 0.9;
    busEffetti.connect(master);
  }

  /** Una nota con inviluppo semplice. */
  function nota(dest, tipo, f, t, durata, vol, filtro) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    var ultimo = g;
    if (filtro) {
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filtro;
      g.connect(lp);
      ultimo = lp;
    }
    o.connect(g);
    ultimo.connect(dest);
    o.start(t);
    o.stop(t + durata + 0.05);
  }

  var rumore = null;
  function bufferRumore() {
    if (rumore) return rumore;
    rumore = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    var d = rumore.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return rumore;
  }
  function colpo(dest, t, durata, vol, filtroTipo, filtroF) {
    var s = ctx.createBufferSource();
    s.buffer = bufferRumore();
    var f = ctx.createBiquadFilter();
    f.type = filtroTipo;
    f.frequency.value = filtroF;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t);
    s.stop(t + durata + 0.02);
  }
  function cassa(t) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(busMusica);
    o.start(t); o.stop(t + 0.2);
  }

  /** Programma un ottavo del brano. */
  function suonaPasso(i, t) {
    var battuta = Math.floor(i / 8) % 4;
    var inBattuta = i % 8;
    var giro = Math.floor(i / 32) % 2;
    var acc = ACCORDI[battuta];
    // basso: tempi 1 e 3, più un passaggio all'ottava
    if (inBattuta === 0 || inBattuta === 4) nota(busMusica, 'triangle', freq(BASSI[battuta]), t, CROMA * 1.8, 0.5);
    if (inBattuta === 6) nota(busMusica, 'triangle', freq(BASSI[battuta] + 12), t, CROMA * 0.9, 0.3);
    // accordi in levare, corti e morbidi
    if (inBattuta % 2 === 1) acc.forEach(function (n) { nota(busMusica, 'square', freq(n), t, CROMA * 0.6, 0.05, 1600); });
    // melodia
    var m = MELODIE[giro][(i % 32)];
    if (m != null) nota(busMusica, 'triangle', freq(m), t, CROMA * 1.5, 0.18);
    // batteria leggera
    if (inBattuta === 0 || inBattuta === 4) cassa(t);
    if (inBattuta === 2 || inBattuta === 6) colpo(busMusica, t, 0.12, 0.18, 'bandpass', 1800);
    colpo(busMusica, t, 0.04, inBattuta % 2 ? 0.05 : 0.08, 'highpass', 7000);
  }

  function programmatore() {
    while (prossimo < ctx.currentTime + 0.15) {
      suonaPasso(passo, prossimo);
      passo++;
      prossimo += CROMA;
    }
  }

  function avviaBrano() {
    if (timer || !ctx) return;
    prossimo = ctx.currentTime + 0.1;
    timer = setInterval(programmatore, 25);
  }

  function volumeMusica(v, tempo) {
    if (!busMusica) return;
    var t = ctx.currentTime;
    busMusica.gain.cancelScheduledValues(t);
    busMusica.gain.setValueAtTime(busMusica.gain.value, t);
    busMusica.gain.linearRampToValueAtTime(v, t + (tempo || 0.8));
  }

  var EFFETTI = {
    via: function (t) { [60, 64, 67, 72].forEach(function (n, k) { nota(busEffetti, 'square', freq(n + 12), t + k * 0.07, 0.18, 0.12, 3000); }); },
    ding: function (t) { nota(busEffetti, 'sine', freq(88), t, 0.5, 0.35); nota(busEffetti, 'sine', freq(95), t + 0.12, 0.8, 0.3); },
    tic: function (t) { nota(busEffetti, 'square', 1200, t, 0.05, 0.12, 4000); },
    whoosh: function (t) { colpo(busEffetti, t, 0.5, 0.25, 'bandpass', 900); },
    turbo: function (t) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2500;
      o.connect(g); g.connect(lp); lp.connect(busEffetti);
      o.start(t); o.stop(t + 0.85);
    },
    fanfara: function (t) {
      [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45]].forEach(function (x) { nota(busEffetti, 'square', freq(x[0]), t + x[1], 0.3, 0.12, 2500); });
      [60, 64, 67, 72].forEach(function (n) { nota(busEffetti, 'triangle', freq(n), t + 0.7, 1.4, 0.15); });
    },
  };

  window.Suono = {
    avviato: function () { return !!ctx && ctx.state === 'running'; },
    avvia: function () {
      crea();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      avviaBrano();
    },
    musica: function (on) {
      musicaAccesa = on == null ? !musicaAccesa : !!on;
      volumeMusica(musicaAccesa ? VOLUMI[atmosferaAttuale] : 0, 0.4);
      return musicaAccesa;
    },
    musicaAccesa: function () { return musicaAccesa; },
    atmosfera: function (nome) {
      if (!VOLUMI[nome] || nome === atmosferaAttuale) return;
      atmosferaAttuale = nome;
      if (musicaAccesa) volumeMusica(VOLUMI[nome]);
    },
    effetto: function (nome) {
      if (!ctx || ctx.state !== 'running' || !EFFETTI[nome]) return;
      EFFETTI[nome](ctx.currentTime + 0.01);
    },
  };
})();
