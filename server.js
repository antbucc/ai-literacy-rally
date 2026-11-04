'use strict';
/* ============================================================
   Rally dell'AI — server di gioco.
   - Node puro + 'qrcode'. Stato in memoria, salvato su disco se DATA_DIR è impostata.
   - I client ricevono lo stato con SSE (/api/flusso) e agiscono con POST.
   - Il proiettore (/host) comanda il gioco con il PIN di regia.
   - Le partite stanno in contenuti/sessioni/*.json (una per ogni pausa del corso).
   ============================================================ */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const PORT = Number(process.env.PORT) || 3000;
const PIN = String(process.env.HOST_PIN || '1234');
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const CARTELLA_CONTENUTI = process.env.CONTENUTI || path.join(__dirname, 'contenuti');
const CARTELLA_PUBBLICA = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || '';
const MAX_GIOCATORI = 300;

const CONFIG = JSON.parse(fs.readFileSync(path.join(CARTELLA_CONTENUTI, 'config.json'), 'utf8'));
const TEMPI = Object.assign(
  { quiz: 30, umano_ai: 45, sala: 25, sincronia: 25, vero_falso: 45, ordina: 40, stima: 30, smista: 40, trovarsi: 90, pronti: 5 },
  CONFIG.tempi || {}
);

/** Le partite, una per file, in ordine di nome. */
const SESSIONI = fs.readdirSync(path.join(CARTELLA_CONTENUTI, 'sessioni'))
  .filter((f) => f.endsWith('.json')).sort()
  .map((f) => {
    const s = JSON.parse(fs.readFileSync(path.join(CARTELLA_CONTENUTI, 'sessioni', f), 'utf8'));
    s.file = f;
    return s;
  });
if (!SESSIONI.length) throw new Error('Nessuna partita in contenuti/sessioni');

const SQUADRE = [
  { id: 'volpi', nome: 'Volpi', articolo: 'le', specie: 'volpe', animale: '🦊', colore: '#5FA8E0' },
  { id: 'gufi', nome: 'Gufi', articolo: 'i', specie: 'gufo', animale: '🦉', colore: '#F2C14E' },
  { id: 'rane', nome: 'Rane', articolo: 'le', specie: 'rana', animale: '🐸', colore: '#EE7FA8' },
  { id: 'panda', nome: 'Panda', articolo: 'i', specie: 'panda', animale: '🐼', colore: '#7CC46A' },
  { id: 'pinguini', nome: 'Pinguini', articolo: 'i', specie: 'pinguino', animale: '🐧', colore: '#F08A4B' },
  { id: 'gatti', nome: 'Gatti', articolo: 'i', specie: 'gatto', animale: '🐱', colore: '#A98BE0' },
];
// Modalità singoli (per le prove): ognuno è una "squadra" da uno, con il suo animale.
const SPECIE_SINGOLI = [
  ['volpe', '🦊'], ['gufo', '🦉'], ['rana', '🐸'], ['panda', '🐼'], ['pinguino', '🐧'], ['gatto', '🐱'],
  ['coniglio', '🐰'], ['maiale', '🐷'], ['topo', '🐭'], ['koala', '🐨'], ['tigre', '🐯'], ['pulcino', '🐤'],
];
const COLORI_SINGOLI = ['#F08A4B', '#A98BE0', '#7CC46A', '#5FA8E0', '#EE7FA8', '#F2C14E', '#4FC1B0', '#E5604D'];

const BONUS_INCONTRO = 50;
const PREMI = [100, 70, 50, 35, 20, 10];
const TURBO = [60, 30];
const LIMITE_MG = { tap: 400, riflessi: 1800, sequenza: 60 };
const TIPI_INDICE = ['quiz', 'umano_ai', 'sala', 'sincronia'];
const TIPI_LISTA = ['vero_falso', 'ordina', 'smista'];

/* ---------------------------------------------------------- stato del corso (dura tra le partite) */

const giocatori = new Map(); // token -> { token, nome, squadra, bot, conn }
const campionato = new Map(); // token -> { punti, partite, vittorie }
const coppie = new Map(); // "a|b" -> quante volte hanno giocato insieme
let partiteGiocate = []; // { sessione, titolo, data }
let MODO = process.env.MODALITA === 'singoli' ? 'singoli' : 'squadre';
let sessioneCorrente = 0;
const singoli = () => MODO === 'singoli';

/* ---------------------------------------------------------- passi della partita scelta */

let PASSI = [];
let MAX_PUNTI = 1;
let INIZIO_TAPPE = [];
const sessione = () => SESSIONI[sessioneCorrente];
const molt = (ti) => (ti != null && sessione().tappe[ti].doppi ? 2 : 1);
const vale = (p) => (p.k === 'domanda' || p.k === 'minigioco' ? 100 * molt(p.ti) : 0);

function preparaSessione(i) {
  sessioneCorrente = Math.max(0, Math.min(i, SESSIONI.length - 1));
  PASSI = [{ k: 'lobby' }, { k: 'squadre' }];
  sessione().tappe.forEach((t, ti) => {
    PASSI.push({ k: 'tappa', ti });
    (t.round || []).forEach((r) => {
      const k = r.tipo === 'minigioco' ? 'minigioco' : r.tipo === 'turbo' ? 'turbo' : 'domanda';
      const p = { k, ti, r };
      // per "metti in ordine" l'ordine mostrato è lo stesso per tutti, mescolato una volta
      if (r.tipo === 'ordina') p.mescolati = mescolaDiverso(r.elementi.length);
      PASSI.push(p);
    });
  });
  PASSI.push({ k: 'podio' });
  MAX_PUNTI = PASSI.reduce((s, p) => s + vale(p), BONUS_INCONTRO);
  let acc = BONUS_INCONTRO;
  INIZIO_TAPPE = sessione().tappe.map((t, ti) => {
    const inizio = acc / MAX_PUNTI;
    PASSI.forEach((p) => { if (p.ti === ti) acc += vale(p); });
    return inizio;
  });
}

/* ---------------------------------------------------------- stato della partita */

let G;
function nuovoGioco() {
  G = {
    passo: 0, sub: null, deadline: null,
    squadre: [], confermati: new Set(), risposte: new Map(), mg: new Map(),
    esito: null, storico: [], inizio: null, nuoveCoppie: 0, registrata: false,
  };
  for (const g of giocatori.values()) g.squadra = null;
}

const passo = () => PASSI[G.passo];
const presente = (g) => g && (g.bot || g.conn > 0);
function mescola(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Un mescolamento in cui nessun elemento resta al suo posto (altrimenti si regalano punti). */
function mescolaDiverso(n) {
  for (let t = 0; t < 50; t++) {
    const m = mescola([...Array(n).keys()]);
    if (m.every((x, i) => x !== i)) return m;
  }
  return [...Array(n).keys()].reverse();
}
const chiaveCoppia = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

let contaIdentita = 0;
function squadraSingola(g) {
  const i = contaIdentita++;
  const [specie, animale] = SPECIE_SINGOLI[i % SPECIE_SINGOLI.length];
  return {
    id: 'g' + i, nome: g.nome, specie, animale,
    colore: COLORI_SINGOLI[(i * 5 + Math.floor(i / SPECIE_SINGOLI.length)) % COLORI_SINGOLI.length],
    membri: [g.token], punti: 0,
  };
}

/**
 * Forma le squadre. Per far conoscere persone nuove a ogni partita, prova molti
 * mescolamenti e sceglie quello con meno coppie che hanno già giocato insieme.
 */
function formaSquadre() {
  const lista = [...giocatori.values()].filter(presente);
  if (singoli()) {
    contaIdentita = 0;
    G.squadre = mescola(lista).map((g) => { const s = squadraSingola(g); g.squadra = s.id; return s; });
    G.nuoveCoppie = 0;
    return;
  }
  const n = lista.length <= 3 ? Math.max(1, lista.length) : Math.max(2, Math.ceil(lista.length / 6));
  const k = Math.min(n, SQUADRE.length);
  let migliore = null;
  let costoMigliore = Infinity;
  for (let prova = 0; prova < 400 && costoMigliore > 0; prova++) {
    const ordine = mescola(lista.slice());
    const gruppi = Array.from({ length: k }, () => []);
    ordine.forEach((g, i) => gruppi[i % k].push(g.token));
    let costo = 0;
    for (const gr of gruppi) for (let a = 0; a < gr.length; a++) for (let b = a + 1; b < gr.length; b++) costo += coppie.get(chiaveCoppia(gr[a], gr[b])) || 0;
    if (costo < costoMigliore) { costoMigliore = costo; migliore = gruppi; }
  }
  const colori = mescola(SQUADRE.slice()).slice(0, k);
  G.squadre = colori.map((s, i) => ({ ...s, membri: migliore ? migliore[i] : [], punti: 0 }));
  G.nuoveCoppie = 0;
  for (const s of G.squadre) {
    for (const t of s.membri) giocatori.get(t).squadra = s.id;
    for (let a = 0; a < s.membri.length; a++) {
      for (let b = a + 1; b < s.membri.length; b++) {
        const c = chiaveCoppia(s.membri[a], s.membri[b]);
        if (!coppie.get(c)) G.nuoveCoppie++;
        coppie.set(c, (coppie.get(c) || 0) + 1);
      }
    }
  }
  salva();
}

/** Chi arriva a gioco iniziato va nella squadra più piccola. */
function assegnaTardivo(g) {
  if (!G.squadre.length || g.squadra) return;
  if (singoli()) {
    const nuova = squadraSingola(g);
    G.squadre.push(nuova);
    g.squadra = nuova.id;
    return;
  }
  const s = [...G.squadre].sort((a, b) => a.membri.length - b.membri.length)[0];
  s.membri.push(g.token);
  g.squadra = s.id;
}

/** Membri che contano per i punti: presenti, o che hanno comunque giocato questo round. */
function attivi(s) {
  return s.membri.filter((t) => presente(giocatori.get(t)) || G.risposte.has(t) || G.mg.has(t));
}
const tuttiInGioco = () => G.squadre.flatMap((s) => s.membri).filter((t) => presente(giocatori.get(t)));

/* ---------------------------------------------------------- avanzamento */

function vai(i) {
  i = Math.max(0, Math.min(i, PASSI.length - 1));
  if (passo().k === 'squadre' && G.sub === 'cerca') chiudi();
  G.passo = i;
  const p = passo();
  G.sub = null; G.deadline = null; G.esito = null;
  G.risposte = new Map(); G.mg = new Map();
  const ora = Date.now();
  switch (p.k) {
    case 'squadre':
      formaSquadre();
      G.confermati = new Set();
      G.inizio = G.inizio || ora;
      if (singoli()) { G.sub = 'fatto'; G.esito = { bonus: {} }; }
      else { G.sub = 'cerca'; G.deadline = ora + TEMPI.trovarsi * 1000; }
      break;
    case 'domanda':
      G.sub = 'aperta';
      G.deadline = ora + (p.r.tempo || TEMPI[p.r.tipo] || 30) * 1000;
      break;
    case 'minigioco':
      G.sub = 'pronti';
      G.deadline = ora + TEMPI.pronti * 1000;
      break;
    case 'turbo':
      G.esito = applicaTurbo();
      G.sub = 'esito';
      break;
    case 'podio':
      G.esito = classificaFinale();
      registraPartita();
      G.sub = 'esito';
      break;
  }
  azioniBot();
  trasmetti();
}

/** Chiude la parte "aperta" del passo corrente. Restituisce false se non c'era niente da chiudere. */
function chiudi() {
  const p = passo();
  if (p.k === 'squadre' && G.sub === 'cerca') {
    const bonus = {};
    G.squadre.forEach((s) => {
      const m = s.membri.length;
      const c = s.membri.filter((t) => G.confermati.has(t)).length;
      const pt = m ? Math.round((BONUS_INCONTRO * c) / m) : 0;
      s.punti += pt;
      bonus[s.id] = pt;
    });
    G.esito = { bonus };
    G.sub = 'fatto';
  } else if (p.k === 'domanda' && G.sub === 'aperta') {
    G.esito = esitoDomanda(p);
    applica(G.esito.perSquadra);
    G.storico.push({ tappa: p.ti, tipo: tipoEffettivo(p.r), testo: testoRound(p.r), esito: G.esito, r: p.r });
    G.sub = 'esito';
  } else if (p.k === 'minigioco' && G.sub === 'pronti') {
    G.sub = 'gioco';
    G.deadline = Date.now() + (p.r.durata || 20) * 1000;
    azioniBot();
    trasmetti();
    return true;
  } else if (p.k === 'minigioco' && G.sub === 'gioco') {
    G.esito = esitoMinigioco(p);
    applica(G.esito.perSquadra);
    G.sub = 'esito';
  } else {
    return false;
  }
  G.deadline = null;
  trasmetti();
  return true;
}

function avanti() { if (!chiudi()) vai(G.passo + 1); }

function applica(perSquadra) {
  G.squadre.forEach((s) => { if (perSquadra[s.id]) s.punti += perSquadra[s.id].punti; });
}

/* ---------------------------------------------------------- punteggi */

/** Da soli la "sintonia di squadra" non ha senso: diventa "indovina la maggioranza". */
const tipoEffettivo = (r) => (singoli() && r.tipo === 'sincronia' ? 'sala' : r.tipo);
const testoRound = (r) => r.testo || (r.tipo === 'vero_falso' ? 'Raffica: vero o falso?' : '');

/** Quanto ha fatto bene un giocatore in un round "a risposta giusta" (da 0 a 1). */
function quotaGiusta(r, a) {
  if (a == null) return 0;
  switch (r.tipo) {
    case 'quiz': case 'umano_ai': return a === r.corretta ? 1 : 0;
    case 'vero_falso': return r.affermazioni.filter((x, i) => a[i] === x.vero).length / r.affermazioni.length;
    case 'ordina': return a.filter((x, i) => x === i).length / r.elementi.length;
    case 'smista': return r.elementi.filter((x, i) => a[i] === x.categoria).length / r.elementi.length;
    default: return 0;
  }
}

/** Una risposta è completa quando il giocatore ha finito (serve per chiudere prima il round). */
function completa(r, a) {
  if (a == null) return false;
  if (r.tipo === 'vero_falso' || r.tipo === 'smista') return Array.isArray(a) && a.every((x) => x != null);
  return true;
}

/** Punti per posizione: premi fissi a squadre, scala da 100 a 10 da soli. */
function premiPerRango(valori, crescente) {
  // valori: [{ id, v }] con v numerico (null = nessun valore)
  const ord = valori.filter((x) => x.v != null).sort((a, b) => (crescente ? a.v - b.v : b.v - a.v));
  const out = {};
  let rango = 0;
  ord.forEach((x, i) => {
    if (i > 0 && x.v !== ord[i - 1].v) rango = i;
    const base = singoli()
      ? Math.round(100 - (rango * 90) / Math.max(1, ord.length - 1))
      : PREMI[Math.min(rango, PREMI.length - 1)];
    out[x.id] = { base, posto: rango + 1 };
  });
  return out;
}

function mediana(v) {
  if (!v.length) return null;
  const s = v.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function esitoDomanda(p) {
  const r = { ...p.r, tipo: tipoEffettivo(p.r) };
  const m = molt(p.ti);
  const risposte = [...G.risposte.values()];
  const tot = risposte.length;
  const perSquadra = {};
  const es = { tot, perSquadra };

  if (TIPI_INDICE.includes(r.tipo)) {
    const conteggi = r.opzioni.map(() => 0);
    for (const a of risposte) conteggi[a]++;
    const max = Math.max(0, ...conteggi);
    const maggioranza = tot ? conteggi.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0) : [];
    es.conteggi = conteggi;
    if (r.tipo === 'quiz' || r.tipo === 'umano_ai') es.corretta = r.corretta;
    if (r.tipo === 'sala') es.maggioranza = maggioranza;
    for (const s of G.squadre) {
      const att = attivi(s);
      const n = att.length;
      let frac = 0;
      let accordo = null;
      if (r.tipo === 'quiz' || r.tipo === 'umano_ai') {
        if (n) frac = att.filter((t) => G.risposte.get(t) === r.corretta).length / n;
      } else if (r.tipo === 'sala') {
        if (n) frac = att.filter((t) => maggioranza.includes(G.risposte.get(t))).length / n;
      } else {
        const cc = {};
        att.forEach((t) => { const a = G.risposte.get(t); if (a != null) cc[a] = (cc[a] || 0) + 1; });
        const mod = Math.max(0, ...Object.values(cc));
        if (n === 1) { frac = mod ? 0.5 : 0; accordo = mod ? 'solo' : 'nessuna'; }
        else if (n > 1) {
          frac = mod >= 2 ? mod / n : 0;
          accordo = mod === n ? 'tutti' : mod >= 2 ? 'quasi' : mod ? 'diverse' : 'nessuna';
        }
      }
      perSquadra[s.id] = { punti: Math.round(100 * frac * m), frac, accordo };
    }
  } else if (TIPI_LISTA.includes(r.tipo)) {
    // media delle quote di ogni giocatore attivo (chi non risponde vale 0)
    for (const s of G.squadre) {
      const att = attivi(s);
      const frac = att.length ? att.reduce((a, t) => a + quotaGiusta(r, G.risposte.get(t)), 0) / att.length : 0;
      perSquadra[s.id] = { punti: Math.round(100 * frac * m), frac };
    }
    // quanto è andata la sala su ogni elemento
    const elenco = r.tipo === 'vero_falso' ? r.affermazioni : r.elementi;
    es.giusti = elenco.map((x, i) => {
      const date = risposte.filter((a) => a && a[i] != null);
      const ok = date.filter((a) => (r.tipo === 'vero_falso' ? a[i] === x.vero : r.tipo === 'smista' ? a[i] === x.categoria : a[i] === i)).length;
      return date.length ? Math.round((100 * ok) / date.length) : 0;
    });
    if (r.tipo === 'ordina') es.perfetti = risposte.filter((a) => quotaGiusta(r, a) === 1).length;
    es.media = tot ? Math.round((100 * risposte.reduce((a, x) => a + quotaGiusta(r, x), 0)) / tot) : 0;
  } else if (r.tipo === 'stima') {
    es.valore = r.valore;
    const valori = G.squadre.map((s) => {
      const v = attivi(s).map((t) => G.risposte.get(t)).filter((x) => x != null);
      const med = mediana(v);
      return { id: s.id, med, v: med == null ? null : Math.abs(med - r.valore) };
    });
    const premi = premiPerRango(valori, true);
    for (const x of valori) {
      const pr = premi[x.id];
      perSquadra[x.id] = { punti: pr ? Math.round(pr.base * m) : 0, mediana: x.med, posto: pr ? pr.posto : null };
    }
    es.mediaSala = tot ? risposte.reduce((a, b) => a + b, 0) / tot : null;
  }
  return es;
}

function esitoMinigioco(p) {
  const m = molt(p.ti);
  const valori = G.squadre.map((s) => {
    const v = s.membri.filter((t) => G.mg.has(t)).map((t) => G.mg.get(t));
    const media = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    return { id: s.id, v: media > 0 ? media : null, media };
  });
  const premi = premiPerRango(valori, false);
  const perSquadra = {};
  for (const x of valori) {
    const pr = premi[x.id];
    perSquadra[x.id] = { punti: pr ? Math.round(pr.base * m) : 0, media: x.media, posto: pr ? pr.posto : null };
  }
  return { perSquadra };
}

function applicaTurbo() {
  const ord = [...G.squadre].sort((a, b) => b.punti - a.punti);
  const bonus = {};
  if (ord.length >= 2) {
    const capo = ord[0].punti;
    for (let k = 0; k < TURBO.length && k < ord.length - 1; k++) {
      const s = ord[ord.length - 1 - k];
      const b = Math.max(0, Math.min(TURBO[k], capo - s.punti));
      if (b) { s.punti += b; bonus[s.id] = b; }
    }
  }
  return { bonus };
}

function classificaFinale() {
  const ord = [...G.squadre].sort((a, b) => b.punti - a.punti);
  let posto = 0;
  const classifica = ord.map((s, i) => {
    if (i > 0 && s.punti < ord[i - 1].punti) posto = i;
    return { id: s.id, posto: posto + 1 };
  });
  // quanto è andata la sala, round per round
  const misurabili = G.storico.map((x) => {
    const e = x.esito;
    if (e.corretta != null) return e.tot ? { testo: x.testo, p: e.conteggi[e.corretta] / e.tot } : null;
    if (e.media != null) return e.tot ? { testo: x.testo, p: e.media / 100 } : null;
    return null;
  }).filter(Boolean);
  const difficile = misurabili.length ? misurabili.reduce((a, b) => (b.p < a.p ? b : a)) : null;
  return {
    classifica,
    stat: {
      giocatori: G.squadre.reduce((n, s) => n + s.membri.length, 0),
      risposte: G.storico.reduce((n, x) => n + x.esito.tot, 0),
      mediaCorrette: misurabili.length ? Math.round((100 * misurabili.reduce((a, b) => a + b.p, 0)) / misurabili.length) : null,
      difficile: difficile ? { testo: difficile.testo, p: Math.round(100 * difficile.p) } : null,
      minuti: G.inizio ? Math.max(1, Math.round((Date.now() - G.inizio) / 60000)) : 0,
      nuoveCoppie: G.nuoveCoppie,
    },
  };
}

/** A fine partita ogni giocatore guadagna nel campionato del corso i punti della sua squadra. */
function registraPartita() {
  if (G.registrata || !G.squadre.length) return;
  G.registrata = true;
  const posti = {};
  G.esito.classifica.forEach((c) => { posti[c.id] = c.posto; });
  for (const s of G.squadre) {
    for (const t of s.membri) {
      const g = giocatori.get(t);
      if (!g || g.bot) continue;
      const c = campionato.get(t) || { punti: 0, partite: 0, vittorie: 0 };
      c.punti += s.punti;
      c.partite += 1;
      if (posti[s.id] === 1) c.vittorie += 1;
      campionato.set(t, c);
    }
  }
  partiteGiocate.push({ sessione: sessione().file, titolo: sessione().titolo, data: new Date().toISOString() });
  salva();
}

function classificaCorso(max) {
  const righe = [...campionato.entries()]
    .filter(([t]) => giocatori.has(t))
    .map(([t, c]) => ({ token: t, nome: giocatori.get(t).nome, ...c }))
    .sort((a, b) => b.punti - a.punti);
  let posto = 0;
  righe.forEach((r, i) => { if (i > 0 && r.punti < righe[i - 1].punti) posto = i; r.posto = posto + 1; });
  return max ? righe.slice(0, max) : righe;
}

/** Quando tutti hanno risposto (o confermato) il timer si accorcia. */
function controllaTutti() {
  const p = passo();
  const tutti = tuttiInGioco();
  if (!tutti.length || !G.deadline) return;
  if (p.k === 'domanda' && G.sub === 'aperta' && tutti.every((t) => completa(p.r, G.risposte.get(t)))) {
    G.deadline = Math.min(G.deadline, Date.now() + 1500);
  }
  if (p.k === 'squadre' && G.sub === 'cerca' && tutti.every((t) => G.confermati.has(t))) {
    G.deadline = Math.min(G.deadline, Date.now() + 2500);
  }
}

setInterval(() => {
  if (!G.deadline) return;
  const p = passo();
  // per i minigiochi un attimo di tolleranza per gli ultimi punteggi in arrivo
  const margine = p.k === 'minigioco' && G.sub === 'gioco' ? 1500 : 0;
  if (Date.now() >= G.deadline + margine) chiudi();
}, 250);

/* ---------------------------------------------------------- giocatori automatici (prove) */

const NOMI_BOT = ['Ada', 'Alan', 'Grace', 'Marvin', 'Fei-Fei', 'Geoffrey', 'Yann', 'Timnit', 'Joy', 'Kate', 'Yoshua', 'Margaret', 'Barbara', 'Hedy', 'Katherine', 'Tim'];
let contaBot = 0;

function aggiungiBot(k) {
  for (let i = 0; i < k && giocatori.size < MAX_GIOCATORI; i++) {
    const token = 'bot-' + crypto.randomBytes(6).toString('hex');
    const g = { token, nome: NOMI_BOT[contaBot % NOMI_BOT.length] + ' 🤖', bot: true, conn: 0, squadra: null };
    contaBot++;
    giocatori.set(token, g);
    assegnaTardivo(g);
  }
  trasmetti();
}

/** Una risposta plausibile per un bot, a volte giusta e a volte no. */
function rispostaBot(r) {
  const bravo = () => Math.random() < 0.6;
  switch (r.tipo) {
    case 'quiz': case 'umano_ai': return bravo() ? r.corretta : Math.floor(Math.random() * r.opzioni.length);
    case 'sala': case 'sincronia': return Math.floor(Math.random() * r.opzioni.length);
    case 'vero_falso': return r.affermazioni.map((x) => (bravo() ? x.vero : !x.vero));
    case 'smista': return r.elementi.map((x) => (bravo() ? x.categoria : Math.floor(Math.random() * r.categorie.length)));
    case 'ordina': return bravo() ? r.elementi.map((_, i) => i) : mescola(r.elementi.map((_, i) => i));
    case 'stima': {
      const v = r.valore + (Math.random() - 0.5) * (r.max - r.min) * 0.5;
      return Math.max(r.min, Math.min(r.max, Math.round(v)));
    }
    default: return null;
  }
}

function azioniBot() {
  const p = passo();
  const fermo = G.passo;
  const sub = G.sub;
  const bots = [...giocatori.values()].filter((g) => g.bot && g.squadra);
  const dopo = (ms, fn) => setTimeout(() => {
    if (G.passo === fermo && G.sub === sub) { fn(); controllaTutti(); trasmetti(); }
  }, ms);
  if (p.k === 'squadre' && sub === 'cerca') {
    bots.forEach((b) => dopo(2000 + Math.random() * 12000, () => G.confermati.add(b.token)));
  } else if (p.k === 'domanda' && sub === 'aperta') {
    const durata = G.deadline - Date.now();
    const r = { ...p.r, tipo: tipoEffettivo(p.r) };
    bots.forEach((b) => dopo(1500 + Math.random() * durata * 0.6, () => G.risposte.set(b.token, rispostaBot(r))));
  } else if (p.k === 'minigioco' && sub === 'gioco') {
    bots.forEach((b) => dopo(3000 + Math.random() * 5000, () => {
      const v = { tap: 40 + Math.random() * 60, riflessi: 400 + Math.random() * 800, sequenza: 2 + Math.random() * 6 }[p.r.gioco] || 0;
      G.mg.set(b.token, Math.round(v));
    }));
  }
}

function togliBot() {
  for (const [t, g] of giocatori) if (g.bot) giocatori.delete(t);
}

/* ---------------------------------------------------------- viste */

function squadraPubblica(s) {
  return {
    id: s.id, nome: s.nome, articolo: s.articolo || '', animale: s.animale, specie: s.specie, colore: s.colore, punti: s.punti,
    progresso: Math.min(1, s.punti / MAX_PUNTI),
    membri: s.membri.map((t) => {
      const g = giocatori.get(t);
      return { nome: g ? g.nome : '?', ok: G.confermati.has(t), online: presente(g) };
    }),
  };
}

/** Il round come lo vedono i giocatori: le soluzioni compaiono solo all'esito. */
function roundPubblico(p, conSoluzioni) {
  const r = p.r;
  const tipo = tipoEffettivo(r);
  const d = { tipo, testo: testoRound(r), brani: r.brani || null, immagine: r.immagine || null };
  if (r.opzioni) d.opzioni = r.opzioni;
  if (r.tipo === 'vero_falso') d.affermazioni = r.affermazioni.map((x) => (conSoluzioni ? { testo: x.testo, vero: x.vero } : { testo: x.testo }));
  if (r.tipo === 'smista') {
    d.categorie = r.categorie;
    d.elementi = r.elementi.map((x) => (conSoluzioni ? { testo: x.testo, categoria: x.categoria } : { testo: x.testo }));
  }
  if (r.tipo === 'ordina') {
    d.mescolati = p.mescolati.map((i) => ({ i, testo: r.elementi[i] }));
    if (conSoluzioni) d.elementi = r.elementi;
  }
  if (r.tipo === 'stima') {
    Object.assign(d, { unita: r.unita, min: r.min, max: r.max, passo: r.passo || null });
    if (conSoluzioni) d.valore = r.valore;
  }
  return d;
}

function vistaBase() {
  const p = passo();
  const sess = sessione();
  const v = {
    ts: Date.now(),
    titolo: CONFIG.titolo, sottotitolo: CONFIG.sottotitolo,
    fase: p.k, sub: G.sub, deadline: G.deadline, passo: G.passo, modo: MODO,
    sessione: { indice: sessioneCorrente, n: SESSIONI.length, titolo: sess.titolo, tema: sess.tema || '', giocate: partiteGiocate.length },
    nTappe: sess.tappe.length, inizioTappe: INIZIO_TAPPE,
    squadre: G.squadre.map(squadraPubblica),
    collegati: [...giocatori.values()].filter(presente).length,
  };
  if (p.ti != null) {
    const t = sess.tappe[p.ti];
    v.tappa = { indice: p.ti, nome: t.nome, sotto: t.sotto || '', doppi: !!t.doppi };
  }
  if (p.k === 'lobby') {
    v.nomi = [...giocatori.values()].filter(presente).map((g) => g.nome);
    v.corso = classificaCorso(5).map(({ nome, punti, posto }) => ({ nome, punti, posto }));
  }
  if (p.k === 'squadre') v.incontro = G.esito;
  if (p.k === 'domanda') {
    const finito = G.sub === 'esito';
    v.domanda = roundPubblico(p, finito);
    v.domanda.risposte = [...G.risposte.values()].filter((a) => completa(p.r, a)).length;
    v.domanda.attesi = tuttiInGioco().length;
    if (finito) Object.assign(v.domanda, { esito: G.esito, spiegazione: p.r.spiegazione || null, spunto: p.r.spunto || null });
  }
  if (p.k === 'minigioco') {
    const r = p.r;
    v.minigioco = {
      gioco: r.gioco, nome: r.nome, come: r.come, durata: r.durata,
      inviati: G.mg.size, attesi: tuttiInGioco().length,
      esito: G.sub === 'esito' ? G.esito : null,
    };
  }
  if (p.k === 'turbo') v.turbo = G.esito;
  if (p.k === 'podio') {
    v.podio = G.esito;
    v.corso = classificaCorso(5).map(({ nome, punti, posto }) => ({ nome, punti, posto }));
  }
  return v;
}

function vistaGiocatore(base, g) {
  const t = g.token;
  const p = passo();
  const a = G.risposte.has(t) ? G.risposte.get(t) : null;
  const me = {
    nome: g.nome, squadra: g.squadra, confermato: G.confermati.has(t),
    risposta: a, mg: G.mg.has(t) ? G.mg.get(t) : null,
  };
  if (p.k === 'domanda' && G.sub === 'esito' && TIPI_LISTA.includes(p.r.tipo)) {
    const elenco = p.r.tipo === 'vero_falso' ? p.r.affermazioni : p.r.elementi;
    me.giuste = Math.round(quotaGiusta(p.r, a) * elenco.length);
    me.su = elenco.length;
  }
  if (p.k === 'podio' || p.k === 'lobby') {
    const c = classificaCorso().find((x) => x.token === t);
    if (c) me.corso = { punti: c.punti, posto: c.posto, su: campionato.size, partite: c.partite, vittorie: c.vittorie };
  }
  return { ...base, me };
}

/* ---------------------------------------------------------- flussi SSE */

const flussiHost = new Set();
const flussiGiocatori = new Map(); // token -> Set(res)
let trasmissionePronta = false;

function trasmetti() {
  if (trasmissionePronta) return;
  trasmissionePronta = true;
  setTimeout(() => {
    trasmissionePronta = false;
    const base = vistaBase();
    const dati = 'data: ' + JSON.stringify(base) + '\n\n';
    for (const res of flussiHost) res.write(dati);
    for (const [t, set] of flussiGiocatori) {
      if (!set.size) continue;
      const g = giocatori.get(t);
      if (!g) continue;
      const msg = 'data: ' + JSON.stringify(vistaGiocatore(base, g)) + '\n\n';
      for (const res of set) res.write(msg);
    }
  }, 40);
}

setInterval(() => {
  for (const res of flussiHost) res.write(':\n\n');
  for (const set of flussiGiocatori.values()) for (const res of set) res.write(':\n\n');
}, 15000);

function apriFlusso(req, res, q) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  if (q.get('host')) {
    flussiHost.add(res);
    req.on('close', () => flussiHost.delete(res));
    trasmetti();
    return;
  }
  const token = q.get('token');
  const g = giocatori.get(token);
  if (!g) {
    res.write('event: sconosciuto\ndata: {}\n\n');
    res.end();
    return;
  }
  g.conn++;
  if (!flussiGiocatori.has(token)) flussiGiocatori.set(token, new Set());
  const set = flussiGiocatori.get(token);
  set.add(res);
  assegnaTardivo(g);
  req.on('close', () => {
    set.delete(res);
    g.conn = Math.max(0, g.conn - 1);
    trasmetti();
  });
  trasmetti();
}

/* ---------------------------------------------------------- azioni */

function entra(corpo) {
  const nome = String(corpo.nome || '').replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!nome) return [400, { errore: 'Scrivi prima il tuo nome.' }];
  const vecchio = corpo.token && giocatori.get(corpo.token);
  if (vecchio && !vecchio.bot) { vecchio.nome = nome; trasmetti(); salva(); return [200, { token: vecchio.token }]; }
  if (giocatori.size >= MAX_GIOCATORI) return [503, { errore: 'Il gioco è pieno.' }];
  const token = crypto.randomBytes(16).toString('hex');
  giocatori.set(token, { token, nome, squadra: null, bot: false, conn: 0 });
  trasmetti();
  salva();
  return [200, { token }];
}

/** Controlla e normalizza una risposta secondo il tipo di round. */
function rispostaValida(r, v) {
  const tipo = tipoEffettivo(r);
  if (TIPI_INDICE.includes(tipo)) return Number.isInteger(v) && v >= 0 && v < r.opzioni.length ? v : undefined;
  if (tipo === 'vero_falso') {
    if (!Array.isArray(v) || v.length !== r.affermazioni.length) return undefined;
    return v.map((x) => (x === true || x === false ? x : null));
  }
  if (tipo === 'smista') {
    if (!Array.isArray(v) || v.length !== r.elementi.length) return undefined;
    return v.map((x) => (Number.isInteger(x) && x >= 0 && x < r.categorie.length ? x : null));
  }
  if (tipo === 'ordina') {
    const n = r.elementi.length;
    if (!Array.isArray(v) || v.length !== n || new Set(v).size !== n || !v.every((x) => Number.isInteger(x) && x >= 0 && x < n)) return undefined;
    return v;
  }
  if (tipo === 'stima') {
    const x = Number(v);
    return Number.isFinite(x) ? Math.max(r.min, Math.min(r.max, x)) : undefined;
  }
  return undefined;
}

function azione(corpo) {
  const g = giocatori.get(corpo.token);
  if (!g || g.bot) return [404, { errore: 'Sessione scaduta: rientra.' }];
  const p = passo();
  if (corpo.tipo === 'trovato' && p.k === 'squadre' && G.sub === 'cerca' && g.squadra) {
    if (corpo.valore === false) G.confermati.delete(g.token); else G.confermati.add(g.token);
  } else if (corpo.tipo === 'risposta' && p.k === 'domanda' && G.sub === 'aperta' && g.squadra) {
    const v = rispostaValida(p.r, corpo.valore);
    if (v === undefined) return [400, { errore: 'Risposta non valida.' }];
    G.risposte.set(g.token, v);
  } else if (corpo.tipo === 'mg' && p.k === 'minigioco' && G.sub === 'gioco' && g.squadra) {
    const v = Math.max(0, Math.min(Number(corpo.valore) || 0, LIMITE_MG[p.r.gioco] || 1000));
    G.mg.set(g.token, Math.max(G.mg.get(g.token) || 0, v));
  } else {
    return [200, { ok: false }];
  }
  controllaTutti();
  trasmetti();
  return [200, { ok: true }];
}

const tentativiPin = new Map(); // ip -> { n, fino }
function pinValido(req, pin) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const t = tentativiPin.get(ip) || { n: 0, fino: 0 };
  if (t.fino > Date.now()) return 'bloccato';
  const a = Buffer.from(String(pin || ''));
  const b = Buffer.from(PIN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) { tentativiPin.delete(ip); return 'ok'; }
  t.n++;
  if (t.n >= 8) { t.n = 0; t.fino = Date.now() + 60000; }
  tentativiPin.set(ip, t);
  return 'no';
}

function comando(req, corpo) {
  const esito = pinValido(req, corpo.pin);
  if (esito === 'bloccato') return [429, { errore: 'Troppi PIN sbagliati: aspetta un minuto.' }];
  if (esito !== 'ok') return [403, { errore: 'PIN di regia errato.' }];
  const inLobby = G.passo === 0;
  switch (corpo.cmd) {
    case 'controlla': break;
    case 'avanti': avanti(); break;
    case 'salta': vai(G.passo + 1); break;
    case 'podio': vai(PASSI.length - 1); break;
    case 'bot': aggiungiBot(Number(corpo.n) || 6); break;
    case 'reset': togliBot(); nuovoGioco(); vai(0); break;
    case 'modo':
      if (!inLobby) return [409, { errore: 'La modalità si cambia dalla schermata iniziale: premi R per ricominciare.' }];
      MODO = corpo.valore === 'singoli' || corpo.valore === 'squadre' ? corpo.valore : (singoli() ? 'squadre' : 'singoli');
      trasmetti();
      break;
    case 'sessione': {
      if (!inLobby) return [409, { errore: 'La partita si sceglie dalla schermata iniziale: premi R per ricominciare.' }];
      const v = corpo.valore;
      const i = v === '+1' ? sessioneCorrente + 1 : v === '-1' ? sessioneCorrente - 1 : Number(v);
      if (!Number.isInteger(i)) return [400, { errore: 'Partita non valida.' }];
      preparaSessione((i + SESSIONI.length) % SESSIONI.length);
      salva();
      trasmetti();
      break;
    }
    case 'azzeraCorso':
      campionato.clear(); coppie.clear(); partiteGiocate = [];
      salva(); trasmetti();
      break;
    default: return [400, { errore: 'Comando sconosciuto.' }];
  }
  return [200, { ok: true }];
}

function csvRisultati() {
  const cella = (c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"';
  const righe = [['partita', sessione().titolo], [], ['tappa', 'tipo', 'domanda', 'risposte', 'risultato_sala_%', 'dettaglio']];
  G.storico.forEach((x) => {
    const e = x.esito;
    let ris = '';
    let dett = '';
    if (e.conteggi) {
      if (e.corretta != null && e.tot) ris = Math.round((100 * e.conteggi[e.corretta]) / e.tot);
      dett = x.r.opzioni.map((o, i) => `${o}: ${e.conteggi[i]}`).join(' | ');
    } else if (e.media != null) {
      ris = e.media;
      const el = x.r.tipo === 'vero_falso' ? x.r.affermazioni.map((a) => a.testo) : x.r.elementi.map((a) => (a.testo || a));
      dett = el.map((t, i) => `${t}: ${e.giusti[i]}%`).join(' | ');
    } else if (e.valore != null) {
      dett = `valore ${e.valore}; media sala ${e.mediaSala == null ? '-' : Math.round(e.mediaSala * 10) / 10}`;
    }
    righe.push([x.tappa + 1, x.tipo, x.testo, e.tot, ris, dett]);
  });
  righe.push([]);
  righe.push(['squadra', 'punti', 'membri']);
  [...G.squadre].sort((a, b) => b.punti - a.punti).forEach((s) => righe.push([
    s.nome, s.punti, s.membri.map((t) => (giocatori.get(t) || {}).nome).join(', '),
  ]));
  righe.push([]);
  righe.push(['classifica del corso', 'punti', 'partite', 'vittorie']);
  classificaCorso().forEach((r) => righe.push([r.nome, r.punti, r.partite, r.vittorie]));
  return '﻿' + righe.map((r) => r.map(cella).join(';')).join('\r\n');
}

/* ---------------------------------------------------------- salvataggio su disco (facoltativo) */

const FILE_STATO = DATA_DIR ? path.join(DATA_DIR, 'stato.json') : null;
let timerSalva = null;
function salva() {
  if (!FILE_STATO) return;
  clearTimeout(timerSalva);
  timerSalva = setTimeout(() => {
    const dati = {
      versione: 1,
      sessioneCorrente,
      giocatori: [...giocatori.values()].filter((g) => !g.bot).map((g) => ({ token: g.token, nome: g.nome })),
      campionato: [...campionato.entries()],
      coppie: [...coppie.entries()].filter(([k]) => !k.includes('bot-')),
      partiteGiocate,
    };
    const tmp = FILE_STATO + '.tmp';
    fs.writeFile(tmp, JSON.stringify(dati), (err) => {
      if (err) return console.error('Salvataggio non riuscito:', err.message);
      fs.rename(tmp, FILE_STATO, (e) => { if (e) console.error('Salvataggio non riuscito:', e.message); });
    });
  }, 1500);
}

function carica() {
  if (!FILE_STATO) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(FILE_STATO)) return;
    const d = JSON.parse(fs.readFileSync(FILE_STATO, 'utf8'));
    for (const g of d.giocatori || []) giocatori.set(g.token, { token: g.token, nome: g.nome, squadra: null, bot: false, conn: 0 });
    for (const [k, v] of d.campionato || []) campionato.set(k, v);
    for (const [k, v] of d.coppie || []) coppie.set(k, v);
    partiteGiocate = d.partiteGiocate || [];
    if (Number.isInteger(d.sessioneCorrente)) sessioneCorrente = d.sessioneCorrente;
    console.log(`  Stato ripristinato: ${giocatori.size} giocatori, ${partiteGiocate.length} partite giocate`);
  } catch (e) {
    console.error('Lettura dello stato non riuscita:', e.message);
  }
}

/* ---------------------------------------------------------- HTTP */

function ipLocale() {
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return null;
}

function urlBase(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  let host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:' + PORT);
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0];
  if (/^(localhost|127\.0\.0\.1)(:|$)/.test(host)) {
    const ip = ipLocale();
    if (ip) host = host.replace(/^(localhost|127\.0\.0\.1)/, ip);
  }
  return proto + '://' + host;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon',
};

function json(res, stato, obj) {
  res.writeHead(stato, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function leggiCorpo(req) {
  return new Promise((ok, ko) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 20000) { ko(new Error('troppo grande')); req.destroy(); } });
    req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(e); } });
    req.on('error', ko);
  });
}

function servi(res, file) {
  const pieno = path.join(CARTELLA_PUBBLICA, file);
  if (!pieno.startsWith(CARTELLA_PUBBLICA + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(pieno, (err, dati) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Non trovato'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(pieno).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(dati);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  try {
    if (req.method === 'GET') {
      if (p === '/') return servi(res, 'index.html');
      if (p === '/host' || p === '/host/') return servi(res, 'host.html');
      if (p === '/api/flusso') return apriFlusso(req, res, u.searchParams);
      if (p === '/api/info') {
        return json(res, 200, {
          url: urlBase(req), titolo: CONFIG.titolo, sottotitolo: CONFIG.sottotitolo,
          sessioni: SESSIONI.map((s, i) => ({ indice: i, titolo: s.titolo })),
        });
      }
      if (p === '/api/qr') {
        const svg = await QRCode.toString(urlBase(req) + '/', { type: 'svg', margin: 1, color: { dark: '#2A2420', light: '#FFFFFF' } });
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=300' });
        return res.end(svg);
      }
      if (p === '/api/risultati.csv') {
        if (pinValido(req, u.searchParams.get('pin')) !== 'ok') return json(res, 403, { errore: 'PIN errato' });
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="rally-risultati.csv"' });
        return res.end(csvRisultati());
      }
      if (p === '/salute') return json(res, 200, { ok: true });
      return servi(res, p.slice(1));
    }
    if (req.method === 'POST') {
      const corpo = await leggiCorpo(req);
      if (p === '/api/entra') return json(res, ...entra(corpo));
      if (p === '/api/azione') return json(res, ...azione(corpo));
      if (p === '/api/host') return json(res, ...comando(req, corpo));
    }
    res.writeHead(404); res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 400, { errore: 'Richiesta non valida.' });
  }
});

carica();
preparaSessione(sessioneCorrente);
nuovoGioco();

server.listen(PORT, () => {
  const ip = ipLocale();
  console.log(`\n  ${CONFIG.titolo} è in pista!`);
  console.log(`  Proiettore:  http://localhost:${PORT}/host`);
  console.log(`  Telefoni:    ${PUBLIC_URL || (ip ? `http://${ip}:${PORT}` : `http://localhost:${PORT}`)}/`);
  if (PIN === '1234') console.log('  PIN di regia: 1234 (imposta HOST_PIN per cambiarlo)');
  console.log(`  ${SESSIONI.length} partite · modalità ${MODO}${FILE_STATO ? ' · stato salvato in ' + FILE_STATO : ''}\n`);
});
