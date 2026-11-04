/* Proiettore: mostra il gioco e lo comanda (con il PIN di regia). */
(function () {
  'use strict';
  var esc = U.esc;
  var L = U.LETTERE;
  var palco = document.getElementById('palco');
  var scena = document.getElementById('scena');
  var timerEl = document.getElementById('timer');
  var S = null;
  var info = { url: location.origin };
  var chiaveDura = '';
  var chiaveMorbida = '';

  document.querySelector('.marchio-icona').innerHTML = U.MASCOTTE;

  fetch('/api/info').then(function (r) { return r.json(); }).then(function (j) {
    info = j;
    if (S) disegna(S, true);
  });

  /* ---------------------------------------------------------- scala del palco */
  function scala() {
    var k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var x = (window.innerWidth - 1920 * k) / 2;
    var y = (window.innerHeight - 1080 * k) / 2;
    palco.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
  }
  window.addEventListener('resize', scala);
  scala();

  /* ---------------------------------------------------------- pezzi riusati */
  var solo = function (s) { return s.modo === 'singoli'; };
  function chip(q, extra) {
    return '<span class="chip-sq" style="--c:' + q.colore + '"><span class="an">' + U.animale(q) + '</span>' +
      esc(q.nome) + (extra || '') + '</span>';
  }
  function trova(s, id) { return s.squadre.filter(function (q) { return q.id === id; })[0]; }
  function fumetto(contenuto) {
    return '<div class="fumetto-riga"><div class="mascotte-box">' + U.MASCOTTE + '</div><div class="fumetto carta">' + contenuto + '</div></div>';
  }
  /** I primi della classifica del corso (si accumula partita dopo partita). */
  function corsoMini(s) {
    if (!s.corso || !s.corso.length) return '';
    return '<div class="corso-mini"><b>🏆 Classifica del corso</b> ' + s.corso.map(function (r) {
      return '<span>' + r.posto + '. ' + esc(r.nome) + ' <small>' + r.punti + '</small></span>';
    }).join('') + '</div>';
  }
  function classificaMini(s, max) {
    var p = U.posti(s.squadre);
    return '<div class="mini-classifica">' + p.ordine.slice(0, max || 12).map(function (q) {
      return chip(q, ' <b>' + p.posto[q.id] + '°</b> <small>' + q.punti + '</small>');
    }).join('') + '</div>';
  }

  /* ---------------------------------------------------------- corpo delle domande, per meccanica */
  function pct(x) { return '<span class="pct">' + x + '%</span>'; }
  var CORPO_APERTA = {
    quiz: function (d) {
      return (d.brani ? '<div class="brani">' + d.brani.map(function (b) {
        return '<div class="brano"><span class="etichetta">' + esc(b.etichetta) + '</span><p>' + esc(b.testo) + '</p></div>';
      }).join('') + '</div>' : '') +
        (d.immagine ? '<img class="immagine" src="' + esc(d.immagine) + '" alt="">' : '') +
        '<div class="opzioni">' + d.opzioni.map(function (o, i) {
          return '<div class="opz o' + i + '"><span class="lettera">' + L[i] + '</span><span class="t">' + esc(o) + '</span></div>';
        }).join('') + '</div>';
    },
    vero_falso: function (d) {
      return '<div class="raffica">' + d.affermazioni.map(function (a, i) {
        return '<div class="affermazione"><span class="lettera">' + (i + 1) + '</span><span class="t">' + esc(a.testo) + '</span></div>';
      }).join('') + '</div>';
    },
    ordina: function (d) {
      return '<div class="da-ordinare">' + d.mescolati.map(function (x, k) {
        return '<div class="tessera o' + (k % 6) + '"><span class="t">' + esc(x.testo) + '</span></div>';
      }).join('') + '</div><div class="suggerimento">Sul telefono: tocca gli elementi dal primo all\'ultimo</div>';
    },
    smista: function (d) {
      return '<div class="cestini n' + d.categorie.length + '">' + d.categorie.map(function (c, i) {
        return '<div class="cestino o' + i + '"><div class="cestino-nome">' + esc(c) + '</div></div>';
      }).join('') + '</div><div class="da-smistare">' + d.elementi.map(function (x) {
        return '<span class="tessera-piccola">' + esc(x.testo) + '</span>';
      }).join('') + '</div>';
    },
    stima: function (d) {
      return '<div class="stima-scala"><span class="estremo">' + U.numero(d.min) + '</span><div class="righello"><span class="punto-domanda">?</span></div><span class="estremo">' + U.numero(d.max) + '</span></div>' +
        '<div class="stima-unita">' + esc(d.unita) + '</div>';
    },
  };
  CORPO_APERTA.umano_ai = CORPO_APERTA.sala = CORPO_APERTA.sincronia = CORPO_APERTA.quiz;

  var CORPO_ESITO = {
    quiz: function (d) {
      var e = d.esito;
      var evidenzia = e.corretta != null ? [e.corretta] : (e.maggioranza || []);
      return '<div class="opzioni">' + d.opzioni.map(function (o, i) {
        var p = e.tot ? Math.round(100 * e.conteggi[i] / e.tot) : 0;
        var cls = evidenzia.length ? (evidenzia.indexOf(i) >= 0 ? 'giusta' : 'spenta') : '';
        return '<div class="opz o' + i + ' ' + cls + '"><span class="barra" style="width:' + p + '%"></span><span class="lettera">' + L[i] +
          '</span><span class="t">' + esc(o) + '</span><span class="num">' + e.conteggi[i] + '</span></div>';
      }).join('') + '</div>';
    },
    vero_falso: function (d) {
      var e = d.esito;
      return '<div class="raffica">' + d.affermazioni.map(function (a, i) {
        return '<div class="affermazione ' + (a.vero ? 'vera' : 'falsa') + '"><span class="verdetto">' + (a.vero ? 'VERO' : 'FALSO') + '</span><span class="t">' + esc(a.testo) + '</span>' + pct(e.giusti[i]) + '</div>';
      }).join('') + '</div>';
    },
    ordina: function (d) {
      var e = d.esito;
      return '<div class="ordinati">' + d.elementi.map(function (t, i) {
        return '<div class="tessera o' + (i % 6) + '"><span class="lettera">' + (i + 1) + '</span><span class="t">' + esc(t) + '</span>' + pct(e.giusti[i]) + '</div>';
      }).join('') + '</div><div class="suggerimento">Ordini perfetti: <b>' + e.perfetti + '</b> su ' + e.tot + ' · la percentuale indica chi ha messo quell\'elemento al posto giusto</div>';
    },
    smista: function (d) {
      var e = d.esito;
      return '<div class="cestini n' + d.categorie.length + '">' + d.categorie.map(function (c, ci) {
        return '<div class="cestino o' + ci + '"><div class="cestino-nome">' + esc(c) + '</div>' + d.elementi.map(function (x, i) {
          return x.categoria === ci ? '<div class="tessera-piccola">' + esc(x.testo) + ' ' + pct(e.giusti[i]) + '</div>' : '';
        }).join('') + '</div>';
      }).join('') + '</div>';
    },
    stima: function (d, s) {
      var e = d.esito;
      var pos = function (v) { return Math.max(0, Math.min(100, 100 * (v - d.min) / (d.max - d.min))); };
      var segnali = s.squadre.filter(function (q) { return (e.perSquadra[q.id] || {}).mediana != null; })
        .sort(function (a, b) { return e.perSquadra[a.id].mediana - e.perSquadra[b.id].mediana; });
      var ultimo = -100;
      var livello = 0;
      return '<div class="stima-scala esito-stima"><span class="estremo">' + U.numero(d.min) + '</span><div class="righello">' +
        segnali.map(function (q) {
          var r = e.perSquadra[q.id];
          var x = pos(r.mediana);
          livello = x - ultimo < 6 ? livello + 1 : 0;
          ultimo = x;
          return '<div class="segnale" style="left:' + x + '%;--liv:' + (livello % 3) + '"><span class="an">' + U.animale(q, r.posto === 1 ? 'felice' : '') + '</span><span class="val">' + U.numero(r.mediana) + '</span></div>';
        }).join('') +
        '<div class="valore-vero" style="left:' + pos(d.valore) + '%"><span>' + U.numero(d.valore) + '</span></div>' +
        '</div><span class="estremo">' + U.numero(d.max) + '</span></div><div class="stima-unita">' + esc(d.unita) + ' · la stima di ogni squadra è la mediana dei suoi membri</div>';
    },
  };
  CORPO_ESITO.umano_ai = CORPO_ESITO.sala = CORPO_ESITO.sincronia = CORPO_ESITO.quiz;

  /* ---------------------------------------------------------- scene */
  var SCENE = {
    lobby: function (s) {
      var n = s.collegati;
      var testo = solo(s)
        ? '<p class="forte">Modalità prova: ognuno gioca per sé, con il suo simbolo sul percorso.</p>'
        : '<p class="forte">Il gioco forma squadre fino a sei persone: dovrai trovare i tuoi compagni in sala.</p>';
      return '<div class="lobby">' + fumetto(
        '<div class="scelta-partita"><button class="freccia" data-cmd="sessione" data-valore="-1" title="Partita precedente ( [ )">◀</button>' +
        '<span class="pillola-scura">Partita ' + (s.sessione.indice + 1) + ' di ' + s.sessione.n + '</span>' +
        '<button class="freccia" data-cmd="sessione" data-valore="+1" title="Partita successiva ( ] )">▶</button>' +
        '<span class="titolo-partita">' + esc(s.sessione.titolo) + '</span></div>' +
        '<h1>Inquadra il QR ed entra in gara!</h1>' + testo +
        '<p class="contatore"><b>' + n + '</b> ' + (n === 1 ? 'giocatore collegato' : 'giocatori collegati') + '</p>' +
        '<div class="nomi">' + (s.nomi || []).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>' +
        corsoMini(s)
      ) +
        '<div class="cartello carta"><h2>Si gioca!</h2><div class="qr"><img src="/api/qr" alt="QR per entrare"></div>' +
        '<div class="url">' + esc(info.url.replace(/^https?:\/\//, '')) + '</div>' +
        '<div class="modo">' + (solo(s) ? '👤 Modalità singoli' : '👥 Modalità squadre') + '</div></div></div>';
    },

    squadre: function (s) {
      if (solo(s)) {
        return fumetto('<span class="pillola-scura">Modalità singoli</span><h1>Ognuno per sé!</h1>' +
          '<p class="forte">Ogni giocatore ha il suo simbolo: cercalo sul percorso qui sotto.</p>' +
          '<div class="singoli">' + s.squadre.slice(0, 24).map(function (q) { return chip(q); }).join('') + '</div>');
      }
      var bonus = s.incontro && s.incontro.bonus;
      var fatto = s.sub === 'fatto';
      return '<div class="squadre"><h1>' + (fatto ? 'Squadre formate!' : 'Trovate la vostra squadra!') + '</h1>' +
        '<p class="sotto">' + (fatto
          ? 'Chi si è trovato parte avvantaggiato. Presentatevi: nome, ruolo e un uso dell\'AI nel vostro lavoro.'
          : 'Stesso colore, stesso animale: alzate il telefono e cercatevi. Poi toccate «Ci siamo trovati».') + '</p>' +
        '<div class="griglia-sq n' + s.squadre.length + '">' + s.squadre.map(function (q) {
          var ok = q.membri.filter(function (m) { return m.ok; }).length;
          return '<div class="card-sq" style="--c:' + q.colore + '"><div class="sq-testa"><span class="animale-box">' + U.animale(q) + '</span>' + esc(q.nome) +
            '<span class="conta">' + (bonus ? '+' + (bonus[q.id] || 0) : ok + '/' + q.membri.length) + '</span></div>' +
            '<ul>' + q.membri.map(function (m) { return '<li class="' + (m.ok ? 'ok' : '') + '">' + esc(m.nome) + '</li>'; }).join('') + '</ul></div>';
        }).join('') + '</div></div>';
    },

    tappa: function (s) {
      var t = s.tappa;
      return fumetto('<span class="pillola-scura">Tappa ' + (t.indice + 1) + ' di ' + s.nTappe + '</span>' +
        (t.doppi ? '<span class="badge-doppi">Punti doppi ×2</span>' : '') +
        '<h1>' + esc(t.nome) + '</h1><p class="forte">' + esc(t.sotto || '') + '</p>' + classificaMini(s, solo(s) ? 10 : 6));
    },

    domanda: function (s) {
      var d = s.domanda;
      var e = d.esito;
      var testa = '<span class="pillola-scura">' + U.TIPO[d.tipo] + '</span><h1 class="testo-domanda">' + esc(d.testo) + '</h1>';
      var nota = '<div class="nota">' + U.nota(d.tipo, solo(s)) + ' · <b>' + d.risposte + '</b>/' + d.attesi + (d.tipo === 'stima' ? ' stime' : ' hanno finito') + '</div>';
      var corpo = (e ? CORPO_ESITO : CORPO_APERTA)[d.tipo] || (e ? CORPO_ESITO.quiz : CORPO_APERTA.quiz);
      if (!e) return '<div class="domanda tipo-' + d.tipo + '">' + testa + corpo(d, s) + nota + '</div>';
      var titoloSpiega = d.tipo === 'sala' ? (e.maggioranza && e.maggioranza.length > 1 ? 'La sala è divisa · parliamone' : 'La sala ha scelto · parliamone')
        : d.tipo === 'sincronia' ? 'Parliamone' : 'Perché';
      var spiega = d.spiegazione || d.spunto;
      var ordinate = s.squadre.slice().sort(function (a, b) { return (e.perSquadra[b.id] || {}).punti - (e.perSquadra[a.id] || {}).punti; });
      var molti = ordinate.length > 6;
      var punti = '<div class="punti-squadre' + (molti ? ' molti' : '') + '">' + ordinate.slice(0, 12).map(function (q) {
        var r = e.perSquadra[q.id] || { punti: 0 };
        var extra = d.tipo === 'sincronia' && r.accordo ? ' <small>' + U.ACCORDO[r.accordo] + '</small>' : '';
        return chip(q, ' <b>+' + r.punti + '</b>' + extra);
      }).join('') + '</div>';
      return '<div class="domanda esito tipo-' + d.tipo + '">' + testa + corpo(d, s) +
        '<div class="esito-basso">' + (spiega ? '<div class="spiegazione"><b>' + titoloSpiega + '</b>' + esc(spiega) + '</div>' : '<div></div>') + punti + '</div></div>';
    },

    minigioco: function (s) {
      var m = s.minigioco;
      if (s.sub === 'pronti') {
        return fumetto('<span class="pillola-scura">Minigioco' + (s.tappa && s.tappa.doppi ? ' · punti doppi' : '') + '</span>' +
          '<h1>' + esc(m.nome) + '</h1><p class="forte">' + esc(m.come) + '</p>' +
          '<p>Si parte tra <span class="conto" data-conto>' + Math.ceil(U.rimasti(s.deadline) / 1000) + '</span></p>');
      }
      if (s.sub === 'gioco') {
        return fumetto('<span class="pillola-scura">Minigioco</span><h1>' + esc(m.nome) + '</h1>' +
          '<div class="via-grande">Giocate sul telefono!</div><p class="nota"><b>' + m.inviati + '</b>/' + m.attesi + ' giocatori hanno già un punteggio</p>');
      }
      var e = m.esito.perSquadra;
      var ord = s.squadre.slice().sort(function (a, b) { return (e[b.id].media || 0) - (e[a.id].media || 0); });
      return '<div class="mg-centro"><span class="pillola-scura">Risultato del minigioco</span><h1>' + esc(m.nome) + '</h1>' +
        '<div class="classifica-mg">' + ord.slice(0, 7).map(function (q) {
          var r = e[q.id];
          return '<div class="riga-mg" style="--c:' + q.colore + '"><span class="pos">' + (r.posto ? r.posto + '°' : '–') + '</span>' +
            '<span class="chi"><span class="an">' + U.animale(q, r.posto === 1 ? 'felice' : '') + '</span>' + esc(q.nome) + '</span><span>' + (solo(s) ? '' : 'media ') + U.valoreMg(m.gioco, r.media) +
            '</span><span class="pt">+' + r.punti + '</span></div>';
        }).join('') + '</div></div>';
    },

    turbo: function (s) {
      var b = (s.turbo && s.turbo.bonus) || {};
      var chi = s.squadre.filter(function (q) { return b[q.id]; });
      return fumetto('<span class="pillola-scura">Turbo</span><h1>⚡ Spinta per chi insegue!</h1>' +
        (chi.length ? '<p class="forte">' + (solo(s) ? 'Gli ultimi in classifica' : 'Le squadre in fondo') + ' ricevono punti extra. La gara è ancora aperta!</p><div class="mini-classifica">' +
          chi.map(function (q) { return chip(q, ' <b>+' + b[q.id] + '</b>'); }).join('') + '</div>'
          : '<p class="forte">Classifica serratissima: nessuno ha bisogno di una spinta.</p>'));
    },

    podio: function (s) {
      var p = s.podio;
      var st = p.stat;
      var perPosto = p.classifica.map(function (c) { return { q: trova(s, c.id), posto: c.posto }; }).filter(function (x) { return x.q; });
      var primi = perPosto.slice(0, 3);
      var ordinePalco = [primi[1], primi[0], primi[2]].filter(Boolean);
      var vincitori = perPosto.filter(function (x) { return x.posto === 1; }).map(function (x) { return x.q.nome; });
      var primoArticolo = perPosto.length ? perPosto[0].q.articolo : '';
      var titolo = vincitori.length > 3 ? vincitori.length + ' a pari merito in vetta!'
        : vincitori.length > 1 ? esc(vincitori.join(' e ')) + ' a pari merito!'
        : solo(s) ? 'Vince ' + esc(vincitori[0] || '') + '!' : 'Vincono ' + (primoArticolo || '') + ' ' + esc(vincitori[0] || '') + '!';
      return '<div class="podio"><div class="podio-palco">' + ordinePalco.map(function (x) {
        return '<div class="gradino p' + Math.min(x.posto, 3) + '" style="--c:' + x.q.colore + '"><div class="an">' + U.animale(x.q, x.posto === 1 ? 'felice' : '') + '</div>' +
          '<div class="nome">' + esc(x.q.nome) + '</div><div class="pt">' + x.q.punti + ' punti</div>' +
          '<div class="membri">' + (solo(s) ? '' : x.q.membri.map(function (m) { return esc(m.nome); }).join(' · ')) + '</div>' +
          '<div class="blocco">' + x.posto + '</div></div>';
      }).join('') + '</div>' +
        '<div class="podio-lato"><span class="pillola-scura" style="align-self:flex-start">Traguardo</span><h1>' + titolo + '</h1>' +
        (perPosto.length > 3 ? '<div class="mini-classifica">' + perPosto.slice(3, solo(s) ? 9 : 6).map(function (x) { return chip(x.q, ' <b>' + x.posto + '°</b> <small>' + x.q.punti + '</small>'); }).join('') + '</div>' : '') +
        '<div class="stat"><div><b>' + st.giocatori + '</b>giocatori</div><div><b>' + st.risposte + '</b>risposte date</div>' +
        (st.mediaCorrette != null ? '<div><b>' + st.mediaCorrette + '%</b>risposte corrette in media</div>' : '') +
        '<div><b>' + (solo(s) ? st.minuti : st.nuoveCoppie) + '</b>' + (solo(s) ? 'minuti di gioco' : 'nuove coppie di compagni') + '</div>' +
        (st.difficile ? '<div class="largo">La più difficile (' + st.difficile.p + '% di risposte giuste)<b>' + esc(st.difficile.testo) + '</b></div>' : '') +
        '</div>' + corsoMini(s) + '</div></div>';
    },
  };

  /** Le scene che hanno bisogno di tutto lo spazio nascondono il paesaggio. */
  function conPista(s) {
    if (s.fase === 'domanda' || s.fase === 'podio') return false;
    if (s.fase === 'squadre') return solo(s);
    if (s.fase === 'minigioco') return s.sub !== 'esito';
    return true;
  }

  function pillola(s) {
    if (s.fase === 'lobby') return 'Partita ' + (s.sessione.indice + 1) + ' di ' + s.sessione.n + ' · ' + esc(s.sessione.titolo) + (solo(s) ? ' · singoli' : '');
    if (s.fase === 'podio') return 'Traguardo · ' + esc(s.sessione.titolo);
    if (s.fase === 'squadre') return solo(s) ? 'Si parte' : 'Formazione delle squadre';
    if (s.fase === 'podio') return 'Classifica finale';
    if (s.tappa) return 'Tappa ' + (s.tappa.indice + 1) + ' di ' + s.nTappe + ' · ' + esc(s.tappa.nome) + (s.tappa.doppi ? ' · <b>×2</b>' : '');
    return '';
  }

  function firmaMorbida(s) {
    return JSON.stringify([
      s.nomi, s.collegati, s.modo, s.sessione.indice, s.corso,
      s.squadre.map(function (q) { return [q.punti, q.membri.map(function (m) { return m.ok ? 1 : 0; }).join(''), q.membri.length]; }),
      s.domanda && [s.domanda.risposte, s.domanda.attesi], s.minigioco && [s.minigioco.inviati, s.minigioco.attesi],
    ]);
  }

  function disegna(s, forza) {
    S = s;
    document.getElementById('titolo').textContent = s.titolo;
    document.getElementById('pillola').innerHTML = pillola(s);
    var pista = conPista(s);
    palco.classList.toggle('con-pista', pista);
    palco.classList.toggle('senza-pista', !pista);
    var dura = [s.fase, s.passo, s.sub].join(':');
    var morbida = firmaMorbida(s);
    if (dura !== chiaveDura) suonaFase(s);
    if (dura !== chiaveDura || forza) {
      scena.innerHTML = SCENE[s.fase](s);
      scena.classList.remove('entra');
      void scena.offsetWidth;
      if (dura !== chiaveDura) scena.classList.add('entra');
    } else if (morbida !== chiaveMorbida) {
      scena.classList.remove('entra');
      scena.innerHTML = SCENE[s.fase](s);
    }
    chiaveDura = dura;
    chiaveMorbida = morbida;
    aggiornaPista(s);
    aggiornaTimer();
  }

  /* ---------------------------------------------------------- suoni */
  function suonaFase(s) {
    var f = s.fase;
    var sub = s.sub;
    if (f === 'domanda' && sub === 'aperta') { Suono.atmosfera('pensiero'); Suono.effetto('via'); }
    else if (f === 'domanda' || (f === 'minigioco' && sub === 'esito')) { Suono.atmosfera('festa'); Suono.effetto('ding'); }
    else if (f === 'minigioco' && sub === 'pronti') { Suono.atmosfera('festa'); Suono.effetto('whoosh'); }
    else if (f === 'minigioco' && sub === 'gioco') { Suono.atmosfera('gioco'); Suono.effetto('via'); }
    else if (f === 'turbo') { Suono.atmosfera('festa'); Suono.effetto('turbo'); }
    else if (f === 'podio') { Suono.atmosfera('festa'); Suono.effetto('fanfara'); }
    else { Suono.atmosfera('festa'); if (f !== 'lobby') Suono.effetto('whoosh'); }
  }
  var avvisoAudio = document.getElementById('avviso-audio');
  function sbloccaAudio() {
    Suono.avvia();
    avvisoAudio.hidden = true;
  }
  document.addEventListener('pointerdown', sbloccaAudio, { once: true });

  /* ---------------------------------------------------------- pista */
  var NS = 'http://www.w3.org/2000/svg';
  var strada = document.getElementById('strada');
  var segni = document.getElementById('segni');
  var gettoni = document.getElementById('gettoni');
  var lunghezza = 0;
  var segniFatti = false;

  function nodo(tag, attr, testo) {
    var n = document.createElementNS(NS, tag);
    for (var k in attr) n.setAttribute(k, attr[k]);
    if (testo != null) n.textContent = testo;
    return n;
  }

  /** Mette dentro il gettone l'SVG dell'animale (contenuto del viewBox 120x130). */
  function disegnaAnimale(g, q, classe) {
    var tmp = new DOMParser().parseFromString(ANIMALI.svg(q.specie, q.colore, { classe: classe }), 'image/svg+xml').documentElement;
    var dest = g.querySelector('svg');
    dest.setAttribute('class', tmp.getAttribute('class'));
    dest.setAttribute('style', tmp.getAttribute('style'));
    while (dest.firstChild) dest.removeChild(dest.firstChild);
    while (tmp.firstChild) dest.appendChild(document.importNode(tmp.firstChild, true)) && tmp.removeChild(tmp.firstChild);
  }

  function aggiornaPista(s) {
    if (!lunghezza) lunghezza = strada.getTotalLength();
    if (!segniFatti && s.inizioTappe) {
      segniFatti = true;
      s.inizioTappe.forEach(function (f, i) {
        if (f < 0.04) return; // la prima tappa parte quasi subito: basta la scritta VIA
        var pt = strada.getPointAtLength(f * lunghezza);
        var g = nodo('g', { class: 'segno' });
        g.appendChild(nodo('circle', { cx: pt.x, cy: pt.y, r: 24 }));
        g.appendChild(nodo('text', { x: pt.x, y: pt.y + 1 }, String(i + 1)));
        segni.appendChild(g);
      });
    }
    var tanti = s.squadre.length > 8;
    var w = tanti ? 66 : 96;                // larghezza dell'animale
    var h = Math.round(w * 130 / 120);
    var p = U.posti(s.squadre);
    var presenti = {};
    var ord = s.squadre.slice().sort(function (a, b) { return a.progresso - b.progresso; });
    var xBase = -1e9;
    var yBase = 0;
    var k = 0;
    ord.forEach(function (q) {
      presenti[q.id] = true;
      var pt = strada.getPointAtLength(q.progresso * lunghezza);
      // gli animali vicini formano un gruppetto: righe da 4, quelle dietro un po' più in alto
      if (Math.abs(pt.x - xBase) < w * 0.7) { k++; } else { k = 0; xBase = pt.x; yBase = pt.y; }
      var x = (k ? xBase : pt.x) + (k % 4) * w * 0.62;
      var y = (k ? yBase : pt.y) - Math.floor(k / 4) * h * 0.5;
      var g = document.getElementById('tok-' + q.id);
      if (!g || g.getAttribute('data-w') !== String(w)) {
        if (g) g.remove();
        g = nodo('g', { id: 'tok-' + q.id, class: 'gettone', 'data-w': w });
        g.appendChild(nodo('svg', { x: -w / 2, y: -h + 10, width: w, height: h, viewBox: '0 0 120 130', overflow: 'visible' }));
        var b = nodo('g', { class: 'badge', transform: 'translate(' + (w * 0.36) + ' ' + (-h * 0.82) + ')' });
        b.appendChild(nodo('circle', { r: tanti ? 12 : 16 }));
        b.appendChild(nodo('text', { y: 1, 'font-size': tanti ? 14 : 18 }, ''));
        g.appendChild(b);
        g.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        gettoni.appendChild(g);
        disegnaAnimale(g, q, '');
      }
      // se avanza, l'animale saltella finché non arriva
      var prima = g.getAttribute('data-p');
      if (prima != null && Number(prima) !== q.progresso) {
        disegnaAnimale(g, q, 'cammina');
        clearTimeout(g._fermo);
        g._fermo = setTimeout(function () { disegnaAnimale(g, q, ''); }, 1500);
      }
      g.setAttribute('data-p', q.progresso);
      g.querySelector('.badge text').textContent = p.posto[q.id];
      g.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
    var ordineVoluto = ord.map(function (q) { return 'tok-' + q.id; }).join(',');
    var ordineAttuale = Array.prototype.map.call(gettoni.children, function (g) { return g.id; }).join(',');
    if (ordineVoluto !== ordineAttuale) {
      ord.forEach(function (q) { var g = document.getElementById('tok-' + q.id); if (g) gettoni.appendChild(g); });
    }
    Array.prototype.slice.call(gettoni.children).forEach(function (g) {
      if (!presenti[g.id.slice(4)]) g.remove();
    });
  }

  /* ---------------------------------------------------------- timer */
  var ultimoTic = 0;
  function aggiornaTimer() {
    if (!S) return;
    var visibile = S.deadline && (S.sub === 'cerca' || S.sub === 'aperta' || S.sub === 'gioco');
    timerEl.hidden = !visibile;
    if (visibile) {
      var sec = Math.ceil(U.rimasti(S.deadline) / 1000);
      timerEl.textContent = sec;
      timerEl.classList.toggle('urgente', sec <= 5);
      if (sec <= 5 && sec > 0 && sec !== ultimoTic) { ultimoTic = sec; Suono.effetto('tic'); }
    }
    var conto = scena.querySelector('[data-conto]');
    if (conto) conto.textContent = Math.max(0, Math.ceil(U.rimasti(S.deadline) / 1000));
  }
  setInterval(aggiornaTimer, 200);

  /* ---------------------------------------------------------- regia */
  var avviso = document.getElementById('avviso');
  var timerAvviso = null;
  function mostraAvviso(t, positivo) {
    avviso.textContent = t;
    avviso.classList.toggle('positivo', !!positivo);
    avviso.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { avviso.hidden = true; }, 3500);
  }
  function pin() {
    var p = sessionStorage.getItem('rally.pin');
    if (!p) {
      p = window.prompt('PIN di regia');
      if (p) sessionStorage.setItem('rally.pin', p);
    }
    return p;
  }
  function comanda(cmd, extra) {
    var p = pin();
    if (!p) return;
    var corpo = { pin: p, cmd: cmd };
    for (var k in extra || {}) corpo[k] = extra[k];
    U.post('/api/host', corpo).catch(function (e) {
      if (e.stato === 403) sessionStorage.removeItem('rally.pin');
      mostraAvviso(e.message);
    });
  }
  function azione(a) {
    if (a === 'avanti' || a === 'salta' || a === 'podio' || a === 'bot' || a === 'modo') return comanda(a);
    if (a === 'precedente' || a === 'successiva') return comanda('sessione', { valore: a === 'precedente' ? '-1' : '+1' });
    if (a === 'musica') {
      Suono.avvia();
      mostraAvviso(Suono.musica() ? '🎵 Musica accesa' : '🔇 Musica spenta', true);
      return;
    }
    if (a === 'reset') {
      if (window.confirm('Ricominciare da capo? Punteggi e squadre si azzerano (i giocatori restano collegati, i bot vengono tolti).')) comanda('reset');
      return;
    }
    if (a === 'csv') { var p = pin(); if (p) location.href = '/api/risultati.csv?pin=' + encodeURIComponent(p); return; }
    if (a === 'schermo') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {});
      return;
    }
    if (a === 'nascondi') document.getElementById('regia').classList.toggle('nascosta');
  }
  // i pulsanti dentro la scena (es. scelta della partita nella lobby)
  scena.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cmd]');
    if (b) comanda(b.getAttribute('data-cmd'), b.hasAttribute('data-valore') ? { valore: b.getAttribute('data-valore') } : null);
  });
  document.getElementById('regia').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) { b.blur(); azione(b.getAttribute('data-cmd') || b.getAttribute('data-azione')); }
  });
  var TASTI = {
    ' ': 'avanti', ArrowRight: 'avanti', Enter: 'avanti', n: 'salta', p: 'podio', g: 'modo', b: 'bot', r: 'reset',
    f: 'schermo', h: 'nascondi', m: 'musica', '[': 'precedente', ']': 'successiva', PageUp: 'precedente', PageDown: 'successiva',
  };
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!Suono.avviato()) {
      sbloccaAudio();
      if (e.key !== 'm' && e.key !== 'M') return; // il primo tasto serve solo ad accendere l'audio
    }
    var a = TASTI[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (a) { e.preventDefault(); azione(a); }
  });

  /* ---------------------------------------------------------- collegamento */
  U.flusso('/api/flusso?host=1', function (s) { disegna(s); }, function (on) {
    if (!on) mostraAvviso('Connessione al server persa: riprovo…');
  });
})();
