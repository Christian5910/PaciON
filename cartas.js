/* ==========================================================================
   cartas.js — baralho da família ON! (arquivo reutilizável, vale para qualquer jogo de cartas)

   Desenha as 52 cartas em SVG, sem imagens e sem fontes externas: as letras e os números são
   contornos do Inter ExtraBold (SIL Open Font License 1.1), então ficam iguais em qualquer aparelho
   e centralizados com precisão. Cada carta é um <symbol> reaproveitado por <use>, o que mantém o
   DOM leve mesmo com 104 cartas na mesa.

   Carta (base): número de 0 a 51 = naipe * 13 + (valor - 1).
   Naipes: 0 espadas, 1 copas, 2 paus, 3 ouros (copas e ouros são vermelhos). Valor: 1 (ás) a 13 (rei).

   API (window.Cartas):
     iniciar()              coloca os símbolos na página (chame uma vez; repetir não faz mal)
     criar(base, id)        elemento .carta pronto (frente e verso). "id" vai em data-c
     face(elemento, base)   troca a frente de uma carta já criada
     mini(base)             SVG pequeno de uma carta (para miniaturas e textos de ajuda)
     nome(base, artigo)     "dama de copas" (com artigo: "a dama de copas")
     naipe, valor, vermelha, RAZAO (altura / largura = 1,4)
   Estilo: cartas.css
   ========================================================================== */
(function (raiz) {
  'use strict';

  var RANGO = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var NOME_VALOR = ['ás', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'valete', 'dama', 'rei'];
  var NOME_NAIPE = ['espadas', 'copas', 'paus', 'ouros'];
  var NAIPES = [
    'M16 2C10 10 3 14 3 20a6.5 6.5 0 0 0 11 4.5c-.5 3-1.5 5-3.5 7h11c-2-2-3-4-3.5-7A6.5 6.5 0 0 0 29 20c0-6-7-10-13-18z',
    'M16 29C5 20 2 14 2 9a7 7 0 0 1 14-2 7 7 0 0 1 14 2c0 5-3 11-14 20z',
    'M16 2.5a6 6 0 0 0-4.8 9.6A6.5 6.5 0 1 0 14 22.7C13.8 26 13 28.5 11 31h10c-2-2.5-2.8-5-3-8.3a6.5 6.5 0 1 0 2.8-10.6A6 6 0 0 0 16 2.5z',
    'M16 2l11 14-11 14L5 16z'
  ];
  /* caixa justa de cada naipe (x, y, largura, altura) dentro do quadrado 32 x 32 do desenho acima.
     Todo naipe é desenhado pela caixa justa e pela mesma altura, então tem o mesmo tamanho e o centro exato onde é colocado */
  var CAIXA = [[3, 2, 26, 29.5], [1.93, 0.93, 28.14, 28.07], [2.72, 2.5, 26.55, 28.5], [5, 2, 22, 28]];
  /* ajuste de peso visual: o coração é mais cheio e o ouros mais fino que os outros, então a altura de cada um é corrigida um pouco */
  var PESO = [1, 0.93, 0.99, 1.08];
  /* contornos dos caracteres: altura da maiúscula = 100, base em y = 0, borda esquerda em x = 0 */
  var GLIFOS = {"A":{"w":99.5,"d":"M0 0H26.3L32.8 -21.3H66.1L72.9 0H99.5L65.1 -100H33.4ZM38.4 -39.4 39.7 -43.7C43 -55 46 -67.7 49 -81.1C52.2 -67.7 55.5 -55.1 59 -43.7L60.3 -39.4Z"},"2":{"w":75.0,"d":"M1.3 0H75V-19.1H34.2V-19.8L46.6 -31.3C68.3 -50.2 73.8 -59.8 73.8 -71.2C73.8 -89.1 59.2 -101.3 36.6 -101.3C14.7 -101.3 0 -88.6 0 -68.4H22.6C22.6 -77.4 28.1 -82.8 36.6 -82.8C44.8 -82.8 50.8 -77.7 50.8 -69.4C50.8 -61.8 46 -56.6 37.7 -49.1L1.3 -17Z"},"3":{"w":78.8,"d":"M39 1.3C62.3 1.3 78.8 -11 78.8 -28.3C78.8 -40.7 70.9 -49.5 55.6 -51.3V-52.1C67 -53.8 75.2 -61.6 75.2 -72.8C75.2 -89 60.6 -101.3 39.3 -101.3C17.9 -101.3 2.1 -88.9 1.9 -71.2H24.7C24.8 -78.2 31.1 -82.8 39.3 -82.8C47 -82.8 52.3 -78.1 52.3 -71.3C52.3 -64.2 46.1 -59.3 37.2 -59.3H27.4V-42.4H37.2C47.4 -42.4 54 -37.4 54 -30.1C54 -23 47.9 -18 39.2 -18C30.5 -18 24 -22.5 23.8 -29.2H0C0.1 -11.2 16.4 1.3 39 1.3Z"},"4":{"w":83.0,"d":"M0 -16.7H48.2V0H70.9V-16.7H83V-35.4H70.9V-100H41.1L0 -35.2ZM48.7 -35.4H23.6V-36.2L47.9 -74.8H48.7Z"},"5":{"w":76.2,"d":"M37.7 1.3C60.8 1.3 76.2 -13.3 76.2 -33.8C76.2 -52.9 63 -66.4 45 -66.4C35.7 -66.4 27.9 -62.5 24.5 -57H24L26.2 -80.8H70.4V-100H6.7L2.3 -46.3L23.4 -42.3C26 -46.8 31.6 -49.5 37.5 -49.5C46.8 -49.5 53.4 -42.9 53.4 -33.2C53.4 -23.4 46.9 -17 37.7 -17C29.8 -17 23.2 -21.8 23.1 -29.2H0C0.3 -11.3 16 1.3 37.7 1.3Z"},"6":{"w":79.9,"d":"M41.4 1.3C64.2 1.3 79.9 -13 79.9 -33.9C79.9 -52.4 67.2 -65.9 49.3 -65.9C38.2 -65.9 28.3 -60.5 24 -51.5H23.4C23.4 -69.6 29.5 -81.1 41.9 -81.1C48.7 -81.1 54 -77.7 55.5 -71.2H78.8C76.9 -88 62.7 -101.3 41.9 -101.3C16.6 -101.3 0 -81.2 0 -48.2C0 -11.7 19.7 1.3 41.4 1.3ZM41.2 -17C32.3 -17 25.6 -24 25.6 -33.1C25.6 -42.1 32.4 -49.3 41.3 -49.3C50.4 -49.3 57 -42.3 57 -33.2C57 -23.9 50.3 -17 41.2 -17Z"},"7":{"w":71.9,"d":"M6.8 0H31.3L71.9 -80.6V-100H0V-80.8H47.3V-80.2Z"},"8":{"w":80.3,"d":"M40.1 1.3C63.4 1.3 80.3 -10.8 80.3 -27C80.3 -39.4 70.3 -49.5 57.9 -51.5V-52.1C68.7 -54.3 76.6 -63.3 76.6 -74.4C76.6 -89.9 61.1 -101.3 40.1 -101.3C19.1 -101.3 3.6 -89.9 3.6 -74.4C3.6 -63.4 11.3 -54.3 22.3 -52.1V-51.5C9.7 -49.5 0 -39.4 0 -27C0 -10.8 16.8 1.3 40.1 1.3ZM40.1 -15.5C31.1 -15.5 24.9 -21.1 24.9 -29C24.9 -36.9 31.3 -42.6 40.1 -42.6C48.9 -42.6 55.4 -36.8 55.4 -29C55.4 -21.1 49.1 -15.5 40.1 -15.5ZM40.1 -59.3C32.4 -59.3 26.8 -64.6 26.8 -71.7C26.8 -78.9 32.3 -83.8 40.1 -83.8C47.9 -83.8 53.4 -78.9 53.4 -71.7C53.4 -64.5 47.9 -59.3 40.1 -59.3Z"},"9":{"w":79.9,"d":"M38.1 1.5C63.4 1.5 79.9 -18.7 79.9 -51.8C79.9 -88.3 60.3 -101.5 38.6 -101.5C15.8 -101.6 0 -87 0 -66.2C0 -47.6 12.7 -34.2 30.7 -34.2C41.7 -34.2 51.7 -39.5 55.9 -48.5H56.5C56.5 -30.4 50.4 -18.7 38.1 -18.7C31.2 -18.7 25.9 -22.4 24.5 -28.9H1.1C3 -12 17.2 1.5 38.1 1.5ZM38.7 -50.8C29.6 -50.8 23 -57.7 23 -66.9C23 -76 29.8 -83 38.7 -83C47.8 -83 54.4 -75.9 54.4 -67C54.4 -57.9 47.7 -50.8 38.7 -50.8Z"},"J":{"w":69.7,"d":"M35 1.3C56.8 1.3 69.7 -10.1 69.7 -30.7V-100H46.3V-30.3C46.3 -21.7 42.1 -17.4 35 -17.4C27.9 -17.4 23.7 -21.7 23.7 -30.2V-36.6H0V-30.6C0 -10.1 13 1.3 35 1.3Z"},"Q":{"w":95.3,"d":"M47.7 1.3C54.1 1.3 60.2 0.3 65.8 -1.8L73.9 7.9H95.3L80.3 -10.7C89.5 -19.5 95.2 -32.7 95.2 -49.9C95.2 -83 74.4 -101.3 47.7 -101.3C20.7 -101.3 0 -83 0 -49.9C0 -17.1 20.7 1.3 47.7 1.3ZM40.4 -35.6 52.4 -19.9C50.9 -19.6 49.3 -19.5 47.7 -19.5C33.1 -19.5 24.2 -30.2 24.2 -49.9C24.2 -69.7 33.1 -80.5 47.7 -80.5C62.1 -80.5 71 -69.8 71 -49.9C71 -40.7 69.1 -33.4 65.4 -28.3L59.6 -35.6Z"},"K":{"w":90.4,"d":"M0 0H23.7V-26.8L36.4 -41.3L62.6 0H90.4L52.8 -56.8L89 -100H60.5L38.3 -72.7C31.5 -64.3 27.2 -58.1 23.3 -51.3L23.7 -75.4V-100H0Z"},"O":{"w":95.2,"d":"M47.7 1.3C74.4 1.3 95.2 -17 95.2 -49.9C95.2 -83 74.4 -101.3 47.7 -101.3C20.7 -101.3 0 -83 0 -49.9C0 -17.1 20.7 1.3 47.7 1.3ZM47.7 -19.5C33.1 -19.5 24.2 -30.2 24.2 -49.9C24.2 -69.7 33.1 -80.5 47.7 -80.5C62.1 -80.5 71 -69.8 71 -49.9C71 -30.2 62.1 -19.5 47.7 -19.5Z"},"N":{"w":89.7,"d":"M0 0H24.3V-41.4C24.3 -47.7 23.6 -58.6 22.8 -70.5C28.4 -58.5 32.1 -51 38 -41.4L63.6 0H89.7V-100H65.4V-57.4C65.4 -50.5 66.1 -39 66.8 -29C62.6 -39.9 58.4 -47.4 54 -54.8L26 -100H0Z"},"0":{"w":84.0,"d":"M42 1.3C68.6 1.3 84 -17.6 84 -49.9C84 -82.2 68.5 -101.3 42 -101.3C15.6 -101.3 0 -82.3 0 -49.9C0 -17.6 15.6 1.3 42 1.3ZM42 -18.1C30.6 -18.1 24.4 -29.4 24.4 -49.9C24.4 -70.5 30.7 -82.1 42 -82.1C53.4 -82.1 59.7 -70.5 59.7 -49.9C59.7 -29.4 53.4 -18.1 42 -18.1Z"},"1":{"w":46.8,"d":"M46.8 -100H22.3L0 -84.7V-63.9L22.5 -79.4H23.2V0H46.8Z"}};

  var DUPLO = false;
  var naipe = function (b) { return (b / 13) | 0; };
  var valor = function (b) { return (b % 13) + 1; };
  var vermelha = function (b) { return (naipe(b) & 1) === 1; };

  function f(n) { return String(Math.round(n * 100) / 100); }

  // desenha um texto curto (A, 7, 10, J, Q, K, ON) centralizado em (cx, cy) com altura de maiúscula h
  function texto(str, cx, cy, h, larguraMax) {
    var folga = 10, larg = 0, i;
    for (i = 0; i < str.length; i++) larg += GLIFOS[str[i]].w + (i ? folga : 0);
    var esc = h / 100;
    if (larguraMax && larg * esc > larguraMax) esc = larguraMax / larg;
    var x = cx - (larg * esc) / 2, base = cy + (50 * esc), out = '';
    for (i = 0; i < str.length; i++) {
      out += '<use href="#g' + str[i] + '" transform="translate(' + f(x) + ' ' + f(base) + ') scale(' + f(esc) + ')"/>';
      x += (GLIFOS[str[i]].w + folga) * esc;
    }
    return out;
  }

  // t = altura do naipe; a largura segue a proporção da caixa justa
  function naipeSvg(n, cx, cy, t, giro) {
    t = t * PESO[n];
    var c = CAIXA[n], w = t * c[2] / c[3];
    var u = '<use href="#n' + n + '" x="' + f(cx - w / 2) + '" y="' + f(cy - t / 2) + '" width="' + f(w) + '" height="' + f(t) + '"/>';
    return giro ? '<g transform="rotate(180 ' + f(cx) + ' ' + f(cy) + ')">' + u + '</g>' : u;
  }

  /* posições dos naipes nas cartas de número: [x, y, de cabeça para baixo] */
  var CE = 50, EQ = 34, DI = 66, E9 = 33, D9 = 67;
  var PIPS = {
    2: [[CE, 30], [CE, 110, 1]],
    3: [[CE, 30], [CE, 70], [CE, 110, 1]],
    4: [[EQ, 30], [DI, 30], [EQ, 110, 1], [DI, 110, 1]],
    5: [[EQ, 30], [DI, 30], [CE, 70], [EQ, 110, 1], [DI, 110, 1]],
    6: [[EQ, 30], [DI, 30], [EQ, 70], [DI, 70], [EQ, 110, 1], [DI, 110, 1]],
    7: [[EQ, 30], [DI, 30], [CE, 50], [EQ, 70], [DI, 70], [EQ, 110, 1], [DI, 110, 1]],
    8: [[EQ, 30], [DI, 30], [CE, 50], [EQ, 70], [DI, 70], [CE, 90, 1], [EQ, 110, 1], [DI, 110, 1]],
    9: [[E9, 28], [D9, 28], [E9, 51.5], [D9, 51.5], [CE, 70], [E9, 88.5, 1], [D9, 88.5, 1], [E9, 112, 1], [D9, 112, 1]],
    10: [[E9, 27], [D9, 27], [CE, 38.5], [E9, 50], [D9, 50], [E9, 90, 1], [D9, 90, 1], [CE, 101.5, 1], [E9, 113, 1], [D9, 113, 1]]
  };

  /* traço fino das figuras (J, Q, K). A linha não passa pelo índice: nos cantos opostos ela é
     interrompida num vão um pouco maior que a letra e o naipe, como se eles tivessem fundo da cor da carta */
  var VX = 21.5, VY = 46.5;   // vão do índice: de fora da carta até x = VX e y = VY (e o oposto, girado)
  function moldura(x, y, r, op, sw) {
    var x2 = 100 - x, y2 = 140 - y, e = 'fill="none" stroke="currentColor" stroke-opacity="' + op + '" stroke-width="' + sw + '"';
    // duas linhas abertas: a de cima/direita e a de baixo/esquerda
    var a = 'M' + f(VX) + ' ' + f(y) + 'H' + f(x2 - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f(x2) + ' ' + f(y + r) + 'V' + f(140 - VY);
    var b = 'M' + f(100 - VX) + ' ' + f(y2) + 'H' + f(x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f(x) + ' ' + f(y2 - r) + 'V' + f(VY);
    return '<path d="' + a + '" ' + e + '/><path d="' + b + '" ' + e + '/>';
  }
  var FIGURA_MOLDURA = moldura(12, 7, 6, 0.3, 1) + (DUPLO ? moldura(15.2, 10.2, 4, 0.2, 0.8) : '');

  function indice(b) {
    var n = naipe(b), v = valor(b), R = RANGO[v - 1];
    return texto(R, 12, 18.5, v === 10 ? 15 : 16, 16.5) + naipeSvg(n, 12, 37, 12.5, 0);
  }

  function centro(b) {
    var n = naipe(b), v = valor(b), R = RANGO[v - 1], s = '', t;
    if (v >= 11) {
      // figuras: letra grande no meio, naipes pequenos acima e abaixo com folga, marca-d'água do naipe atrás
      s += '<g opacity=".07">' + naipeSvg(n, 50, 70, 58, 0) + '</g>';
      s += texto(R, 50, 70, 35, 30);
      s += naipeSvg(n, 50, 35, 16, 0) + naipeSvg(n, 50, 105, 16, 1);
    } else if (v === 1) {
      t = 50;
      s += naipeSvg(n, 50, 70, t, 0);
    } else {
      t = v >= 9 ? (v === 10 ? 16 : 17) : 20;
      PIPS[v].forEach(function (p) { s += naipeSvg(n, p[0], p[1], t, p[2]); });
    }
    return s;
  }

  function simboloFace(b) {
    var ind = indice(b);
    return '<symbol id="c' + b + '" viewBox="0 0 100 140">' + (valor(b) >= 11 ? FIGURA_MOLDURA : '') + ind + '<g transform="rotate(180 50 70)">' + ind + '</g>' + centro(b) + '</symbol>';
  }

  function simboloVerso() {
    var s = '<symbol id="cv" viewBox="0 0 100 140">';
    s += '<rect width="100" height="140" fill="#fbfcff"/>';
    s += '<rect x="4" y="4" width="92" height="132" rx="5" fill="#1565c0"/>';
    s += '<rect x="4" y="4" width="92" height="132" rx="5" fill="url(#cTrama)"/>';
    s += '<rect x="9.5" y="9.5" width="81" height="121" rx="3" fill="none" stroke="#fbfcff" stroke-opacity=".55" stroke-width="1"/>';
    [[17, 17], [83, 17], [17, 123], [83, 123]].forEach(function (p) {
      s += '<path d="M' + p[0] + ' ' + (p[1] - 4) + 'l4 4-4 4-4-4z" fill="#fbfcff" fill-opacity=".7"/>';
    });
    s += '<circle cx="50" cy="70" r="21" fill="#1565c0"/>';
    s += '<circle cx="50" cy="70" r="19" fill="#2e7d32"/>';
    s += '<circle cx="50" cy="70" r="19" fill="none" stroke="#fbfcff" stroke-width="1.6"/>';
    s += '<circle cx="50" cy="70" r="15.2" fill="none" stroke="#fbfcff" stroke-opacity=".55" stroke-width=".8"/>';
    s += '<g fill="#fff">' + texto('ON', 50, 70, 10.5, 24) + '</g>';
    return s + '</symbol>';
  }

  function defs() {
    var s = '<svg id="cartas-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>';
    NAIPES.forEach(function (d, n) { s += '<symbol id="n' + n + '" viewBox="' + CAIXA[n].join(' ') + '"><path d="' + d + '"/></symbol>'; });
    Object.keys(GLIFOS).forEach(function (k) { s += '<path id="g' + k + '" d="' + GLIFOS[k].d + '"/>'; });
    s += '<pattern id="cTrama" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="8" height="8" fill="#1565c0"/><path d="M0 0H8" stroke="#1e88e5" stroke-width="3.2"/><circle cx="4" cy="4" r=".9" fill="#fbfcff" fill-opacity=".35"/></pattern>';
    for (var b = 0; b < 52; b++) s += simboloFace(b);
    s += simboloVerso();
    return s + '</defs></svg>';
  }

  function iniciar() {
    if (document.getElementById('cartas-defs')) return;
    var d = document.createElement('div');
    d.innerHTML = defs();
    document.body.insertBefore(d.firstChild, document.body.firstChild);
  }

  var svgFace = function (b) { return '<svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><use href="#c' + b + '"/></svg>'; };
  var svgVerso = '<svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><use href="#cv"/></svg>';

  function nome(b, artigo) {
    var v = valor(b), t = NOME_VALOR[v - 1] + ' de ' + NOME_NAIPE[naipe(b)];
    return artigo ? (v === 12 ? 'a ' : 'o ') + t : t;
  }

  function face(el, b) {
    var fr = el.querySelector('.frente');
    fr.className = 'frente ' + (vermelha(b) ? 'vermelho' : 'preto');
    fr.innerHTML = svgFace(b);
    el.dataset.b = b;
    el.setAttribute('aria-label', nome(b));
  }

  function criar(b, id) {
    var d = document.createElement('div');
    d.className = 'carta oculta';
    d.dataset.c = id;
    d.setAttribute('role', 'img');
    d.innerHTML = '<div class="giro"><div class="frente"></div><div class="verso">' + svgVerso + '</div></div>';
    face(d, b);
    return d;
  }

  function mini(b) {
    return '<span class="carta-mini ' + (vermelha(b) ? 'vermelho' : 'preto') + '">' + svgFace(b) + '</span>';
  }

  raiz.Cartas = {
    iniciar: iniciar, criar: criar, face: face, mini: mini, nome: nome,
    naipe: naipe, valor: valor, vermelha: vermelha, RAZAO: 1.4,
    RANGO: RANGO, NOME_VALOR: NOME_VALOR, NOME_NAIPE: NOME_NAIPE
  };
})(window);
