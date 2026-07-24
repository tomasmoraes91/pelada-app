// ============================================================
// FECHAMENTO POR PERÍODO — prêmios consolidados do mês/semestre/ano.
// Gols/assist/desarmes vêm do `placar` de cada sessão do período;
// goleiro (sofridos/jogos) vem de `statsGoleiros` da sessão; vitórias/
// jogos vêm do `historico` do jogador filtrado pelo início do período.
// (statsGoleiros só existe em sessões novas — muralha do período conta
// a partir de agora.)
// ============================================================

// Início (ms) do período corrente.
export function inicioPeriodo(tipo) {
  const d = new Date();
  if (tipo === "mes") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (tipo === "semestre") return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1).getTime();
  return new Date(d.getFullYear(), 0, 1).getTime(); // ano
}

// Agrega as sessões + historico em estatísticas por jogador no período.
export function agregarPeriodo(sessoes, jogadores, desde) {
  const porId = {};
  const get = (uid) =>
    (porId[uid] ||= { uid, gols: 0, assist: 0, desarmes: 0, sofridos: 0, jogosGoleiro: 0, vitorias: 0, jogos: 0 });

  sessoes.forEach((s) => {
    Object.entries(s.placar || {}).forEach(([uid, v]) => {
      const g = get(uid);
      g.gols += v?.gols || 0;
      g.assist += v?.assist || 0;
      g.desarmes += v?.desarmes || 0;
    });
    Object.entries(s.statsGoleiros || {}).forEach(([uid, v]) => {
      const g = get(uid);
      g.sofridos += v?.sofridos || 0;
      g.jogosGoleiro += v?.jogos || 0;
    });
  });

  jogadores.forEach((j) => {
    const lista = (j.historico || []).filter((h) => h && h.t >= desde);
    if (lista.length || porId[j.id]) {
      const g = get(j.id);
      g.jogos = lista.length;
      g.vitorias = lista.filter((h) => h.r === "V").length;
    }
  });

  return Object.values(porId);
}

// Prêmios do período a partir das estatísticas agregadas.
export function premiosPeriodo(stats, jogadores, minGoleiro = 3) {
  const nome = (uid) => jogadores.find((j) => j.id === uid)?.nome || "—";
  const top = (campo) => {
    const c = stats.filter((s) => (s[campo] || 0) > 0).sort((a, b) => b[campo] - a[campo])[0];
    return c ? { uid: c.uid, nome: nome(c.uid), valor: c[campo] } : null;
  };
  const muralha = stats
    .filter((s) => (s.jogosGoleiro || 0) >= minGoleiro)
    .map((s) => ({ uid: s.uid, nome: nome(s.uid), media: s.sofridos / s.jogosGoleiro }))
    .sort((a, b) => a.media - b.media)[0] || null;

  return {
    artilheiro: top("gols"),
    garcom: top("assist"),
    xerife: top("desarmes"),
    vencedor: top("vitorias"),
    muralha,
  };
}
