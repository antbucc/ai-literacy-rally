/* Telefono del giocatore. */
(function () {
  'use strict';
  var esc = U.esc;
  var L = U.LETTERE;
  var app = document.getElementById('schermata');
  var barra = document.getElementById('barra');
  var rete = document.getElementById('rete');
  var token = localStorage.getItem('rally.token');
  var nome = localStorage.getItem('rally.nome') || '';
  var S = null;
  var flusso = null;
  var chiaveDura = '';
  var chiaveMorbida = '';
  var mgAttivo = null;
  var titolo = "Rally dell'AI";


  /* ---------------------------------------------------------- ingresso */
  function mostraIngresso(errore) {
    barra.hidden = true;
    document.body.classList.remove('faro');
    chiaveDura = '';
    app.innerHTML = '<div class="ingresso entra"><div class="mascotte-tel">' + U.MASCOTTE + '</div><h1>' + esc(titolo) + '</h1>' +
      '<p>Quiz, sfide di squadra e minigiochi sull\'intelligenza artificiale. Il gioco sceglie i tuoi compagni: dovrai trovarli in sala!</p>' +
      '<form id="f-ingresso">' +
      '<input id="nome" maxlength="24" autocomplete="given-name" enterkeyhint="go" placeholder="Il tuo nome" aria-label="Il tuo nome" value="' + esc(nome) + '" required>' +
      '<button class="btn" type="submit">Entra in gara</button><p class="errore">' + esc(errore || '') + '</p></form>' +
      '<p class="piccolo">Tieni aperta questa pagina per tutto il gioco.</p></div>';
    document.getElementById('f-ingresso').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('nome').value.trim();
      if (!v) return;
      e.target.querySelector('button').disabled = true;
      entra(v);
    });
  }

  function entra(n) {
    U.post('/api/entra', { nome: n, token: token }).then(function (r) {
      token = r.token;
      nome = n;
      localStorage.setItem('rally.token', token);
      localStorage.setItem('rally.nome', nome);
      collega();
    }).catch(function (e) { mostraIngresso(e.message); });
  }

  function collega() {
    if (flusso) flusso.chiudi();
    app.innerHTML = '<div class="centro"><p>Collegamento…</p></div>';
    flusso = U.flusso('/api/flusso?token=' + encodeURIComponent(token), disegna, function (on) {
      rete.hidden = on;
    }, function () {
      // il server non ci conosce più (riavvio): rientriamo con lo stesso nome
      localStorage.removeItem('rally.token');
      token = null;
      if (nome) entra(nome); else mostraIngresso();
    });
  }

  /* ---------------------------------------------------------- schermate */
  function miaSquadra(s) {
    return s.me.squadra ? s.squadre.filter(function (q) { return q.id === s.me.squadra; })[0] : null;
  }
  var solo = function (s) { return s.modo === 'singoli'; };
  /** "La tua squadra: +N" oppure, da soli, "+N punti". */
  function guadagno(s, sq, n) {
    return solo(s) ? '+' + n + ' punti' : 'La tua squadra: +' + n;
  }
  function corsoTel(me) {
    if (!me.corso) return '';
    return '<p class="corso-tel">🏆 Nel corso: <b>' + me.corso.punti + ' punti</b> · ' + me.corso.posto + '° su ' + me.corso.su +
      ' · ' + me.corso.partite + (me.corso.partite === 1 ? ' partita' : ' partite') + '</p>';
  }
  function attendi(testo) {
    return '<div class="centro"><div class="emoji">⏳</div><h1>Un attimo…</h1><p>' + testo + '</p></div>';
  }

  var SCHERMI = {
    lobby: function (s) {
      return '<div class="centro"><div class="mascotte-tel">' + U.MASCOTTE + '</div><h1>Sei in gara, ' + esc(s.me.nome) + '!</h1>' +
        '<span class="pillola-scura">Partita ' + (s.sessione.indice + 1) + ' · ' + esc(s.sessione.titolo) + '</span>' +
        '<p>Guarda lo schermo: il gioco parte a breve.' + (solo(s) ? ' Oggi giochi da solo, con il tuo animale.' : ' Fra poco il telefono ti dirà in che squadra sei: a ogni partita compagni nuovi!') + '</p>' +
        corsoTel(s.me) +
        '<p class="piccolo">' + s.collegati + (s.collegati === 1 ? ' giocatore collegato' : ' giocatori collegati') + '</p></div>';
    },

    squadre: function (s, me, sq) {
      if (!sq) return attendi('Stiamo formando le squadre.');
      if (solo(s)) {
        return '<div class="faro-schermo"><div class="faro-disco">' + U.animale(sq) + '</div><span class="pillola-scura">Il tuo simbolo</span>' +
          '<h1>' + esc(sq.nome) + '</h1><p>Oggi giochi da solo: cerca questo simbolo sul percorso proiettato.</p></div>';
      }
      var cerca = s.sub === 'cerca';
      var bonus = s.incontro && s.incontro.bonus ? s.incontro.bonus[sq.id] : null;
      return '<div class="faro-schermo"><div class="faro-disco">' + U.animale(sq) + '</div><span class="pillola-scura">La tua squadra</span><h1>' + esc(sq.nome) + '</h1>' +
        '<p>' + (cerca ? 'Alza il telefono e cerca chi ha il tuo stesso colore!' : 'Presentatevi: nome, ruolo e un uso dell\'AI nel vostro lavoro.') + '</p>' +
        '<ul class="compagni">' + sq.membri.map(function (m) {
          return '<li class="' + (m.ok ? 'ok ' : '') + (m.nome === me.nome ? 'io' : '') + '">' + esc(m.nome) + '</li>';
        }).join('') + '</ul>' +
        (cerca
          ? '<button class="btn btn-faro ' + (me.confermato ? 'fatto' : '') + '" data-az="trovato">' + (me.confermato ? '✓ Confermato (tocca per annullare)' : 'Ci siamo trovati!') + '</button>' +
            '<p class="timer-tel" data-timer></p>'
          : '<p><b>Bonus incontro: +' + (bonus || 0) + ' punti</b></p>') + '</div>';
    },

    tappa: function (s, me, sq) {
      var t = s.tappa;
      var p = U.posti(s.squadre);
      return '<div class="centro"><span class="pillola-scura">Tappa ' + (t.indice + 1) + ' di ' + s.nTappe + '</span><h1>' + esc(t.nome) + '</h1>' +
        '<p>' + esc(t.sotto || '') + '</p>' + (t.doppi ? '<span class="badge">Punti doppi ×2</span>' : '') +
        (sq ? '<div class="esito-an">' + U.animale(sq) + '</div><p><b>' + (solo(s) ? 'Sei ' : esc(sq.nome) + ': ') + p.posto[sq.id] + '° con ' + sq.punti + ' punti</b></p>' : '') + '</div>';
    },

    domanda: function (s, me, sq) {
      var d = s.domanda;
      if (!sq) return attendi('Entrerai in squadra al prossimo round.');
      if (!d.esito) {
        var scelto = me.risposta != null;
        return '<div class="domanda tipo-' + d.tipo + '"><span class="pillola-scura">' + U.TIPO[d.tipo] + '</span><h2>' + esc(d.testo) + '</h2>' +
          (d.brani ? d.brani.map(function (b) { return '<div class="brano"><b>' + esc(b.etichetta) + '.</b> ' + esc(b.testo) + '</div>'; }).join('') : '') +
          '<div class="scelte ' + (scelto ? 'scelto' : '') + '">' + d.opzioni.map(function (o, i) {
            return '<button class="scelta o' + i + (me.risposta === i ? ' mia' : '') + '" data-az="risposta" data-v="' + i + '"><span class="lettera">' + L[i] + '</span>' + esc(o) + '</button>';
          }).join('') + '</div>' +
          '<p class="nota">' + (scelto ? 'Risposta inviata. Puoi cambiarla finché c\'è tempo.' : U.nota(d.tipo, solo(s))) + '</p>' +
          '<div class="timer-tel" data-timer></div></div>';
      }
      var e = d.esito;
      var r = e.perSquadra[sq.id] || { punti: 0 };
      var emoji;
      var umore = 'triste';
      var titoloEsito;
      var sotto = '';
      if (me.su != null) {
        var quota = me.giuste / me.su;
        umore = quota >= 0.5 ? 'felice' : 'triste';
        titoloEsito = me.risposta == null ? 'Non hai risposto' : me.giuste + ' su ' + me.su + (me.giuste === 1 ? ' giusta' : ' giuste') + (quota === 1 ? ': perfetto!' : '');
        sotto = e.media != null ? 'La sala in media: <b>' + e.media + '%</b>' + (e.perfetti != null ? ' · ordini perfetti: <b>' + e.perfetti + '</b>' : '') : '';
      } else if (d.tipo === 'stima') {
        umore = r.posto === 1 ? 'felice' : r.posto ? '' : 'triste';
        titoloEsito = 'Era ' + U.numero(e.valore) + ' ' + esc(d.unita);
        sotto = 'La tua stima: <b>' + (me.risposta == null ? '—' : U.numero(me.risposta)) + '</b>' +
          (r.mediana != null ? '<br>' + (solo(s) ? '' : 'Stima della squadra: <b>' + U.numero(r.mediana) + '</b> · ') + (r.posto ? r.posto + '° più vicin' + (solo(s) ? 'o' : 'a') : '') : '');
      } else if (e.corretta != null) {
        if (me.risposta === e.corretta) { emoji = '🎉'; umore = 'felice'; titoloEsito = 'Giusto!'; }
        else if (me.risposta == null) { emoji = '😶'; titoloEsito = 'Non hai risposto'; }
        else { emoji = '🤔'; titoloEsito = 'Non questa volta'; }
        sotto = 'Risposta giusta: <b>' + L[e.corretta] + '. ' + esc(d.opzioni[e.corretta]) + '</b>';
      } else if (d.tipo === 'sala') {
        var m = e.maggioranza || [];
        var preso = me.risposta != null && m.indexOf(me.risposta) >= 0;
        emoji = preso ? '🎯' : '👥';
        if (preso) umore = 'felice';
        titoloEsito = preso ? 'Hai indovinato la sala!' : (me.risposta == null ? 'Non hai risposto' : 'La sala la pensa diversamente');
        sotto = (m.length > 1 ? 'La sala è divisa: ' : 'La sala ha scelto: ') + '<b>' + m.map(function (i) { return esc(d.opzioni[i]); }).join(' / ') + '</b>';
      } else {
        emoji = r.accordo === 'tutti' ? '🤝' : r.accordo === 'quasi' ? '👌' : '🔀';
        if (r.accordo === 'tutti' || r.accordo === 'quasi') umore = 'felice';
        titoloEsito = U.ACCORDO[r.accordo] || 'Sintonia';
      }
      var spiega = d.spiegazione || d.spunto;
      return '<div class="esito"><div class="esito-an">' + U.animale(sq, umore) + '</div><h1>' + titoloEsito + '</h1>' +
        (sotto ? '<p>' + sotto + '</p>' : '') +
        '<div class="punti">' + guadagno(s, sq, r.punti) + '</div>' +
        (spiega ? '<div class="spiegazione"><b>' + (d.spiegazione ? 'Perché' : 'Parliamone') + '</b>' + esc(spiega) + '</div>' : '') + '</div>';
    },

    minigioco: function (s, me, sq) {
      var m = s.minigioco;
      if (!sq) return attendi('Entrerai in squadra al prossimo round.');
      if (s.sub === 'pronti') {
        return '<div class="centro"><span class="pillola-scura">Minigioco</span><h1>' + esc(m.nome) + '</h1><p>' + esc(m.come) + '</p>' +
          '<div class="tap-conta" data-timer></div><p class="piccolo">Preparati!</p></div>';
      }
      if (s.sub === 'gioco') return ''; // la schermata la costruisce avviaMinigioco()
      var r = m.esito.perSquadra[sq.id] || {};
      var titoloMg = !r.posto ? 'Nessun punteggio' : solo(s) ? 'Sei ' + r.posto + '°' : 'La tua squadra è ' + r.posto + 'ª';
      return '<div class="esito"><div class="esito-an">' + U.animale(sq, r.posto === 1 ? 'felice' : '') + '</div><h1>' + titoloMg + '</h1>' +
        '<p>Il tuo risultato: <b>' + U.valoreMg(m.gioco, me.mg) + '</b>' + (solo(s) ? '' : '<br>Media della squadra: <b>' + U.valoreMg(m.gioco, r.media) + '</b>') + '</p>' +
        '<div class="punti">+' + (r.punti || 0) + ' punti</div></div>';
    },

    turbo: function (s, me, sq) {
      var b = s.turbo && s.turbo.bonus && sq ? s.turbo.bonus[sq.id] : 0;
      return '<div class="centro">' + (sq ? '<div class="esito-an">' + U.animale(sq, b ? 'cammina' : '') + '</div>' : '<div class="emoji">⚡</div>') + '<h1>⚡ Turbo!</h1><p>' +
        (b ? (solo(s) ? 'Ricevi' : 'La tua squadra riceve') + ' una spinta: <b>+' + b + ' punti</b>!' : 'Chi insegue riceve una spinta. Occhio alle spalle!') + '</p></div>';
    },

    podio: function (s, me, sq) {
      if (!sq) return '<div class="centro"><div class="emoji">🏁</div><h1>Gara finita!</h1><p>Grazie per aver giocato.</p></div>';
      var c = s.podio.classifica.filter(function (x) { return x.id === sq.id; })[0];
      var posto = c ? c.posto : null;
      return '<div class="centro"><div class="esito-an">' + U.animale(sq, posto <= 3 ? 'felice' : '') + '</div><div class="emoji" style="font-size:44px">' + (posto === 1 ? '🏆' : posto === 2 ? '🥈' : posto === 3 ? '🥉' : '🏁') + '</div>' +
        '<h1>' + (posto === 1 ? (solo(s) ? 'Hai vinto!' : 'Avete vinto!') : solo(s) ? 'Posizione finale: ' + posto + '°' : 'La tua squadra è arrivata ' + posto + 'ª') + '</h1>' +
        '<p><b>' + (solo(s) ? '' : esc(sq.nome) + ' · ') + sq.punti + ' punti</b></p>' +
        corsoTel(me) +
        '<p>Grazie per aver giocato! Alla prossima pausa: nuova partita e nuovi compagni.</p></div>';
    },
  };

  /* ---------------------------------------------------------- meccaniche interattive (raffica, ordina, stima, smista) */
  var INTERATTIVI = ['vero_falso', 'ordina', 'stima', 'smista'];
  function intestazione(d) {
    return '<span class="pillola-scura">' + U.TIPO[d.tipo] + '</span>' + (d.tipo === 'vero_falso' ? '' : '<h2>' + esc(d.testo) + '</h2>');
  }
  function piede() { return '<div class="timer-tel" data-timer></div>'; }

  /** Costruisce il widget della meccanica e tiene lo stato in locale (un rendering dal server non lo azzera). */
  function avviaInterattivo(s, me) {
    var d = s.domanda;
    app.classList.remove('entra');
    WIDGET[d.tipo](d, me.risposta);
  }

  var WIDGET = {
    // una affermazione alla volta, due pulsanti grandi
    vero_falso: function (d, prima) {
      var n = d.affermazioni.length;
      var r = Array.isArray(prima) ? prima.slice() : d.affermazioni.map(function () { return null; });
      function mostra() {
        var i = r.indexOf(null);
        if (i < 0) {
          app.innerHTML = '<div class="domanda">' + intestazione(d) + '<div class="fatto-box"><div class="emoji">✅</div><h2>Fatto!</h2><p>Aspetta che finiscano gli altri.</p></div>' +
            '<ol class="riepilogo">' + d.affermazioni.map(function (a, k) {
              return '<li><span class="mini-verdetto ' + (r[k] ? 'v' : 'f') + '">' + (r[k] ? 'V' : 'F') + '</span>' + esc(a.testo) + '</li>';
            }).join('') + '</ol>' + piede() + '</div>';
          return;
        }
        app.innerHTML = '<div class="domanda">' + intestazione(d) +
          '<div class="progresso">' + d.affermazioni.map(function (_, k) { return '<span class="' + (r[k] != null ? 'fatto' : k === i ? 'ora' : '') + '"></span>'; }).join('') + '</div>' +
          '<div class="carta-grande"><span class="numero">' + (i + 1) + '/' + n + '</span><p>' + esc(d.affermazioni[i].testo) + '</p></div>' +
          '<div class="vf-bottoni"><button class="vf vero" data-v="1">VERO</button><button class="vf falso" data-v="0">FALSO</button></div>' + piede() + '</div>';
        app.querySelectorAll('.vf').forEach(function (b) {
          b.addEventListener('click', function () {
            r[i] = b.getAttribute('data-v') === '1';
            if (navigator.vibrate) navigator.vibrate(15);
            invia('risposta', r);
            mostra();
          });
        });
      }
      mostra();
    },

    // un elemento alla volta, un pulsante per categoria
    smista: function (d, prima) {
      var n = d.elementi.length;
      var r = Array.isArray(prima) ? prima.slice() : d.elementi.map(function () { return null; });
      function mostra() {
        var i = r.indexOf(null);
        if (i < 0) {
          app.innerHTML = '<div class="domanda">' + intestazione(d) + '<div class="fatto-box"><div class="emoji">✅</div><h2>Tutto smistato!</h2><p>Aspetta che finiscano gli altri.</p></div>' +
            '<ol class="riepilogo">' + d.elementi.map(function (x, k) {
              return '<li><span class="mini-cat o' + r[k] + '">' + esc(d.categorie[r[k]]) + '</span>' + esc(x.testo) + '</li>';
            }).join('') + '</ol>' + piede() + '</div>';
          return;
        }
        app.innerHTML = '<div class="domanda">' + intestazione(d) +
          '<div class="progresso">' + d.elementi.map(function (_, k) { return '<span class="' + (r[k] != null ? 'fatto' : k === i ? 'ora' : '') + '"></span>'; }).join('') + '</div>' +
          '<div class="carta-grande"><span class="numero">' + (i + 1) + '/' + n + '</span><p>' + esc(d.elementi[i].testo) + '</p></div>' +
          '<div class="scelte">' + d.categorie.map(function (c, k) {
            return '<button class="scelta o' + k + '" data-v="' + k + '">' + esc(c) + '</button>';
          }).join('') + '</div>' + piede() + '</div>';
        app.querySelectorAll('.scelta').forEach(function (b) {
          b.addEventListener('click', function () {
            r[i] = Number(b.getAttribute('data-v'));
            if (navigator.vibrate) navigator.vibrate(15);
            invia('risposta', r);
            mostra();
          });
        });
      }
      mostra();
    },

    // tocca gli elementi nell'ordine giusto
    ordina: function (d, prima) {
      var n = d.mescolati.length;
      var seq = Array.isArray(prima) ? prima.slice() : [];
      function mostra() {
        var completo = seq.length === n;
        app.innerHTML = '<div class="domanda">' + intestazione(d) +
          '<p class="nota">' + (completo ? 'Ordine inviato ✓ Puoi ricominciare finché c\'è tempo.' : 'Tocca gli elementi dal primo all\'ultimo.') + '</p>' +
          '<div class="ordina-lista">' + d.mescolati.map(function (x, k) {
            var pos = seq.indexOf(x.i);
            return '<button class="tessera-tel o' + (k % 6) + (pos >= 0 ? ' messa' : '') + '" data-i="' + x.i + '"' + (pos >= 0 ? ' disabled' : '') + '>' +
              '<span class="lettera">' + (pos >= 0 ? pos + 1 : '') + '</span>' + esc(x.testo) + '</button>';
          }).join('') + '</div>' +
          '<div class="riga-bottoni"><button class="btn piccolo-btn" data-az2="annulla"' + (seq.length ? '' : ' disabled') + '>↶ Annulla ultimo</button>' +
          '<button class="btn piccolo-btn" data-az2="ricomincia"' + (seq.length ? '' : ' disabled') + '>Ricomincia</button></div>' + piede() + '</div>';
        app.querySelectorAll('.tessera-tel').forEach(function (b) {
          b.addEventListener('click', function () {
            seq.push(Number(b.getAttribute('data-i')));
            if (navigator.vibrate) navigator.vibrate(15);
            if (seq.length === n) invia('risposta', seq);
            mostra();
          });
        });
        app.querySelectorAll('[data-az2]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (b.getAttribute('data-az2') === 'annulla') seq.pop(); else seq = [];
            mostra();
          });
        });
      }
      mostra();
    },

    // cursore con il valore grande, invio esplicito
    stima: function (d, prima) {
      var passo = d.passo || passoBello((d.max - d.min) / 200);
      var v = prima != null ? prima : Math.round(((d.min + d.max) / 2) / passo) * passo;
      var inviato = prima != null ? prima : null;
      app.innerHTML = '<div class="domanda">' + intestazione(d) +
        '<div class="stima-valore"><b id="sv"></b><span>' + esc(d.unita) + '</span></div>' +
        '<input type="range" id="sr" min="' + d.min + '" max="' + d.max + '" step="' + passo + '" value="' + v + '">' +
        '<div class="riga-bottoni"><button class="btn piccolo-btn" data-d="-1">−</button><span class="estremi">' + U.numero(d.min) + ' – ' + U.numero(d.max) + '</span><button class="btn piccolo-btn" data-d="1">+</button></div>' +
        '<button class="btn" id="si">Invia la stima</button><p class="nota" id="sn">La stima della squadra è la mediana delle vostre.</p>' + piede() + '</div>';
      var sr = app.querySelector('#sr');
      var sv = app.querySelector('#sv');
      var sn = app.querySelector('#sn');
      function aggiorna() { sv.textContent = U.numero(v); }
      sr.addEventListener('input', function () { v = Number(sr.value); aggiorna(); });
      app.querySelectorAll('[data-d]').forEach(function (b) {
        b.addEventListener('click', function () {
          v = Math.max(d.min, Math.min(d.max, Math.round((v + Number(b.getAttribute('data-d')) * passo) * 1000) / 1000));
          sr.value = v; aggiorna();
        });
      });
      app.querySelector('#si').addEventListener('click', function () {
        inviato = v;
        invia('risposta', v);
        if (navigator.vibrate) navigator.vibrate(20);
        sn.textContent = 'Stima inviata: ' + U.numero(inviato) + ' ' + d.unita + '. Puoi cambiarla finché c\'è tempo.';
      });
      if (inviato != null) sn.textContent = 'Stima inviata: ' + U.numero(inviato) + ' ' + d.unita + '. Puoi cambiarla finché c\'è tempo.';
      aggiorna();
    },
  };

  /** Un passo "rotondo" per il cursore (1, 2, 5, 10, 20, 50…). */
  function passoBello(x) {
    if (x <= 0) return 1;
    var e = Math.pow(10, Math.floor(Math.log10(x)));
    var m = x / e;
    var p = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
    return p >= 1 ? Math.round(p) : p;
  }

  function disegnaBarra(s, sq) {
    barra.hidden = false;
    var p = U.posti(s.squadre);
    barra.innerHTML = '<span class="chi">' + esc(s.me.nome) + '</span>' +
      (sq ? '<span class="sq"><span class="an">' + U.animale(sq) + '</span>' + (solo(s) ? '' : esc(sq.nome) + ' · ') + p.posto[sq.id] + '° · ' + sq.punti + ' pt</span>' : '');
  }

  function disegna(s) {
    S = s;
    titolo = s.titolo;
    var me = s.me;
    var sq = miaSquadra(s);
    document.body.style.setProperty('--sq', sq ? sq.colore : '#F2C14E');
    document.body.classList.toggle('faro', s.fase === 'squadre' && !!sq);
    disegnaBarra(s, sq);

    var dura = [s.fase, s.passo, s.sub, me.squadra, s.modo].join(':');
    var morbida = JSON.stringify([me.confermato, me.risposta, me.mg, sq && sq.membri.map(function (m) { return m.ok ? 1 : 0; }).join(''), sq && sq.membri.length, s.collegati]);
    var inGioco = s.fase === 'minigioco' && s.sub === 'gioco' && sq;
    var interattivo = s.fase === 'domanda' && s.sub === 'aperta' && sq && INTERATTIVI.indexOf(s.domanda.tipo) >= 0;

    if (dura !== chiaveDura) {
      fermaMinigioco();
      chiaveDura = dura;
      chiaveMorbida = morbida;
      if (inGioco) { avviaMinigioco(s, sq); return; }
      if (interattivo) {
        avviaInterattivo(s, me);
        if (navigator.vibrate) navigator.vibrate(60);
        aggiornaTimer();
        return;
      }
      app.innerHTML = SCHERMI[s.fase](s, me, sq);
      app.classList.remove('entra');
      void app.offsetWidth;
      app.classList.add('entra');
      if (s.fase === 'domanda' && s.sub === 'aperta' && navigator.vibrate) navigator.vibrate(60);
    } else if (morbida !== chiaveMorbida && !inGioco && !interattivo) {
      chiaveMorbida = morbida;
      app.classList.remove('entra');
      app.innerHTML = SCHERMI[s.fase](s, me, sq);
    }
    aggiornaTimer();
  }

  /* ---------------------------------------------------------- azioni */
  function invia(tipo, valore) {
    return U.post('/api/azione', { token: token, tipo: tipo, valore: valore }).catch(function (e) {
      if (e.stato === 404) { localStorage.removeItem('rally.token'); token = null; if (nome) entra(nome); else mostraIngresso(); }
    });
  }

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-az]');
    if (!b || !S) return;
    var az = b.getAttribute('data-az');
    if (az === 'trovato') {
      var gia = S.me.confermato;
      b.classList.toggle('fatto', !gia);
      b.textContent = gia ? 'Ci siamo trovati!' : '✓ Confermato (tocca per annullare)';
      invia('trovato', !gia);
    } else if (az === 'risposta') {
      var v = Number(b.getAttribute('data-v'));
      var lista = b.parentNode;
      lista.classList.add('scelto');
      Array.prototype.forEach.call(lista.children, function (x) { x.classList.toggle('mia', x === b); });
      if (navigator.vibrate) navigator.vibrate(20);
      invia('risposta', v);
    }
  });

  /* ---------------------------------------------------------- timer */
  function aggiornaTimer() {
    if (!S) return;
    var sec = Math.ceil(U.rimasti(S.deadline) / 1000);
    Array.prototype.forEach.call(document.querySelectorAll('[data-timer]'), function (el) {
      if (!S.deadline) { el.textContent = ''; return; }
      if (S.fase === 'minigioco' && S.sub === 'pronti') el.textContent = Math.max(sec, 0);
      else if (S.fase === 'squadre') el.textContent = 'Tempo per trovarvi: ' + sec + ' s';
      else el.textContent = sec + ' s';
    });
  }
  setInterval(aggiornaTimer, 200);

  /* ---------------------------------------------------------- minigiochi */
  function avviaMinigioco(s, sq) {
    var m = s.minigioco;
    var fine = s.deadline;
    var punteggio = 0;
    var inviato = 0;
    var ultimo = 0;
    function spedisci(forza) {
      if (punteggio === inviato) return;
      var ora = Date.now();
      if (!forza && ora - ultimo < 700) return;
      ultimo = ora;
      inviato = punteggio;
      invia('mg', punteggio);
    }
    app.classList.remove('entra');
    app.innerHTML = '<div class="mg-gioco"><div class="mg-testa"><span>' + esc(m.nome) + '</span><span data-timer></span></div><div id="mg-area"></div></div>';
    var ferma = (GIOCHI[m.gioco] || GIOCHI.tap)(document.getElementById('mg-area'), function (p) { punteggio = p; spedisci(false); });
    var intervallo = setInterval(function () {
      spedisci(false);
      if (U.rimasti(fine) <= 0) fermaMinigioco();
    }, 250);
    mgAttivo = function () { clearInterval(intervallo); ferma(); spedisci(true); };
  }
  function fermaMinigioco() {
    if (mgAttivo) { var f = mgAttivo; mgAttivo = null; f(); }
  }

  var GIOCHI = {
    tap: function (area, punta) {
      var n = 0;
      area.innerHTML = '<div class="tap-conta">0</div><button class="tap-bottone">TOCCA!</button><p class="piccolo">Più veloce che puoi!</p>';
      var b = area.querySelector('.tap-bottone');
      var c = area.querySelector('.tap-conta');
      function tocco(e) {
        e.preventDefault();
        n++;
        c.textContent = n;
        punta(n);
        b.classList.remove('pulsa');
        void b.offsetWidth;
        b.classList.add('pulsa');
      }
      b.addEventListener('pointerdown', tocco);
      return function () { b.removeEventListener('pointerdown', tocco); b.disabled = true; b.textContent = 'Stop!'; };
    },

    riflessi: function (area, punta) {
      var prova = 0;
      var tot = 0;
      var stato = '';
      var t0 = 0;
      var timer = null;
      area.innerHTML = '<div class="rif"><div class="msg"></div><div class="sub"></div></div>';
      var z = area.querySelector('.rif');
      var msg = z.querySelector('.msg');
      var sub = z.querySelector('.sub');
      function mostra(cls, a, b) { z.className = 'rif ' + cls; msg.textContent = a; sub.textContent = b; }
      function prossima() {
        if (prova >= 3) { stato = 'fine'; mostra('fine', 'Fatto!', 'Punti: ' + tot); return; }
        stato = 'aspetta';
        mostra('aspetta', 'Aspetta il verde…', 'Tentativo ' + (prova + 1) + ' di 3 · punti ' + tot);
        timer = setTimeout(function () {
          stato = 'ora';
          mostra('ora', 'ORA!', '');
          t0 = performance.now();
          timer = setTimeout(function () {
            if (stato !== 'ora') return;
            stato = 'pausa';
            prova++;
            mostra('presto', 'Troppo lento!', '0 punti');
            timer = setTimeout(prossima, 1100);
          }, 1500);
        }, 1200 + Math.random() * 2500);
      }
      function tocco(e) {
        e.preventDefault();
        if (stato === 'aspetta') {
          clearTimeout(timer);
          stato = 'pausa';
          prova++;
          mostra('presto', 'Troppo presto!', 'L\'allucinazione è passata: 0 punti');
          if (navigator.vibrate) navigator.vibrate(150);
          timer = setTimeout(prossima, 1300);
        } else if (stato === 'ora') {
          clearTimeout(timer);
          var rt = performance.now() - t0;
          var p = Math.max(0, Math.round(600 - rt));
          tot += p;
          punta(tot);
          stato = 'pausa';
          prova++;
          mostra('preso', Math.round(rt) + ' ms', '+' + p + ' punti');
          timer = setTimeout(prossima, 1100);
        }
      }
      z.addEventListener('pointerdown', tocco);
      prossima();
      return function () {
        clearTimeout(timer);
        z.removeEventListener('pointerdown', tocco);
        if (stato !== 'fine') mostra('fine', 'Tempo!', 'Punti: ' + tot);
      };
    },

    sequenza: function (area, punta) {
      var COLORI = ['#EE7FA8', '#7CC4E8', '#F2C14E', '#8FD07E'];
      var seq = [];
      var pos = 0;
      var record = 0;
      var bloccato = true;
      var vivo = true;
      var timers = [];
      area.innerHTML = '<div class="seq-info"></div><div class="seq-griglia">' +
        COLORI.map(function (c, i) { return '<button class="seq-pad" data-i="' + i + '" style="--c:' + c + '"></button>'; }).join('') + '</div>';
      var info = area.querySelector('.seq-info');
      var pads = Array.prototype.slice.call(area.querySelectorAll('.seq-pad'));
      function dopo(fn, ms) { timers.push(setTimeout(function () { if (vivo) fn(); }, ms)); }
      function accendi(i, ms) { pads[i].classList.add('acceso'); dopo(function () { pads[i].classList.remove('acceso'); }, ms); }
      function aggiungi() { seq.push(Math.floor(Math.random() * 4)); }
      function mostra() {
        bloccato = true;
        info.textContent = 'Guarda bene… (livello ' + seq.length + ')';
        seq.forEach(function (c, k) { dopo(function () { accendi(c, 380); }, 500 + k * 560); });
        dopo(function () { bloccato = false; pos = 0; info.textContent = 'Tocca a te! · record ' + record; }, 500 + seq.length * 560);
      }
      function tocco(e) {
        e.preventDefault();
        if (bloccato) return;
        var i = Number(e.currentTarget.getAttribute('data-i'));
        accendi(i, 180);
        if (i === seq[pos]) {
          pos++;
          if (pos === seq.length) {
            record = Math.max(record, seq.length);
            punta(record);
            bloccato = true;
            info.textContent = 'Perfetto! Livello ' + seq.length + ' superato';
            aggiungi();
            dopo(mostra, 700);
          }
        } else {
          bloccato = true;
          info.textContent = 'Sbagliato! Si riparte da capo · record ' + record;
          if (navigator.vibrate) navigator.vibrate(200);
          seq = [];
          aggiungi(); aggiungi();
          dopo(mostra, 1300);
        }
      }
      pads.forEach(function (p) { p.addEventListener('pointerdown', tocco); });
      aggiungi(); aggiungi();
      mostra();
      return function () {
        vivo = false;
        timers.forEach(clearTimeout);
        bloccato = true;
        pads.forEach(function (p) { p.classList.remove('acceso'); p.removeEventListener('pointerdown', tocco); });
        info.textContent = 'Tempo! Il tuo record: livello ' + record;
      };
    },
  };

  /* ---------------------------------------------------------- avvio */
  fetch('/api/info').then(function (r) { return r.json(); }).then(function (j) {
    titolo = j.titolo || titolo;
    if (!token) mostraIngresso();
  }).catch(function () { if (!token) mostraIngresso(); });
  if (token) collega();
})();
