/* ============================================================
   Gli animali del Rally: personaggi 2D a contorno spesso, in SVG,
   generati da un corpo comune + i tratti di ogni specie.
   Ognuno porta una pettorina da gara del colore della squadra.
   Le animazioni (respiro, battito di ciglia, orecchie, salto)
   stanno in base.css, classi .animale / .an-*.
   ============================================================ */
(function () {
  'use strict';
  var INK = '#2A2420';
  var BIANCO = '#FFFDF7';
  var ROSA = '#F4A3B5';

  var SPECIE = {
    volpe:    { corpo: '#F08A4B', orecchie: 'punta', interno: '#2A2420', muso: 'volpe', emoji: '🦊' },
    gufo:     { corpo: '#9C7652', orecchie: 'ciuffi', muso: 'gufo', emoji: '🦉' },
    rana:     { corpo: '#7CC46A', orecchie: 'nessuna', muso: 'rana', emoji: '🐸' },
    panda:    { corpo: BIANCO, orecchie: 'tonde', colOrecchie: INK, muso: 'panda', emoji: '🐼' },
    pinguino: { corpo: '#3E4452', orecchie: 'nessuna', muso: 'pinguino', emoji: '🐧' },
    gatto:    { corpo: '#B9A99A', orecchie: 'punta', interno: ROSA, muso: 'gatto', emoji: '🐱' },
    coniglio: { corpo: '#EDE5DA', orecchie: 'lunghe', interno: ROSA, muso: 'coniglio', emoji: '🐰' },
    maiale:   { corpo: '#F6B3C3', orecchie: 'maiale', muso: 'maiale', emoji: '🐷' },
    topo:     { corpo: '#B5B5C2', orecchie: 'topo', interno: ROSA, muso: 'gatto', emoji: '🐭' },
    koala:    { corpo: '#A3ABB5', orecchie: 'koala', interno: BIANCO, muso: 'koala', emoji: '🐨' },
    tigre:    { corpo: '#F2A33A', orecchie: 'tonde', colOrecchie: '#F2A33A', interno: BIANCO, muso: 'tigre', emoji: '🐯' },
    pulcino:  { corpo: '#F7D44C', orecchie: 'ciuffo', muso: 'pulcino', emoji: '🐤' },
  };

  function attr(o) {
    var s = '';
    for (var k in o) s += ' ' + k + '="' + o[k] + '"';
    return s;
  }
  var tratto = function (w) { return attr({ stroke: INK, 'stroke-width': w || 5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }); };

  function orecchie(sp) {
    var c = sp.colOrecchie || sp.corpo;
    var i = sp.interno || ROSA;
    switch (sp.orecchie) {
      case 'punta':
        return '<path d="M28 54 L30 14 L56 38 Z" fill="' + c + '"' + tratto() + '/><path d="M92 54 L90 14 L64 38 Z" fill="' + c + '"' + tratto() + '/>' +
          '<path d="M33 40 L34 24 L46 35 Z" fill="' + i + '"/><path d="M87 40 L86 24 L74 35 Z" fill="' + i + '"/>';
      case 'tonde':
        return '<circle cx="30" cy="40" r="14" fill="' + c + '"' + tratto() + '/><circle cx="90" cy="40" r="14" fill="' + c + '"' + tratto() + '/>' +
          (sp.interno ? '<circle cx="31" cy="41" r="6" fill="' + sp.interno + '"/><circle cx="89" cy="41" r="6" fill="' + sp.interno + '"/>' : '');
      case 'topo':
        return '<circle cx="26" cy="38" r="19" fill="' + c + '"' + tratto() + '/><circle cx="94" cy="38" r="19" fill="' + c + '"' + tratto() + '/>' +
          '<circle cx="27" cy="39" r="10" fill="' + i + '"/><circle cx="93" cy="39" r="10" fill="' + i + '"/>';
      case 'koala':
        return '<circle cx="22" cy="44" r="20" fill="' + c + '"' + tratto() + '/><circle cx="98" cy="44" r="20" fill="' + c + '"' + tratto() + '/>' +
          '<circle cx="24" cy="46" r="10" fill="' + i + '"/><circle cx="96" cy="46" r="10" fill="' + i + '"/>';
      case 'lunghe':
        return '<ellipse cx="44" cy="20" rx="11" ry="26" transform="rotate(-12 44 20)" fill="' + c + '"' + tratto() + '/>' +
          '<ellipse cx="76" cy="20" rx="11" ry="26" transform="rotate(12 76 20)" fill="' + c + '"' + tratto() + '/>' +
          '<ellipse cx="44" cy="22" rx="5" ry="17" transform="rotate(-12 44 22)" fill="' + i + '"/><ellipse cx="76" cy="22" rx="5" ry="17" transform="rotate(12 76 22)" fill="' + i + '"/>';
      case 'maiale':
        return '<path d="M30 46 L26 22 L50 36 Z" fill="' + c + '"' + tratto() + '/><path d="M90 46 L94 22 L70 36 Z" fill="' + c + '"' + tratto() + '/>';
      case 'ciuffi':
        return '<path d="M30 44 L24 16 L48 34 Z" fill="' + c + '"' + tratto() + '/><path d="M90 44 L96 16 L72 34 Z" fill="' + c + '"' + tratto() + '/>';
      case 'ciuffo':
        return '<path d="M56 36 Q50 18 60 14 Q58 26 64 34" fill="' + c + '"' + tratto(4) + '/>';
      case 'rana':
        return '<circle cx="40" cy="42" r="16" fill="' + sp.corpo + '"' + tratto() + '/><circle cx="80" cy="42" r="16" fill="' + sp.corpo + '"' + tratto() + '/>';
      default:
        return '';
    }
  }

  /** Occhi neri con il riflesso; per il panda su sfondo bianco dentro la macchia. */
  function occhi(xs, y, opz) {
    opz = opz || {};
    return '<g class="an-occhi">' + xs.map(function (x) {
      return (opz.fondo ? '<circle cx="' + x + '" cy="' + y + '" r="' + (opz.fondoR || 7) + '" fill="' + opz.fondo + '"' + (opz.bordo ? tratto(4) : '') + '/>' : '') +
        '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (opz.rx || 4.6) + '" ry="' + (opz.ry || 6) + '" fill="' + INK + '"/>' +
        '<circle cx="' + (x + 1.6) + '" cy="' + (y - 2.2) + '" r="1.8" fill="#fff"/>';
    }).join('') + '</g>';
  }
  var guance = '<ellipse cx="34" cy="82" rx="7" ry="4.5" fill="#F26D8F" opacity=".45"/><ellipse cx="86" cy="82" rx="7" ry="4.5" fill="#F26D8F" opacity=".45"/>';
  var baffi = '<g' + tratto(2.5) + ' fill="none"><path d="M40 80 L24 77"/><path d="M40 85 L25 87"/><path d="M80 80 L96 77"/><path d="M80 85 L95 87"/></g>';
  var nasoRosa = '<path d="M55 77 L65 77 L60 83 Z" fill="#E86F8E"' + tratto(3) + '/>';
  var bocca = '<path d="M53 87 Q57 91 60 87 Q63 91 67 87" fill="none"' + tratto(3) + '/>';

  function muso(sp) {
    switch (sp.muso) {
      case 'volpe':
        return '<path d="M34 76 Q60 60 86 76 Q78 96 60 97 Q42 96 34 76 Z" fill="' + BIANCO + '"/>' + occhi([46, 70], 66) +
          '<ellipse cx="60" cy="80" rx="6" ry="4.5" fill="' + INK + '"/>' + bocca;
      case 'gatto':
        return occhi([46, 74], 66) + guance + nasoRosa + bocca + baffi;
      case 'coniglio':
        return occhi([46, 74], 66) + guance + nasoRosa + bocca +
          '<rect x="56" y="89" width="8" height="7" rx="2" fill="#fff"' + tratto(2.5) + '/>';
      case 'panda':
        return '<ellipse cx="45" cy="67" rx="11" ry="13" transform="rotate(20 45 67)" fill="' + INK + '"/>' +
          '<ellipse cx="75" cy="67" rx="11" ry="13" transform="rotate(-20 75 67)" fill="' + INK + '"/>' +
          occhi([46, 74], 66, { fondo: '#fff', fondoR: 5.5, rx: 3.4, ry: 4.2 }) +
          '<ellipse cx="60" cy="80" rx="6" ry="4.5" fill="' + INK + '"/>' + bocca + guance;
      case 'koala':
        return occhi([44, 76], 64) + guance + '<ellipse cx="60" cy="80" rx="9" ry="11" fill="#3B3640"' + tratto(3) + '/>';
      case 'tigre':
        return '<g' + tratto(4) + ' fill="none"><path d="M60 34 V46"/><path d="M48 37 L52 47"/><path d="M72 37 L68 47"/><path d="M19 70 H29"/><path d="M101 70 H91"/></g>' +
          '<path d="M38 78 Q60 66 82 78 Q76 95 60 96 Q44 95 38 78 Z" fill="' + BIANCO + '"/>' + occhi([46, 74], 64) + nasoRosa + bocca;
      case 'maiale':
        return occhi([46, 74], 62) + guance +
          '<ellipse cx="60" cy="80" rx="14" ry="10" fill="#F08DA5"' + tratto(4) + '/><ellipse cx="55" cy="80" rx="2.5" ry="3.5" fill="' + INK + '"/><ellipse cx="65" cy="80" rx="2.5" ry="3.5" fill="' + INK + '"/>';
      case 'gufo':
        return occhi([45, 75], 62, { fondo: BIANCO, fondoR: 14, bordo: true, rx: 5.5, ry: 6.5 }) +
          '<path d="M53 76 L67 76 L60 88 Z" fill="#F2B33C"' + tratto(3.5) + '/>' +
          '<g' + tratto(3) + ' fill="none" opacity=".5"><path d="M44 96 q4 4 8 0"/><path d="M58 98 q4 4 8 0"/><path d="M70 94 q4 4 8 0"/></g>';
      case 'pinguino':
        return '<path d="M60 58 C 42 42, 22 66, 36 90 Q60 104 84 90 C 98 66, 78 42, 60 58 Z" fill="' + BIANCO + '"/>' +
          occhi([48, 72], 68) + guance + '<path d="M53 78 L67 78 L60 87 Z" fill="#F2913C"' + tratto(3.5) + '/>';
      case 'pulcino':
        return occhi([46, 74], 64) + guance + '<path d="M52 76 L68 76 L60 86 Z" fill="#F2913C"' + tratto(3.5) + '/>';
      case 'rana':
        return '<circle cx="40" cy="42" r="17" fill="' + sp.corpo + '"' + tratto(5.5) + '/><circle cx="80" cy="42" r="17" fill="' + sp.corpo + '"' + tratto(5.5) + '/>' +
          occhi([40, 80], 42, { fondo: BIANCO, fondoR: 10, rx: 5, ry: 6.5 }) + guance +
          '<path d="M42 80 Q60 94 78 80" fill="none"' + tratto(4) + '/>';
      default:
        return occhi([46, 74], 66) + bocca;
    }
  }

  /**
   * Restituisce l'SVG di un animale.
   * specie: chiave di SPECIE; colore: colore della pettorina;
   * opz.classe: classi in più (cammina, felice, triste…); opz.ritardo: sfasa le animazioni.
   */
  function svg(specie, colore, opz) {
    opz = opz || {};
    var sp = SPECIE[specie] || SPECIE.volpe;
    var ritardo = opz.ritardo != null ? opz.ritardo : -Math.random() * 3;
    var braccio = sp.corpo;
    return '<svg xmlns="http://www.w3.org/2000/svg" class="animale an-' + specie + ' ' + (opz.classe || '') + '" viewBox="0 0 120 130" style="--rit:' + ritardo.toFixed(2) + 's" aria-hidden="true">' +
      '<ellipse class="an-ombra" cx="60" cy="124" rx="34" ry="5" fill="#2A2420" opacity=".14"/>' +
      '<g class="an-tutto">' +
      '<ellipse cx="44" cy="116" rx="12" ry="7" fill="' + braccio + '"' + tratto() + '/>' +
      '<ellipse cx="76" cy="116" rx="12" ry="7" fill="' + braccio + '"' + tratto() + '/>' +
      '<g class="an-corpo">' +
      '<g class="an-orecchie">' + orecchie(sp) + '</g>' +
      '<ellipse cx="60" cy="74" rx="43" ry="41" fill="' + sp.corpo + '"' + tratto(5.5) + '/>' +
      muso(sp) +
      '<path d="M43 96 h34 v13 a6 6 0 0 1 -6 6 h-22 a6 6 0 0 1 -6 -6 z" fill="' + (colore || '#F2C14E') + '"' + tratto(4) + '/>' +
      '<circle cx="48" cy="101" r="1.8" fill="' + INK + '"/><circle cx="72" cy="101" r="1.8" fill="' + INK + '"/>' +
      '<g class="an-braccio sx"><ellipse cx="20" cy="88" rx="8" ry="12" transform="rotate(25 20 88)" fill="' + braccio + '"' + tratto(4.5) + '/></g>' +
      '<g class="an-braccio dx"><ellipse cx="100" cy="88" rx="8" ry="12" transform="rotate(-25 100 88)" fill="' + braccio + '"' + tratto(4.5) + '/></g>' +
      '</g></g></svg>';
  }

  window.ANIMALI = {
    SPECIE: SPECIE,
    svg: svg,
    emoji: function (specie) { return (SPECIE[specie] || {}).emoji || ''; },
  };
})();
