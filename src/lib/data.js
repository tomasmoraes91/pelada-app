// ============================================================
// CAMADA DE DADOS  (todas as leituras/escritas ficam aqui)
//
// ESTRATÉGIA ANTI-CUSTO:
//  - A "sessão" do dia guarda fila + times + presença em UM doc.
//    1 leitura traz o estado inteiro do jogo.
//  - Estatísticas (gols, jogos) ficam agregadas no doc do jogador,
//    atualizadas por increment() na hora do evento — nunca varremos
//    a coleção de eventos para montar ranking.
//  - Votação usa contadores num único doc (_resumo) via increment().
//  - Use listen() (onSnapshot) só na sessão ativa; o resto é getDoc.
// ============================================================
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit, increment, arrayUnion,
  arrayRemove, serverTimestamp, writeBatch, deleteField,
} from "firebase/firestore";
import { db } from "./firebase";

/* ---------- PELADA ---------- */
export async function getPelada(peladaId) {
  const snap = await getDoc(doc(db, "peladas", peladaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Código curto e legível usado como ID do doc (fácil de compartilhar).
// Sem caracteres ambíguos (0/O, 1/I).
function gerarCodigo(n = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Cria a pelada com um código gerado e devolve o ID.
// `nomeLower` permite busca por prefixo, sem precisar de índice composto.
export async function criarPelada({ nome }, presidenteUid) {
  const id = gerarCodigo();
  await setDoc(doc(db, "peladas", id), {
    nome: nome.trim(),
    nomeLower: nome.trim().toLowerCase(),
    presidenteUid,
    adminUids: [],
    configNiveis: "presidente", // quem avalia: "todos" | "admins" | "presidente"
    configCaixa: "presidente",  // quem vê o caixa: "todos" | "admins" | "presidente"
    configPartidas: "admins",   // quem lança partidas: "admins" | "todos"
    modoFormacao: "sorteio",    // como formar: "chegada" | "sorteio" | "sorteioChegada"
    configGoleiro: "rotativo",  // "fixo" | "rotativo"
    jogadoresPorTime: 5,        // 5 futsal/quadra, 7 society, 11 campo
    duracaoPartidaMin: 10,      // duração de cada partida (cronômetro apita no fim)
    goleiroDedicado: false,     // true = linha + 1 goleiro à parte (futsal)
    valorDiaria: 0,             // valor da diária (cobrada por dia de jogo)
    cobrancas: {},              // { "AAAA-MM": valor } — valor cobrado em cada mês (histórico)
    confirmacaoAntecedenciaHoras: 1, // quando abre a confirmação de presença (h antes)
    sequenciaMaxVitorias: 0,    // 0 = desativado; senão, após N vitórias o time sai
    modoSequenciaMax: "ambos",  // ao bater o limite: "ambos" saem | "soVencedor"
    empateSaemDois: false,      // no empate, saem os dois times automaticamente
    configHabilidadeTipo: "detalhada",   // "simples" | "detalhada"
    configHabilidadeEscala: "estrelas",  // "estrelas" (1-5) | "numero" (0-99)
    toleranciaMin: 10,                   // min de tolerância p/ pontualidade
    criadoEm: serverTimestamp(),
  });
  return id;
}

// Altera campos de config da pelada (permissões, goleiro, etc.).
export async function setConfigPelada(peladaId, patch) {
  await updateDoc(doc(db, "peladas", peladaId), patch);
}

// Remove a pelada (só o presidente). Apaga o doc principal; subcoleções
// (jogadores/sessões) ficam órfãs no Firestore, mas a pelada some do app.
export async function removerPelada(peladaId) {
  await deleteDoc(doc(db, "peladas", peladaId));
}

// Presidente promove/remove um admin.
export async function definirAdmin(peladaId, uid, ehAdmin) {
  await updateDoc(doc(db, "peladas", peladaId), {
    adminUids: ehAdmin ? arrayUnion(uid) : arrayRemove(uid),
  });
}

// Presidência: o presidente oferece a outro jogador, que precisa aceitar.
export async function oferecerPresidencia(peladaId, paraUid) {
  await updateDoc(doc(db, "peladas", peladaId), {
    transferenciaPresidencia: { paraUid, em: Date.now() },
  });
}

export async function aceitarPresidencia(peladaId, uid) {
  await updateDoc(doc(db, "peladas", peladaId), {
    presidenteUid: uid,
    transferenciaPresidencia: null,
  });
}

export async function cancelarTransferencia(peladaId) {
  await updateDoc(doc(db, "peladas", peladaId), {
    transferenciaPresidencia: null,
  });
}

// Busca peladas por nome (prefixo, sem diferenciar maiúsculas) ou por ID exato.
export async function buscarPeladas(termo) {
  const t = (termo || "").trim();
  if (!t) return [];
  const colRef = collection(db, "peladas");
  const resultados = new Map();

  const tl = t.toLowerCase();
  const porNome = await getDocs(
    query(colRef, where("nomeLower", ">=", tl), where("nomeLower", "<=", tl + ""))
  );
  porNome.docs.forEach((d) => resultados.set(d.id, { id: d.id, ...d.data() }));

  // ID exato (os códigos são em maiúsculas).
  for (const candidato of new Set([t, t.toUpperCase()])) {
    const porId = await getDoc(doc(db, "peladas", candidato));
    if (porId.exists()) resultados.set(porId.id, { id: porId.id, ...porId.data() });
  }

  return [...resultados.values()];
}

/* ---------- JOGADORES (cadastro + validação) ---------- */
export async function cadastrarJogador(peladaId, uid, dados) {
  // status "pendente" até o presidente aprovar
  await setDoc(doc(db, "peladas", peladaId, "jogadores", uid), {
    ...dados,
    status: "pendente",
    nivel: 3,
    mensalidadePaga: false,
    totalJogos: 0,
    totalGols: 0,
    totalAssistencias: 0,
    totalDesarmes: 0,
    empates: 0,
    chegadas: 0,
    pontualidades: 0,
    historico: [],        // resultados em ordem: { r: "V"|"E"|"D", t: ms } p/ sequências
    // --- temporada (agregados baratos) ---
    pontosTemporada: 0,   // gol=2, vitória=3, presença=1
    vitorias: 0,
    presencas: 0,
    golsSofridos: 0,      // só conta quando jogou de goleiro (Muralha)
    jogosGoleiro: 0,
    criadoEm: serverTimestamp(),
  });
}

export async function aprovarJogador(peladaId, uid) {
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", uid), {
    status: "aprovado",
  });
}

// Perfil do próprio jogador: nome, emoji, posição (DEF/MC/AC) e número.
// Só inclui os campos enviados (não apaga o que não veio).
export async function setPerfil(peladaId, uid, dados) {
  const patch = {};
  for (const k of ["nome", "emoji", "posicao", "numero"]) {
    if (k in dados) patch[k] = dados[k];
  }
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", uid), patch);
}

// Presidente recusa/remove um jogador (pendente ou do elenco).
export async function removerJogador(peladaId, uid) {
  await deleteDoc(doc(db, "peladas", peladaId, "jogadores", uid));
}

export async function setNivel(peladaId, uid, nivel) {
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", uid), { nivel });
}

// Salva a avaliação DO avaliador sobre um jogador (cada avaliador tem a
// própria entrada; o app calcula a média). Escreve só a sub-chave do avaliador.
export async function setMinhaAvaliacao(peladaId, jogadorUid, avaliadorUid, notas) {
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", jogadorUid), {
    [`avaliacoes.${avaliadorUid}`]: notas,
  });
}

// Marca se o jogador é mensalista (paga mensalidade) ou não (diarista).
export async function setMensalista(peladaId, uid, ehMensalista) {
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", uid), { mensalista: ehMensalista });
}

// Cobrança da mensalidade por jogador/mês. `mensalidades[mes] = { st, v }`:
// st = "cobrado" (devendo) | "pago"; v = valor cobrado (capturado no momento,
// então meses/valores antigos ficam preservados).
export async function cobrarJogadorMes(peladaId, uid, mes, valor) {
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", uid), {
    [`mensalidades.${mes}`]: { st: "cobrado", v: valor },
  });
}
export async function marcarPagoMes(peladaId, uid, mes) {
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", uid), {
    [`mensalidades.${mes}.st`]: "pago",
  });
}
export async function desmarcarPagoMes(peladaId, uid, mes) {
  await updateDoc(doc(db, "peladas", peladaId, "jogadores", uid), {
    [`mensalidades.${mes}.st`]: "cobrado",
  });
}

// "Virar o mês": define o mês de cobrança ativo da pelada (AAAA-MM).
export async function virarMes(peladaId, mes) {
  await updateDoc(doc(db, "peladas", peladaId), { mesCobranca: mes });
}

// Marca/desmarca um diarista como tendo PAGO a diária do dia (na sessão).
// `id` = uid do jogador, id do convidado (g_...) ou id do avulso (d_...).
export async function setDiariaPaga(peladaId, sessaoId, id, pago) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    diaristasPagos: pago ? arrayUnion(id) : arrayRemove(id),
  });
}

// Diarista AVULSO (fora do elenco): entra como devendo, até ser marcado pago.
export async function addDiaristaAvulso(peladaId, sessaoId, nome) {
  const id = "d_" + Math.random().toString(36).slice(2, 9);
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    diariasAvulsas: arrayUnion({ id, nome: nome.trim() }),
  });
  return id;
}

// Lê todos os jogadores uma vez (tela de admin / ranking).
export async function listarJogadores(peladaId) {
  const snap = await getDocs(collection(db, "peladas", peladaId, "jogadores"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ---------- SESSÃO DO DIA (fila, times, presença) ---------- */
export async function abrirSessao(peladaId) {
  const ref = await addDoc(collection(db, "peladas", peladaId, "sessoes"), {
    status: "aberta",
    data: serverTimestamp(),
    filaOrdenada: [],          // ordem de chegada (entram na linha)
    presencaConfirmada: [],    // todos os presentes (linha + goleiros fixos)
    goleirosFixos: [],         // vieram só pra agarrar: presentes, FORA da fila
    presencaAntecipada: [],    // confirmaram que VÃO (antes do jogo); não é chegada
    naoVou: [],                // avisaram que não vão
    presencaNoHorario: [],     // chegaram até o horário (entram no sorteio inicial)
    vagas: null,               // nº de vagas; acima disso vira lista de espera
    times: { timeA: [], timeB: [], aguardando: [] },
    goleiros: { timeA: null, timeB: null }, // goleiro de cada time na partida atual
    golsPartida: { timeA: 0, timeB: 0 },    // gols da partida atual (zera a cada rodízio)
    convidados: {},          // jogadores avulsos só desta sessão: { id: { nome, nivel } }
    modoTimes: "rodizio",    // "rodizio" (giro por vitória) | "fixo" (times montados)
    vitoriasSeguidas: 0,     // vitórias seguidas do time que está reinando (timeA)
    muralhaMinJogos: 3,      // mín. de partidas no gol p/ a Muralha (deste dia)
    amistoso: false,         // se true, as partidas não contam nas estatísticas
  });
  return ref.id;
}

// Lista as sessões (mais recentes primeiro) para a página de Partidas.
export async function listarSessoes(peladaId, max = 20) {
  const snap = await getDocs(query(
    collection(db, "peladas", peladaId, "sessoes"),
    orderBy("data", "desc"),
    limit(max)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Sessões a partir de uma data (ms) — usado no fechamento por período.
// Range numa única coluna (data), sem índice composto.
export async function listarSessoesPeriodo(peladaId, desdeMs) {
  const snap = await getDocs(query(
    collection(db, "peladas", peladaId, "sessoes"),
    where("data", ">=", new Date(desdeMs)),
    orderBy("data", "desc"),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Sessão aberta atual (a mais recente que não foi encerrada). Detecta a
// pelada do dia em qualquer aparelho, sem depender do localStorage.
export async function getSessaoAberta(peladaId) {
  const snap = await getDocs(query(
    collection(db, "peladas", peladaId, "sessoes"),
    orderBy("data", "desc"),
    limit(1)
  ));
  const d = snap.docs[0];
  if (!d) return null;
  const s = { id: d.id, ...d.data() };
  return s.status === "encerrada" ? null : s;
}

// Última sessão (a mais recente), aberta OU encerrada. Usada na votação,
// que continua disponível depois que a pelada é encerrada.
export async function getUltimaSessao(peladaId) {
  const snap = await getDocs(query(
    collection(db, "peladas", peladaId, "sessoes"),
    orderBy("data", "desc"),
    limit(1)
  ));
  const d = snap.docs[0];
  return d ? { id: d.id, ...d.data() } : null;
}

// Encerra a pelada do dia (vira histórico).
export async function encerrarSessao(peladaId, sessaoId) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    status: "encerrada",
  });
}

// Encerra TODAS as sessões abertas (limpa sobras que "reabrem sozinhas").
export async function encerrarSessoesAbertas(peladaId) {
  const snap = await getDocs(query(
    collection(db, "peladas", peladaId, "sessoes"),
    where("status", "==", "aberta"),
  ));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { status: "encerrada" }));
  await batch.commit();
  return snap.size;
}

// Apaga uma sessão do histórico (ex: pelada de teste). Só remove o registro
// do dia — não desfaz as estatísticas já somadas nos jogadores.
export async function removerSessao(peladaId, sessaoId) {
  await deleteDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId));
}

// 1 listener = estado completo do jogo em tempo real.
export function ouvirSessao(peladaId, sessaoId, cb) {
  return onSnapshot(doc(db, "peladas", peladaId, "sessoes", sessaoId), (s) =>
    cb(s.exists() ? { id: s.id, ...s.data() } : null)
  );
}

// `soGoleiro`: veio só pra agarrar — fica presente (selecionável como goleiro)
// mas NÃO entra na fila da linha, então não perde nem ocupa a vez de ninguém.
export async function confirmarPresenca(peladaId, sessaoId, uid, noHorario = false, soGoleiro = false) {
  const batch = writeBatch(db);
  const sessUpd = { presencaConfirmada: arrayUnion(uid) };
  if (soGoleiro) {
    sessUpd.goleirosFixos = arrayUnion(uid);
  } else {
    sessUpd.filaOrdenada = arrayUnion(uid); // entra no fim da fila por ordem de chegada
    if (noHorario) sessUpd.presencaNoHorario = arrayUnion(uid); // p/ o sorteio inicial
  }
  batch.update(doc(db, "peladas", peladaId, "sessoes", sessaoId), sessUpd);
  // Pontualidade vira agregado do jogador (alimenta stats/badges/premiação).
  batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
    chegadas: increment(1),
    pontualidades: increment(noHorario ? 1 : 0),
  });
  await batch.commit();
}

// Presença ANTECIPADA: o jogador avisa se vai (ou não) antes do jogo. NÃO é a
// chegada real (não mexe na fila/sorteio); serve pra planejar + lista de espera.
// vai = true ("Vou"), false ("Não vou") ou null (limpar).
export async function confirmarAntecipada(peladaId, sessaoId, uid, vai) {
  const ref = doc(db, "peladas", peladaId, "sessoes", sessaoId);
  if (vai === true) {
    await updateDoc(ref, { presencaAntecipada: arrayUnion(uid), naoVou: arrayRemove(uid) });
  } else if (vai === false) {
    await updateDoc(ref, { naoVou: arrayUnion(uid), presencaAntecipada: arrayRemove(uid) });
  } else {
    await updateDoc(ref, { presencaAntecipada: arrayRemove(uid), naoVou: arrayRemove(uid) });
  }
}

// Nº de vagas do dia (gestor). Acima disso, os confirmados viram lista de espera.
export async function setVagas(peladaId, sessaoId, n) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), { vagas: n });
}

// Convidado avulso (não é da liga): só entra no sorteio/jogo desta sessão.
// `nivel` (1–5) define a força; o presidente/admin escolhe.
export async function adicionarConvidado(peladaId, sessaoId, { nome, nivel }) {
  const id = "g_" + Math.random().toString(36).slice(2, 9);
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    [`convidados.${id}`]: { nome: nome.trim(), nivel },
    presencaConfirmada: arrayUnion(id),
    filaOrdenada: arrayUnion(id),
  });
  return id;
}

export async function removerConvidado(peladaId, sessaoId, id, sessao) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    [`convidados.${id}`]: deleteField(),
    filaOrdenada: arrayRemove(id),
    presencaConfirmada: arrayRemove(id),
    "times.timeA": (sessao.times.timeA || []).filter((x) => x !== id),
    "times.timeB": (sessao.times.timeB || []).filter((x) => x !== id),
    "times.aguardando": (sessao.times.aguardando || []).filter((x) => x !== id),
  });
}

// Alterna entre rodízio (giro por vitória) e times fixos.
export async function setModoTimes(peladaId, sessaoId, modo) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), { modoTimes: modo });
}

// Mínimo de partidas no gol p/ concorrer à Muralha, definido no dia de jogo.
export async function setMuralhaMin(peladaId, sessaoId, n) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), { muralhaMinJogos: n });
}

// Modo amistoso: as partidas do dia não contam nas estatísticas.
export async function setAmistoso(peladaId, sessaoId, amistoso) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), { amistoso });
}

// Jogador foi embora: sai da fila, dos times e do gol.
export async function jogadorSaiu(peladaId, sessaoId, uid, sessao) {
  const upd = {
    filaOrdenada: arrayRemove(uid),
    presencaConfirmada: arrayRemove(uid),
    goleirosFixos: arrayRemove(uid),
    "times.timeA": sessao.times.timeA.filter((x) => x !== uid),
    "times.timeB": sessao.times.timeB.filter((x) => x !== uid),
    "times.aguardando": sessao.times.aguardando.filter((x) => x !== uid),
  };
  if (sessao.goleiros?.timeA === uid) upd["goleiros.timeA"] = null;
  if (sessao.goleiros?.timeB === uid) upd["goleiros.timeB"] = null;
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), upd);
}

// Coloca um jogador (que chegou depois) no fim da fila (aguardando).
export async function adicionarNaFila(peladaId, sessaoId, uid) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    "times.aguardando": arrayUnion(uid),
  });
}

// Sorteio: monta times equilibrados pelos níveis (ver lib/sorteio.js).
export async function definirTimes(peladaId, sessaoId, times) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    times, golsPartida: { timeA: 0, timeB: 0 }, vitoriasSeguidas: 0,
  });
}

// Define o goleiro de um time na partida atual ("a" | "b"); uid ou null.
export async function setGoleiro(peladaId, sessaoId, lado, uid) {
  const campo = lado === "a" ? "goleiros.timeA" : "goleiros.timeB";
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), { [campo]: uid });
}

// Time perdedor vai pro fim da fila; entra quem está aguardando.
// Zera os gols da partida (a nova partida começa 0 a 0). `extra` permite
// atualizar campos junto (ex: vitoriasSeguidas).
export async function aplicarResultado(peladaId, sessaoId, times, extra = {}) {
  await updateDoc(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    times, golsPartida: { timeA: 0, timeB: 0 }, ...extra,
  });
}

/* ---------- GOLS / ARTILHARIA (agregado, sem varrer eventos) ---------- */
// `lado` ("a"|"b") conta o gol para a partida atual (usado p/ gols sofridos
// do goleiro adversário ao encerrar a partida).
export async function registrarGol(peladaId, sessaoId, uid, lado) {
  const batch = writeBatch(db);
  // log opcional do evento (histórico)
  batch.set(
    doc(collection(db, "peladas", peladaId, "sessoes", sessaoId, "eventos")),
    { tipo: "gol", jogadorUid: uid, em: serverTimestamp() }
  );
  // incremento no agregado do jogador — é o que o ranking lê
  batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
    totalGols: increment(1),
    pontosTemporada: increment(2), // gol vale 2 pts
  });
  // placar do dia + gols da partida atual (na própria sessão)
  const upd = { [`placar.${uid}.gols`]: increment(1) };
  if (lado === "a" || lado === "b") {
    upd[lado === "a" ? "golsPartida.timeA" : "golsPartida.timeB"] = increment(1);
  }
  batch.update(doc(db, "peladas", peladaId, "sessoes", sessaoId), upd);
  await batch.commit();
}

// Assistência e desarme: mesmo padrão do gol (agregado barato + log).
export async function registrarAssistencia(peladaId, sessaoId, uid) {
  const batch = writeBatch(db);
  batch.set(
    doc(collection(db, "peladas", peladaId, "sessoes", sessaoId, "eventos")),
    { tipo: "assistencia", jogadorUid: uid, em: serverTimestamp() }
  );
  batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
    totalAssistencias: increment(1),
    pontosTemporada: increment(1),
  });
  batch.update(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    [`placar.${uid}.assist`]: increment(1),
  });
  await batch.commit();
}

export async function registrarDesarme(peladaId, sessaoId, uid) {
  const batch = writeBatch(db);
  batch.set(
    doc(collection(db, "peladas", peladaId, "sessoes", sessaoId, "eventos")),
    { tipo: "desarme", jogadorUid: uid, em: serverTimestamp() }
  );
  batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
    totalDesarmes: increment(1),
    pontosTemporada: increment(1),
  });
  batch.update(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
    [`placar.${uid}.desarmes`]: increment(1),
  });
  await batch.commit();
}

// Encerra uma partida: soma jogos, presença, vitórias, pontos de
// temporada, gols sofridos do goleiro, e registra o confronto (freguesia).
// vencedores/perdedores = arrays de uid; golsSofridosPorTime = nº de gols
// que cada lado tomou; goleiros = { uid: golsSofridos } opcional.
export async function contabilizarJogos(peladaId, sessaoId, { vencedores, perdedores, goleiros = {} }) {
  const batch = writeBatch(db);
  const todos = [...vencedores, ...perdedores];

  todos.forEach((uid) => {
    const venceu = vencedores.includes(uid);
    batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
      totalJogos: increment(1),
      presencas: increment(1),
      pontosTemporada: increment(venceu ? 4 : 1), // vitória 3 + presença 1
      historico: arrayUnion({ r: venceu ? "V" : "D", t: Date.now() }),
      ...(venceu ? { vitorias: increment(1) } : {}),
    });
  });

  // Muralha: gols sofridos por quem jogou de goleiro.
  Object.entries(goleiros).forEach(([uid, sofridos]) => {
    batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
      golsSofridos: increment(sofridos),
      jogosGoleiro: increment(1),
    });
  });

  // Resumo da sessão: nº de partidas, vitórias do dia (página de Partidas) e
  // stats de goleiro por sessão (alimentam a muralha do mês/semestre/ano).
  if (sessaoId) {
    const resumo = { partidas: increment(1) };
    vencedores.forEach((uid) => { resumo[`vitorias.${uid}`] = increment(1); });
    Object.entries(goleiros).forEach(([uid, sofridos]) => {
      resumo[`statsGoleiros.${uid}.sofridos`] = increment(sofridos);
      resumo[`statsGoleiros.${uid}.jogos`] = increment(1);
    });
    batch.update(doc(db, "peladas", peladaId, "sessoes", sessaoId), resumo);
  }

  await batch.commit();

  // Freguesia: 1 doc por par de adversários, contador de quem venceu.
  await registrarConfronto(peladaId, vencedores, perdedores);
  // Parcerias: 1 doc por par de companheiros, vitórias/derrotas juntos.
  await registrarParcerias(peladaId, vencedores, perdedores);
}

// Empate: conta jogo/presença para todos, sem vitória/derrota (não mexe em
// freguesia). Registra "empates juntos" nas parcerias de cada time.
export async function contabilizarEmpate(peladaId, sessaoId, { timeA = [], timeB = [] }) {
  const batch = writeBatch(db);
  [...timeA, ...timeB].forEach((uid) => {
    batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
      totalJogos: increment(1),
      presencas: increment(1),
      empates: increment(1),
      pontosTemporada: increment(2), // empate vale 1 + presença 1
      historico: arrayUnion({ r: "E", t: Date.now() }),
    });
  });
  if (sessaoId) {
    batch.update(doc(db, "peladas", peladaId, "sessoes", sessaoId), {
      partidas: increment(1),
    });
  }
  await batch.commit();
  await registrarParceriasEmpate(peladaId, timeA, timeB);
}

/* ---------- TEMPORADA / HALL DA FAMA ---------- */
// Encerra a temporada (fim do ano): guarda os campeões no Hall da Fama e
// zera os pontos de todos. Mantém o histórico (totais de carreira ficam).
export async function encerrarTemporada(peladaId, ano, campeoes, jogadoresIds) {
  await setDoc(doc(db, "peladas", peladaId, "hallDaFama", String(ano)), {
    ano, campeoes, em: serverTimestamp(),
  });
  const batch = writeBatch(db);
  jogadoresIds.forEach((uid) => {
    batch.update(doc(db, "peladas", peladaId, "jogadores", uid), { pontosTemporada: 0 });
  });
  await batch.commit();
}

// Zera TODAS as estatísticas dos jogadores (gols, jogos, vitórias, histórico...)
// e limpa freguesia/parcerias. Mantém perfil, nível, mensalidade e avaliações.
// Use para limpar dados de teste antes de valer.
export async function zerarEstatisticas(peladaId, jogadoresIds) {
  const batch = writeBatch(db);
  jogadoresIds.forEach((uid) => {
    batch.update(doc(db, "peladas", peladaId, "jogadores", uid), {
      totalJogos: 0, totalGols: 0, totalAssistencias: 0, totalDesarmes: 0,
      empates: 0, vitorias: 0, presencas: 0, golsSofridos: 0, jogosGoleiro: 0,
      pontosTemporada: 0, chegadas: 0, pontualidades: 0, historico: [],
    });
  });
  await batch.commit();
  for (const col of ["confrontos", "parcerias"]) {
    const snap = await getDocs(collection(db, "peladas", peladaId, col));
    if (snap.empty) continue;
    const b = writeBatch(db);
    snap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

export async function getHallDaFama(peladaId) {
  const snap = await getDocs(query(
    collection(db, "peladas", peladaId, "hallDaFama"),
    orderBy("ano", "desc"),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ---------- FREGUESIA (confrontos entre jogadores) ---------- */
// Para cada vencedor x perdedor, incrementa o placar do par.
// chave do doc = uids ordenados, para o par ser sempre o mesmo doc.
async function registrarConfronto(peladaId, vencedores, perdedores) {
  const batch = writeBatch(db);
  for (const v of vencedores) {
    for (const p of perdedores) {
      const [a, b] = [v, p].sort();
      const ref = doc(db, "peladas", peladaId, "confrontos", `${a}__${b}`);
      // vitoriasA = vitórias do uid 'a'; vitoriasB = do uid 'b'
      const campo = v === a ? "vitoriasA" : "vitoriasB";
      batch.set(ref, { a, b, [campo]: increment(1) }, { merge: true });
    }
  }
  await batch.commit();
}

/* ---------- PARCERIAS (companheiros de time) ---------- */
// Para cada par dentro de `uids`, incrementa o campo (vitorias/empates/derrotas).
// chave do doc = uids ordenados, pra o par ser sempre o mesmo doc.
function acumularPares(batch, peladaId, uids, campo) {
  for (let i = 0; i < uids.length; i++) {
    for (let j = i + 1; j < uids.length; j++) {
      const [a, b] = [uids[i], uids[j]].sort();
      const ref = doc(db, "peladas", peladaId, "parcerias", `${a}__${b}`);
      batch.set(ref, { a, b, [campo]: increment(1) }, { merge: true });
    }
  }
}

async function registrarParcerias(peladaId, vencedores, perdedores) {
  const batch = writeBatch(db);
  acumularPares(batch, peladaId, vencedores, "vitorias");
  acumularPares(batch, peladaId, perdedores, "derrotas");
  await batch.commit();
}

// Empate: cada time guarda "empates juntos" entre seus companheiros.
async function registrarParceriasEmpate(peladaId, timeA, timeB) {
  const batch = writeBatch(db);
  acumularPares(batch, peladaId, timeA, "empates");
  acumularPares(batch, peladaId, timeB, "empates");
  await batch.commit();
}

export async function getParcerias(peladaId, uid) {
  const colRef = collection(db, "peladas", peladaId, "parcerias");
  const [qa, qb] = await Promise.all([
    getDocs(query(colRef, where("a", "==", uid))),
    getDocs(query(colRef, where("b", "==", uid))),
  ]);
  const out = [];
  const push = (parceiro, x) => out.push({
    parceiro,
    vitorias: x.vitorias || 0,
    empates: x.empates || 0,
    derrotas: x.derrotas || 0,
  });
  qa.docs.forEach((d) => push(d.data().b, d.data()));
  qb.docs.forEach((d) => push(d.data().a, d.data()));
  return out;
}

// Mapa par→nº de vezes que jogaram juntos (V+E+D) — usado no sorteio p/ diversificar.
export async function getMapaParcerias(peladaId) {
  const snap = await getDocs(collection(db, "peladas", peladaId, "parcerias"));
  const m = {};
  snap.docs.forEach((d) => {
    const x = d.data();
    m[d.id] = (x.vitorias || 0) + (x.empates || 0) + (x.derrotas || 0);
  });
  return m;
}

export async function getFreguesia(peladaId, uid) {
  // lê confrontos onde o jogador aparece (2 queries pequenas)
  const colRef = collection(db, "peladas", peladaId, "confrontos");
  const [qa, qb] = await Promise.all([
    getDocs(query(colRef, where("a", "==", uid))),
    getDocs(query(colRef, where("b", "==", uid))),
  ]);
  const out = [];
  qa.docs.forEach((d) => {
    const x = d.data();
    out.push({ adversario: x.b, vitorias: x.vitoriasA || 0, derrotas: x.vitoriasB || 0 });
  });
  qb.docs.forEach((d) => {
    const x = d.data();
    out.push({ adversario: x.a, vitorias: x.vitoriasB || 0, derrotas: x.vitoriasA || 0 });
  });
  return out;
}

/* ---------- CAIXA / FINANCEIRO ---------- */
// Lançamentos guardados em 1 doc agregado por mês para leitura barata.
export async function getCaixa(peladaId, mes) {
  const snap = await getDoc(doc(db, "peladas", peladaId, "caixa", mes));
  return snap.exists() ? snap.data() : { entradas: [], saidas: [], totalEntrada: 0, totalSaida: 0 };
}

export async function lancarCaixa(peladaId, mes, { tipo, descricao, valor }) {
  const ref = doc(db, "peladas", peladaId, "caixa", mes);
  const item = { descricao, valor, em: Date.now() };
  if (tipo === "entrada") {
    await setDoc(ref, {
      entradas: arrayUnion(item), totalEntrada: increment(valor),
    }, { merge: true });
  } else {
    await setDoc(ref, {
      saidas: arrayUnion(item), totalSaida: increment(valor),
    }, { merge: true });
  }
}

/* ---------- VOTAÇÃO (estrelas 1–5 para cada presente) ---------- */
// Cada votante dá nota a cada jogador presente. Guarda o voto inteiro do
// votante numa chave própria (revotar substitui). Médias e o melhor/pior
// são calculados no cliente quando a votação é revelada.
export async function salvarVotacao(peladaId, sessaoId, votanteUid, notas) {
  const ref = doc(db, "peladas", peladaId, "sessoes", sessaoId, "votacao", "_resumo");
  await setDoc(ref, { [`votos.${votanteUid}`]: notas }, { merge: true });
}

export async function getResumoVotacao(peladaId, sessaoId) {
  const snap = await getDoc(
    doc(db, "peladas", peladaId, "sessoes", sessaoId, "votacao", "_resumo")
  );
  return snap.exists() ? snap.data() : null;
}
