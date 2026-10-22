/* ==========================================================================
   PaciON! — jogos.js  (regras de todos os modos de Paciência, sem interface)
   Funciona no navegador (window.Jogos) e no node (para os testes).

   Modelo comum a todos os modos
   - Cada carta da mesa é uma "instância" (número de 0 a N-1, N = 52 ou 104). O desenho dela vem de
     s.b[instância] = carta base (naipe * 13 + valor - 1, naipes 0 espadas, 1 copas, 2 paus, 3 ouros).
   - Estado (só números, arrays e objetos simples, dá para guardar em JSON):
       m      id do modo            b      base de cada instância (não muda durante o jogo)
       p      pilhas: { id: [instâncias] }, a última de cada pilha é a de cima
       up     1 se a instância está virada para cima, 0 se está virada para baixo
       x      dados extras do modo (compras, embaralhadas, carta base do Canfield...)
       jog    jogadas feitas       pts    pontos (só o Klondike usa)
   - Uma pilha tem um tipo: est (estoque), des (descarte), fun (fundação), col (coluna do tabuleiro),
     cel (célula livre), res (reserva), pic (carta avulsa de pirâmide/picos).
   - Lances: { t: 'm', de, idx, para }  mover as cartas da posição idx de "de" até o fim para "para"
             { t: 'compra' }            usar o estoque do modo
             { t: 'emb' }               embaralhar (Crescent)
   ========================================================================== */
(function (raiz) {
  'use strict';

  const nap = (b) => (b / 13) | 0;
  const val = (b) => (b % 13) + 1;
  const verm = (b) => (nap(b) & 1) === 1;
  const topo = (a) => a[a.length - 1];

  function embaralhar(n, rng) {
    const r = rng || Math.random, a = [];
    for (let i = 0; i < n; i++) a.push(i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* atalhos sobre um estado */
  const R = (s, i) => val(s.b[i]);          // valor da instância
  const NP = (s, i) => nap(s.b[i]);         // naipe da instância
  const VM = (s, i) => verm(s.b[i]);        // vermelha?

  /* ----- descritores de pilha para o layout (a interface posiciona) -----
     x em colunas de carta, y em linhas de carta (0,5 = meia linha); y: 'fim' = logo abaixo de tudo que veio antes. */
  const P = (id, tipo, x, y, extra) => Object.assign({ id: id, tipo: tipo, x: x, y: y, fan: 'n' }, extra || {});
  const seq = (pre, n) => { const a = []; for (let i = 0; i < n; i++) a.push(pre + i); return a; };

  function novoEstado(modo, b) {
    return { m: modo, b: b, p: {}, up: new Array(b.length).fill(0), x: {}, jog: 0, pts: 0 };
  }
  function empilhar(s, pid, i, cima) { (s.p[pid] = s.p[pid] || []).push(i); s.up[i] = cima ? 1 : 0; }

  /* sequência decrescente de cores alternadas (arr[idx..]) */
  function seqAlt(s, arr, idx, circular) {
    for (let k = idx; k < arr.length - 1; k++) {
      const a = arr[k], c = arr[k + 1];
      if (!s.up[a] || !s.up[c]) return false;
      if (VM(s, a) === VM(s, c)) return false;
      const ok = R(s, a) === R(s, c) + 1 || (circular && R(s, a) === 1 && R(s, c) === 13);
      if (!ok) return false;
    }
    return !!s.up[arr[idx]];
  }
  /* sequência decrescente do mesmo naipe (arr[idx..]) */
  function seqNaipe(s, arr, idx) {
    for (let k = idx; k < arr.length - 1; k++) {
      const a = arr[k], c = arr[k + 1];
      if (!s.up[a] || !s.up[c] || NP(s, a) !== NP(s, c) || R(s, a) !== R(s, c) + 1) return false;
    }
    return !!s.up[arr[idx]];
  }

  /* K..A do mesmo naipe nas 13 últimas cartas de uma coluna? */
  function sequenciaCompleta(s, col) {
    if (col.length < 13) return false;
    const ini = col.length - 13;
    if (!s.up[col[ini]] || R(s, col[ini]) !== 13) return false;
    return seqNaipe(s, col, ini);
  }

  /* vira a carta que ficou de cima nas colunas indicadas; devolve as viradas */
  function virarExpostas(s, pids, info) {
    pids.forEach((pid) => {
      const a = s.p[pid];
      if (a && a.length && !s.up[topo(a)]) { s.up[topo(a)] = 1; (info.viradas = info.viradas || []).push(topo(a)); }
    });
  }

  function contar(s, ids) { let n = 0; ids.forEach((id) => { n += (s.p[id] || []).length; }); return n; }

  /* ==========================================================================
     Modos
     ========================================================================== */
  const MODOS = {};

  /* ---------- 1. Klondike ---------- */
  MODOS.klondike = {
    nome: 'Klondike', baralhos: 1, dif: 2, grupo: 'classicos', completar: true, alturaRel: 5.1,
    desc: 'Colunas de cores alternadas, estoque e quatro fundações. É a Paciência clássica.',
    layout(o) {
      const L = [P('e', 'est', 0, 0), P('d', 'des', 1, 0, { fan: 'h', leque: o.compra === 3 ? 3 : 1 })];
      seq('f', 4).forEach((id, i) => L.push(P(id, 'fun', 3 + i, 0, { marca: 'n' + i })));
      seq('c', 7).forEach((id, i) => L.push(P(id, 'col', i, 1, { fan: 'v', marca: 'K' })));
      return { cols: 7, piles: L };
    },
    distribuir(s, deck, o) {
      s.x = { compra: o.compra === 3 ? 3 : 1, rec: 0 };
      s.p.e = []; s.p.d = []; seq('f', 4).forEach((id) => { s.p[id] = []; });
      let k = 0;
      for (let i = 0; i < 7; i++) {
        s.p['c' + i] = [];
        for (let j = 0; j <= i; j++) empilhar(s, 'c' + i, deck[k++], j === i);
      }
      while (k < 52) empilhar(s, 'e', deck[k++], false);
    },
    podePegar(s, pid, idx) {
      const a = s.p[pid], t = pid[0];
      if (t === 'c') return !!s.up[a[idx]];
      if (t === 'd' || t === 'f') return idx === a.length - 1;
      return false;
    },
    podeSoltar(s, de, idx, para) {
      if (de === para) return false;
      const c = s.p[de][idx], n = s.p[de].length - idx, t = para[0];
      if (t === 'f') return n === 1 && NP(s, c) === +para.slice(1) && R(s, c) === s.p[para].length + 1;
      if (t === 'c') {
        const col = s.p[para];
        if (!col.length) return R(s, c) === 13;
        const top = topo(col);
        return R(s, top) === R(s, c) + 1 && VM(s, top) !== VM(s, c);
      }
      return false;
    },
    compraOk(s) { return s.p.e.length > 0 || s.p.d.length > 0; },
    compra(s, info) {
      if (s.p.e.length) {
        const n = Math.min(s.x.compra, s.p.e.length);
        for (let i = 0; i < n; i++) { const c = s.p.e.pop(); s.up[c] = 1; s.p.d.push(c); }
        info.sacou = n;
      } else {
        s.x.rec++;
        info.recicla = true;
        while (s.p.d.length) { const c = s.p.d.pop(); s.up[c] = 0; s.p.e.push(c); }
        if (s.x.compra === 1) s.pts -= 100;
        else if (s.x.rec >= 3) s.pts -= 20;
      }
    },
    depois(s, info) {
      const i = info.mov;
      if (i && i.de[0] === 'd' && i.para[0] === 'c') s.pts += 5;
      else if (i && i.de[0] === 'd' && i.para[0] === 'f') s.pts += 10;
      else if (i && i.de[0] === 'c' && i.para[0] === 'f') s.pts += 10;
      else if (i && i.de[0] === 'f' && i.para[0] === 'c') s.pts -= 15;
      const v = []; virarExpostas(s, seq('c', 7), { viradas: v });
      if (v.length) { s.pts += 5 * v.length; info.viradas = v; }
      if (s.pts < 0) s.pts = 0;
    },
    venceu(s) { return contar(s, seq('f', 4)) === 52; },
    hud(s) { return { rotulo: 'Pontos', valor: s.pts }; },
    textoCompra(s) { return s.p.e.length ? (s.x.compra === 3 ? 'Compre cartas do estoque.' : 'Compre uma carta do estoque.') : 'Vire o descarte de volta para o estoque.'; }
  };

  /* ---------- 2. Spider (1, 2 ou 4 naipes) ---------- */
  function modoSpider(naipes, dif) {
    return {
      nome: 'Spider ' + naipes + (naipes === 1 ? ' naipe' : ' naipes'), baralhos: 2, dif: dif, grupo: 'construir', alturaRel: 5.8, naipes: naipes,
      desc: naipes === 1 ? 'Monte sequências de rei a ás do mesmo naipe. Com um naipe só, é a versão mais fácil.'
        : naipes === 2 ? 'Spider com dois naipes: já pede planejamento para não travar as colunas.'
          : 'Spider com os quatro naipes. Um dos desafios mais difíceis da Paciência.',
      bases() {
        const b = [];
        for (let k = 0; k < 8; k++) for (let v = 0; v < 13; v++) b.push((k % naipes) * 13 + v);
        return b;
      },
      layout() {
        const L = [P('e', 'est', 0, 0)];
        seq('f', 8).forEach((id, i) => L.push(P(id, 'fun', 2 + i, 0, { fan: 'n', marca: 'seq' })));
        seq('c', 10).forEach((id, i) => L.push(P(id, 'col', i, 1, { fan: 'v' })));
        return { cols: 10, piles: L };
      },
      distribuir(s, deck) {
        s.p.e = []; seq('f', 8).forEach((id) => { s.p[id] = []; });
        let k = 0;
        for (let i = 0; i < 10; i++) {
          s.p['c' + i] = [];
          const n = i < 4 ? 6 : 5;
          for (let j = 0; j < n; j++) empilhar(s, 'c' + i, deck[k++], j === n - 1);
        }
        while (k < 104) empilhar(s, 'e', deck[k++], false);
      },
      podePegar(s, pid, idx) { return pid[0] === 'c' && seqNaipe(s, s.p[pid], idx); },
      podeSoltar(s, de, idx, para) {
        if (de === para || para[0] !== 'c') return false;
        const col = s.p[para];
        if (!col.length) return true;
        return R(s, topo(col)) === R(s, s.p[de][idx]) + 1;
      },
      compraOk(s) { return s.p.e.length > 0 && seq('c', 10).every((id) => s.p[id].length > 0); },
      compraMsg(s) {
        if (!s.p.e.length) return 'O estoque acabou.';
        return seq('c', 10).some((id) => !s.p[id].length) ? 'Preencha as colunas vazias antes de distribuir.' : '';
      },
      compra(s, info) {
        for (let i = 0; i < 10; i++) { const c = s.p.e.pop(); s.up[c] = 1; s.p['c' + i].push(c); }
        info.sacou = 10;
      },
      depois(s, info) {
        for (let i = 0; i < 10; i++) {
          const col = s.p['c' + i];
          if (sequenciaCompleta(s, col)) {
            const f = seq('f', 8).find((id) => !s.p[id].length);
            const cs = col.splice(col.length - 13);
            cs.forEach((c) => s.p[f].push(c));
            (info.completos = info.completos || []).push(f);
          }
        }
        virarExpostas(s, seq('c', 10), info);
      },
      venceu(s) { return seq('f', 8).every((id) => s.p[id].length === 13); },
      hud(s) { return { rotulo: 'Sequências', valor: seq('f', 8).filter((id) => s.p[id].length === 13).length + '/8' }; },
      textoCompra() { return 'Distribua uma carta em cada coluna com o estoque.'; }
    };
  }
  MODOS.spider1 = modoSpider(1, 1);
  MODOS.spider2 = modoSpider(2, 3);
  MODOS.spider4 = modoSpider(4, 5);

  /* ---------- 3. FreeCell ---------- */
  function limiteMover(s, para) {
    const livres = seq('k', 4).filter((id) => !s.p[id].length).length;
    let vazias = seq('c', 8).filter((id) => !s.p[id].length && id !== para).length;
    return (livres + 1) * Math.pow(2, vazias);
  }
  MODOS.freecell = {
    nome: 'FreeCell', baralhos: 1, dif: 2, grupo: 'classicos', completar: true, alturaRel: 5.4,
    desc: 'Todas as cartas ficam abertas. Quatro células livres ajudam a reorganizar as colunas.',
    layout() {
      const L = [];
      seq('k', 4).forEach((id, i) => L.push(P(id, 'cel', i, 0)));
      seq('f', 4).forEach((id, i) => L.push(P(id, 'fun', 4 + i, 0, { marca: 'n' + i })));
      seq('c', 8).forEach((id, i) => L.push(P(id, 'col', i, 1, { fan: 'v' })));
      return { cols: 8, piles: L };
    },
    distribuir(s, deck) {
      seq('k', 4).concat(seq('f', 4), seq('c', 8)).forEach((id) => { s.p[id] = []; });
      deck.forEach((c, i) => empilhar(s, 'c' + (i % 8), c, true));
    },
    podePegar(s, pid, idx) {
      const a = s.p[pid], t = pid[0];
      if (t === 'c') return seqAlt(s, a, idx);
      if (t === 'k') return a.length === 1;
      return false;
    },
    podeSoltar(s, de, idx, para) {
      if (de === para) return false;
      const c = s.p[de][idx], n = s.p[de].length - idx, t = para[0];
      if (t === 'k') return n === 1 && !s.p[para].length;
      if (t === 'f') return n === 1 && NP(s, c) === +para.slice(1) && R(s, c) === s.p[para].length + 1;
      if (t === 'c') {
        if (n > limiteMover(s, para)) return false;
        const col = s.p[para];
        if (!col.length) return true;
        const top = topo(col);
        return R(s, top) === R(s, c) + 1 && VM(s, top) !== VM(s, c);
      }
      return false;
    },
    venceu(s) { return contar(s, seq('f', 4)) === 52; },
    hud(s) { return { rotulo: 'Fundação', valor: contar(s, seq('f', 4)) + '/52' }; }
  };

  /* ---------- 4. Tri Peaks ---------- */
  const PICOS = (function () {
    const pos = [], cob = [];
    const x1 = [1.5, 4.5, 7.5], x2 = [1, 2, 4, 5, 7, 8];
    x1.forEach((x) => pos.push([x, 0]));
    x2.forEach((x) => pos.push([x, 0.5]));
    for (let k = 0; k < 9; k++) pos.push([k + 0.5, 1]);
    for (let k = 0; k < 10; k++) pos.push([k, 1.5]);
    // quem cobre quem: índices 0-2 (linha 1), 3-8 (linha 2), 9-17 (linha 3), 18-27 (linha 4)
    for (let p = 0; p < 3; p++) cob[p] = [3 + 2 * p, 4 + 2 * p];
    for (let j = 0; j < 6; j++) { const q = j >> 1, o = j & 1; cob[3 + j] = [9 + 3 * q + o, 9 + 3 * q + o + 1]; }
    for (let k = 0; k < 9; k++) cob[9 + k] = [18 + k, 19 + k];
    for (let k = 18; k < 28; k++) cob[k] = [];
    return { pos: pos, cob: cob };
  })();
  function livre(s, idx, cob) { return cob[idx].every((j) => !s.p['p' + j].length); }

  MODOS.tripeaks = {
    nome: 'Tri Peaks', baralhos: 1, dif: 3, grupo: 'combinar', alturaRel: 4.4,
    desc: 'Três picos de cartas abertas. Tire a que for um nível acima ou abaixo da carta do monte.',
    layout() {
      const L = PICOS.pos.map((q, i) => P('p' + i, 'pic', q[0], q[1]));
      L.push(P('e', 'est', 3.5, 2.75), P('f', 'des', 5.5, 2.75));
      return { cols: 10, piles: L };
    },
    distribuir(s, deck) {
      for (let i = 0; i < 28; i++) { s.p['p' + i] = []; empilhar(s, 'p' + i, deck[i], true); }
      s.p.e = []; s.p.f = [];
      empilhar(s, 'f', deck[28], true);
      for (let k = 29; k < 52; k++) empilhar(s, 'e', deck[k], false);
    },
    podePegar(s, pid) { return pid[0] === 'p' && s.p[pid].length > 0 && livre(s, +pid.slice(1), PICOS.cob); },
    podeSoltar(s, de, idx, para) {
      if (para !== 'f') return false;
      const d = Math.abs(R(s, s.p[de][idx]) - R(s, topo(s.p.f)));
      return d === 1;
    },
    compraOk(s) { return s.p.e.length > 0; },
    compra(s, info) { const c = s.p.e.pop(); s.up[c] = 1; s.p.f.push(c); info.sacou = 1; },
    depois() {},
    venceu(s) { return contar(s, seq('p', 28)) === 0; },
    hud(s) { return { rotulo: 'Restantes', valor: contar(s, seq('p', 28)) }; },
    textoCompra() { return 'Vire uma carta do monte.'; },
    selecao: false
  };

  /* ---------- 5. Yukon ---------- */
  MODOS.yukon = {
    nome: 'Yukon', baralhos: 1, dif: 4, grupo: 'construir', completar: true, alturaRel: 5.3,
    desc: 'Sem estoque. Qualquer carta aberta pode ser movida, junto com todas as que estão sobre ela.',
    layout() {
      const L = [];
      seq('f', 4).forEach((id, i) => L.push(P(id, 'fun', 3 + i, 0, { marca: 'n' + i })));
      seq('c', 7).forEach((id, i) => L.push(P(id, 'col', i, 1, { fan: 'v', marca: 'K' })));
      return { cols: 7, piles: L };
    },
    distribuir(s, deck) {
      seq('f', 4).forEach((id) => { s.p[id] = []; });
      let k = 0;
      for (let i = 0; i < 7; i++) {
        s.p['c' + i] = [];
        if (i === 0) { empilhar(s, 'c0', deck[k++], true); continue; }
        for (let j = 0; j < i; j++) empilhar(s, 'c' + i, deck[k++], false);
        for (let j = 0; j < 5; j++) empilhar(s, 'c' + i, deck[k++], true);
      }
    },
    podePegar(s, pid, idx) {
      const t = pid[0];
      if (t === 'c') return !!s.up[s.p[pid][idx]];
      if (t === 'f') return idx === s.p[pid].length - 1;
      return false;
    },
    podeSoltar(s, de, idx, para) {
      if (de === para) return false;
      const c = s.p[de][idx], n = s.p[de].length - idx, t = para[0];
      if (t === 'f') return n === 1 && NP(s, c) === +para.slice(1) && R(s, c) === s.p[para].length + 1;
      if (t === 'c') {
        const col = s.p[para];
        if (!col.length) return R(s, c) === 13;
        const top = topo(col);
        return R(s, top) === R(s, c) + 1 && VM(s, top) !== VM(s, c);
      }
      return false;
    },
    depois(s, info) { virarExpostas(s, seq('c', 7), info); },
    venceu(s) { return contar(s, seq('f', 4)) === 52; },
    hud(s) { return { rotulo: 'Fundação', valor: contar(s, seq('f', 4)) + '/52' }; }
  };

  /* ---------- 6. Canfield ---------- */
  const proxCirc = (r) => (r % 13) + 1;
  MODOS.canfield = {
    nome: 'Canfield', baralhos: 1, dif: 4, grupo: 'construir', completar: true, alturaRel: 5.3,
    desc: 'Uma reserva de 13 cartas e fundações que começam numa carta sorteada. Os valores dão a volta.',
    layout() {
      const L = [P('e', 'est', 0, 0), P('d', 'des', 1, 0, { fan: 'h', leque: 3 })];
      seq('f', 4).forEach((id, i) => L.push(P(id, 'fun', 3 + i, 0, { marca: 'base' })));
      L.push(P('r', 'res', 0, 1, { fan: 'v', compacto: true }));
      seq('t', 4).forEach((id, i) => L.push(P(id, 'col', 3 + i, 1, { fan: 'v' })));
      return { cols: 7, piles: L };
    },
    distribuir(s, deck) {
      s.p.e = []; s.p.d = []; s.p.r = []; seq('f', 4).forEach((id) => { s.p[id] = []; }); seq('t', 4).forEach((id) => { s.p[id] = []; });
      let k = 0;
      for (let i = 0; i < 13; i++) empilhar(s, 'r', deck[k++], i === 12);
      for (let i = 0; i < 4; i++) empilhar(s, 't' + i, deck[k++], true);
      empilhar(s, 'f0', deck[k++], true);
      s.x = { base: R(s, s.p.f0[0]) };
      while (k < 52) empilhar(s, 'e', deck[k++], false);
    },
    podePegar(s, pid, idx) {
      const a = s.p[pid], t = pid[0];
      if (t === 't') return seqAlt(s, a, idx, true);
      if (t === 'r' || t === 'd') return idx === a.length - 1;
      return false;
    },
    podeSoltar(s, de, idx, para) {
      if (de === para) return false;
      const c = s.p[de][idx], n = s.p[de].length - idx, t = para[0];
      if (t === 'f') {
        if (n !== 1) return false;
        const f = s.p[para];
        if (!f.length) return R(s, c) === s.x.base;
        const top = topo(f);
        return NP(s, c) === NP(s, top) && R(s, c) === proxCirc(R(s, top)) && f.length < 13;
      }
      if (t === 't') {
        const col = s.p[para];
        if (!col.length) return true;
        const top = topo(col);
        return VM(s, top) !== VM(s, c) && (R(s, top) === R(s, c) + 1 || (R(s, top) === 1 && R(s, c) === 13));
      }
      return false;
    },
    compraOk(s) { return s.p.e.length > 0 || s.p.d.length > 0; },
    compra(s, info) {
      if (s.p.e.length) {
        const n = Math.min(3, s.p.e.length);
        for (let i = 0; i < n; i++) { const c = s.p.e.pop(); s.up[c] = 1; s.p.d.push(c); }
        info.sacou = n;
      } else {
        info.recicla = true;
        while (s.p.d.length) { const c = s.p.d.pop(); s.up[c] = 0; s.p.e.push(c); }
      }
    },
    depois(s, info) {
      // coluna vazia: a carta de cima da reserva vem sozinha
      seq('t', 4).forEach((id) => {
        if (!s.p[id].length && s.p.r.length) {
          const c = s.p.r.pop(); s.up[c] = 1; s.p[id].push(c);
          (info.refil = info.refil || []).push(id);
        }
      });
      if (s.p.r.length && !s.up[topo(s.p.r)]) { s.up[topo(s.p.r)] = 1; (info.viradas = info.viradas || []).push(topo(s.p.r)); }
    },
    venceu(s) { return contar(s, seq('f', 4)) === 52; },
    hud(s) { return { rotulo: 'Fundação', valor: contar(s, seq('f', 4)) + '/52' }; },
    textoCompra(s) { return s.p.e.length ? 'Compre três cartas do estoque.' : 'Vire o descarte de volta para o estoque.'; }
  };

  /* ---------- 7. Forty Thieves ---------- */
  MODOS.quarenta = {
    nome: 'Forty Thieves', baralhos: 2, dif: 5, grupo: 'construir', completar: true, alturaRel: 5.8,
    desc: 'Dois baralhos, uma carta por vez e uma só passada pelo estoque. Exige muito planejamento.',
    layout() {
      const L = [P('e', 'est', 0, 0), P('d', 'des', 1, 0)];
      seq('f', 8).forEach((id, i) => L.push(P(id, 'fun', 2 + i, 0, { marca: 'A' })));
      seq('c', 10).forEach((id, i) => L.push(P(id, 'col', i, 1, { fan: 'v' })));
      return { cols: 10, piles: L };
    },
    bases() { const b = []; for (let k = 0; k < 2; k++) for (let i = 0; i < 52; i++) b.push(i); return b; },
    distribuir(s, deck) {
      s.p.e = []; s.p.d = []; seq('f', 8).forEach((id) => { s.p[id] = []; });
      let k = 0;
      for (let i = 0; i < 10; i++) { s.p['c' + i] = []; for (let j = 0; j < 4; j++) empilhar(s, 'c' + i, deck[k++], true); }
      while (k < 104) empilhar(s, 'e', deck[k++], false);
    },
    podePegar(s, pid, idx) {
      const a = s.p[pid], t = pid[0];
      return (t === 'c' || t === 'd') && idx === a.length - 1;
    },
    podeSoltar(s, de, idx, para) {
      if (de === para) return false;
      const c = s.p[de][idx], t = para[0];
      if (t === 'f') {
        const f = s.p[para];
        if (!f.length) return R(s, c) === 1;
        return NP(s, c) === NP(s, topo(f)) && R(s, c) === f.length + 1;
      }
      if (t === 'c') {
        const col = s.p[para];
        if (!col.length) return true;
        const top = topo(col);
        return NP(s, top) === NP(s, c) && R(s, top) === R(s, c) + 1;
      }
      return false;
    },
    compraOk(s) { return s.p.e.length > 0; },
    compra(s, info) { const c = s.p.e.pop(); s.up[c] = 1; s.p.d.push(c); info.sacou = 1; },
    depois() {},
    venceu(s) { return contar(s, seq('f', 8)) === 104; },
    hud(s) { return { rotulo: 'Fundação', valor: contar(s, seq('f', 8)) + '/104' }; },
    textoCompra() { return 'Compre uma carta do estoque.'; }
  };

  /* ---------- 8. Scorpion ---------- */
  MODOS.scorpion = {
    nome: 'Scorpion', baralhos: 1, dif: 4, grupo: 'construir', alturaRel: 5.2,
    desc: 'Monte sequências de rei a ás do mesmo naipe. Mova qualquer carta aberta com tudo o que está sobre ela.',
    layout() {
      const L = [P('e', 'est', 0, 0)];
      seq('f', 4).forEach((id, i) => L.push(P(id, 'fun', 3 + i, 0, { marca: 'seq' })));
      seq('c', 7).forEach((id, i) => L.push(P(id, 'col', i, 1, { fan: 'v', marca: 'K' })));
      return { cols: 7, piles: L };
    },
    distribuir(s, deck) {
      s.p.e = []; seq('f', 4).forEach((id) => { s.p[id] = []; });
      let k = 0;
      for (let i = 0; i < 7; i++) {
        s.p['c' + i] = [];
        for (let j = 0; j < 7; j++) empilhar(s, 'c' + i, deck[k++], !(i < 4 && j < 3));
      }
      while (k < 52) empilhar(s, 'e', deck[k++], false);
    },
    podePegar(s, pid, idx) { return pid[0] === 'c' && !!s.up[s.p[pid][idx]]; },
    podeSoltar(s, de, idx, para) {
      if (de === para || para[0] !== 'c') return false;
      const c = s.p[de][idx], col = s.p[para];
      if (!col.length) return R(s, c) === 13;
      const top = topo(col);
      return NP(s, top) === NP(s, c) && R(s, top) === R(s, c) + 1;
    },
    compraOk(s) { return s.p.e.length > 0; },
    compra(s, info) {
      for (let i = 0; i < 3 && s.p.e.length; i++) { const c = s.p.e.pop(); s.up[c] = 1; s.p['c' + i].push(c); }
      info.sacou = 3;
    },
    depois(s, info) {
      for (let i = 0; i < 7; i++) {
        const col = s.p['c' + i];
        if (sequenciaCompleta(s, col)) {
          const f = seq('f', 4).find((id) => !s.p[id].length);
          col.splice(col.length - 13).forEach((c) => s.p[f].push(c));
          (info.completos = info.completos || []).push(f);
        }
      }
      virarExpostas(s, seq('c', 7), info);
    },
    venceu(s) { return seq('f', 4).every((id) => s.p[id].length === 13); },
    hud(s) { return { rotulo: 'Sequências', valor: seq('f', 4).filter((id) => s.p[id].length === 13).length + '/4' }; },
    textoCompra() { return 'Distribua as três cartas do estoque nas três primeiras colunas.'; }
  };

  /* ---------- 9. Golf ---------- */
  MODOS.golf = {
    nome: 'Golf', baralhos: 1, dif: 4, grupo: 'combinar', alturaRel: 5.6,
    desc: 'Limpe as sete colunas tirando cartas um nível acima ou abaixo da carta do monte. Uma só passada.',
    layout() {
      const L = seq('c', 7).map((id, i) => P(id, 'col', i, 0, { fan: 'v' }));
      L.push(P('e', 'est', 2.5, 'fim'), P('f', 'des', 3.5, 'fim'));
      return { cols: 7, piles: L };
    },
    distribuir(s, deck) {
      let k = 0;
      for (let i = 0; i < 7; i++) { s.p['c' + i] = []; for (let j = 0; j < 5; j++) empilhar(s, 'c' + i, deck[k++], true); }
      s.p.e = []; s.p.f = [];
      empilhar(s, 'f', deck[k++], true);
      while (k < 52) empilhar(s, 'e', deck[k++], false);
    },
    podePegar(s, pid, idx) { return pid[0] === 'c' && idx === s.p[pid].length - 1; },
    podeSoltar(s, de, idx, para) {
      if (para !== 'f') return false;
      return Math.abs(R(s, s.p[de][idx]) - R(s, topo(s.p.f))) === 1;
    },
    compraOk(s) { return s.p.e.length > 0; },
    compra(s, info) { const c = s.p.e.pop(); s.up[c] = 1; s.p.f.push(c); info.sacou = 1; },
    depois() {},
    venceu(s) { return contar(s, seq('c', 7)) === 0; },
    hud(s) { return { rotulo: 'Restantes', valor: contar(s, seq('c', 7)) }; },
    textoCompra() { return 'Vire uma carta do monte.'; }
  };

  /* ---------- 10. Crescent ---------- */
  const difCirc = (a, b) => ((a - b) % 13 + 13) % 13;
  MODOS.crescent = {
    nome: 'Crescent', baralhos: 2, dif: 3, grupo: 'construir', alturaRel: 6.4, max_emb: 9,
    desc: 'Dois baralhos e oito fundações: quatro sobem do ás ao rei, quatro descem do rei ao ás.',
    layout() {
      const L = [];
      seq('t', 8).forEach((id, i) => L.push(P(id, 'col', i, 0, { fan: 'v' })));
      seq('a', 4).forEach((id, i) => L.push(P(id, 'fun', i, 'fim', { marca: 'n' + i + 'A' })));
      seq('k', 4).forEach((id, i) => L.push(P(id, 'fun', 4 + i, 'fim', { marca: 'n' + i + 'K' })));
      for (let i = 8; i < 16; i++) L.push(P('t' + i, 'col', i - 8, 'fim2', { fan: 'v' }));
      return { cols: 8, piles: L };
    },
    bases() { const b = []; for (let k = 0; k < 2; k++) for (let i = 0; i < 52; i++) b.push(i); return b; },
    distribuir(s, deck) {
      seq('a', 4).concat(seq('k', 4), seq('t', 16)).forEach((id) => { s.p[id] = []; });
      s.x = { emb: 0 };
      const usadas = new Set();
      for (let n = 0; n < 4; n++) {
        const ace = deck.find((c) => !usadas.has(c) && s.b[c] === n * 13);
        usadas.add(ace); empilhar(s, 'a' + n, ace, true);
        const rei = deck.find((c) => !usadas.has(c) && s.b[c] === n * 13 + 12);
        usadas.add(rei); empilhar(s, 'k' + n, rei, true);
      }
      const resto = deck.filter((c) => !usadas.has(c));
      resto.forEach((c, i) => empilhar(s, 't' + Math.floor(i / 6), c, true));
    },
    podePegar(s, pid, idx) { return idx === s.p[pid].length - 1; },
    podeSoltar(s, de, idx, para) {
      if (de === para) return false;
      const c = s.p[de][idx], t = para[0], f = s.p[para];
      if (t === 't') {
        if (!f.length) return false;
        const d = difCirc(R(s, c), R(s, topo(f)));
        return NP(s, topo(f)) === NP(s, c) && (d === 1 || d === 12);
      }
      const nn = +para.slice(1);
      if (t === 'a') {
        if (NP(s, c) !== nn) return false;
        return f.length ? R(s, c) === R(s, topo(f)) + 1 && R(s, topo(f)) < 13 : R(s, c) === 1;
      }
      if (t === 'k') {
        if (NP(s, c) !== nn) return false;
        return f.length ? R(s, c) === R(s, topo(f)) - 1 && R(s, topo(f)) > 1 : R(s, c) === 13;
      }
      return false;
    },
    extraOk(s) { return s.x.emb < 9 && seq('t', 16).some((id) => s.p[id].length > 1); },
    extra(s, info) {
      seq('t', 16).forEach((id) => { const a = s.p[id]; if (a.length > 1) a.push(a.shift()); });
      s.x.emb++;
      info.embaralhou = true;
    },
    depois() {},
    venceu(s) { return seq('a', 4).concat(seq('k', 4)).every((id) => s.p[id].length === 13); },
    hud(s) { return { rotulo: 'Fundação', valor: contar(s, seq('a', 4).concat(seq('k', 4))) + '/104' }; },
    extraRotulo(s) { return 'Embaralhar (' + (9 - s.x.emb) + ')'; },
    fundVolta: true
  };

  /* ---------- 11. Pirâmide ---------- */
  const PIRAMIDE = (function () {
    const pos = [], cob = [];
    for (let r = 0; r < 7; r++) for (let i = 0; i <= r; i++) pos.push([(6 - r) / 2 + i, r * 0.5]);
    for (let r = 0; r < 7; r++) {
      for (let i = 0; i <= r; i++) {
        const id = (r * (r + 1)) / 2 + i;
        cob[id] = r < 6 ? [((r + 1) * (r + 2)) / 2 + i, ((r + 1) * (r + 2)) / 2 + i + 1] : [];
      }
    }
    return { pos: pos, cob: cob };
  })();
  MODOS.piramide = {
    nome: 'Pirâmide', baralhos: 1, dif: 3, grupo: 'combinar', alturaRel: 4.6, selecao: true,
    desc: 'Desmonte a pirâmide juntando pares de cartas que somam 13. O rei sai sozinho.',
    layout() {
      const L = PIRAMIDE.pos.map((q, i) => P('p' + i, 'pic', q[0], q[1]));
      L.push(P('e', 'est', 0, 0), P('d', 'des', 1, 0), P('f', 'fun', 6, 0, { marca: 'par' }));
      return { cols: 7, piles: L };
    },
    distribuir(s, deck) {
      for (let i = 0; i < 28; i++) { s.p['p' + i] = []; empilhar(s, 'p' + i, deck[i], true); }
      s.p.e = []; s.p.d = []; s.p.f = [];
      for (let k = 28; k < 52; k++) empilhar(s, 'e', deck[k], false);
    },
    podePegar(s, pid, idx) {
      if (pid[0] === 'p') return s.p[pid].length > 0 && livre(s, +pid.slice(1), PIRAMIDE.cob);
      return pid === 'd' && idx === s.p.d.length - 1;
    },
    disponivel(s, pid) { return this.podePegar(s, pid, (s.p[pid] || []).length - 1); },
    podeSoltar(s, de, idx, para) {
      if (de === para) return false;
      const c = s.p[de][idx];
      if (para === 'f') return R(s, c) === 13;
      if (para === 'e') return false;
      if (R(s, c) === 13) return false;
      if (!s.p[para].length || !this.disponivel(s, para)) return false;
      return R(s, c) + R(s, topo(s.p[para])) === 13;
    },
    mover(s, de, idx, para, info) {
      const c = s.p[de].pop(); s.p.f.push(c);
      const rem = [c];
      if (para !== 'f') { const d = s.p[para].pop(); s.p.f.push(d); rem.push(d); }
      info.removidas = rem;
    },
    compraOk(s) { return s.p.e.length > 0; },
    compra(s, info) { const c = s.p.e.pop(); s.up[c] = 1; s.p.d.push(c); info.sacou = 1; },
    depois() {},
    venceu(s) { return contar(s, seq('p', 28)) === 0; },
    hud(s) { return { rotulo: 'Restantes', valor: contar(s, seq('p', 28)) }; },
    textoCompra() { return 'Compre uma carta do estoque.'; }
  };

  const ORDEM = ['klondike', 'spider1', 'freecell', 'piramide', 'tripeaks', 'golf', 'yukon', 'canfield', 'scorpion', 'spider2', 'spider4', 'quarenta', 'crescent'];
  Object.keys(MODOS).forEach((id) => { MODOS[id].id = id; });

  /* ==========================================================================
     API
     ========================================================================== */
  const modo = (s) => MODOS[s.m];

  function clonar(s) {
    const p = {};
    Object.keys(s.p).forEach((k) => { p[k] = s.p[k].slice(); });
    return { m: s.m, b: s.b, p: p, up: s.up.slice(), x: JSON.parse(JSON.stringify(s.x)), jog: s.jog, pts: s.pts };
  }

  function novo(id, opcoes, deck) {
    const M = MODOS[id], o = opcoes || {};
    const b = M.bases ? M.bases() : (function () { const a = []; for (let i = 0; i < 52; i++) a.push(i); return a; })();
    const s = novoEstado(id, b);
    M.distribuir(s, deck || embaralhar(b.length), o);
    return s;
  }

  const memo = {};
  function layoutDe(id, compra) {
    const k = id + (compra || 0);
    if (!memo[k]) {
      const piles = MODOS[id].layout({ compra: compra }).piles, tipos = {};
      piles.forEach((q) => { tipos[q.id] = q.tipo; });
      memo[k] = { piles: piles, tipos: tipos };
    }
    return memo[k];
  }

  function lances(s, opcoes) {
    const M = modo(s), L = [], op = opcoes || {};
    const pids = Object.keys(s.p);
    const LY = layoutDe(s.m, s.x.compra), lay = LY.piles, tipos = LY.tipos;
    pids.forEach((de) => {
      const a = s.p[de];
      if (tipos[de] === 'est' || !a.length) return;
      if (tipos[de] === 'fun' && !M.fundVolta && !op.tudo) return;
      for (let idx = 0; idx < a.length; idx++) {
        if (!M.podePegar(s, de, idx)) continue;
        const vazios = {};
        for (let q = 0; q < lay.length; q++) {
          const para = lay[q].id;
          if (para === de || tipos[para] === 'est') continue;
          if (!M.podeSoltar(s, de, idx, para)) continue;
          const vazia = !s.p[para].length;
          if (vazia && lay[q].tipo !== 'fun') {
            if (vazios[lay[q].tipo]) continue;       // duas colunas (ou células) vazias valem o mesmo
            vazios[lay[q].tipo] = 1;
          }
          L.push({ t: 'm', de: de, idx: idx, para: para });
        }
      }
    });
    if (M.compraOk && M.compraOk(s)) L.push({ t: 'compra' });
    if (M.extraOk && M.extraOk(s)) L.push({ t: 'emb' });
    return L;
  }

  /* aplica o lance no próprio estado; devolve informações para a interface */
  function aplicar(s, m) {
    const M = modo(s), info = { t: m.t };
    if (m.t === 'compra') {
      M.compra(s, info);
    } else if (m.t === 'emb') {
      M.extra(s, info);
    } else {
      info.mov = m;
      info.carta = s.p[m.de][m.idx];
      if (M.mover) M.mover(s, m.de, m.idx, m.para, info);
      else {
        const mov = s.p[m.de].splice(m.idx);
        info.cartas = mov;
        for (let i = 0; i < mov.length; i++) s.p[m.para].push(mov[i]);
      }
    }
    if (M.depois) M.depois(s, info);
    s.jog++;
    return info;
  }

  function venceu(s) { return modo(s).venceu(s); }

  /* sem nenhum lance (o estoque conta como lance, então só acontece quando o jogo travou de vez) */
  function semJogadas(s) { return lances(s).length === 0; }

  /* ----- toque: escolhe o destino ----- */
  function tipos(s) { return layoutDe(s.m, s.x.compra).tipos; }

  function util(s, m, T) {
    if (m.t !== 'm') return true;
    const M = modo(s);
    // mover uma coluna inteira para outra coluna vazia não muda nada
    if (T[m.de] === 'col' && m.idx === 0 && T[m.para] === 'col' && !s.p[m.para].length) return false;
    if (T[m.de] === 'fun' && !M.fundVolta) return false;
    return true;
  }

  function pontuar(s, m, T) {
    if (m.t === 'compra') return 10;
    if (m.t === 'emb') return 1;
    const M = modo(s), a = s.p[m.de], dst = T[m.para], src = T[m.de];
    let v = 0;
    if (M.selecao || dst === 'pic') v = 70;
    if (dst === 'fun' || (m.para === 'f' && (s.m === 'golf' || s.m === 'tripeaks'))) v = 100;
    else if (dst === 'col') v = s.p[m.para].length ? 50 : 20;
    else if (dst === 'cel') v = 5;
    else if (dst === 'des') v = 60;
    if (src === 'col' && m.idx > 0 && !s.up[a[m.idx - 1]]) v += 40;                     // desvira uma carta
    if (src === 'col' && m.idx === 0 && dst === 'col' && s.p[m.para].length) v += 6;     // esvazia uma coluna
    if (src === 'fun') v -= 60;
    if (dst === 'col' && s.p[m.para].length && NP(s, s.p[m.para][s.p[m.para].length - 1]) === NP(s, a[m.idx])) v += 12;   // mesmo naipe
    if (src === 'cel' && dst === 'col') v += 8;
    return v;
  }

  /* lances úteis a partir de uma carta (toque), melhores primeiro */
  function lancesDaOrigem(s, pid, idx) {
    const T = tipos(s);
    return lances(s).filter((m) => m.t === 'm' && m.de === pid && m.idx === idx && util(s, m, T))
      .map((m) => ({ m: m, v: pontuar(s, m, T) })).sort((a, b) => b.v - a.v).map((x) => x.m);
  }

  /* melhor lance geral (dica simples) */
  function melhorLance(s) {
    const T = tipos(s);
    const L = lances(s).filter((m) => util(s, m, T));
    if (!L.length) return null;
    let melhor = null, nota = -1e9;
    L.forEach((m) => { const v = pontuar(s, m, T); if (v > nota) { nota = v; melhor = m; } });
    return melhor;
  }

  /* ----- completar sozinho (só fundação) ----- */
  function proximoAuto(s) {
    const M = modo(s);
    if (!M.completar) return null;
    const T = tipos(s);
    let melhor = null, r = 99;
    Object.keys(s.p).forEach((de) => {
      if (T[de] === 'fun' || T[de] === 'est') return;
      const a = s.p[de];
      if (!a.length) return;
      const idx = a.length - 1;
      if (!M.podePegar(s, de, idx)) return;
      for (const q in T) {
        if (T[q] !== 'fun' || !M.podeSoltar(s, de, idx, q)) continue;
        const v = R(s, a[idx]);
        if (v < r) { r = v; melhor = { t: 'm', de: de, idx: idx, para: q }; }
        break;
      }
    });
    return melhor;
  }

  function podeCompletar(s) {
    const M = modo(s);
    if (!M.completar || M.venceu(s)) return false;
    if (s.p.e && s.p.e.length) return false;
    for (let i = 0; i < s.up.length; i++) {
      let achou = false;
      for (const k in s.p) if (s.p[k].indexOf(i) >= 0) { achou = true; break; }
      if (achou && !s.up[i]) return false;
    }
    const c = clonar(s);
    let n = 0;
    while (!M.venceu(c) && n++ < 400) {
      const m = proximoAuto(c);
      if (!m) return false;
      aplicar(c, m);
    }
    return M.venceu(c);
  }


  /* ----- ponte com o solucionador do Klondike (regras.js / solver.js) ----- */
  function paraPaci(s) {
    const base = (i) => s.b[i];
    const col = [], ocultas = [];
    for (let i = 0; i < 7; i++) { const a = s.p['c' + i]; col.push(a.map(base)); ocultas.push(a.filter((c) => !s.up[c]).length); }
    return {
      compra: s.x.compra, estoque: s.p.e.map(base), descarte: s.p.d.map(base),
      fund: [0, 1, 2, 3].map((n) => s.p['f' + n].map(base)), col: col, ocultas: ocultas,
      pontos: s.pts, jogadas: s.jog, reciclagens: s.x.rec
    };
  }
  function lanceDePaci(s, m) {
    const ult = (pid) => s.p[pid].length - 1;
    switch (m.t) {
      case 'c': return { t: 'compra' };
      case 'd': return { t: 'm', de: 'd', idx: ult('d'), para: 'c' + m.para };
      case 'df': return { t: 'm', de: 'd', idx: ult('d'), para: 'f' + nap(s.b[topo(s.p.d)]) };
      case 'cf': return { t: 'm', de: 'c' + m.de, idx: ult('c' + m.de), para: 'f' + nap(s.b[topo(s.p['c' + m.de])]) };
      case 'cc': return { t: 'm', de: 'c' + m.de, idx: m.k, para: 'c' + m.para };
      case 'fc': return { t: 'm', de: 'f' + m.naipe, idx: ult('f' + m.naipe), para: 'c' + m.para };
    }
    return null;
  }

  raiz.Jogos = {
    MODOS: MODOS, ORDEM: ORDEM, novo: novo, clonar: clonar, lances: lances, aplicar: aplicar, venceu: venceu,
    semJogadas: semJogadas, lancesDaOrigem: lancesDaOrigem, melhorLance: melhorLance, proximoAuto: proximoAuto,
    podeCompletar: podeCompletar, embaralhar: embaralhar, tipos: tipos, util: util, layoutDe: layoutDe,
    paraPaci: paraPaci, lanceDePaci: lanceDePaci,
    nap: nap, val: val, verm: verm, modo: modo
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = raiz.Jogos;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
