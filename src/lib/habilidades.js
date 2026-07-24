// ============================================================
// HABILIDADES DO JOGADOR
// Configurável pelo presidente:
//  - tipo:   "simples" (1 nota) | "detalhada" (6 atributos)
//  - escala: "estrelas" (1–5)   | "numero" (0–99)
// Quem pode avaliar segue configNiveis (podeEditarNiveis).
//
// MODELO: jogador.avaliacoes = { [avaliadorUid]: { ...notas } }.
// Cada avaliador guarda a própria nota; o card e o sorteio usam a MÉDIA.
// ============================================================

export const ATRIBUTOS = [
  { key: "velocidade", label: "VEL", nome: "Velocidade" },
  { key: "finalizacao", label: "FIN", nome: "Finalização" },
  { key: "passe", label: "PAS", nome: "Passe" },
  { key: "drible", label: "DRI", nome: "Drible" },
  { key: "desarme", label: "DES", nome: "Desarme" },
  { key: "garra", label: "GAR", nome: "Garra" },
];

export function escalaMax(escala) {
  return escala === "numero" ? 99 : 5;
}

// Valor inicial sugerido ao começar a avaliar (meio da escala).
export function valorPadrao(escala) {
  return escala === "numero" ? 50 : 3;
}

// Chaves ativas conforme o tipo de avaliação.
export function chavesHabilidade(tipo) {
  return tipo === "simples" ? ["geral"] : ATRIBUTOS.map((a) => a.key);
}

// Garante que o valor fica dentro da escala.
export function limitar(valor, escala) {
  const max = escalaMax(escala);
  return Math.max(0, Math.min(max, Math.round(Number(valor) || 0)));
}

export function qtdAvaliadores(avaliacoes = {}) {
  return Object.keys(avaliacoes || {}).length;
}

export function temAvaliacao(avaliacoes = {}) {
  return qtdAvaliadores(avaliacoes) > 0;
}

// Média (arredondada) por chave, considerando todos os avaliadores.
export function mediaAvaliacoes(avaliacoes = {}, tipo) {
  const chaves = chavesHabilidade(tipo);
  const lista = Object.values(avaliacoes || {});
  const out = {};
  for (const k of chaves) {
    const vals = lista.map((a) => Number(a?.[k])).filter((n) => !Number.isNaN(n));
    out[k] = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  }
  return out;
}

// OVR (média geral) a partir de um mapa de notas já agregadas.
export function overall(mapa = {}, tipo) {
  const chaves = chavesHabilidade(tipo);
  const vals = chaves.map((k) => Number(mapa[k]) || 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
}

// OVR para EXIBIR, na escala da pelada (0–5 ou 0–99). Usa a média das
// avaliações; se ninguém avaliou, cai no nível (1–5) convertido pra escala.
export function ovrExibicao(jogador, pelada) {
  const tipo = pelada?.configHabilidadeTipo || "detalhada";
  const escala = pelada?.configHabilidadeEscala || "estrelas";
  const avaliacoes = jogador.avaliacoes || {};
  if (temAvaliacao(avaliacoes)) {
    return overall(mediaAvaliacoes(avaliacoes, tipo), tipo);
  }
  return Math.round(((jogador.nivel || 3) / 5) * escalaMax(escala));
}

// Força 0–100 usada no balanceamento dos times.
// Usa a média das avaliações; se ninguém avaliou, cai no nível (1–5) do Elenco.
export function forcaJogador(jogador, pelada) {
  const tipo = pelada?.configHabilidadeTipo || "detalhada";
  const escala = pelada?.configHabilidadeEscala || "estrelas";
  const avaliacoes = jogador.avaliacoes || {};
  if (!temAvaliacao(avaliacoes)) {
    return Math.round(((jogador.nivel || 3) / 5) * 100);
  }
  const ovr = overall(mediaAvaliacoes(avaliacoes, tipo), tipo);
  return Math.round((ovr / escalaMax(escala)) * 100);
}
