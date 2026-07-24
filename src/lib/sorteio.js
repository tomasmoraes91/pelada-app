// ============================================================
// SORTEIO E RODÍZIO DE TIMES
// ============================================================

// Distribui `jogadores` em `nTimes` times (capacidade `cap`), priorizando o
// EQUILÍBRIO de força e, como desempate, juntar quem jogou MENOS vezes junto
// (mapa `parcerias`: chave "a__b" ordenada → nº de vezes juntos).
function distribuir(jogadores, nTimes, cap, forca, parcerias) {
  const par = (a, b) => parcerias[[a, b].sort().join("__")] || 0;
  const bucket = (s) => Math.round(s / 5); // tolerância de força (~5) pro desempate
  const times = Array.from({ length: nTimes }, () => ({ ids: [], soma: 0 }));
  for (const j of jogadores) {
    const cands = times.filter((t) => t.ids.length < cap);
    cands.sort((a, b) => {
      const df = bucket(a.soma) - bucket(b.soma); // 1º: equilíbrio de força
      if (df !== 0) return df;
      const pa = a.ids.reduce((s, m) => s + par(j.id, m), 0);
      const pb = b.ids.reduce((s, m) => s + par(j.id, m), 0);
      if (pa !== pb) return pa - pb;                // 2º: menos vezes juntos
      return a.soma - b.soma;                       // 3º: força exata
    });
    cands[0].ids.push(j.id);
    cands[0].soma += forca(j);
  }
  return times.map((t) => t.ids).filter((t) => t.length);
}

// Monta VÁRIOS times equilibrados de `tamanho`: Time 1 e Time 2 entram em campo,
// os demais ficam na fila (Time 3, 4...). Equilibra por força e desempata
// diversificando companheiros (parcerias). Sobra (< tamanho) = último time parcial.
export function montarTimes(jogadores, tamanho, parcerias = {}) {
  const forca = (j) => (j.forca != null ? j.forca : (j.nivel || 3));
  const ord = [...jogadores].sort((a, b) => forca(b) - forca(a));
  const n = ord.length;

  if (n < tamanho * 2) {
    return distribuir(ord, 2, Math.ceil(n / 2), forca, parcerias);
  }
  const nCheios = Math.floor(n / tamanho);
  const cheios = distribuir(ord.slice(0, nCheios * tamanho), nCheios, tamanho, forca, parcerias);
  const resto = ord.slice(nCheios * tamanho).map((j) => j.id);
  return resto.length ? [...cheios, resto] : cheios;
}

function emGrupos(uids, tam) {
  const out = [];
  for (let i = 0; i < uids.length; i += tam) out.push(uids.slice(i, i + tam));
  return out;
}

// Forma os times conforme o modo escolhido pelo presidente. Retorna
// { timeA, timeB, aguardando }. `fila` = uids em ordem de chegada.
//  - "chegada": times = grupos pela ordem de chegada (sem equilibrar).
//  - "sorteio": equilibra TODOS (times fixos que rodam por vitória).
//  - "sorteioChegada": equilibra Time 1 e 2 com quem chegou no horário;
//    o resto (extras + atrasados) fica na fila por ordem de chegada.
export function formarTimes(modo, { fila, noHorario = [], tamanho, forcaDe, parcerias = {} }) {
  if (modo === "chegada") {
    const g = emGrupos(fila, tamanho);
    return { timeA: g[0] || [], timeB: g[1] || [], aguardando: g.slice(2).flat() };
  }
  if (modo === "sorteioChegada") {
    const setNo = new Set(noHorario);
    const onTime = fila.filter((id) => setNo.has(id));
    const late = fila.filter((id) => !setNo.has(id));
    const pool = [...onTime, ...late].slice(0, tamanho * 2); // completa com atrasados se faltar
    const usados = new Set(pool);
    const dois = montarTimes(pool.map((id) => ({ id, forca: forcaDe(id) })), tamanho, parcerias);
    return {
      timeA: dois[0] || [],
      timeB: dois[1] || [],
      aguardando: fila.filter((id) => !usados.has(id)), // resto em ordem de chegada
    };
  }
  // "sorteio" (padrão): equilibra todos.
  const teams = montarTimes(fila.map((id) => ({ id, forca: forcaDe(id) })), tamanho, parcerias);
  return { timeA: teams[0] || [], timeB: teams[1] || [], aguardando: teams.slice(2).flat() };
}

// Empate: os DOIS times saem; entram os que aguardam. `primeiro` define
// qual time vai antes para o fim da fila (decidido no par/ímpar da vida real).
export function rodarEmpate(times, tamanhoTime, primeiro = "timeA") {
  const saida = primeiro === "timeB"
    ? [...times.timeB, ...times.timeA]
    : [...times.timeA, ...times.timeB];
  const fila = [...times.aguardando, ...saida];
  return {
    timeA: fila.slice(0, tamanhoTime),
    timeB: fila.slice(tamanhoTime, tamanhoTime * 2),
    aguardando: fila.slice(tamanhoTime * 2),
  };
}

// Time perdedor sai; vencedor fica; entram os que aguardam.
// Perdedor vai para o FIM da fila de espera.
export function rodarTimes(times, perdedor, tamanhoTime) {
  const vencedor = perdedor === "timeA" ? times.timeB : times.timeA;
  const saiu = times[perdedor];
  const fila = [...times.aguardando, ...saiu]; // perdedor pro fim
  const entram = fila.slice(0, tamanhoTime);
  const restoFila = fila.slice(tamanhoTime);

  // o vencedor sempre ocupa timeA; desafiante ocupa timeB
  return { timeA: vencedor, timeB: entram, aguardando: restoFila };
}

// Sequência máxima: o VENCEDOR sai (bateu o limite de vitórias seguidas) e o
// PERDEDOR fica. Vencedor vai pro fim da fila; entra quem aguarda.
export function rodarVencedorSai(times, vencedorLado, tamanhoTime) {
  const perdedorLado = vencedorLado === "timeA" ? "timeB" : "timeA";
  const ficam = times[perdedorLado];
  const fila = [...times.aguardando, ...times[vencedorLado]]; // vencedor pro fim
  const entram = fila.slice(0, tamanhoTime);
  const restoFila = fila.slice(tamanhoTime);
  // quem ficou (perdedor) vira timeA; desafiante ocupa timeB
  return { timeA: ficam, timeB: entram, aguardando: restoFila };
}
