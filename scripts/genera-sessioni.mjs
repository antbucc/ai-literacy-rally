#!/usr/bin/env node
/* ============================================================
   Genera le partite del Rally con un LLM locale (Ollama).

   Uso:
     node scripts/genera-sessioni.mjs            # tutte le partite del piano
     node scripts/genera-sessioni.mjs 03 07      # solo alcune
   Variabili:
     OLLAMA_URL   (default http://localhost:11434)
     OLLAMA_MODEL (default llama3.1:8b)
     SOVRASCRIVI=1 per rigenerare file già esistenti

   Legge contenuti/aimpro-contesto.md e contenuti/piano.json,
   scrive contenuti/sessioni/NN.json.
   IMPORTANTE: un modello locale può sbagliare i fatti.
   Rileggi sempre le domande prima di usarle in aula.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODELLO = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const CONTESTO = fs.readFileSync(path.join(RADICE, 'contenuti', 'aimpro-contesto.md'), 'utf8');
const PIANO = JSON.parse(fs.readFileSync(path.join(RADICE, 'contenuti', 'piano.json'), 'utf8'));
const CARTELLA = path.join(RADICE, 'contenuti', 'sessioni');

/* ------------------------------------------------ sequenze di meccaniche */
const MG = {
  tap: { tipo: 'minigioco', gioco: 'tap', nome: 'Addestramento lampo', come: 'Tocca il pulsante più veloce che puoi: ogni tocco è un ciclo di addestramento. Conta la media della squadra.', durata: 15 },
  riflessi: { tipo: 'minigioco', gioco: 'riflessi', nome: "Ferma l'allucinazione", come: "Quando lo schermo diventa verde, tocca! Se tocchi prima, l'allucinazione passa. Tre tentativi: conta la velocità.", durata: 25 },
  duo: { tipo: 'minigioco', gioco: 'duo', nome: 'Passaparola', come: "In coppia (o in tre): chi vede il codice di simboli lo legge ad alta voce, gli altri lo compongono senza guardare. A ogni codice risolto cambia chi legge. Conta la media della squadra.", durata: 50 },
  sequenza: { tipo: 'minigioco', gioco: 'sequenza', nome: 'Finestra di contesto', come: 'Guarda la sequenza di colori e ripetila: ogni livello è più lungo. Conta il livello più alto raggiunto.', durata: 40 },
};
const SCHEMI = {
  A: [['quiz', 'vero_falso', MG.tap], ['sala', 'ordina', 'sincronia', 'turbo'], ['stima', 'quiz', MG.duo]],
  B: [['quiz', 'smista', MG.sequenza], ['sincronia', 'quiz', 'vero_falso', 'turbo'], ['ordina', 'stima', MG.duo]],
  C: [['vero_falso', 'quiz', MG.riflessi], ['smista', 'sala', 'quiz', 'turbo'], ['sincronia', 'stima', MG.duo]],
};

/* ------------------------------------------------ schemi JSON per tipo */
const S = (props, req) => ({ type: 'object', properties: props, required: req || Object.keys(props) });
const str = { type: 'string' };
const SCHEMA = {
  quiz: S({ testo: str, opzioni: { type: 'array', items: str, minItems: 4, maxItems: 4 }, corretta: { type: 'integer' }, spiegazione: str }),
  sala: S({ testo: str, opzioni: { type: 'array', items: str, minItems: 4, maxItems: 4 }, spunto: str }),
  sincronia: S({ testo: str, opzioni: { type: 'array', items: str, minItems: 4, maxItems: 4 }, spunto: str }),
  vero_falso: S({ affermazioni: { type: 'array', minItems: 6, maxItems: 6, items: S({ testo: str, vero: { type: 'boolean' } }) }, spiegazione: str }),
  ordina: S({ testo: str, elementi: { type: 'array', items: str, minItems: 4, maxItems: 5 }, spiegazione: str }),
  stima: S({ testo: str, unita: str, valore: { type: 'number' }, min: { type: 'number' }, max: { type: 'number' }, spiegazione: str }),
  smista: S({ testo: str, categorie: { type: 'array', items: str, minItems: 2, maxItems: 4 }, elementi: { type: 'array', minItems: 6, maxItems: 6, items: S({ testo: str, categoria: { type: 'integer' } }) }, spiegazione: str }),
};

/* Un esempio per tipo: mostra al modello forma, tono e lunghezza attesi. */
const ESEMPI = {
  quiz: { testo: 'Un chatbot ti cita una sentenza con numero e data precisi. Cosa fai?', opzioni: ['La uso: è troppo precisa per essere inventata', 'La verifico su una fonte ufficiale', 'Chiedo al chatbot se è sicuro', 'Aggiungo "fonte: AI" e la uso'], corretta: 1, spiegazione: 'Le allucinazioni sono risposte false ma plausibili: dettagli precisi non garantiscono che siano vere. Si verifica sempre su fonti ufficiali.' },
  sala: { testo: 'Quale uso dell\'AI la maggior parte dei presenti ha già provato al lavoro?', opzioni: ['Scrivere email', 'Riassumere documenti', 'Cercare informazioni', 'Non la uso ancora'], spunto: 'Raccontate un uso che vi ha fatto risparmiare tempo e uno andato storto.' },
  sincronia: { testo: 'Senza parlarvi! La parola che descrive meglio l\'AI generativa per il vostro lavoro è…', opzioni: ['Assistente', 'Rischio', 'Opportunità', 'Moda'], spunto: 'Le squadre in sintonia spiegano perché; le altre, chi ha scelto diversamente?' },
  vero_falso: { affermazioni: [{ testo: 'Un LLM consulta un database di risposte già scritte.', vero: false }, { testo: 'Un LLM genera il testo prevedendo un token alla volta.', vero: true }], spiegazione: 'Il modello non cerca risposte: le genera prevedendo il seguito più probabile.' },
  ordina: { testo: 'Metti in ordine le fasi del ciclo di vita di un modello di machine learning', elementi: ['Raccolta dei dati', 'Addestramento', 'Valutazione', 'Messa in produzione', 'Monitoraggio'], spiegazione: 'Prima i dati, poi addestramento e valutazione; dopo il rilascio il modello va monitorato nel tempo.' },
  stima: { testo: 'Quante competenze contiene il catalogo AIM-PRO?', unita: 'competenze', valore: 104, min: 20, max: 200, spiegazione: 'Il catalogo AIM-PRO ha 104 competenze attive in 4 categorie.' },
  smista: { testo: 'Questo sistema, per l\'AI Act, in che categoria rientra?', categorie: ['Vietato', 'Alto rischio'], elementi: [{ testo: 'Social scoring dei cittadini', categoria: 0 }, { testo: 'Selezione automatica dei CV', categoria: 1 }], spiegazione: 'Il social scoring è vietato; il recruiting è ad alto rischio.' },
};

const ISTRUZIONI = {
  quiz: 'Una domanda a scelta multipla con 4 opzioni, UNA sola corretta (indice "corretta" da 0 a 3). Le opzioni sbagliate devono essere plausibili ma chiaramente errate per chi conosce il tema. Varia la posizione della risposta giusta. "spiegazione": 1-2 frasi che spiegano perché.',
  sala: 'Una domanda di OPINIONE o di esperienza personale (non c\'è una risposta giusta): i giocatori devono indovinare cosa sceglierà la maggioranza della sala. 4 opzioni. "spunto": una domanda per aprire la discussione in aula.',
  sincronia: 'Una domanda aperta di opinione in cui la squadra, SENZA parlarsi, deve dare la stessa risposta. Inizia il testo con "Senza parlarvi!". 4 opzioni brevi (1-4 parole), tutte ragionevoli. "spunto": una domanda per la discussione.',
  vero_falso: '6 affermazioni brevi (massimo 110 caratteri l\'una) sul tema, circa metà vere e metà false. Le false devono essere errori comuni o miti diffusi. "spiegazione": 1-2 frasi che riassumono la lezione.',
  ordina: 'Un insieme di 4 o 5 passaggi/elementi da mettere nell\'ordine corretto (cronologico, di processo o crescente). Scrivi "elementi" GIÀ nell\'ordine corretto, ogni elemento massimo 50 caratteri. Il "testo" spiega il criterio (es. "Metti in ordine le fasi..."). "spiegazione": 1-2 frasi.',
  stima: 'Una domanda numerica in cui si stima un valore, PERTINENTE all\'argomento della partita (se l\'argomento non offre numeri certi, usa un numero del progetto AIM-PRO presente nel contesto). Usa SOLO un numero presente nel contesto o un fatto certo. "valore" è la risposta esatta; "min" e "max" delimitano il cursore (il valore deve stare tra min e max, non al centro esatto). "unita" breve (es. "competenze", "%", "giorni", "milioni di €"). "spiegazione": 1-2 frasi.',
  smista: 'Un esercizio di classificazione: 6 elementi brevi (massimo 70 caratteri) da assegnare alle categorie date. "categoria" è l\'indice della categoria corretta. Usa tutte le categorie almeno una volta. "spiegazione": 1-2 frasi.',
};

const SISTEMA = `Sei un esperto di AI literacy e di didattica per adulti. Crei contenuti per "Rally dell'AI", un gioco a squadre giocato durante le pause di un corso di 20 ore su AI literacy per professionisti (università, formazione professionale e PMI), nell'ambito del progetto europeo AIM-PRO.
Regole:
- Scrivi in italiano corretto, chiaro, tono amichevole e professionale. Dai del "voi"/"tu" ai partecipanti.
- Testi brevi: domande massimo 140 caratteri, opzioni massimo 80 caratteri, spiegazioni massimo 320 caratteri.
- Usa solo fatti presenti nel CONTESTO o conoscenze generali certe. Non inventare numeri, date, nomi o studi.
- Evita domande ambigue o trabocchetto; la risposta giusta deve essere difendibile.
- Rispondi SOLO con il JSON richiesto.

CONTESTO:
${CONTESTO}`;

/* ------------------------------------------------ chiamata a Ollama */
async function chiedi(prompt, schema) {
  const r = await fetch(URL_OLLAMA + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELLO,
      stream: false,
      format: schema,
      options: { temperature: 0.7, num_ctx: 8192 },
      messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error('Ollama ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return JSON.parse(j.message.content);
}

/* ------------------------------------------------ controlli */
function valida(tipo, x, sess) {
  const corta = (s, n) => typeof s === 'string' && s.trim().length > 3 && s.length <= n;
  // il testo deve essere una domanda o una consegna, non un titolo copiato dal prompt
  if (x.testo != null) {
    const t = x.testo.trim();
    if (t.length < 25 || /^(partita|tappa|argomento|sotto-argomento|compito)\b/i.test(t) || t === sess.titolo) return false;
    if (!/[?…:]$|\.\.\.$/.test(t) && !/^(metti|ordina|smista|assegna|stima|indovina|senza parlarvi|classifica|quale|quanti|quante|quanto|chi|cosa|come|in che)/i.test(t)) return false;
  }
  switch (tipo) {
    case 'quiz':
      return corta(x.testo, 220) && x.opzioni.length === 4 && x.opzioni.every((o) => corta(o, 140)) &&
        Number.isInteger(x.corretta) && x.corretta >= 0 && x.corretta < 4 && new Set(x.opzioni).size === 4 && corta(x.spiegazione, 500);
    case 'sala': case 'sincronia':
      return corta(x.testo, 220) && x.opzioni.length === 4 && new Set(x.opzioni).size === 4 && corta(x.spunto, 400);
    case 'vero_falso': {
      const v = x.affermazioni.filter((a) => a.vero).length;
      return x.affermazioni.length === 6 && x.affermazioni.every((a) => corta(a.testo, 170)) && v >= 2 && v <= 4 && corta(x.spiegazione, 500);
    }
    case 'ordina':
      return corta(x.testo, 220) && x.elementi.length >= 4 && x.elementi.length <= 5 && x.elementi.every((e) => corta(e, 90)) && new Set(x.elementi).size === x.elementi.length;
    case 'stima':
      return corta(x.testo, 220) && Number.isFinite(x.valore) && x.min < x.valore && x.valore < x.max && corta(x.unita, 40);
    case 'smista': {
      const n = x.categorie.length;
      const usate = new Set(x.elementi.map((e) => e.categoria));
      return n >= 2 && n <= 4 && x.elementi.length === 6 && x.elementi.every((e) => Number.isInteger(e.categoria) && e.categoria >= 0 && e.categoria < n && corta(e.testo, 110)) &&
        usate.size === n && (!sess.smista_categorie || n === sess.smista_categorie.length);
    }
    default: return false;
  }
}

async function generaRound(tipo, sess, tappa, giaFatte) {
  let prompt = `ARGOMENTO DELLA PARTITA: ${sess.tema}\nSOTTO-ARGOMENTO (tappa): ${tappa}\n`;
  if (giaFatte.length) prompt += `\nDomande già usate in questa partita (NON ripeterle, scegli un aspetto diverso):\n- ${giaFatte.join('\n- ')}\n`;
  prompt += `\nCOMPITO: crea UN round di tipo "${tipo}" sul sotto-argomento. ${ISTRUZIONI[tipo]}`;
  if (tipo === 'smista' && sess.smista_categorie) prompt += `\nUsa ESATTAMENTE queste categorie, in questo ordine: ${JSON.stringify(sess.smista_categorie)}.`;
  prompt += `\nIl campo "testo" deve essere la domanda vera e propria rivolta ai giocatori (mai il titolo della partita o della tappa).`;
  prompt += `\nEsempio della FORMA attesa (su un altro argomento, non copiarlo): ${JSON.stringify(ESEMPI[tipo])}`;
  for (let tentativo = 1; tentativo <= 4; tentativo++) {
    try {
      const x = await chiedi(prompt, SCHEMA[tipo]);
      if (tipo === 'smista' && sess.smista_categorie) x.categorie = sess.smista_categorie;
      if (valida(tipo, x, sess)) return { tipo, ...x };
      console.log(`   ✗ ${tipo}: non valido, riprovo (${tentativo})`);
    } catch (e) {
      console.log(`   ✗ ${tipo}: ${e.message} (${tentativo})`);
    }
  }
  throw new Error('Impossibile generare un round ' + tipo);
}

async function generaSessione(sess) {
  const file = path.join(CARTELLA, sess.id + '.json');
  if (fs.existsSync(file) && !process.env.SOVRASCRIVI) { console.log(`• ${sess.id} esiste già, salto`); return; }
  console.log(`• Partita ${sess.id}: ${sess.titolo} (schema ${sess.schema}, modello ${MODELLO})`);
  const giaFatte = [];
  const tappe = [];
  const schema = SCHEMI[sess.schema];
  for (let ti = 0; ti < schema.length; ti++) {
    const round = [];
    for (const voce of schema[ti]) {
      if (typeof voce === 'object') { round.push({ ...voce }); continue; }
      if (voce === 'turbo') { round.push({ tipo: 'turbo' }); continue; }
      const r = await generaRound(voce, sess, sess.tappe[ti], giaFatte);
      giaFatte.push(r.testo || (r.affermazioni && r.affermazioni[0].testo));
      console.log(`   ✓ ${voce}: ${(r.testo || r.affermazioni[0].testo).slice(0, 80)}`);
      round.push(r);
    }
    tappe.push({ nome: sess.tappe[ti], doppi: ti === schema.length - 1, round });
  }
  const out = {
    titolo: sess.titolo,
    tema: sess.tema,
    generato: { modello: MODELLO, data: new Date().toISOString().slice(0, 10), rivisto: false },
    tappe,
  };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log(`   → ${path.relative(RADICE, file)}`);
}

const scelte = process.argv.slice(2);
fs.mkdirSync(CARTELLA, { recursive: true });
for (const sess of PIANO.sessioni) {
  if (scelte.length && !scelte.includes(sess.id)) continue;
  await generaSessione(sess);
}
console.log('Fatto. Ricordati di rileggere le domande prima di usarle in aula!');
