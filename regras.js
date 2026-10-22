/* ==========================================================================
   PaciON! — regras.js  (Paciência Klondike, sem interface)
   Funciona no navegador (window.Paci), em Web Worker (self.Paci) e no node.

   Carta: número de 0 a 51 = naipe * 13 + (valor - 1).
   Naipes: 0 espadas, 1 copas, 2 paus, 3 ouros (copas e ouros são vermelhos).
   Valor: 1 (ás) a 13 (rei).

   Estado (só arrays e números, dá para guardar em JSON):
     compra      1 ou 3 cartas por vez
     estoque     cartas viradas para baixo; a de cima é a última do array
     descarte    cartas viradas para cima; a de cima é a última
     fund        4 pilhas, uma por naipe, do ás para cima
     col         7 colunas; as primeiras ocultas[i] cartas estão viradas para baixo
     ocultas     quantas cartas viradas para baixo há em cada coluna
     pontos, jogadas, reciclagens

   Lances ({ t, ... }):
     c                    comprar (ou reciclar o descarte quando o estoque acaba)
     d   para             descarte para a coluna "para"
     df                   descarte para a fundação
     cf  de               topo da coluna "de" para a fundação
     cc  de, k, para      cartas da posição k da coluna "de" até o fim, para a coluna "para"
     fc  naipe, para      topo da fundação para a coluna "para"
   ========================================================================== */
(function (raiz) {
  'use strict';

  const naipe = (c) => (c / 13) | 0;
  const valor = (c) => (c % 13) + 1;
  const vermelha = (c) => (naipe(c) & 1) === 1;
  const topo = (a) => a[a.length - 1];

  function embaralhar(rng) {
    const r = rng || Math.random;
    const b = [];
    for (let i = 0; i < 52; i++) b.push(i);
    for (let i = 51; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = b[i]; b[i] = b[j]; b[j] = t;
    }
    return b;
  }

  // distribui as 28 primeiras cartas nas colunas (1 a 7) e deixa 24 no estoque
  function novo(compra, baralho) {
    const b = baralho || embaralhar();
    const s = {
      compra: compra === 3 ? 3 : 1, estoque: [], descarte: [], fund: [[], [], [], []],
      col: [[], [], [], [], [], [], []], ocultas: [0, 1, 2, 3, 4, 5, 6],
      pontos: 0, jogadas: 0, reciclagens: 0
    };
    let k = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j <= i; j++) s.col[i].push(b[k++]);
    while (k < 52) s.estoque.push(b[k++]);
    return s;
  }

  function clonar(s) {
    return {
      compra: s.compra, estoque: s.estoque.slice(), descarte: s.descarte.slice(),
      fund: s.fund.map((a) => a.slice()), col: s.col.map((a) => a.slice()), ocultas: s.ocultas.slice(),
      pontos: s.pontos, jogadas: s.jogadas, reciclagens: s.reciclagens
    };
  }

  const vencido = (s) => s.fund[0].length + s.fund[1].length + s.fund[2].length + s.fund[3].length === 52;

  function podeFund(s, c) { return s.fund[naipe(c)].length === valor(c) - 1; }

  function podeColuna(s, c, j) {
    const col = s.col[j];
    if (!col.length) return valor(c) === 13;
    const t = topo(col);
    return valor(t) === valor(c) + 1 && vermelha(t) !== vermelha(c);
  }

  // Todos os lances legais.
  function lances(s) {
    const L = [];
    if (s.estoque.length || s.descarte.length) L.push({ t: 'c' });
    if (s.descarte.length) {
      const c = topo(s.descarte);
      if (podeFund(s, c)) L.push({ t: 'df' });
      for (let j = 0; j < 7; j++) if (podeColuna(s, c, j)) L.push({ t: 'd', para: j });
    }
    for (let i = 0; i < 7; i++) {
      const col = s.col[i], n = col.length;
      if (!n) continue;
      if (podeFund(s, topo(col))) L.push({ t: 'cf', de: i });
      for (let k = s.ocultas[i]; k < n; k++) {
        for (let j = 0; j < 7; j++) if (j !== i && podeColuna(s, col[k], j)) L.push({ t: 'cc', de: i, k, para: j });
      }
    }
    for (let n = 0; n < 4; n++) {
      const f = s.fund[n];
      if (!f.length) continue;
      const c = n * 13 + f.length - 1;
      for (let j = 0; j < 7; j++) if (podeColuna(s, c, j)) L.push({ t: 'fc', naipe: n, para: j });
    }
    return L;
  }

  function virar(s, i, r) {
    if (s.col[i].length && s.ocultas[i] === s.col[i].length) {
      s.ocultas[i]--; s.pontos += 5; r.virou = i;
    }
  }

  // Aplica o lance no próprio estado. Devolve { virou, recicl, carta } para a interface.
  function aplicar(s, m) {
    const r = { virou: -1, recicl: false };
    let d = 0;
    switch (m.t) {
      case 'c':
        if (s.estoque.length) {
          const n = Math.min(s.compra, s.estoque.length);
          for (let i = 0; i < n; i++) s.descarte.push(s.estoque.pop());
        } else {
          s.reciclagens++;
          r.recicl = true;
          while (s.descarte.length) s.estoque.push(s.descarte.pop());
          if (s.compra === 1) d -= 100;
          else if (s.reciclagens >= 3) d -= 20;
        }
        break;
      case 'd': { const c = s.descarte.pop(); s.col[m.para].push(c); d += 5; r.carta = c; break; }
      case 'df': { const c = s.descarte.pop(); s.fund[naipe(c)].push(c); d += 10; r.carta = c; break; }
      case 'cf': { const c = s.col[m.de].pop(); s.fund[naipe(c)].push(c); d += 10; r.carta = c; s.pontos = Math.max(0, s.pontos + d); d = 0; virar(s, m.de, r); break; }
      case 'cc': {
        const mov = s.col[m.de].splice(m.k);
        for (let i = 0; i < mov.length; i++) s.col[m.para].push(mov[i]);
        r.carta = mov[0];
        virar(s, m.de, r);
        break;
      }
      case 'fc': { const c = s.fund[m.naipe].pop(); s.col[m.para].push(c); d -= 15; r.carta = c; break; }
    }
    s.pontos = Math.max(0, s.pontos + d);
    s.jogadas++;
    return r;
  }

  /* "Útil" = lance que leva a algum lugar. Deixa de fora vaivéns sem efeito
     (mover um rei já na base de uma coluna para outra coluna vazia, devolver carta da fundação). */
  function prioridade(s, m) {
    switch (m.t) {
      case 'c': return 6;
      case 'fc': return 9;
      case 'df': return 2;
      case 'd': return 3;
      case 'cf': return s.ocultas[m.de] === s.col[m.de].length - 1 ? 1 : 2;
      case 'cc': {
        const col = s.col[m.de];
        const vira = m.k === s.ocultas[m.de] && s.ocultas[m.de] > 0;      // vai desvirar uma carta
        const esvazia = m.k === 0;                                          // a coluna fica vazia
        if (esvazia && !s.col[m.para].length) return 9;                     // rei saindo da base para outra coluna vazia
        if (vira) return 1;
        if (esvazia) return 4;
        return 5;
      }
    }
    return 9;
  }

  const ehUtil = (s, m) => prioridade(s, m) <= 6;

  function lancesUteis(s) {
    return lances(s).filter((m) => ehUtil(s, m)).sort((a, b) => prioridade(s, a) - prioridade(s, b));
  }

  // Dica por regra simples: o melhor lance útil, ou comprar.
  function dica(s) {
    const L = lancesUteis(s).filter((m) => m.t !== 'c' && prioridade(s, m) <= 5);
    if (L.length) {
      // entre os que desviram carta, prefere a coluna com mais cartas ocultas
      L.sort((a, b) => (prioridade(s, a) - prioridade(s, b)) ||
        ((b.de !== undefined ? s.ocultas[b.de] : 0) - (a.de !== undefined ? s.ocultas[a.de] : 0)));
      return L[0];
    }
    if (s.estoque.length || s.descarte.length) return { t: 'c' };
    return null;
  }

  // Sem lance algum que adiante, mesmo comprando todas as cartas do estoque?
  function semJogadas(s) {
    const t = clonar(s);
    const total = t.estoque.length + t.descarte.length;
    const passos = Math.ceil(total / t.compra) + 2;
    for (let i = 0; i <= passos; i++) {
      if (lancesUteis(t).some((m) => m.t !== 'c')) return false;
      if (!(t.estoque.length || t.descarte.length)) break;
      aplicar(t, { t: 'c' });
    }
    return true;
  }

  // Tudo virado, estoque e descarte vazios: dá para mandar o resto para as fundações sozinho.
  function podeCompletar(s) {
    if (s.estoque.length || s.descarte.length) return false;
    return s.ocultas.every((o) => o === 0);
  }

  function proximoAuto(s) {
    for (let i = 0; i < 7; i++) {
      const c = s.col[i].length ? topo(s.col[i]) : -1;
      if (c >= 0 && podeFund(s, c)) return { t: 'cf', de: i };
    }
    return null;
  }

  /* ---------- solver (jogos com solução e dica inteligente) ---------- */
  function seguro(s, c) {
    const v = valor(c);
    if (v <= 2) return true;
    const a = vermelha(c) ? 0 : 1, b = vermelha(c) ? 2 : 3;      // naipes da cor oposta
    return s.fund[a].length >= v - 1 && s.fund[b].length >= v - 1;
  }

  function autoFund(s, saida) {
    let mudou = true;
    while (mudou) {
      mudou = false;
      if (s.descarte.length) {
        const c = topo(s.descarte);
        if (podeFund(s, c) && seguro(s, c)) { const m = { t: 'df' }; aplicar(s, m); saida.push(m); mudou = true; continue; }
      }
      for (let i = 0; i < 7; i++) {
        const col = s.col[i];
        if (!col.length) continue;
        const c = topo(col);
        if (podeFund(s, c) && seguro(s, c)) { const m = { t: 'cf', de: i }; aplicar(s, m); saida.push(m); mudou = true; break; }
      }
    }
  }

  function chave(s) {
    let k = '';
    for (let i = 0; i < 7; i++) {
      k += String.fromCharCode(48 + s.ocultas[i]);
      for (let j = 0; j < s.col[i].length; j++) k += String.fromCharCode(64 + s.col[i][j]);
      k += '|';
    }
    k += '#';
    for (let j = 0; j < s.estoque.length; j++) k += String.fromCharCode(64 + s.estoque[j]);
    k += '#';
    for (let j = 0; j < s.descarte.length; j++) k += String.fromCharCode(64 + s.descarte[j]);
    k += '#' + s.fund[0].length + ',' + s.fund[1].length + ',' + s.fund[2].length + ',' + s.fund[3].length;
    return k;
  }

  /* Busca em profundidade com limite de nós. Devolve { ok, lances, nos, esgotou }.
     "lances" é um caminho válido até a vitória (aplicável com aplicar()). */
  function resolver(inicial, limiteNos) {
    let nos = 0, abortou = false;
    const vis = new Set();
    const caminho = [];
    const raiz = clonar(inicial);
    autoFund(raiz, caminho);

    function dfs(s) {
      if (vencido(s)) return true;
      if (++nos > limiteNos) { abortou = true; return false; }
      const k = chave(s);
      if (vis.has(k)) return false;
      vis.add(k);
      const cand = lances(s).filter((m) => m.t !== 'fc' && prioridade(s, m) <= 6);
      cand.sort((a, b) => {
        const d = prioridade(s, a) - prioridade(s, b);
        if (d) return d;
        const oa = a.de !== undefined ? s.ocultas[a.de] : 0, ob = b.de !== undefined ? s.ocultas[b.de] : 0;
        return ob - oa;
      });
      for (let i = 0; i < cand.length; i++) {
        const m = cand[i];
        const t = clonar(s);
        const marca = caminho.length;
        caminho.push(m);
        aplicar(t, m);
        autoFund(t, caminho);
        if (dfs(t)) return true;
        caminho.length = marca;
        if (abortou) return false;
      }
      return false;
    }

    const ok = dfs(raiz);
    return { ok, lances: ok ? caminho.slice() : null, nos, esgotou: !ok && !abortou };
  }

  // Embaralha até achar um jogo que o solver vence. Devolve { baralho, tentativas, achou }.
  function jogoComSolucao(compra, limiteNos, maxTentativas, rng) {
    let ultimo = null;
    for (let i = 1; i <= maxTentativas; i++) {
      const b = embaralhar(rng);
      ultimo = b;
      const r = resolver(novo(compra, b), limiteNos);
      if (r.ok) return { baralho: b, tentativas: i, achou: true };
    }
    return { baralho: ultimo, tentativas: maxTentativas, achou: false };
  }

  const Paci = {
    naipe, valor, vermelha, embaralhar, novo, clonar, vencido, podeFund, podeColuna,
    lances, aplicar, prioridade, lancesUteis, dica, semJogadas, podeCompletar, proximoAuto,
    resolver, jogoComSolucao, autoFund, chave
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Paci;
  raiz.Paci = Paci;
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis));
