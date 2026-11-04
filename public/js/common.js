/* Utility comuni a proiettore e telefono. */
(function () {
  'use strict';
  var U = {
    scarto: 0,
    _sincronizzato: false,
    LETTERE: ['A', 'B', 'C', 'D', 'E', 'F'],
    /** I simboli del Passaparola (stesso ordine degli indici del server). */
    SIMBOLI: [
      { e: '🍕', n: 'pizza' }, { e: '⚡', n: 'fulmine' }, { e: '👽', n: 'alieno' }, { e: '🚀', n: 'razzo' },
      { e: '🌵', n: 'cactus' }, { e: '🍋', n: 'limone' }, { e: '🍩', n: 'ciambella' }, { e: '🤖', n: 'robot' },
    ],
    /** La mascotte: un robottino disegnato a contorno spesso. */
    MASCOTTE: '<svg class="mascotte" viewBox="0 0 140 150" aria-hidden="true">' +
      '<g stroke="#2A2420" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">' +
      '<line x1="70" y1="14" x2="70" y2="34" fill="none"/>' +
      '<circle cx="70" cy="13" r="10" fill="#F2C14E"/>' +
      '<rect x="8" y="62" width="16" height="30" rx="8" fill="#F08A4B"/>' +
      '<rect x="116" y="62" width="16" height="30" rx="8" fill="#F08A4B"/>' +
      '<path d="M38 112 h64 v18 a12 12 0 0 1 -12 12 h-40 a12 12 0 0 1 -12 -12z" fill="#7CC4E8"/>' +
      '<rect x="20" y="34" width="100" height="82" rx="30" fill="#FFFDF7"/>' +
      '<rect x="34" y="50" width="72" height="44" rx="18" fill="#2A2420"/>' +
      '</g>' +
      '<circle cx="55" cy="70" r="8" fill="#8FE6F2"/><circle cx="85" cy="70" r="8" fill="#8FE6F2"/>' +
      '<path d="M58 83 Q70 91 82 83" stroke="#8FE6F2" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<circle cx="34" cy="102" r="6" fill="#EE7FA8" opacity=".7"/><circle cx="106" cy="102" r="6" fill="#EE7FA8" opacity=".7"/>' +
      '</svg>',
    TIPO: {
      quiz: 'Quiz',
      umano_ai: 'Umano o AI?',
      sala: 'La sala · indovina la maggioranza',
      sincronia: 'Sintonia di squadra',
      vero_falso: 'Raffica · vero o falso',
      ordina: 'Metti in ordine',
      stima: 'Stima · chi si avvicina di più',
      smista: 'Smista nelle categorie',
    },
    NOTA: {
      quiz: 'Risposta giusta = la tua squadra avanza',
      umano_ai: 'Risposta giusta = la tua squadra avanza',
      sala: 'Non conta la tua opinione: indovina cosa sceglierà la maggioranza',
      sincronia: 'Senza parlarvi: stessa risposta della tua squadra = punti',
      vero_falso: 'Rispondi a tutte sul telefono: ogni risposta giusta fa avanzare la squadra',
      ordina: 'Sul telefono tocca gli elementi dal primo all\'ultimo',
      stima: 'Muovi il cursore: conta la mediana della squadra, vince chi si avvicina di più',
      smista: 'Sul telefono assegna ogni elemento alla categoria giusta',
    },
    /** Nota sotto la domanda, al singolare se si gioca da soli. */
    nota: function (tipo, solo) {
      if (solo && (tipo === 'quiz' || tipo === 'umano_ai')) return 'Risposta giusta = avanzi sul percorso';
      return U.NOTA[tipo];
    },
    ACCORDO: {
      tutti: 'Sintonia perfetta!',
      quasi: 'Quasi in sintonia',
      diverse: 'Tutte risposte diverse',
      solo: 'In solitaria: metà punti',
      nessuna: 'Nessuna risposta',
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    ora: function () { return Date.now() + U.scarto; },
    rimasti: function (deadline) { return deadline ? Math.max(0, deadline - U.ora()) : 0; },
    post: function (url, corpo) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok) { var e = new Error(j.errore || 'Errore ' + r.status); e.stato = r.status; throw e; }
            return j;
          });
        });
    },
    /** Apre il flusso SSE. Il browser si riconnette da solo. */
    flusso: function (url, onStato, onConnessione, onSconosciuto) {
      var es = new EventSource(url);
      es.onopen = function () { if (onConnessione) onConnessione(true); };
      es.onerror = function () { if (onConnessione) onConnessione(false); };
      es.onmessage = function (ev) {
        var s;
        try { s = JSON.parse(ev.data); } catch (e) { return; }
        var sc = s.ts - Date.now();
        U.scarto = U._sincronizzato ? U.scarto * 0.7 + sc * 0.3 : sc;
        U._sincronizzato = true;
        if (onConnessione) onConnessione(true);
        onStato(s);
      };
      es.addEventListener('sconosciuto', function () { es.close(); if (onSconosciuto) onSconosciuto(); });
      return { chiudi: function () { es.close(); } };
    },
    /** Numero in formato italiano, con al massimo un decimale. */
    numero: function (v) {
      if (v == null || !isFinite(v)) return '—';
      return (Math.round(v * 10) / 10).toLocaleString('it-IT');
    },
    /** Posizioni in classifica, con i pari merito. */
    posti: function (squadre) {
      var ord = squadre.slice().sort(function (a, b) { return b.punti - a.punti; });
      var mappa = {};
      var posto = 0;
      ord.forEach(function (s, i) {
        if (i > 0 && s.punti < ord[i - 1].punti) posto = i;
        mappa[s.id] = posto + 1;
      });
      return { ordine: ord, posto: mappa };
    },
    /** L'animale di una squadra (o di un giocatore, in modalità singoli). */
    animale: function (q, classe) {
      return window.ANIMALI ? ANIMALI.svg(q.specie, q.colore, { classe: classe || '' }) : U.esc(q.animale);
    },
    valoreMg: function (gioco, v) {
      if (v == null) return '—';
      if (gioco === 'tap') return Math.round(v) + ' tocchi';
      if (gioco === 'riflessi') return Math.round(v) + ' punti';
      if (gioco === 'duo') return (Math.round(v * 10) / 10).toString().replace('.', ',') + (v === 1 ? ' codice' : ' codici');
      if (gioco === 'sequenza') return 'livello ' + (Math.round(v * 10) / 10).toString().replace('.', ',');
      return String(Math.round(v));
    },
  };
  window.U = U;
})();
