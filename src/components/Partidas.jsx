// ============================================================
// PARTIDAS — pelada aberta (times sorteados) + histórico das
// peladas anteriores com placar do dia (gols/assist/desarme).
// ============================================================
import { useEffect, useState } from "react";
import { useAuth, papelDoUsuario } from "../context/AuthContext";
import { listarSessoes, removerSessao } from "../lib/data";
import ResumoDia from "./ResumoDia";

function dataBR(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d
    ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";
}

export default function Partidas({ pelada, jogadores }) {
  const { user } = useAuth();
  const papel = papelDoUsuario(pelada, user?.uid);
  const ehGestor = papel === "presidente" || papel === "admin";

  const [sessoes, setSessoes] = useState(null);
  const [expandida, setExpandida] = useState(null);

  const nome = (uid) => jogadores.find((j) => j.id === uid)?.nome || "—";

  async function carregar() { setSessoes(await listarSessoes(pelada.id)); }
  useEffect(() => { carregar(); }, [pelada.id]);

  if (!sessoes) return <div className="empty">Carregando partidas…</div>;

  const aberta = sessoes.find((s) => s.status !== "encerrada");
  const anteriores = sessoes.filter((s) => s.status === "encerrada");

  async function excluir(id, data) {
    const ok = window.confirm(
      `Apagar a pelada de ${dataBR(data)} do histórico? As estatísticas já somadas não são desfeitas.`
    );
    if (!ok) return;
    await removerSessao(pelada.id, id);
    if (expandida === id) setExpandida(null);
    carregar();
  }

  function artilheiroDia(s) {
    let top = null;
    Object.entries(s.placar || {}).forEach(([uid, v]) => {
      if ((v?.gols || 0) > 0 && (!top || v.gols > top.gols)) top = { uid, gols: v.gols };
    });
    return top;
  }

  return (
    <>
      {aberta ? (
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Pelada de hoje</h2>
            {ehGestor && (
              <span className="muted" style={{ fontSize: 12 }}>Encerrar no Admin</span>
            )}
          </div>
          {(aberta.times?.timeA?.length || aberta.times?.timeB?.length) ? (
            <div className="teams">
              <TimeLista titulo="Time 1" lado="a" uids={aberta.times.timeA} nome={nome} />
              <TimeLista titulo="Time 2" lado="b" uids={aberta.times.timeB} nome={nome} />
            </div>
          ) : (
            <p className="muted">Times ainda não sorteados — faça o sorteio na aba Jogo.</p>
          )}
          <PlacarDia sessao={aberta} nome={nome} />
          <ResumoDia pelada={pelada} sessao={aberta} jogadores={jogadores} />
        </div>
      ) : (
        <div className="card">
          <p className="muted">Nenhuma pelada aberta. O gestor abre em “Abrir hoje”.</p>
        </div>
      )}

      <div className="card">
        <h2>Peladas anteriores</h2>
        <div className="list">
          {anteriores.map((s) => {
            const art = artilheiroDia(s);
            const np = (s.presencaConfirmada || []).length;
            return (
              <div key={s.id}>
                <div
                  className="player"
                  style={{ cursor: "pointer" }}
                  onClick={() => setExpandida(expandida === s.id ? null : s.id)}
                >
                  <span className="name">{dataBR(s.data)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {np} jog · {s.partidas || 0} part.
                  </span>
                  {art && <span className="lvl">{nome(art.uid)} {art.gols}⚽</span>}
                  {ehGestor && (
                    <button
                      className="btn danger sm"
                      title="Apagar do histórico"
                      onClick={(e) => { e.stopPropagation(); excluir(s.id, s.data); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {expandida === s.id && (
                  <>
                    <PlacarDia sessao={s} nome={nome} detalhe />
                    <ResumoDia pelada={pelada} sessao={s} jogadores={jogadores} />
                  </>
                )}
              </div>
            );
          })}
          {anteriores.length === 0 && <div className="empty">Sem peladas anteriores.</div>}
        </div>
      </div>
    </>
  );
}

function TimeLista({ titulo, lado, uids = [], nome }) {
  return (
    <div className={`team ${lado}`}>
      <h3>{titulo}</h3>
      <ul>
        {uids.map((uid) => <li key={uid}>{nome(uid)}</li>)}
        {uids.length === 0 && <li className="muted">vazio</li>}
      </ul>
    </div>
  );
}

function PlacarDia({ sessao, nome, detalhe }) {
  const linhas = Object.entries(sessao.placar || {})
    .map(([uid, v]) => ({ uid, gols: v?.gols || 0, assist: v?.assist || 0, desarmes: v?.desarmes || 0 }))
    .filter((l) => l.gols + l.assist + l.desarmes > 0)
    .sort((a, b) => b.gols - a.gols || b.assist - a.assist);

  if (linhas.length === 0) {
    return detalhe
      ? <p className="muted" style={{ padding: "8px 0 0" }}>Sem lances registrados.</p>
      : null;
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p className="muted" style={{ marginBottom: 8 }}>Lances do dia</p>
      <div className="list">
        {linhas.map((l) => (
          <div className="player" key={l.uid}>
            <span className="name">{nome(l.uid)}</span>
            <span className="lvl">{l.gols}⚽ {l.assist}🅰 {l.desarmes}🛡</span>
          </div>
        ))}
      </div>
    </div>
  );
}
