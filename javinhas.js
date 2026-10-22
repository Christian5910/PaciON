/* ==========================================================================
   PaciON! — javinhas.js  (interface; regras em jogos.js e regras.js, cartas em cartas.js,
   menu, sons e estatísticas vêm do on.js)

   Índice
   1. Constantes e estado
   2. Miniaturas das mesas
   3. Montar a mesa
   4. Medidas e posições
   5. Render
   6. Lances (executar, desfazer, completar)
   7. Entrada (arrastar, tocar, teclado)
   8. Dica
   9. Novo jogo, trocar de jogo, vitória
   10. Salvar, estatísticas e opções
   11. Escolher jogo e Como Jogar
   12. Início
   ========================================================================== */
(function () {
  'use strict';

  /* ==========================================================================
     1. Constantes e estado
     ========================================================================== */
  const J = window.Jogos, C = window.Cartas;
  const LS = { prefs: 'pacion.prefs', jogo: 'pacion.j.', stats: 'pacion.stats', antigo: 'pacion.jogo' };
  const topo = (a) => a[a.length - 1];
  const $ = (s) => document.querySelector(s);
  const el = {
    box: $('#mesa-box'), mesa: $('#mesa'), pontos: $('#pontos'), hudRotulo: $('#hud-rotulo'), tempo: $('#tempo'), jogadas: $('#jogadas'),
    msg: $('#message-area'), undo: $('#undo-btn'), dica: $('#hint-btn'), extra: $('#extra-btn'), auto: $('#auto-btn'), restart: $('#restart-btn'),
    tela: $('#tela'), telaTitulo: $('#tela-titulo'), telaTexto: $('#tela-texto'), telaBtn: $('#tela-btn'),
    modoNome: $('#modo-nome'), modoMini: $('#modo-mini'), jogosCorpo: $('#jogos-corpo'),
    config: $('#config'), opcoesAtual: $('#opcoes-atual'), opCompra: $('#op-compra'), opJogo: $('#op-jogo')
  };
  const MIN_W = 26;               // menor largura de carta; abaixo disso a mesa ganha rolagem lateral
  const LIMITE_ARRASTO = 6;
  const DIF = ['', 'Fácil', 'Moderado', 'Médio', 'Difícil', 'Muito difícil'];
  const GRUPOS = [
    ['classicos', 'Clássicos', 'Os dois jogos mais conhecidos.'],
    ['combinar', 'Combinar cartas', 'Partidas curtas: tire cartas que combinam com a do monte ou formam pares.'],
    ['construir', 'Montar sequências', 'Organize as cartas nas colunas até completar as fundações.']
  ];
  const AJUDA_DE = { klondike: 'klondike', spider1: 'spider', spider2: 'spider', spider4: 'spider', freecell: 'freecell', piramide: 'piramide', tripeaks: 'tripeaks', golf: 'golf', yukon: 'yukon', canfield: 'canfield', scorpion: 'scorpion', quarenta: 'quarenta', crescent: 'crescent' };

  let prefs = Object.assign({ modo: 'klondike', compra: 1, jogo: 'aleatorio' }, ON.store.get(LS.prefs, {}));
  if (!J.MODOS[prefs.modo]) prefs.modo = 'klondike';
  if (prefs.compra !== 3) prefs.compra = 1;
  if (prefs.jogo !== 'solucao') prefs.jogo = 'aleatorio';

  let S = null;                 // estado do jogo (ver jogos.js)
  let hist = [];                // fotos do estado antes de cada lance, para desfazer
  let ini = false;              // já houve algum lance nesta partida
  let venceu = false;
  let gerando = false;          // procurando um jogo com solução
  let ocupado = false;          // completando sozinho
  let tempoMs = 0, tPrev = 0, relogio = null;
  let cartas = [];              // elementos .carta, um por instância
  let slots = {};               // elementos .slot, por pilha
  let montado = '';             // modo cuja mesa está montada
  let LY = null, COLS = 7;      // layout do modo atual
  let L = null;                 // medidas
  let pos = [];                 // posição de cada carta: {x, y, z, pid, k, tipo}
  let basePilha = {};           // posição de cada pilha
  let sel = null;               // carta escolhida (Pirâmide)
  let dicaTimer = 0, drag = null;
  let worker = null, reqId = 0, pendentes = {};
  let ultimosPontos = 0;

  const reduzido = () => !!ON.cfg.reduzir;
  const emAndamento = () => ini && !venceu;
  const bloqueado = () => !S || venceu || gerando || ocupado;
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const M = () => J.modo(S);
  const nome = (i) => C.nome(S.b[i], true);
  const fmt = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const modoOpcoes = () => ({ compra: prefs.compra });

  /* ==========================================================================
     2. Miniaturas das mesas (usadas no botão do jogo, no seletor e no Como Jogar)
     ========================================================================== */
  function miniatura(id) {
    const lay = J.MODOS[id].layout({ compra: 1 });
    const cw = 10, ch = 14, g = 2.4, passo = 3.6;
    const grupos = {};
    let bottom = 0, maxX = 0, partes = '';
    lay.piles.forEach((q) => {
      const px = g + q.x * (cw + g);
      let py;
      if (typeof q.y === 'string') { if (grupos[q.y] === undefined) grupos[q.y] = bottom + g; py = grupos[q.y]; }
      else py = g + q.y * (ch + g);
      let fim = py + ch;
      const x = px.toFixed(1), y = py.toFixed(1);
      if (q.tipo === 'est') {
        partes += '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + ch + '" rx="1.4" fill="#1e88e5" stroke="#fbfcff" stroke-width="0.9"/>';
      } else if (q.tipo === 'pic') {
        partes += '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + ch + '" rx="1.4" fill="#fbfcff" stroke="#9db4d6" stroke-width="0.5"/>';
      } else if (q.tipo === 'col' || q.tipo === 'res') {
        const n = q.tipo === 'res' ? 3 : 3;
        for (let k = 0; k < n; k++) {
          const yy = (py + k * passo).toFixed(1);
          partes += '<rect x="' + x + '" y="' + yy + '" width="' + cw + '" height="' + ch + '" rx="1.4" fill="' + (k === n - 1 ? '#fbfcff' : '#1e88e5') + '" stroke="' + (k === n - 1 ? '#9db4d6' : '#fbfcff') + '" stroke-width="0.5"/>';
        }
        fim = py + ch + (n - 1) * passo;
      } else {
        partes += '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + ch + '" rx="1.4" fill="none" stroke="rgba(144,202,249,.7)" stroke-width="0.7" stroke-dasharray="1.8 1.4"/>';
      }
      bottom = Math.max(bottom, fim);
      maxX = Math.max(maxX, px + cw);
    });
    const Wv = maxX + g, Hv = bottom + g;
    return '<svg viewBox="0 0 ' + Wv.toFixed(1) + ' ' + Hv.toFixed(1) + '" aria-hidden="true" focusable="false"><rect width="' + Wv.toFixed(1) + '" height="' + Hv.toFixed(1) + '" rx="3" fill="#0d3c75"/>' + partes + '</svg>';
  }

  /* ==========================================================================
     3. Montar a mesa (cartas e espaços do jogo atual)
     ========================================================================== */
  const marcaHTML = (m) => {
    if (!m) return '';
    const mm = /^n(\d)(A|K)?$/.exec(m);
    if (mm) {
      return '<svg class="mk-naipe' + (mm[2] ? ' peq' : '') + '" viewBox="0 0 32 32" aria-hidden="true"><use href="#n' + mm[1] + '"/></svg>' +
        (mm[2] ? '<span class="mk-txt peq">' + mm[2] + '</span>' : '');
    }
    if (m === 'K' || m === 'A') return '<span class="mk-txt">' + m + '</span>';
    if (m === 'seq') return '<span class="mk-txt peq">K-A</span>';
    if (m === 'par') return '<span class="mk-txt">13</span>';
    if (m === 'base') return '<span class="mk-txt mk-base"></span>';
    return '';
  };

  function montarMesa() {
    el.mesa.querySelectorAll('.carta, .slot').forEach((x) => x.remove());
    el.mesa.classList.remove('arrastando-ativo');
    const mo = J.MODOS[S.m];
    COLS = mo.layout({ compra: S.x.compra }).cols;
    LY = J.layoutDe(S.m, S.x.compra);
    slots = {};
    const frag = document.createDocumentFragment();
    LY.piles.forEach((q) => {
      if (q.tipo === 'pic') return;
      const s = document.createElement(q.tipo === 'est' ? 'button' : 'div');
      s.className = 'slot slot-' + q.tipo;
      s.dataset.pid = q.id;
      if (q.tipo === 'est') { s.type = 'button'; s.setAttribute('aria-label', 'Estoque'); }
      s.innerHTML = marcaHTML(q.marca);
      slots[q.id] = s;
      frag.appendChild(s);
    });
    cartas = [];
    S.b.forEach((b, i) => { const d = C.criar(b, i); cartas[i] = d; frag.appendChild(d); });
    el.mesa.appendChild(frag);
    if (!el.mesa.querySelector('#mesa-esp')) { const e = document.createElement('div'); e.id = 'mesa-esp'; el.mesa.appendChild(e); }
    el.modoNome.textContent = mo.nome;
    el.modoMini.innerHTML = miniatura(S.m);
    el.config.hidden = S.m !== 'klondike';
    el.extra.hidden = !mo.extraOk;
    montado = S.m;
  }

  /* ==========================================================================
     4. Medidas e posições
     ========================================================================== */
  function medir() {
    const mo = J.MODOS[S.m];
    const W = el.box.clientWidth;
    const gap = Math.max(3, Math.min(12, Math.round(W * 0.012)));
    const margem = Math.max(4, gap);
    const wFit = Math.floor((W - margem * 2 - gap * (COLS - 1)) / COLS);
    const topAbs = el.box.getBoundingClientRect().top + window.scrollY;
    const disp = Math.max(300, window.innerHeight - 20 - Math.min(topAbs, window.innerHeight * 0.45));
    const wAlt = Math.floor(disp / mo.alturaRel / C.RAZAO);
    const w = Math.max(MIN_W, Math.min(wFit, 120, wAlt));
    const h = Math.round(w * C.RAZAO);
    const util = COLS * w + (COLS - 1) * gap;
    const x0 = Math.max(margem, Math.round((W - util) / 2));
    L = { W, w, h, gap, margem, x0, vg: gap * 2, dd: Math.max(6, h * 0.12), du: Math.max(12, h * 0.3), off: Math.max(8, Math.round(w * 0.26)), disp, larg: Math.max(W, x0 + util + margem) };
  }

  function colocar(esc) {
    const p = new Array(S.b.length), base = {}, grupos = {};
    let bottom = 0;
    LY.piles.forEach((q, qi) => {
      const a = S.p[q.id] || [];
      const px = L.x0 + q.x * (L.w + L.gap);
      let py;
      if (typeof q.y === 'string') { if (grupos[q.y] === undefined) grupos[q.y] = bottom + L.vg; py = grupos[q.y]; }
      else py = L.margem + q.y * (L.h + L.vg);
      base[q.id] = { x: px, y: py };
      let y = 0, fim = L.h;
      const dentroDe = q.fan === 'h' ? Math.max(0, a.length - (q.leque || 1)) : 0;
      a.forEach((c, k) => {
        let ox = 0, oy = 0;
        if (q.fan === 'v') { oy = y; fim = oy + L.h; }
        else if (q.fan === 'h' && k >= dentroDe) ox = (k - dentroDe) * L.off;
        const o = !S.up[c];
        p[c] = { x: px + ox, y: py + oy, z: 10 + k + (q.tipo === 'pic' ? qi : 0), o: o, pid: q.id, k: k, tipo: q.tipo, qi: qi };
        if (q.fan === 'v') y += (o ? (q.compacto ? L.dd * 0.55 : L.dd) : L.du) * esc;
      });
      bottom = Math.max(bottom, py + fim);
    });
    return { p: p, base: base, alto: bottom + L.margem };
  }

  function ajustar() {
    let r = colocar(1);
    if (r.alto > L.disp) {
      const min = colocar(0.62);
      if (min.alto <= L.disp) {
        let lo = 0.62, hi = 1;
        r = min;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2, t = colocar(mid);
          if (t.alto <= L.disp) { lo = mid; r = t; } else hi = mid;
        }
      } else r = min;
    }
    return r;
  }

  /* ==========================================================================
     5. Render
     ========================================================================== */
  function render(op) {
    if (!S) return;
    op = op || {};
    if (montado !== S.m) montarMesa();
    medir();
    const R = ajustar();
    pos = R.p; basePilha = R.base;
    const rola = L.larg > L.W + 1;
    el.mesa.style.setProperty('--w', L.w + 'px');
    el.mesa.style.setProperty('--h', L.h + 'px');
    el.mesa.style.height = Math.max(Math.round(R.alto), L.h + L.margem * 2) + (rola ? 14 : 0) + 'px';
    el.mesa.querySelector('#mesa-esp').style.left = Math.max(0, L.larg - 1) + 'px';
    const mo = M(), T = LY.tipos;
    Object.keys(slots).forEach((id) => {
      const b = R.base[id];
      slots[id].style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
    });
    if (slots.e) slots.e.classList.toggle('recicla', !S.p.e.length && mo.compraOk && mo.compraOk(S) && !!(S.p.d && S.p.d.length));
    if (S.x.base) el.mesa.querySelectorAll('.mk-base').forEach((s) => { s.textContent = C.RANGO[S.x.base - 1]; });
    const arr = new Set(op.arrastando || []);
    const ordem = [];
    if (op.distribuir && !reduzido()) {
      for (let i = 0; i < pos.length; i++) if (pos[i].tipo !== 'est') ordem.push(i);
      ordem.sort((a, b) => (pos[a].k - pos[b].k) || (pos[a].qi - pos[b].qi));
    }
    const passo = ordem.length ? Math.min(30, 1100 / ordem.length) : 0;
    const rank = {};
    ordem.forEach((c, i) => { rank[c] = i; });
    for (let i = 0; i < pos.length; i++) {
      const d = cartas[i], q = pos[i];
      if (arr.has(i)) continue;
      const a = S.p[q.pid], pil = LY.piles[q.qi];
      if (op.semAnim) { d.style.transition = 'none'; d.firstChild.style.transition = 'none'; }
      d.style.transform = 'translate(' + q.x + 'px,' + q.y + 'px)';
      d.style.zIndex = q.z;
      d.classList.toggle('oculta', q.o);
      const lbl = q.o ? 'Carta virada para baixo' : C.nome(S.b[i]);
      if (d._lbl !== lbl) { d.setAttribute('aria-label', lbl); d._lbl = lbl; }
      d.classList.toggle('pega', q.tipo !== 'est' && !!mo.podePegar(S, q.pid, q.k));
      const fundo = q.tipo === 'est' ? q.k < a.length - 1
        : pil.fan === 'n' ? q.k < a.length - 1
          : pil.fan === 'h' ? q.k < a.length - (pil.leque || 1)
            : false;
      d.classList.toggle('sem-sombra', fundo);
      d.classList.toggle('sel', !!(sel && sel.c === i));
      d.classList.remove('voa');
      d.style.opacity = '';
      if (op.distribuir) {
        const dl = rank[i] === undefined ? 0 : Math.round(rank[i] * passo);
        d.style.transitionDelay = dl + 'ms';
        d.firstChild.style.transitionDelay = (rank[i] === undefined ? 0 : dl + 160) + 'ms';
      } else if (d.style.transitionDelay) {
        d.style.transitionDelay = '';
        d.firstChild.style.transitionDelay = '';
      }
    }
    if (op.semAnim) {
      void el.mesa.offsetWidth;
      for (let i = 0; i < pos.length; i++) { if (arr.has(i)) continue; cartas[i].style.transition = ''; cartas[i].firstChild.style.transition = ''; }
    }
    if (op.distribuir) setTimeout(() => { cartas.forEach((d) => { d.style.transitionDelay = ''; d.firstChild.style.transitionDelay = ''; }); }, 1500);
    atualizarPainel();
  }

  function atualizarPainel() {
    if (!S) return;
    const mo = M(), h = mo.hud(S);
    el.hudRotulo.textContent = h.rotulo;
    if (S.m === 'klondike' && S.pts > ultimosPontos && !reduzido()) {
      el.pontos.classList.remove('sobe'); void el.pontos.offsetWidth; el.pontos.classList.add('sobe');
    }
    ultimosPontos = S.pts;
    el.pontos.textContent = h.valor;
    el.jogadas.textContent = S.jog;
    el.tempo.textContent = fmt(tempoMs);
    el.undo.disabled = !hist.length || bloqueado();
    el.dica.disabled = bloqueado();
    if (mo.extraOk) {
      el.extra.hidden = false;
      el.extra.textContent = mo.extraRotulo ? mo.extraRotulo(S) : 'Extra';
      el.extra.disabled = bloqueado() || !mo.extraOk(S);
    } else el.extra.hidden = true;
    el.auto.hidden = !(!venceu && !gerando && !ocupado && J.podeCompletar(S));
    if (S.m === 'klondike') {
      el.opcoesAtual.textContent = 'Compra ' + S.x.compra + (S.x.compra === 1 ? ' carta' : ' cartas') + ' · ' + (prefs.jogo === 'solucao' ? 'Com solução' : 'Aleatórios');
      marcar(el.opCompra, prefs.compra);
      marcar(el.opJogo, prefs.jogo);
    }
  }

  function marcar(grupo, valor) {
    [...grupo.children].forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(valor))));
  }

  /* ==========================================================================
     6. Lances
     ========================================================================== */
  function limparDica() {
    clearTimeout(dicaTimer);
    el.mesa.querySelectorAll('.carta.dica').forEach((d) => d.classList.remove('dica'));
    el.mesa.querySelectorAll('.slot.alvo').forEach((d) => d.classList.remove('alvo'));
  }

  function desselecionar() {
    if (!sel) return;
    sel = null;
    el.mesa.querySelectorAll('.carta.sel').forEach((d) => d.classList.remove('sel'));
  }

  function uteis(s) {
    const T = J.tipos(s);
    return J.lances(s).filter((m) => J.util(s, m, T) && !(m.t === 'm' && T[m.de] === 'cel' && T[m.para] === 'cel'));
  }

  function executar(m) {
    limparDica(); desselecionar();
    hist.push(J.clonar(S));
    if (hist.length > 300) hist.shift();
    if (!ini) comecou();
    const T = LY.tipos;
    const info = J.aplicar(S, m);
    if (m.t === 'compra' || m.t === 'emb') { ON.som('toque'); ON.vibrar('leve'); }
    else if (T[m.para] === 'fun' || info.removidas || info.completos) { ON.som('acerto'); ON.vibrar('leve'); }
    else { ON.som('mover'); ON.vibrar('mover'); }
    el.msg.textContent = '';
    render();
    salvar();
    depoisDoLance(info);
  }

  function depoisDoLance(info) {
    if (J.venceu(S)) { ganhar(); return; }
    if (info && info.completos) el.msg.textContent = 'Sequência completa!';
    else if (!J.podeCompletar(S) && !uteis(S).length) el.msg.textContent = 'Sem jogadas possíveis. Desfaça jogadas ou comece um jogo novo.';
  }

  function desfazer() {
    if (bloqueado() || !hist.length) return;
    limparDica(); desselecionar();
    S = hist.pop();
    ON.som('toque'); ON.vibrar('leve');
    el.msg.textContent = '';
    render();
    salvar();
  }

  async function completar() {
    if (bloqueado() || !J.podeCompletar(S)) return;
    ocupado = true;
    limparDica(); desselecionar();
    atualizarPainel();
    while (!J.venceu(S)) {
      const m = J.proximoAuto(S);
      if (!m) break;
      hist.push(J.clonar(S));
      J.aplicar(S, m);
      ON.som('acerto');
      render();
      await dormir(reduzido() ? 20 : 80);
    }
    ocupado = false;
    salvar();
    if (J.venceu(S)) ganhar(); else atualizarPainel();
  }

  function comprar() {
    if (bloqueado()) return;
    const mo = M();
    if (!mo.compraOk || !mo.compraOk(S)) {
      ON.som('erro');
      if (mo.compraMsg) el.msg.textContent = mo.compraMsg(S);
      return;
    }
    executar({ t: 'compra' });
  }

  function embaralharExtra() {
    if (bloqueado() || !M().extraOk || !M().extraOk(S)) return;
    executar({ t: 'emb' });
  }

  /* ==========================================================================
     7. Entrada
     ========================================================================== */
  function lancesDe(pid, k) {
    return J.lances(S).filter((m) => m.t === 'm' && m.de === pid && m.idx === k);
  }

  function retDestino(pid) {
    const b = basePilha[pid], a = S.p[pid], pil = LY.piles.find((q) => q.id === pid);
    if (pil.tipo === 'pic' && a.length) return { x: pos[a[0]].x, y: pos[a[0]].y, w: L.w, h: L.h };
    if (pil.fan === 'v' && a.length) { const q = pos[topo(a)]; return { x: b.x, y: b.y, w: L.w, h: q.y + L.h - b.y }; }
    return { x: b.x, y: b.y, w: L.w, h: L.h };
  }

  function sobreposicao(a, b) {
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return x * y;
  }

  function melhorAlvo(d, dx, dy) {
    const q = pos[d.cartas[0]];
    const r = { x: q.x + dx, y: q.y + dy, w: L.w, h: L.h };
    let melhor = null, area = 0;
    d.destinos.forEach((m) => {
      const a = sobreposicao(r, retDestino(m.para));
      if (a > area) { area = a; melhor = m; }
    });
    return area > L.w * L.h * 0.16 ? melhor : null;
  }

  function marcarAlvo(m) {
    el.mesa.querySelectorAll('.slot.alvo').forEach((d) => d.classList.remove('alvo'));
    if (!m || !slots[m.para]) return;
    const t = LY.tipos[m.para];
    if (!S.p[m.para].length || t === 'fun' || t === 'cel') slots[m.para].classList.add('alvo');
  }

  function erroCarta(c) {
    const d = cartas[c];
    ON.som('erro'); ON.vibrar('erro');
    if (reduzido()) return;
    d.classList.remove('erro'); void d.offsetWidth; d.classList.add('erro');
    setTimeout(() => d.classList.remove('erro'), 400);
  }

  function tocar(c) {
    const q = pos[c], mo = M();
    if (mo.selecao) { tocarPar(c, q); return; }
    const l = lancesDe(q.pid, q.k).filter((m) => J.util(S, m, LY.tipos))
      .map((m) => ({ m: m })).length ? J.lancesDaOrigem(S, q.pid, q.k) : [];
    if (!l.length) { erroCarta(c); return; }
    executar(l[0]);
  }

  // Pirâmide: escolher uma carta e depois a que forma o par
  function tocarPar(c, q) {
    const mo = M();
    if (!mo.podePegar(S, q.pid, q.k)) { erroCarta(c); return; }
    if (J.val(S.b[c]) === 13) { executar({ t: 'm', de: q.pid, idx: q.k, para: 'f' }); return; }
    if (sel && sel.c === c) { desselecionar(); return; }
    if (sel && mo.podeSoltar(S, sel.pid, sel.k, q.pid)) { executar({ t: 'm', de: sel.pid, idx: sel.k, para: q.pid }); return; }
    desselecionar();
    sel = { c: c, pid: q.pid, k: q.k };
    cartas[c].classList.add('sel');
    ON.som('toque');
    if (sel) el.msg.textContent = 'Agora toque na carta que soma 13 com ' + nome(c) + '.';
  }

  el.mesa.addEventListener('pointerdown', (e) => {
    if (bloqueado()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const alvo = e.target.closest('.carta');
    limparDica();
    if (!alvo) return;
    const c = +alvo.dataset.c, q = pos[c];
    if (!q) return;
    if (q.tipo === 'est') { drag = { tipo: 'estoque', sx: e.clientX, sy: e.clientY }; return; }
    if (!M().podePegar(S, q.pid, q.k)) {
      if (q.o) { drag = null; return; }
      drag = { tipo: 'invalida', c: c, sx: e.clientX, sy: e.clientY };
      return;
    }
    const cs = S.p[q.pid].slice(q.k);
    drag = {
      tipo: 'carta', c: c, pid: q.pid, k: q.k, cartas: cs, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY,
      mover: false, id: e.pointerId, base: cs.map((x) => ({ x: pos[x].x, y: pos[x].y })),
      destinos: lancesDe(q.pid, q.k), sc0: el.mesa.scrollLeft, alvo: null, dx: 0, dy: 0
    };
    try { el.mesa.setPointerCapture(e.pointerId); } catch (err) { /* segue */ }
  });

  function posicionarArrasto() {
    const d = drag;
    d.dx = d.cx - d.sx + (el.mesa.scrollLeft - d.sc0);
    d.dy = d.cy - d.sy;
    d.cartas.forEach((x, i) => {
      cartas[x].style.transform = 'translate(' + (d.base[i].x + d.dx) + 'px,' + (d.base[i].y + d.dy) + 'px)';
    });
    const m = melhorAlvo(d, d.dx, d.dy);
    if (m !== d.alvo) { d.alvo = m; marcarAlvo(m); }
  }

  // arrastando perto da borda de uma mesa mais larga que a tela, a mesa rola sozinha
  function rolarBorda() {
    if (!drag || !drag.mover) return;
    const r = el.mesa.getBoundingClientRect();
    let v = 0;
    if (drag.cx < r.left + 30) v = -9; else if (drag.cx > r.right - 30) v = 9;
    if (v) {
      const antes = el.mesa.scrollLeft, max = Math.max(0, L.larg - L.W);
      el.mesa.scrollLeft = Math.max(0, Math.min(max, antes + v));
      if (el.mesa.scrollLeft !== antes) posicionarArrasto();
    }
    requestAnimationFrame(rolarBorda);
  }

  el.mesa.addEventListener('pointermove', (e) => {
    if (!drag || drag.tipo !== 'carta' || e.pointerId !== drag.id) return;
    drag.cx = e.clientX; drag.cy = e.clientY;
    if (!drag.mover) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < LIMITE_ARRASTO) return;
      drag.mover = true;
      drag.cartas.forEach((x) => cartas[x].classList.add('arrastando'));
      requestAnimationFrame(rolarBorda);
    }
    posicionarArrasto();
  });

  function soltar(e) {
    if (!drag) return;
    const d = drag; drag = null;
    el.mesa.querySelectorAll('.slot.alvo').forEach((s) => s.classList.remove('alvo'));
    if (d.tipo === 'estoque') {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < LIMITE_ARRASTO) comprar();
      return;
    }
    if (d.tipo === 'invalida') {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < LIMITE_ARRASTO) tocarInvalida(d.c);
      return;
    }
    if (!d.mover) { tocar(d.c); return; }
    const m = melhorAlvo(d, d.dx, d.dy);
    d.cartas.forEach((x) => cartas[x].classList.remove('arrastando'));
    if (m) executar(m);
    else { render({ semAnim: false }); ON.som('erro'); }
  }

  // toque numa carta que não pode ser usada agora
  function tocarInvalida(c) {
    if (M().selecao && sel) {
      const q = pos[c];
      if (q && M().podePegar(S, q.pid, q.k)) { tocarPar(c, q); return; }
    }
    erroCarta(c);
  }

  el.mesa.addEventListener('pointerup', soltar);
  el.mesa.addEventListener('pointercancel', () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.cartas) d.cartas.forEach((x) => cartas[x].classList.remove('arrastando'));
    el.mesa.querySelectorAll('.slot.alvo').forEach((s) => s.classList.remove('alvo'));
    render();
  });

  // o espaço do estoque (vazio) também compra ou recicla
  el.mesa.addEventListener('click', (e) => {
    const s = e.target.closest('.slot-est');
    if (!s) return;
    if (e.detail === 0 || !S.p.e.length) comprar();
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ON.modal && ON.modal.aberto && ON.modal.aberto()) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && !(t && t.tagName === 'BUTTON')) { e.preventDefault(); comprar(); }
    else if (k === 'u') { e.preventDefault(); desfazer(); }
    else if (k === 'h') { e.preventDefault(); dica(); }
    else if (k === 'n') { e.preventDefault(); novoJogo(); }
  });

  /* ==========================================================================
     8. Dica
     ========================================================================== */
  function descrever(m) {
    const mo = M(), T = LY.tipos;
    if (m.t === 'compra') return mo.textoCompra ? mo.textoCompra(S) : 'Compre uma carta.';
    if (m.t === 'emb') return 'Embaralhe as pilhas.';
    const c = S.p[m.de][m.idx], n = S.p[m.de].length - m.idx, dst = T[m.para];
    if (S.m === 'piramide') {
      if (m.para === 'f') return 'Retire ' + nome(c) + '. O rei vale 13 sozinho.';
      return 'Junte ' + nome(c) + ' com ' + nome(topo(S.p[m.para])) + '. Os dois somam 13.';
    }
    if (S.m === 'golf' || S.m === 'tripeaks') return 'Tire ' + nome(c) + ' e leve para o monte.';
    if (dst === 'fun') return 'Mande ' + nome(c) + ' para a fundação.';
    if (dst === 'cel') return 'Guarde ' + nome(c) + ' numa célula livre.';
    const col = S.p[m.para];
    return 'Mova ' + nome(c) + (n > 1 ? ', com as cartas de cima,' : '') + ' ' + (col.length ? 'para ' + nome(topo(col)) : 'para a coluna vazia') + '.';
  }

  function destacar(m) {
    limparDica();
    const marca = (c) => cartas[c].classList.add('dica');
    const T = LY.tipos;
    if (m.t === 'compra') {
      if (slots.e) slots.e.classList.add('alvo');
      if (S.p.e && S.p.e.length) marca(topo(S.p.e));
    } else if (m.t === 'm') {
      marca(S.p[m.de][m.idx]);
      const col = S.p[m.para];
      if (T[m.para] === 'pic' || (col.length && T[m.para] !== 'fun')) { if (col.length) marca(topo(col)); }
      else if (slots[m.para]) slots[m.para].classList.add('alvo');
    }
    dicaTimer = setTimeout(limparDica, 5000);
  }

  function pedirAoWorker(msg, espera) {
    return new Promise((resolve) => {
      if (!worker) { resolve(null); return; }
      const id = ++reqId;
      pendentes[id] = resolve;
      msg.id = id;
      worker.postMessage(msg);
      setTimeout(() => { if (pendentes[id]) { delete pendentes[id]; resolve(null); } }, espera);
    });
  }

  async function dica() {
    if (bloqueado()) return;
    limparDica(); desselecionar();
    const alvo = S, jog0 = S.jog;
    let m = null, achou = false, consultou = false;
    if (S.m === 'klondike') {
      el.msg.textContent = 'Pensando…';
      el.dica.disabled = true;
      const r = await pedirAoWorker({ tipo: 'dica', estado: J.paraPaci(S), limite: 40000 }, 3000);
      if (S !== alvo || S.jog !== jog0) { atualizarPainel(); return; }
      el.dica.disabled = bloqueado();
      consultou = r !== null;
      if (r && r.ok && r.lance) { m = J.lanceDePaci(S, r.lance); achou = !!m; }
    }
    if (!m) m = J.melhorLance(S);
    if (!m || (m.t === 'compra' && !uteis(S).filter((x) => x.t !== 'compra').length && !J.modo(S).compraOk(S))) {
      el.msg.textContent = 'Não há jogadas possíveis. Desfaça jogadas ou comece um jogo novo.';
      return;
    }
    const prefixo = S.m === 'klondike' && consultou && !achou ? 'Não achei um caminho até a vitória daqui. Uma jogada possível: ' : '';
    el.msg.textContent = prefixo + descrever(m);
    destacar(m);
  }

  /* ==========================================================================
     9. Novo jogo, trocar de jogo, vitória
     ========================================================================== */
  function comecou() {
    ini = true;
    const s = lerStats(), r = reg(s, S.m); r.partidas++; gravarStats(s);
    tPrev = performance.now();
  }

  function ligarRelogio() {
    if (relogio) return;
    tPrev = performance.now();
    relogio = setInterval(() => {
      const n = performance.now();
      if (ini && !venceu && !document.hidden) tempoMs += n - tPrev;
      tPrev = n;
      if (S) el.tempo.textContent = fmt(tempoMs);
    }, 500);
  }

  function esconderTela() { el.tela.hidden = true; }

  function novoJogo() {
    ON.novoJogo(emAndamento(), recomecar, { texto: 'A partida em andamento será abandonada e a sequência de vitórias deste jogo volta a zero.' });
  }

  function limparPartida() {
    limparDica(); desselecionar();
    esconderTela();
    ini = false; venceu = false; ocupado = false; gerando = false; hist = []; tempoMs = 0; ultimosPontos = 0;
    el.msg.textContent = '';
  }

  function recomecar() {
    const id = S ? S.m : prefs.modo;
    if (emAndamento()) { const s = lerStats(); reg(s, id).seq = 0; gravarStats(s); }
    ON.store.del(LS.jogo + id);
    limparPartida();
    if (id === 'klondike' && prefs.jogo === 'solucao' && worker) {
      gerando = true;
      el.msg.textContent = 'Procurando um jogo com solução…';
      iniciarEstado(J.novo('klondike', modoOpcoes()), false);
      pedirAoWorker({ tipo: 'gerar', compra: prefs.compra, limite: 80000, max: 40 }, 20000).then((r) => {
        if (!gerando || !S || S.m !== 'klondike') return;
        gerando = false;
        el.msg.textContent = r && r.achou ? '' : 'Não achei um jogo com solução a tempo. Este é um jogo aleatório.';
        if (r && r.baralho) iniciarEstado(J.novo('klondike', modoOpcoes(), r.baralho), true);
        else atualizarPainel();
        setTimeout(() => { if (!ini) el.msg.textContent = ''; }, 4000);
      });
    } else {
      iniciarEstado(J.novo(id, modoOpcoes()), true);
    }
  }

  function iniciarEstado(novo, distribuir) {
    S = novo;
    pos = [];
    if (montado !== S.m || cartas.length !== S.b.length) montarMesa();
    else {
      LY = J.layoutDe(S.m, S.x.compra);
      el.config.hidden = S.m !== 'klondike';
    }
    if (distribuir && !reduzido()) {
      // todas as cartas começam juntas no estoque (ou no topo da mesa), viradas para baixo
      medir();
      const R0 = colocar(1), o = R0.base.e || { x: L.x0 + (COLS * (L.w + L.gap) - L.gap) / 2 - L.w / 2, y: L.margem };
      cartas.forEach((d) => {
        d.style.transition = 'none'; d.firstChild.style.transition = 'none';
        d.classList.add('oculta');
        d.style.transform = 'translate(' + o.x + 'px,' + o.y + 'px)';
      });
      void el.mesa.offsetWidth;
      cartas.forEach((d) => { d.style.transition = ''; d.firstChild.style.transition = ''; });
      render({ distribuir: true });
    } else {
      render({ semAnim: true });
    }
  }

  function trocarModo(id) {
    if (!J.MODOS[id] || (S && S.m === id)) return;
    if (S) {
      if (venceu) ON.store.del(LS.jogo + S.m); else salvar();
    }
    limparPartida();
    prefs.modo = id;
    ON.store.set(LS.prefs, prefs);
    carregarModo(id);
    el.mesa.scrollLeft = 0;
  }

  function carregarModo(id) {
    const d = restaurar(id);
    if (d) {
      S = d.s; hist = d.h; tempoMs = d.t; ini = true; venceu = false;
      if (id === 'klondike') prefs.compra = S.x.compra;
      ultimosPontos = S.pts;
      if (montado !== S.m || cartas.length !== S.b.length) montarMesa();
      render({ semAnim: true });
    } else {
      iniciarEstado(J.novo(id, modoOpcoes()), true);
    }
  }

  // cartas voando pela mesa, uma de cada vez, a partir das fundações
  function cascata() {
    if (reduzido()) return;
    const T = LY.tipos;
    let ids = [];
    Object.keys(S.p).forEach((pid) => { if (T[pid] === 'fun') S.p[pid].forEach((c) => ids.push(c)); });
    if (!ids.length) Object.keys(S.p).forEach((pid) => { if (T[pid] === 'des') S.p[pid].forEach((c) => ids.push(c)); });
    ids.sort((a, b) => J.val(S.b[b]) - J.val(S.b[a]));
    ids = ids.slice(0, 52);
    const W = el.mesa.clientWidth, H = el.mesa.clientHeight;
    const vivos = [];
    let lancadas = 0;
    ids.forEach((c, i) => {
      setTimeout(() => {
        if (!venceu) return;
        const d = cartas[c], q = pos[c];
        d.classList.add('voa');
        d.style.zIndex = 3000 + i;
        vivos.push({ d, x: q.x, y: q.y, vx: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 4.5), vy: -3 - Math.random() * 5 });
        lancadas++;
        if (vivos.length === 1) requestAnimationFrame(passo);
      }, i * 110);
    });
    let ultimo = 0;
    function passo(t) {
      if (!venceu) return;
      const dt = Math.min(2, (t - (ultimo || t)) / 16.67 || 1); ultimo = t;
      for (let i = vivos.length - 1; i >= 0; i--) {
        const v = vivos[i];
        v.vy += 0.45 * dt;
        v.x += v.vx * dt; v.y += v.vy * dt;
        if (v.y > H - L.h) { v.y = H - L.h; v.vy = -v.vy * 0.78; if (Math.abs(v.vy) < 2) v.vy = -2.4; }
        v.d.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px)';
        if (v.x < -L.w - 4 || v.x > W + L.larg || v.x > L.larg + 4) { v.d.style.opacity = '0'; vivos.splice(i, 1); }
      }
      if (vivos.length || lancadas < ids.length) requestAnimationFrame(passo);
    }
  }

  function ganhar() {
    venceu = true;
    limparDica(); desselecionar();
    const mo = M();
    const s = lerStats(), r = reg(s, S.m);
    r.vitorias++; r.seq++; r.maiorSeq = Math.max(r.maiorSeq, r.seq);
    const recTempo = !r.melhorTempo || tempoMs < r.melhorTempo;
    const comPontos = S.m === 'klondike';
    const recPontos = comPontos && S.pts > r.melhorPontos;
    if (comPontos) r.melhorPontos = Math.max(r.melhorPontos, S.pts);
    if (recTempo) r.melhorTempo = Math.round(tempoMs);
    gravarStats(s);
    ON.store.del(LS.jogo + S.m);
    ON.som('vitoria');
    ON.impacto(el.box, 'vitoria');
    atualizarPainel();
    cascata();
    el.telaTitulo.textContent = 'Você venceu!';
    el.telaTexto.textContent = mo.nome + '. ' + (comPontos ? 'Pontuação ' + S.pts + (recPontos ? ' (novo recorde)' : '') + '. ' : '') +
      'Tempo ' + fmt(tempoMs) + (recTempo ? ' (novo recorde)' : '') + '. ' + S.jog + ' jogadas.';
    el.telaBtn.textContent = 'Novo jogo';
    setTimeout(() => { if (venceu) el.tela.hidden = false; }, reduzido() ? 100 : 2600);
  }

  el.telaBtn.addEventListener('click', () => { recomecar(); });
  el.undo.addEventListener('click', desfazer);
  el.dica.addEventListener('click', dica);
  el.extra.addEventListener('click', embaralharExtra);
  el.auto.addEventListener('click', completar);
  el.restart.addEventListener('click', novoJogo);

  /* ==========================================================================
     10. Salvar, estatísticas e opções
     ========================================================================== */
  const strip = (h) => ({ p: h.p, up: h.up, x: h.x, jog: h.jog, pts: h.pts });
  const inflar = (h, s) => ({ m: s.m, b: s.b, p: h.p, up: h.up, x: h.x, jog: h.jog, pts: h.pts });

  function salvar() {
    if (!S || venceu) return;
    if (!ini) { ON.store.del(LS.jogo + S.m); return; }
    ON.store.set(LS.jogo + S.m, { s: S, h: hist.slice(-80).map(strip), t: Math.round(tempoMs) });
  }

  function estadoValido(s, id) {
    try {
      const mo = J.MODOS[id];
      if (!s || s.m !== id || !Array.isArray(s.b) || !Array.isArray(s.up) || !s.p || typeof s.p !== 'object' || !s.x || typeof s.x !== 'object') return false;
      const esperadas = mo.bases ? mo.bases() : Array.from({ length: 52 }, (_, i) => i);
      if (s.b.length !== esperadas.length || s.up.length !== esperadas.length || s.b.some((v, i) => v !== esperadas[i])) return false;
      if (id === 'klondike' && s.x.compra !== 1 && s.x.compra !== 3) return false;
      const ids = J.layoutDe(id, s.x.compra).piles.map((q) => q.id).sort();
      const chaves = Object.keys(s.p).sort();
      if (ids.length !== chaves.length || ids.some((v, i) => v !== chaves[i])) return false;
      const todas = [].concat(...chaves.map((k) => s.p[k]));
      if (todas.length !== esperadas.length || new Set(todas).size !== esperadas.length) return false;
      return todas.every((c) => Number.isInteger(c) && c >= 0 && c < esperadas.length) && s.up.every((u) => u === 0 || u === 1);
    } catch (err) { return false; }
  }

  // partida do formato antigo (só Klondike) vira uma partida do formato novo
  function migrarAntigo() {
    const d = ON.store.get(LS.antigo, null);
    ON.store.del(LS.antigo);
    try {
      const o = d && d.s;
      if (!o) return null;
      const s = { m: 'klondike', b: Array.from({ length: 52 }, (_, i) => i), p: { e: o.estoque.slice(), d: o.descarte.slice() }, up: new Array(52).fill(0), x: { compra: o.compra === 3 ? 3 : 1, rec: o.reciclagens | 0 }, jog: o.jogadas | 0, pts: o.pontos | 0 };
      o.estoque.forEach((c) => { s.up[c] = 0; });
      o.descarte.forEach((c) => { s.up[c] = 1; });
      o.fund.forEach((a, n) => { s.p['f' + n] = a.slice(); a.forEach((c) => { s.up[c] = 1; }); });
      o.col.forEach((a, i) => { s.p['c' + i] = a.slice(); a.forEach((c, k) => { s.up[c] = k >= o.ocultas[i] ? 1 : 0; }); });
      if (!estadoValido(s, 'klondike')) return null;
      return { s: s, h: [], t: +d.t || 0 };
    } catch (err) { return null; }
  }

  function restaurar(id) {
    let d = ON.store.get(LS.jogo + id, null);
    if (!d && id === 'klondike') d = migrarAntigo();
    if (!d || !estadoValido(d.s, id)) return null;
    const hs = (d.h || []).map((h) => inflar(h, d.s)).filter((h) => estadoValido(h, id));
    return { s: d.s, h: hs, t: +d.t || 0 };
  }

  const vazio = () => ({ partidas: 0, vitorias: 0, melhorTempo: 0, melhorPontos: 0, seq: 0, maiorSeq: 0 });
  function lerStats() {
    const raw = ON.store.get(LS.stats, {});
    if (raw && raw.modos) return raw;
    // formato antigo: números soltos, todos do Klondike
    const s = { modos: {} };
    if (raw && raw.partidas) s.modos.klondike = Object.assign(vazio(), raw);
    return s;
  }
  const reg = (s, id) => { if (!s.modos[id]) s.modos[id] = vazio(); return s.modos[id]; };
  const gravarStats = (s) => ON.store.set(LS.stats, s);

  function estatisticas() {
    const s = lerStats();
    let p = 0, v = 0, ms = 0;
    Object.keys(s.modos).forEach((k) => { p += s.modos[k].partidas; v += s.modos[k].vitorias; ms = Math.max(ms, s.modos[k].maiorSeq); });
    const linhas = [{ rotulo: 'Partidas', valor: p }, { rotulo: 'Vitórias', valor: v }];
    if (ms) linhas.push({ rotulo: 'Maior sequência de vitórias', valor: ms, larga: true });
    J.ORDEM.forEach((id) => {
      const r = s.modos[id];
      if (!r || !r.partidas) return;
      let t = r.vitorias + ' de ' + r.partidas;
      if (r.melhorTempo) t += ' · melhor ' + fmt(r.melhorTempo);
      linhas.push({ rotulo: J.MODOS[id].nome, valor: t, larga: true });
    });
    return linhas;
  }

  function mudarOpcao(chave, valor) {
    if (prefs[chave] === valor) return;
    ON.novoJogo(emAndamento(), () => {
      prefs[chave] = valor;
      ON.store.set(LS.prefs, prefs);
      recomecar();
    }, { texto: 'Trocar a opção começa um jogo novo. A partida em andamento será abandonada.', sim: 'Sim, trocar' });
  }

  el.opCompra.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) mudarOpcao('compra', +b.dataset.v); });
  el.opJogo.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) mudarOpcao('jogo', b.dataset.v); });

  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (S && !drag && !venceu) render({ semAnim: true }); }, 120); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });
  window.addEventListener('pagehide', salvar);

  /* ==========================================================================
     11. Escolher jogo e Como Jogar
     ========================================================================== */
  function construirJogos() {
    const corpo = el.jogosCorpo;
    corpo.textContent = '';
    GRUPOS.forEach((g) => {
      const ids = J.ORDEM.filter((id) => J.MODOS[id].grupo === g[0]).sort((a, b) => J.MODOS[a].dif - J.MODOS[b].dif);
      if (!ids.length) return;
      const sec = document.createElement('section');
      sec.className = 'sec-jogos';
      sec.innerHTML = '<h3></h3><p class="sec-sub"></p><div class="tiles"></div>';
      sec.querySelector('h3').textContent = g[1];
      sec.querySelector('.sec-sub').textContent = g[2];
      const lista = sec.querySelector('.tiles');
      ids.forEach((id) => {
        const mo = J.MODOS[id], atual = S && S.m === id;
        const andamento = atual ? emAndamento() : !!ON.store.get(LS.jogo + id, null);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tile';
        b.dataset.id = id;
        if (atual) b.setAttribute('aria-current', 'true');
        let pts = '';
        for (let i = 1; i <= 5; i++) pts += '<i' + (i <= mo.dif ? ' class="on"' : '') + '></i>';
        b.innerHTML = '<span class="tile-mini">' + miniatura(id) + '</span><span class="tile-txt"><span class="tile-nome"></span>' +
          '<span class="tile-dif"><span class="pontos-dif" aria-hidden="true">' + pts + '</span><span class="tile-dif-txt"></span></span>' +
          '<span class="tile-desc"></span></span>';
        b.querySelector('.tile-nome').textContent = mo.nome;
        b.querySelector('.tile-dif-txt').textContent = DIF[mo.dif];
        b.querySelector('.tile-desc').textContent = mo.desc;
        if (atual || andamento) {
          const selo = document.createElement('span');
          selo.className = 'tile-selo' + (andamento ? ' andamento' : '');
          selo.textContent = atual ? 'Jogando' : 'Em andamento';
          b.querySelector('.tile-txt').insertBefore(selo, b.querySelector('.tile-desc'));
        }
        lista.appendChild(b);
      });
      corpo.appendChild(sec);
    });
  }

  el.jogosCorpo.addEventListener('click', (e) => {
    const b = e.target.closest('.tile');
    if (!b) return;
    ON.modal.fechar();
    trocarModo(b.dataset.id);
  });
  $('#modo-btn').addEventListener('click', construirJogos);

  function ligarAbas() {
    const abas = [...document.querySelectorAll('.aba')];
    const mostrar = (aba) => {
      abas.forEach((a) => {
        const sel2 = a === aba;
        a.setAttribute('aria-selected', String(sel2));
        a.tabIndex = sel2 ? 0 : -1;
        document.getElementById(a.getAttribute('aria-controls')).hidden = !sel2;
      });
      document.getElementById(aba.getAttribute('aria-controls')).scrollTop = 0;
    };
    abas.forEach((a) => {
      a.addEventListener('click', () => mostrar(a));
      a.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const novo = abas[(abas.indexOf(a) + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length];
        mostrar(novo); novo.focus();
        e.preventDefault();
      });
    });
    $('#howto-btn').addEventListener('click', () => {
      mostrar(abas[0]);
      const atual = 'ajuda-' + AJUDA_DE[S ? S.m : prefs.modo];
      document.querySelectorAll('#painel-jogos details').forEach((d) => { d.open = d.id === atual; });
    });
  }

  function minisDaAjuda() {
    document.querySelectorAll('.ajuda-mini[data-modo]').forEach((d) => { d.innerHTML = miniatura(d.dataset.modo); });
  }

  /* ==========================================================================
     12. Início
     ========================================================================== */
  function iniciarWorker() {
    try {
      worker = new Worker('solver.js');
      worker.onmessage = (e) => {
        const r = e.data, f = pendentes[r.id];
        if (f) { delete pendentes[r.id]; f(r); }
      };
      worker.onerror = () => { worker = null; Object.keys(pendentes).forEach((k) => { pendentes[k](null); delete pendentes[k]; }); };
    } catch (err) { worker = null; }
  }

  ON.init({
    id: 'pacion',
    nome: 'PaciON!',
    configuracoes: ['som', 'vibracao', 'tremor', 'escuro', 'reduzir'],
    estatisticas,
    zerarEstatisticas: () => { ON.store.del(LS.stats); },
    pronto: () => {
      C.iniciar();
      document.getElementById('opcoes-chevron').innerHTML = ON.icone('chevron', 18);
      document.getElementById('modo-chevron').innerHTML = ON.icone('chevron', 16);
      minisDaAjuda();
      ligarAbas();
      iniciarWorker();
      ligarRelogio();
      carregarModo(prefs.modo);
    }
  });
})();
