import { useEffect, useMemo, useState } from "react";
import { useAuth, papelDoUsuario, podeLancarPartidas } from "../context/AuthContext";
import {
  ouvirSessao, confirmarPresenca, jogadorSaiu, definirTimes,
  aplicarResultado, registrarGol, registrarAssistencia, registrarDesarme,
  contabilizarJogos, contabilizarEmpate, setGoleiro, adicionarConvidado,
  removerConvidado, setModoTimes, setMuralhaMin, setAmistoso, adicionarNaFila,
  getMapaParcerias,
} from "../lib/data";
import { formarTimes, rodarTimes, rodarEmpate, rodarVencedorSai } from "../lib/sorteio";
import { forcaJogador } from "../lib/habilidades";
import { chegouNoHorario } from "../lib/premios";
import { filaLiberada } from "../lib/agenda";
import Cronometro from "./Cronometro";
import PresencaAntecipada from "./PresencaAntecipada";

const DIAS_CONV = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Divide uma lista de uids em times de `tam` (para mostrar os próximos times).
function dividirEmTimes(uids, tam) {
  const out = [];
  for (let i = 0; i < uids.length; i += tam) out.push(uids.slice(i, i + tam));
  return out;
}

// Distância em metros entre duas coordenadas (haversine).
function distanciaM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const RAIO_CHEGADA_M = 500; // precisa estar a até 500m do local pra confirmar chegada

// Mensagem de convocação com o link p/ os outros confirmarem presença no app.
function linkConvocacao(pelada) {
  const link = `${window.location.origin}${window.location.pathname}?pelada=${pelada.id}`;
  const quando =
    pelada.diaSemana != null && pelada.horario
      ? `\n🗓️ ${DIAS_CONV[pelada.diaSemana]} às ${pelada.horario}`
      : "";
  const onde = pelada.local?.endereco ? `\n📍 ${pelada.local.endereco}` : "";
  return (
    `⚽ Pelada confirmada — ${pelada.nome || "bora jogar"}!` +
    quando +
    onde +
    `\n\nConfirma sua presença no app: ${link}`
  );
}

export default function Jogo({ pelada, jogadores, sessaoId }) {
  const { user } = useAuth();
  const [sessao, setSessao] = useState(null);
  const [nomeConv, setNomeConv] = useState("");
  const [nivelConv, setNivelConv] = useState(3);
  const [empatePanel, setEmpatePanel] = useState(false);
  const [verificandoLocal, setVerificandoLocal] = useState(false);
  const papel = papelDoUsuario(pelada, user?.uid);
  // Quem pode operar o jogo (gols, empate, sorteio...) — config do presidente.
  const podeLancar = podeLancarPartidas(pelada, papel);
  const TAM_TIME = pelada.jogadoresPorTime || 5;

  useEffect(() => {
    if (!sessaoId) return;
    return ouvirSessao(pelada.id, sessaoId, setSessao);
  }, [pelada.id, sessaoId]);

  const convidados = sessao?.convidados || {};
  const nome = useMemo(() => {
    const m = {};
    jogadores.forEach((j) => (m[j.id] = j.nome));
    Object.entries(convidados).forEach(([id, c]) => (m[id] = c.nome));
    return (uid) => m[uid] || "—";
  }, [jogadores, convidados]);

  if (!sessao || sessao.status === "encerrada")
    return <div className="empty">Nenhuma pelada aberta hoje.</div>;

  const modoFixo = sessao.modoTimes === "fixo";
  const amistoso = !!sessao.amistoso;
  const filaAberta = filaLiberada(pelada); // chegada/sorteio só 1h antes do jogo
  const ehConvidado = (id) => !!convidados[id];
  const goleirosFixos = sessao.goleirosFixos || [];
  const ehGoleiroFixo = (id) => goleirosFixos.includes(id);
  const ehGoleiro = (id) => sessao.goleiros?.timeA === id || sessao.goleiros?.timeB === id;
  const localLabel = (id) => {
    if (sessao.times.timeA.includes(id)) return "Time A";
    if (sessao.times.timeB.includes(id)) return "Time B";
    if (ehGoleiroFixo(id)) return "só no gol";
    if (sessao.times.aguardando.includes(id)) return "fila";
    return "presente";
  };
  const aprovados = jogadores.filter((j) => j.status === "aprovado");
  const ausentes = aprovados.filter((j) => !sessao.presencaConfirmada.includes(j.id));

  // Formação dos times (modo definido pelo presidente).
  const rotuloSortear = (pelada.modoFormacao || "sorteio") === "chegada" ? "Formar por chegada" : "Sortear";
  // Quem está presente mas ficou de fora dos times (chegou depois da formação).
  const colocados = new Set([
    ...sessao.times.timeA, ...sessao.times.timeB, ...sessao.times.aguardando, ...goleirosFixos,
  ]);
  const foraDoJogo = sessao.times.timeA.length > 0
    ? sessao.presencaConfirmada.filter((id) => !colocados.has(id))
    : [];

  // Força para o sorteio: convidado usa o nível dado; jogador usa habilidades.
  function forcaDe(id) {
    const c = convidados[id];
    if (c) return Math.round(((c.nivel || 3) / 5) * 100);
    const j = jogadores.find((x) => x.id === id);
    return j ? forcaJogador(j, pelada) : 50;
  }

  // Jogador confirma a CHEGADA — só vale se estiver no local da pelada (GPS).
  function confirmarChegada() {
    const loc = pelada.local;
    const ok = () => confirmarPresenca(pelada.id, sessaoId, user.uid, chegouNoHorario(pelada));
    if (!loc || loc.lat == null) return ok(); // sem local cadastrado, confirma direto
    if (!navigator.geolocation) {
      window.alert("Seu aparelho não tem GPS para confirmar a localização.");
      return;
    }
    setVerificandoLocal(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVerificandoLocal(false);
        const d = distanciaM(pos.coords.latitude, pos.coords.longitude, loc.lat, loc.lng);
        if (d <= RAIO_CHEGADA_M) ok();
        else window.alert(`Você está a ~${Math.round(d)} m do local. Chegue até a quadra/campo para confirmar a chegada.`);
      },
      () => {
        setVerificandoLocal(false);
        window.alert("Não foi possível obter sua localização. Permita o acesso ao GPS para confirmar a chegada.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function sortear() {
    const ordem = sessao.filaOrdenada;
    // Goleiros fixos ("só agarrar") não entram na linha do sorteio.
    const fila = sessao.presencaConfirmada
      .filter((id) => !ehGoleiroFixo(id))
      .sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    const modo = pelada.modoFormacao || "sorteio";
    // Diversidade: evita repetir sempre os mesmos companheiros (só nos modos de sorteio).
    const parcerias = modo === "chegada" ? {} : await getMapaParcerias(pelada.id);
    const times = formarTimes(modo, {
      fila,
      noHorario: sessao.presencaNoHorario || [],
      tamanho: TAM_TIME,
      forcaDe,
      parcerias,
    });
    await definirTimes(pelada.id, sessaoId, times);
  }

  // Modo fixo: coloca o jogador em A, B ou banco (aguardando), ou tira.
  function atribuir(id, destino) {
    const t = sessao.times;
    const sem = (arr) => (arr || []).filter((x) => x !== id);
    const novo = { timeA: sem(t.timeA), timeB: sem(t.timeB), aguardando: sem(t.aguardando) };
    if (destino) novo[destino] = [...novo[destino], id];
    definirTimes(pelada.id, sessaoId, novo);
  }

  async function addConvidado() {
    if (!nomeConv.trim()) return;
    await adicionarConvidado(pelada.id, sessaoId, { nome: nomeConv, nivel: Number(nivelConv) });
    setNomeConv("");
    setNivelConv(3);
  }

  async function fimDePartida(perdedor) {
    const vencedores = perdedor === "timeA" ? sessao.times.timeB : sessao.times.timeA;
    const perdedores = sessao.times[perdedor];
    // Convidados não acumulam estatística.
    const real = (arr) => arr.filter((id) => !ehConvidado(id));
    // Gols sofridos do goleiro (só goleiros que são da liga).
    // Goleiro pode estar no time OU vir da fila/fixo (à parte) — conta gols
    // sofridos em qualquer caso (gols sofridos = gols do time adversário).
    const g = sessao.goleiros || {};
    const gp = sessao.golsPartida || {};
    const goleiros = {};
    if (g.timeA && !ehConvidado(g.timeA)) goleiros[g.timeA] = gp.timeB || 0;
    if (g.timeB && !ehConvidado(g.timeB)) goleiros[g.timeB] = gp.timeA || 0;

    if (!amistoso) {
      await contabilizarJogos(pelada.id, sessaoId, {
        vencedores: real(vencedores), perdedores: real(perdedores), goleiros,
      });
    }

    if (modoFixo) {
      // Times fixos não giram: só zera os gols da partida.
      await aplicarResultado(pelada.id, sessaoId, sessao.times);
    } else {
      // Sequência de vitórias: timeA é quem está reinando. Se o reinante vence
      // de novo, a sequência sobe; se o desafiante vence, zera.
      const vencedorLado = perdedor === "timeA" ? "timeB" : "timeA";
      const novaSeq = vencedorLado === "timeA" ? (sessao.vitoriasSeguidas || 0) + 1 : 1;
      const maxSeq = pelada.sequenciaMaxVitorias || 0;

      if (maxSeq > 0 && novaSeq >= maxSeq) {
        // Campeão bateu o limite e precisa sair.
        const novos = (pelada.modoSequenciaMax || "ambos") === "soVencedor"
          ? rodarVencedorSai(sessao.times, vencedorLado, TAM_TIME) // só o vencedor sai
          : rodarEmpate(sessao.times, TAM_TIME, "timeA");          // saem os dois
        await aplicarResultado(pelada.id, sessaoId, novos, { vitoriasSeguidas: 0 });
      } else {
        await aplicarResultado(
          pelada.id, sessaoId, rodarTimes(sessao.times, perdedor, TAM_TIME),
          { vitoriasSeguidas: novaSeq },
        );
      }
    }
  }

  // Empate. modo: "fixo" | "ambos" (saem os 2) | "um" (sai só um time).
  // lado: em "ambos" = quem vai PRIMEIRO pra fila; em "um" = quem SAI.
  async function empate(modo, lado) {
    const real = (arr) => arr.filter((id) => !ehConvidado(id));
    if (!amistoso) await contabilizarEmpate(pelada.id, sessaoId, {
      timeA: real(sessao.times.timeA), timeB: real(sessao.times.timeB),
    });
    let novos;
    if (modo === "fixo") novos = sessao.times;
    else if (modo === "um") novos = rodarTimes(sessao.times, lado, TAM_TIME); // lado sai
    else novos = rodarEmpate(sessao.times, TAM_TIME, lado); // lado vai primeiro
    // Empate não é vitória: zera a sequência do reinante.
    await aplicarResultado(pelada.id, sessaoId, novos, { vitoriasSeguidas: 0 });
    setEmpatePanel(false);
  }

  function evento(uid, tipo, lado) {
    if (tipo === "gol") return registrarGol(pelada.id, sessaoId, uid, lado);
    if (tipo === "assistencia") return registrarAssistencia(pelada.id, sessaoId, uid);
    if (tipo === "desarme") return registrarDesarme(pelada.id, sessaoId, uid);
  }

  function saiu(id) {
    return ehConvidado(id)
      ? removerConvidado(pelada.id, sessaoId, id, sessao)
      : jogadorSaiu(pelada.id, sessaoId, id, sessao);
  }

  function placeDe(id) {
    if (sessao.times.timeA.includes(id)) return "timeA";
    if (sessao.times.timeB.includes(id)) return "timeB";
    if (sessao.times.aguardando.includes(id)) return "aguardando";
    return null;
  }

  return (
    <>
      {/* PRESENÇA ANTECIPADA — quem vai/não vai, vagas e lista de espera */}
      <PresencaAntecipada pelada={pelada} sessao={sessao} jogadores={jogadores} />

      {/* CONVOCAÇÃO — lembrete de presença via WhatsApp (sem custo) */}
      {podeLancar && (
        <div className="card">
          <h2>Convocar a galera</h2>
          <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
            Manda o lembrete no grupo pra confirmarem presença.
          </p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(linkConvocacao(pelada))}`}
            target="_blank"
            rel="noreferrer"
          >
            <button className="btn">Enviar lembrete no WhatsApp</button>
          </a>
        </div>
      )}

      {/* FILA POR ORDEM DE CHEGADA */}
      <div className="card">
        <h2>Fila — ordem de chegada</h2>
        <div className="list">
          {sessao.filaOrdenada.length === 0 && (
            <div className="empty">Ninguém na fila ainda.</div>
          )}
          {sessao.filaOrdenada.map((uid, i) => (
            <div className="player" key={uid}>
              <span className="num">{i + 1}</span>
              <span className="name">
                {ehGoleiro(uid) && "🧤 "}{nome(uid)}
                {ehConvidado(uid) && <span className="muted"> (conv.)</span>}
                {ehGoleiro(uid) && <span className="muted"> · no gol (não perde a vez)</span>}
              </span>
              {podeLancar && (
                <button className="btn danger sm" onClick={() => saiu(uid)}>Saiu</button>
              )}
            </div>
          ))}
        </div>

        {!sessao.presencaConfirmada.includes(user?.uid) &&
          aprovados.some((j) => j.id === user?.uid) && (
          filaAberta ? (
            <button
              className="btn"
              style={{ marginTop: 10 }}
              onClick={confirmarChegada}
              disabled={verificandoLocal}
            >
              {verificandoLocal ? "Confirmando local…" : "Cheguei — entrar na fila"}
            </button>
          ) : (
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
              ⏳ A fila de chegada (sorteio) abre <b>1h antes</b> do jogo
              {pelada.horario ? ` (${pelada.horario})` : ""}. Por enquanto, confirme presença acima.
            </p>
          )
        )}

        {/* Quem veio só pra agarrar: presente, mas fora da fila da linha. */}
        {goleirosFixos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginBottom: 8 }}>Só no gol (fora da fila):</p>
            <div className="list">
              {goleirosFixos.map((id) => (
                <div className="player" key={id}>
                  <span className="name">🧤 {nome(id)}</span>
                  {podeLancar && (
                    <button className="btn danger sm" onClick={() => saiu(id)}>Saiu</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gestor marca a chegada de quem ainda não confirmou. */}
        {podeLancar && ausentes.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginBottom: 8 }}>Marcar chegada de:</p>
            <div className="list">
              {ausentes.map((j) => (
                <div className="player" key={j.id}>
                  <span className="name">{j.nome}</span>
                  <span className="tp-acoes">
                    <button
                      className="btn ghost sm"
                      onClick={() => confirmarPresenca(pelada.id, sessaoId, j.id, chegouNoHorario(pelada))}
                    >
                      Chegou
                    </button>
                    <button
                      className="btn ghost sm"
                      title="Só pra agarrar (fora da fila)"
                      onClick={() => confirmarPresenca(pelada.id, sessaoId, j.id, chegouNoHorario(pelada), true)}
                    >
                      🧤
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gestor adiciona convidado avulso (não é da liga). */}
        {podeLancar && (
          <div style={{ marginTop: 14 }}>
            <p className="muted" style={{ marginBottom: 8 }}>Adicionar convidado:</p>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input" style={{ margin: 0, flex: 1 }}
                placeholder="Nome do convidado"
                value={nomeConv}
                onChange={(e) => setNomeConv(e.target.value)}
              />
              <select
                className="input" style={{ margin: 0, width: 64 }}
                value={nivelConv}
                onChange={(e) => setNivelConv(e.target.value)}
                title="Nível (força)"
              >
                {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
              </select>
              <button className="btn sm" onClick={addConvidado}>+</button>
            </div>
          </div>
        )}
      </div>

      {/* CRONÔMETRO da partida (apita no início e no fim) */}
      <Cronometro duracaoMin={pelada.duracaoPartidaMin || 0} />

      {/* TIMES */}
      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>Times em campo</h2>
          {podeLancar && (
            <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                className={`btn sm ${amistoso ? "warn" : "ghost"}`}
                onClick={() => setAmistoso(pelada.id, sessaoId, !amistoso)}
                title="Amistoso não conta nas estatísticas"
              >
                {amistoso ? "Amistoso ✓" : "Amistoso"}
              </button>
              <button
                className="btn ghost sm"
                onClick={() => setModoTimes(pelada.id, sessaoId, modoFixo ? "rodizio" : "fixo")}
              >
                {modoFixo ? "Modo: Fixo" : "Modo: Rodízio"}
              </button>
              {!modoFixo && <button className="btn warn sm" onClick={sortear}>{rotuloSortear}</button>}
            </div>
          )}
        </div>

        {/* PLACAR AO VIVO da partida atual (gols por time; zera a cada rodízio) */}
        {(sessao.times.timeA.length > 0 || sessao.times.timeB.length > 0) && (
          <div className="placar-vivo">
            <span className="pv-lado a">1</span>
            <span className="pv-gols">{sessao.golsPartida?.timeA || 0}</span>
            <span className="pv-x">×</span>
            <span className="pv-gols">{sessao.golsPartida?.timeB || 0}</span>
            <span className="pv-lado b">2</span>
          </div>
        )}

        {/* Sequência de vitórias: o Time A é quem está reinando no rodízio. */}
        {!modoFixo && (sessao.vitoriasSeguidas || 0) > 0 && (
          <p style={{ textAlign: "center", marginTop: 8, fontWeight: 700, color: "var(--ball)" }}>
            🔥 Time 1 vem de {sessao.vitoriasSeguidas} vitória{sessao.vitoriasSeguidas > 1 ? "s" : ""} seguida{sessao.vitoriasSeguidas > 1 ? "s" : ""}
            {(pelada.sequenciaMaxVitorias || 0) > 0 && ` · sai ao chegar em ${pelada.sequenciaMaxVitorias}`}
          </p>
        )}

        {/* Modo fixo: montar os times na mão. */}
        {modoFixo && podeLancar && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginBottom: 8 }}>Montar times:</p>
            <div className="list">
              {sessao.presencaConfirmada.filter((id) => !ehGoleiroFixo(id)).map((id) => {
                const p = placeDe(id);
                return (
                  <div className="player" key={id}>
                    <span className="name">
                      {nome(id)}{ehConvidado(id) && <span className="muted"> (conv.)</span>}
                    </span>
                    <span className="tp-acoes">
                      <button className={`btn sm ${p === "timeA" ? "" : "ghost"}`} onClick={() => atribuir(id, "timeA")}>1</button>
                      <button className={`btn sm ${p === "timeB" ? "warn" : "ghost"}`} onClick={() => atribuir(id, "timeB")}>2</button>
                      <button className={`btn sm ${p === "aguardando" ? "warn" : "ghost"}`} onClick={() => atribuir(id, "aguardando")}>Banco</button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="teams" style={{ marginTop: 12 }}>
          <Time titulo="Time 1" lado="a" uids={sessao.times.timeA}
            nome={nome} permiteAcoes={podeLancar && !amistoso} onEvento={evento} ehConvidado={ehConvidado}
            goleiroUid={sessao.goleiros?.timeA}
            onGoleiro={(uid) => setGoleiro(pelada.id, sessaoId, "a", sessao.goleiros?.timeA === uid ? null : uid)} />
          <Time titulo="Time 2" lado="b" uids={sessao.times.timeB}
            nome={nome} permiteAcoes={podeLancar && !amistoso} onEvento={evento} ehConvidado={ehConvidado}
            goleiroUid={sessao.goleiros?.timeB}
            onGoleiro={(uid) => setGoleiro(pelada.id, sessaoId, "b", sessao.goleiros?.timeB === uid ? null : uid)} />
        </div>

        {/* Próximos times na fila (Time 3, 4...). O perdedor vai pro fim. */}
        {!modoFixo && sessao.times.aguardando.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginBottom: 8 }}>Próximos na fila:</p>
            <div className="teams">
              {dividirEmTimes(sessao.times.aguardando, TAM_TIME).map((uids, i) => (
                <div className="team" key={i}>
                  <h3>Time {i + 3}</h3>
                  <ul>
                    {uids.map((uid) => (
                      <li key={uid}>
                        {nome(uid)}{ehConvidado(uid) && <span className="muted"> (conv.)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {modoFixo && sessao.times.aguardando.length > 0 && (
          <p className="muted" style={{ marginTop: 12 }}>
            Banco: {sessao.times.aguardando.map(nome).join(", ")}
          </p>
        )}

        {/* Chegaram depois da formação: o gestor coloca no fim da fila. */}
        {!modoFixo && foraDoJogo.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginBottom: 8 }}>Chegaram depois:</p>
            <div className="list">
              {foraDoJogo.map((id) => (
                <div className="player" key={id}>
                  <span className="name">{nome(id)}{ehConvidado(id) && <span className="muted"> (conv.)</span>}</span>
                  {podeLancar && (
                    <button className="btn sm" onClick={() => adicionarNaFila(pelada.id, sessaoId, id)}>
                      → fila
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GOLEIROS — pode ser do time, da fila (sem perder a vez) ou fixo. */}
        {podeLancar && (sessao.times.timeA.length > 0 || sessao.times.timeB.length > 0) && (
          <div style={{ marginTop: 12 }}>
            <p className="muted" style={{ marginBottom: 8 }}>
              Goleiros{pelada.goleiroDedicado ? " (à parte da linha)" : ""}:
            </p>
            <div className="row" style={{ gap: 8 }}>
              {[["a", "timeA", "Time 1"], ["b", "timeB", "Time 2"]].map(([lado, campo, rotulo]) => (
                <div key={lado} style={{ flex: 1 }}>
                  <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{rotulo}</p>
                  <select
                    className="input" style={{ margin: 0 }}
                    value={sessao.goleiros?.[campo] || ""}
                    onChange={(e) => setGoleiro(pelada.id, sessaoId, lado, e.target.value || null)}
                  >
                    <option value="">— sem goleiro —</option>
                    {sessao.presencaConfirmada
                      .filter((id) => !ehConvidado(id))
                      .map((id) => (
                        <option key={id} value={id}>{nome(id)} · {localLabel(id)}</option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {podeLancar && sessao.times.timeA.length > 0 && (
          <>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <button className="btn ghost" onClick={() => fimDePartida("timeB")}>
                Time 1 venceu
              </button>
              <button
                className="btn ghost"
                onClick={modoFixo ? () => empate("fixo") : () => setEmpatePanel((v) => !v)}
              >
                Empate
              </button>
              <button className="btn ghost" onClick={() => fimDePartida("timeA")}>
                Time 2 venceu
              </button>
            </div>

            {empatePanel && !modoFixo && (
              <div style={{ marginTop: 10 }}>
                <p className="muted" style={{ marginBottom: 8 }}>
                  Saem os dois — quem vai primeiro pra fila? (par ou ímpar na hora)
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn sm" onClick={() => empate("ambos", "timeA")}>Time 1 primeiro</button>
                  <button className="btn warn sm" onClick={() => empate("ambos", "timeB")}>Time 2 primeiro</button>
                </div>
                {!pelada.empateSaemDois && (
                  <>
                    <p className="muted" style={{ margin: "10px 0 8px" }}>Ou sai só um time:</p>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn ghost sm" onClick={() => empate("um", "timeA")}>Sai o Time 1</button>
                      <button className="btn ghost sm" onClick={() => empate("um", "timeB")}>Sai o Time 2</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Config do dia: mínimo de jogos no gol p/ concorrer à Muralha. */}
      {podeLancar && (
        <div className="card">
          <h2>Muralha (deste dia)</h2>
          <p className="muted" style={{ marginTop: -6, marginBottom: 8 }}>
            Mínimo de partidas no gol para concorrer à Muralha hoje.
          </p>
          <input
            className="input" style={{ margin: 0 }}
            type="number" min="1" max="50"
            value={sessao.muralhaMinJogos ?? 3}
            onChange={(e) =>
              setMuralhaMin(pelada.id, sessaoId, e.target.value === "" ? 3 : Number(e.target.value))
            }
          />
        </div>
      )}
    </>
  );
}

function Time({ titulo, lado, uids, nome, permiteAcoes, onEvento, goleiroUid, onGoleiro, ehConvidado }) {
  return (
    <div className={`team ${lado}`}>
      <h3>{titulo}</h3>
      <ul>
        {uids.map((uid) => {
          const conv = ehConvidado(uid);
          return (
            <li key={uid} className="team-player">
              <span className="tp-nome">
                {goleiroUid === uid && "🧤 "}{nome(uid)}{conv && <span className="muted"> (conv.)</span>}
              </span>
              {permiteAcoes && !conv && (
                <span className="tp-acoes">
                  <button
                    className={`btn sm ${goleiroUid === uid ? "warn" : "ghost"}`}
                    title="Goleiro" onClick={() => onGoleiro(uid)}
                  >🧤</button>
                  <button className="btn warn sm" title="Gol" onClick={() => onEvento(uid, "gol", lado)}>⚽</button>
                  <button className="btn ghost sm" title="Assistência" onClick={() => onEvento(uid, "assistencia", lado)}>🅰</button>
                  <button className="btn ghost sm" title="Desarme" onClick={() => onEvento(uid, "desarme", lado)}>🛡</button>
                </span>
              )}
            </li>
          );
        })}
        {uids.length === 0 && <li className="muted">vazio</li>}
      </ul>
    </div>
  );
}
