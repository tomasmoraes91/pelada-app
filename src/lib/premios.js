// ============================================================
// PREMIAÇÃO E BADGES (conquistas)
// Tudo derivado dos agregados do jogador — sem leituras extras.
// ============================================================

// Categorias premiadas (mesmos critérios dos rankings do Stats).
export const CATEGORIAS = [
  { key: "totalGols", nome: "Artilheiro", emoji: "⚽" },
  { key: "totalAssistencias", nome: "Garçom", emoji: "🅰" },
  { key: "totalDesarmes", nome: "Xerife", emoji: "🛡" },
  { key: "vitorias", nome: "Vencedor", emoji: "🔥" },
  { key: "totalJogos", nome: "Fominha", emoji: "👟" },
  { key: "pontualidades", nome: "Pontual", emoji: "⏰" },
  { key: "empates", nome: "Empatador", emoji: "🤝" },
];

// Líder de cada categoria (maior valor > 0).
export function premiacao(jogadores) {
  const aprovados = jogadores.filter((j) => j.status === "aprovado");
  return CATEGORIAS.map((c) => {
    const top = [...aprovados].sort((a, b) => (b[c.key] || 0) - (a[c.key] || 0))[0];
    const valor = top ? top[c.key] || 0 : 0;
    return { ...c, lider: valor > 0 ? top : null, valor };
  });
}

// Marcos de carreira (badges por acúmulo).
export const BADGES = [
  { key: "gol10", emoji: "⚽", nome: "Matador", campo: "totalGols", meta: 10 },
  { key: "assist10", emoji: "🅰", nome: "Maestro", campo: "totalAssistencias", meta: 10 },
  { key: "des10", emoji: "🛡", nome: "Xerife", campo: "totalDesarmes", meta: 10 },
  { key: "jogos30", emoji: "👟", nome: "Veterano", campo: "totalJogos", meta: 30 },
  { key: "vit10", emoji: "🔥", nome: "Vencedor", campo: "vitorias", meta: 10 },
  { key: "pont5", emoji: "⏰", nome: "Pontual", campo: "pontualidades", meta: 5 },
];

// MURALHA — goleiro com menor média de gols sofridos, com um mínimo de
// partidas no gol (definido pelo presidente em cada pelada; padrão 3).
// Goleiro pode ser fixo ou temporário (marcado na partida).
export const MIN_JOGOS_GOLEIRO = 3;

export function muralha(jogadores, minJogos = MIN_JOGOS_GOLEIRO) {
  const elegiveis = jogadores
    .filter((j) => j.status === "aprovado" && (j.jogosGoleiro || 0) >= minJogos)
    .map((j) => ({ ...j, media: (j.golsSofridos || 0) / j.jogosGoleiro }));
  if (!elegiveis.length) return null;
  return elegiveis.sort((a, b) => a.media - b.media)[0]; // menor média sofrida
}

// Ranking de goleiros (qualquer um que já pegou), por média de gols sofridos.
export function rankingGoleiros(jogadores) {
  return jogadores
    .filter((j) => j.status === "aprovado" && (j.jogosGoleiro || 0) > 0)
    .map((j) => ({ ...j, media: (j.golsSofridos || 0) / j.jogosGoleiro }))
    .sort((a, b) => a.media - b.media);
}

// Conquistas do jogador: coroas (categorias que ele lidera) + marcos.
export function badgesDoJogador(jogador, jogadores, minJogosGoleiro = MIN_JOGOS_GOLEIRO) {
  const coroas = premiacao(jogadores)
    .filter((c) => c.lider && c.lider.id === jogador.id)
    .map((c) => ({ key: "rei-" + c.key, emoji: c.emoji, nome: "Rei " + c.nome }));

  // Coroa especial da Muralha (melhor goleiro).
  const mur = muralha(jogadores, minJogosGoleiro);
  if (mur && mur.id === jogador.id) {
    coroas.push({ key: "muralha", emoji: "🧤", nome: "Muralha" });
  }

  const marcos = BADGES.map((b) => {
    const valor = jogador[b.campo] || 0;
    return { ...b, valor, ganhou: valor >= b.meta };
  });

  return { coroas, marcos };
}

// SEQUÊNCIAS — maior sequência de um resultado (V/E/D) num período.
export function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
export function inicioAno() {
  return new Date(new Date().getFullYear(), 0, 1).getTime();
}

function maiorSequencia(historico, r, desde) {
  const lista = (historico || [])
    .filter((h) => h && h.t >= desde)
    .sort((a, b) => a.t - b.t);
  let max = 0, atual = 0;
  for (const h of lista) {
    if (h.r === r) { atual += 1; if (atual > max) max = atual; }
    else atual = 0;
  }
  return max;
}

// Quem tem a maior sequência do resultado `r` desde `desde`.
export function liderSequencia(jogadores, r, desde) {
  let lider = null;
  jogadores
    .filter((j) => j.status === "aprovado")
    .forEach((j) => {
      const n = maiorSequencia(j.historico, r, desde);
      if (n > 0 && (!lider || n > lider.n)) lider = { jogador: j, n };
    });
  return lider;
}

// Resultados do jogador no dia (a partir do historico filtrado para hoje).
export function resultadosDoDia(jogador, desde) {
  const t0 = desde ?? new Date().setHours(0, 0, 0, 0);
  const lista = (jogador.historico || []).filter((h) => h && h.t >= t0);
  const v = lista.filter((h) => h.r === "V").length;
  const e = lista.filter((h) => h.r === "E").length;
  const d = lista.filter((h) => h.r === "D").length;
  return { v, e, d, total: lista.length };
}

// MVP do dia POR DADOS (objetivo): gol=3, assistência=2, desarme=1, vitória=2.
// Diferente do "Craque da galera" (mais votado na votação).
export function rankingMvpDia(sessao) {
  const placar = sessao?.placar || {};
  const vit = sessao?.vitorias || {};
  const ids = new Set([...Object.keys(placar), ...Object.keys(vit)]);
  const out = [];
  ids.forEach((uid) => {
    const p = placar[uid] || {};
    const gols = p.gols || 0, assist = p.assist || 0, desarmes = p.desarmes || 0;
    const vitorias = vit[uid] || 0;
    const score = gols * 3 + assist * 2 + desarmes + vitorias * 2;
    if (score > 0) out.push({ uid, score, gols, assist, desarmes, vitorias });
  });
  return out.sort((a, b) => b.score - a.score);
}

export function mvpDoDia(sessao, jogadores) {
  const top = rankingMvpDia(sessao)[0];
  if (!top) return null;
  return { ...top, nome: jogadores?.find((x) => x.id === top.uid)?.nome || "—" };
}

// Conquistas RELATIVAS À PELADA do dia (não são números pessoais acumulados):
// destaques do placar do dia + desempenho do jogador no dia.
export function conquistasDoDia(jogador, sessao) {
  const out = [];
  const mvp = rankingMvpDia(sessao)[0];
  if (mvp && mvp.uid === jogador.id) out.push({ key: "mvp_dia", emoji: "🌟", nome: "MVP do dia" });
  const placar = sessao?.placar || {};
  const topDe = (campo) => {
    let best = null;
    Object.entries(placar).forEach(([uid, v]) => {
      const n = v?.[campo] || 0;
      if (n > 0 && (!best || n > best.n)) best = { uid, n };
    });
    return best;
  };
  const art = topDe("gols");
  const gar = topDe("assist");
  const xer = topDe("desarmes");
  if (art && art.uid === jogador.id) out.push({ key: "artilheiro_dia", emoji: "⚽", nome: "Artilheiro do dia" });
  if (gar && gar.uid === jogador.id) out.push({ key: "garcom_dia", emoji: "🅰", nome: "Garçom do dia" });
  if (xer && xer.uid === jogador.id) out.push({ key: "xerife_dia", emoji: "🛡", nome: "Xerifão do dia" });

  const { v, e, d, total } = resultadosDoDia(jogador);
  if (total >= 2) {
    if (v === total) out.push({ key: "venceu_todas", emoji: "🏆", nome: "Venceu todas no dia" });
    else if (d === total) out.push({ key: "perdeu_todas", emoji: "❄️", nome: "Perdeu todas no dia" });
    else if (e === total) out.push({ key: "empatou_todas", emoji: "🤝", nome: "Empatou todas no dia" });
    else if (d === 0) out.push({ key: "invicto_dia", emoji: "🛡️", nome: "Invicto no dia" });
    else if (v === 0) out.push({ key: "nao_venceu", emoji: "😅", nome: "Não venceu nenhuma no dia" });
  }
  return out;
}

// Chegou no horário marcado? Só conta no DIA do jogo e dentro da janela:
// de 1h antes até a tolerância (min) depois do horário. Tolerância no Admin.
export function chegouNoHorario(pelada) {
  if (pelada?.diaSemana == null || !pelada?.horario) return false;
  const agora = new Date();
  if (agora.getDay() !== pelada.diaSemana) return false; // só no dia do jogo
  const [h, m] = pelada.horario.split(":").map(Number);
  const tolerancia = pelada.toleranciaMin ?? 10;
  const alvo = new Date(agora);
  alvo.setHours(h, m, 0, 0);
  return agora.getTime() >= alvo.getTime() - 60 * 60000
      && agora.getTime() <= alvo.getTime() + tolerancia * 60000;
}
