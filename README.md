# Rally dell'AI

Gioco a squadre per le pause di un corso di **AI Literacy** (progetto Erasmus+ **AIM-PRO**). Il docente proietta `/host` e i partecipanti entrano con il telefono inquadrando un QR.

A ogni partita il gioco forma **squadre nuove** (colore + animale) e i compagni si devono cercare in sala. Le squadre risalgono un sentiero a tappe fino alla vetta, rispondendo a domande e sfide sull'AI. Lo scopo è doppio: ripassare i contenuti e far conoscere le persone.

- **12 partite** da circa 12–15 minuti, una per pausa, per coprire un corso di 20 ore.
- **Squadre che si rimescolano:** il gioco evita le coppie che hanno già giocato insieme, così a ogni pausa si conoscono persone nuove.
- **Classifica del corso:** ogni giocatore accumula i punti della sua squadra, partita dopo partita.
- **Modalità singoli** per provare il gioco da soli (tasto **G**).
- **Musica di sottofondo ed effetti** generati dal browser, senza file audio.

## Meccaniche

| Tipo | Cosa succede | Punti alla squadra |
|---|---|---|
| **Trovarsi** | Il telefono si colora come la squadra; tutti toccano «Ci siamo trovati» | fino a 50 |
| **Quiz** | Scelta multipla, poi la spiegazione sul proiettore | 100 × quota di membri che rispondono giusto |
| **Umano o AI?** | Due testi: quale è generato? | come il quiz |
| **Raffica vero/falso** | 6 affermazioni in fila sul telefono | 100 × media delle risposte giuste |
| **Metti in ordine** | Tocca gli elementi dal primo all'ultimo | 100 × media degli elementi al posto giusto |
| **Smista** | Assegna ogni elemento alla categoria giusta | 100 × media delle assegnazioni giuste |
| **Stima** | Un cursore per indovinare un numero | per posizione: vince la squadra con la mediana più vicina |
| **La sala** | Indovina cosa sceglierà la maggioranza (domande d'opinione) | 100 × quota che indovina |
| **Sintonia** | Senza parlarsi, la squadra deve dare la stessa risposta | 100 × quota della risposta più scelta |
| **Minigiochi** | *tap*, *riflessi*, *sequenza* di colori | per posizione della media di squadra |
| **Turbo** | Le ultime due squadre ricevono una spinta | +60 / +30 |

L'ultima tappa di ogni partita vale **punti doppi**.

## Avvio in locale

```bash
npm install
HOST_PIN=4321 npm start
```

- Proiettore: <http://localhost:3000/host>. Il QR punta all'IP del portatile sulla rete locale.
- I telefoni devono stare sulla **stessa rete** del portatile. Le reti universitarie o aziendali spesso bloccano il traffico tra dispositivi: in quel caso usa il deploy su Railway.
- Per conservare la classifica del corso tra un riavvio e l'altro: `DATA_DIR=./dati npm start`.

## Regia (dal proiettore)

Il pulsante **▶ Avanti** è in basso a destra; passandoci sopra col mouse compaiono gli altri. Al primo comando la pagina chiede il PIN. Il primo tasto premuto accende anche la musica, perché i browser bloccano l'audio finché non si interagisce con la pagina.

| Tasto | Azione |
|---|---|
| Spazio / → / Invio | Avanti: chiude la domanda e mostra l'esito, oppure passa al passo successivo |
| `[` `]` (o PagSu/PagGiù) | Partita precedente / successiva (solo dalla schermata iniziale) |
| M | Musica sì / no |
| G | Modalità squadre / singoli (solo dalla schermata iniziale) |
| N | Salta il passo (senza assegnare punti) |
| P | Vai al podio |
| B | Aggiunge 6 giocatori automatici, per provare il gioco da soli |
| R | Ricomincia la partita (i giocatori restano, i bot vengono tolti) |
| F | Schermo intero |
| H | Nasconde / mostra la regia |

Le domande si chiudono da sole allo scadere del tempo o quando hanno finito tutti; il passaggio al round successivo resta a te, così puoi commentare la spiegazione. **⬇ CSV** scarica i risultati della partita e la classifica del corso.

**Una partita per pausa:** dopo il podio premi **R**, poi **]** per scegliere la partita successiva. I telefoni restano collegati. Se il server si riavvia, i telefoni rientrano da soli con lo stesso nome.

## Le partite e la generazione con un LLM locale

Le partite stanno in [`contenuti/sessioni/`](contenuti/sessioni/), una per file (`01.json` … `12.json`):

- la **01** è scritta a mano;
- le altre sono generate con un **LLM locale via [Ollama](https://ollama.com)**, partendo da:
  - [`contenuti/aimpro-contesto.md`](contenuti/aimpro-contesto.md): sintesi del deliverable D2.1 AIM-PRO e fatti certi sull'AI;
  - [`contenuti/piano.json`](contenuti/piano.json): tema, tappe e sequenza di meccaniche di ogni partita.

```bash
ollama pull qwen2.5:14b                                  # o un altro modello
OLLAMA_MODEL=qwen2.5:14b npm run genera                  # genera le partite mancanti
SOVRASCRIVI=1 OLLAMA_MODEL=qwen2.5:14b npm run genera 05 # rigenera solo la 05
npm run controlla                                        # valida e stampa tutto, da rileggere
```

> ⚠️ **Rileggi sempre le domande generate.** Un modello locale può sbagliare fatti, numeri e risposte giuste. Le partite in questo repository sono state riviste e corrette dopo la generazione (`"rivisto": true` nel file). Quelle nuove nascono con `"rivisto": false` e `npm run controlla` le segnala.

Per modificare a mano una partita basta editare il JSON. Ecco i formati per ogni tipo di round:

```json
{ "tipo": "quiz", "testo": "…", "opzioni": ["…","…","…","…"], "corretta": 1, "spiegazione": "…" }
{ "tipo": "vero_falso", "affermazioni": [{ "testo": "…", "vero": true }], "spiegazione": "…" }
{ "tipo": "ordina", "testo": "…", "elementi": ["primo","secondo","terzo","quarto"], "spiegazione": "…" }
{ "tipo": "smista", "testo": "…", "categorie": ["A","B"], "elementi": [{ "testo": "…", "categoria": 0 }], "spiegazione": "…" }
{ "tipo": "stima", "testo": "…", "unita": "…", "valore": 104, "min": 20, "max": 200, "spiegazione": "…" }
{ "tipo": "sala", "testo": "…", "opzioni": ["…"], "spunto": "domanda per la discussione" }
{ "tipo": "sincronia", "testo": "Senza parlarvi! …", "opzioni": ["…"], "spunto": "…" }
{ "tipo": "umano_ai", "testo": "…", "brani": [{ "etichetta": "A", "testo": "…" }], "opzioni": ["A","B"], "corretta": 0, "spiegazione": "…" }
{ "tipo": "minigioco", "gioco": "tap | riflessi | sequenza", "nome": "…", "come": "…", "durata": 20 }
{ "tipo": "turbo" }
```

- `corretta` e `categoria` partono da 0.
- Negli `ordina` gli elementi si scrivono **già nell'ordine giusto**: il gioco li mescola da solo.
- Ogni round accetta `"tempo": 40` per cambiare la durata di quel solo round.
- Le durate predefinite sono in [`contenuti/config.json`](contenuti/config.json).

## Pubblicare su GitHub

```bash
gh repo create ai-literacy-rally --private --source . --push
# oppure, con un repository già creato su github.com:
git remote add origin git@github.com:<utente>/ai-literacy-rally.git
git push -u origin main
```

## Deploy su Railway

1. Su [railway.com](https://railway.com): **New Project → Deploy from GitHub repo** e scegli il repository. Railway riconosce Node e usa [`railway.json`](railway.json): avvio con `npm start` e controllo di salute su `/salute`.
2. In **Variables** imposta:
   - `HOST_PIN`: il PIN di regia (obbligatorio, altrimenti è `1234`);
   - `DATA_DIR=/data`: per salvare la classifica del corso.
3. Per conservare la classifica tra un deploy e l'altro aggiungi un **Volume** al servizio, montato su `/data`. Senza volume il gioco funziona lo stesso, ma la classifica del corso si azzera a ogni deploy.
4. In **Settings → Networking** clicca **Generate Domain**, poi apri `https://<dominio>/host`.

Note:
- Lascia **una sola istanza** (repliche = 1): lo stato di gioco vive nella memoria del server.
- Se usi un dominio tuo, imposta `PUBLIC_URL=https://tuodominio.it`, così il QR punta all'indirizzo giusto.

## Struttura

```
server.js                     server Node: stato di gioco, SSE, API, QR, salvataggio
contenuti/config.json         titolo e durate
contenuti/sessioni/*.json     le 12 partite
contenuti/aimpro-contesto.md  contesto AIM-PRO per l'LLM
contenuti/piano.json          piano delle partite da generare
scripts/genera-sessioni.mjs   generazione con Ollama
scripts/controlla-contenuti.mjs  validazione e stampa per la revisione
public/host.html              proiettore  (js/host.js, css/host.css, js/suono.js)
public/index.html             telefono    (js/player.js, css/player.css)
public/js/animali.js          gli animali animati in SVG
public/js/common.js           funzioni condivise
```

Tutta la grafica (mascotte, animali, paesaggio) e la musica sono originali e generate dal codice.
