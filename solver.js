/* PaciON! — solver.js: roda a busca de soluções fora da tela principal (Web Worker). */
importScripts('regras.js');
self.onmessage = function (e) {
  var m = e.data, r;
  try {
    if (m.tipo === 'gerar') {
      var g = self.Paci.jogoComSolucao(m.compra, m.limite || 80000, m.max || 30);
      self.postMessage({ id: m.id, tipo: 'gerado', baralho: g.baralho, achou: g.achou, tentativas: g.tentativas });
    } else if (m.tipo === 'dica') {
      r = self.Paci.resolver(m.estado, m.limite || 40000);
      // o caminho já começa por um lance legal no estado atual
      var lance = r.ok && r.lances.length ? r.lances[0] : null;
      self.postMessage({ id: m.id, tipo: 'dica', ok: !!lance, lance: lance, nos: r.nos });
    }
  } catch (err) {
    self.postMessage({ id: m.id, tipo: 'erro', ok: false });
  }
};
