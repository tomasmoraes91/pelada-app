// ============================================================
// FECHAMENTO — prêmios consolidados do mês / semestre / ano.
// ============================================================
import { useEffect, useState } from "react";
import { listarSessoesPeriodo } from "../lib/data";
import { inicioPeriodo, agregarPeriodo, premiosPeriodo } from "../lib/fechamento";

const PERIODOS = [
  { v: "mes", l: "Mês" },
  { v: "semestre", l: "Semestre" },
  { v: "ano", l: "Ano" },
];

export default function Fechamento({ pelada, jogadores, muralhaMin }) {
  const [periodo, setPeriodo] = useState("mes");
  const [sessoes, setSessoes] = useState(null);

  useEffect(() => {
    setSessoes(null);
    listarSessoesPeriodo(pelada.id, inicioPeriodo(periodo))
      .then(setSessoes)
      .catch(() => setSessoes([]));
  }, [pelada.id, periodo]);

  const stats = sessoes ? agregarPeriodo(sessoes, jogadores, inicioPeriodo(periodo)) : [];
  const premios = sessoes ? premiosPeriodo(stats, jogadores, muralhaMin) : null;
  const vazio = premios && !premios.artilheiro && !premios.garcom && !premios.xerife
    && !premios.vencedor && !premios.muralha;

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Prêmios do período 🏆</h2>
        <div className="row" style={{ gap: 6 }}>
          {PERIODOS.map((p) => (
            <button
              key={p.v}
              className={`btn sm ${periodo === p.v ? "" : "ghost"}`}
              onClick={() => setPeriodo(p.v)}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {!sessoes ? (
        <div className="empty">Carregando…</div>
      ) : vazio ? (
        <div className="empty">Sem jogos contabilizados neste período.</div>
      ) : (
        <div className="list">
          <Linha emoji="⚽" titulo="Artilheiro" p={premios.artilheiro} sufixo="gols" />
          <Linha emoji="🅰" titulo="Garçom" p={premios.garcom} sufixo="assist." />
          <Linha emoji="🛡" titulo="Xerifão" p={premios.xerife} sufixo="desarmes" />
          <Linha emoji="🔥" titulo="Mais vitórias" p={premios.vencedor} sufixo="vitórias" />
          {premios.muralha && (
            <div className="player">
              <span className="premio-emoji">🧤</span>
              <span className="name">Muralha</span>
              <span className="lvl">{premios.muralha.nome} · {premios.muralha.media.toFixed(1)}/jogo</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({ emoji, titulo, p, sufixo }) {
  if (!p) return null;
  return (
    <div className="player">
      <span className="premio-emoji">{emoji}</span>
      <span className="name">{titulo}</span>
      <span className="lvl">{p.nome} · {p.valor} {sufixo}</span>
    </div>
  );
}
