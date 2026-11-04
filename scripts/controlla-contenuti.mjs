#!/usr/bin/env node
/* ============================================================
   Controlla le partite in contenuti/sessioni e stampa un riepilogo
   leggibile, utile per rileggere le domande prima di usarle.

   Uso:  npm run controlla            (controllo + riepilogo)
         npm run controlla -- --breve (solo controllo)
   Esce con codice 1 se trova errori.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARTELLA = path.join(RADICE, 'contenuti', 'sessioni');
const BREVE = process.argv.includes('--breve');
const GIOCHI = ['tap', 'riflessi', 'sequenza', 'duo'];

let errori = 0;
const errore = (f, msg) => { errori++; console.log(`  ✗ ${f}: ${msg}`); };
const L = 'ABCDEF';

function controllaRound(f, r, dove) {
  const e = (m) => errore(f, `${dove} (${r.tipo}): ${m}`);
  const testo = (s) => typeof s === 'string' && s.trim().length > 0;
  switch (r.tipo) {
    case 'quiz': case 'umano_ai': case 'sala': case 'sincronia':
      if (!testo(r.testo)) e('manca il testo');
      if (!Array.isArray(r.opzioni) || r.opzioni.length < 2 || r.opzioni.length > 6) e('servono da 2 a 6 opzioni');
      if ((r.tipo === 'quiz' || r.tipo === 'umano_ai') && !(Number.isInteger(r.corretta) && r.corretta >= 0 && r.corretta < r.opzioni.length)) e('"corretta" non valida');
      break;
    case 'vero_falso':
      if (!Array.isArray(r.affermazioni) || r.affermazioni.length < 3) e('servono almeno 3 affermazioni');
      else r.affermazioni.forEach((a, i) => { if (!testo(a.testo) || typeof a.vero !== 'boolean') e(`affermazione ${i + 1} non valida`); });
      break;
    case 'ordina':
      if (!testo(r.testo)) e('manca il testo');
      if (!Array.isArray(r.elementi) || r.elementi.length < 3 || r.elementi.length > 6) e('servono da 3 a 6 elementi');
      break;
    case 'smista':
      if (!testo(r.testo)) e('manca il testo');
      if (!Array.isArray(r.categorie) || r.categorie.length < 2 || r.categorie.length > 4) e('servono da 2 a 4 categorie');
      else if (!Array.isArray(r.elementi) || !r.elementi.every((x) => testo(x.testo) && Number.isInteger(x.categoria) && x.categoria >= 0 && x.categoria < r.categorie.length)) e('elementi non validi');
      break;
    case 'stima':
      if (!testo(r.testo)) e('manca il testo');
      if (![r.min, r.valore, r.max].every(Number.isFinite) || !(r.min < r.valore && r.valore < r.max)) e('serve min < valore < max');
      if (!testo(r.unita)) e('manca l\'unità');
      break;
    case 'minigioco':
      if (!GIOCHI.includes(r.gioco)) e('gioco sconosciuto');
      break;
    case 'turbo':
      break;
    default:
      e('tipo sconosciuto');
  }
}

function stampa(r) {
  const spiega = r.spiegazione || r.spunto;
  switch (r.tipo) {
    case 'quiz': case 'umano_ai': case 'sala': case 'sincronia':
      console.log(`    [${r.tipo}] ${r.testo}`);
      r.opzioni.forEach((o, i) => console.log(`       ${i === r.corretta ? '✔' : ' '} ${L[i]}. ${o}`));
      break;
    case 'vero_falso':
      console.log(`    [vero_falso] ${r.testo || ''}`);
      r.affermazioni.forEach((a) => console.log(`       ${a.vero ? 'V' : 'F'}  ${a.testo}`));
      break;
    case 'ordina':
      console.log(`    [ordina] ${r.testo}`);
      r.elementi.forEach((x, i) => console.log(`       ${i + 1}. ${x}`));
      break;
    case 'smista':
      console.log(`    [smista] ${r.testo}  →  ${r.categorie.join(' | ')}`);
      r.elementi.forEach((x) => console.log(`       ${r.categorie[x.categoria].padEnd(14)} ${x.testo}`));
      break;
    case 'stima':
      console.log(`    [stima] ${r.testo}  →  ${r.valore} ${r.unita} (cursore ${r.min}–${r.max})`);
      break;
    case 'minigioco':
      console.log(`    [minigioco] ${r.nome} (${r.gioco}, ${r.durata}s)`);
      return;
    case 'turbo':
      console.log('    [turbo]');
      return;
  }
  if (spiega) console.log(`       ↳ ${spiega}`);
}

const file = fs.readdirSync(CARTELLA).filter((f) => f.endsWith('.json')).sort();
for (const f of file) {
  let s;
  try { s = JSON.parse(fs.readFileSync(path.join(CARTELLA, f), 'utf8')); } catch (e) { errore(f, 'JSON non valido: ' + e.message); continue; }
  if (!s.titolo) errore(f, 'manca il titolo');
  if (!Array.isArray(s.tappe) || !s.tappe.length) { errore(f, 'mancano le tappe'); continue; }
  const rivisto = s.generato && s.generato.rivisto === false ? '  ⚠ DA RIVEDERE' : '';
  const nRound = s.tappe.reduce((n, t) => n + (t.round || []).length, 0);
  console.log(`\n${f}  ${s.titolo}  (${s.tappe.length} tappe, ${nRound} round)${rivisto}`);
  s.tappe.forEach((t, ti) => {
    if (!BREVE) console.log(`  Tappa ${ti + 1}: ${t.nome}${t.doppi ? '  ×2' : ''}`);
    (t.round || []).forEach((r, ri) => {
      controllaRound(f, r, `tappa ${ti + 1}, round ${ri + 1}`);
      if (!BREVE) stampa(r);
    });
  });
}
console.log(errori ? `\n${errori} errori trovati.` : `\nTutto a posto: ${file.length} partite.`);
process.exit(errori ? 1 : 0);
