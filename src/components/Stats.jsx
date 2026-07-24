// ============================================================
// STATS — premiação (líderes) + rankings da pelada.
// ============================================================
import {
  premiacao, muralha, rankingGoleiros, MIN_JOGOS_GOLEIRO,
  liderSequencia, inicioMes, inicioAno,
} from "../lib/premios";

const TIPOS_SEQ = [
  { r: "V", l: "Vitórias", e: "🔥" },
  { r: "E", l: "Empates", e: "🤝" },
  { r: "D", l: "Derrotas", e: "❄️" },
];

export default function Stats({ jogadores, muralhaMin }) {
  const aprovados = jogadores.filter((j) => j.status === "aprovado");
  const minGoleiro = muralhaMin ?? MIN_JOGOS_GOLEIRO;
  const premios = premiacao(jogadores);
  const mur = muralha(jogadores, minGoleiro);
  const goleiros = rankingGoleiros(jogadores);

  return (
    <>
      <div className="card">
        <h2>Premiação 🏆</h2>
        <div className="list">
          {premios.map((p) => (
            <div className="player" key={p.key}>
              <span className="premio-emoji">{p.emoji}</span>
              <span className="name">{p.nome}</span>
              {p.lider ? (
                <span className="lvl">
                  {p.lider.emoji ? `${p.lider.emoji} ` : ""}{p.lider.nome} · {p.valor}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>sem dono</span>
              )}
            </div>
          ))}
          <div className="player">
            <span className="premio-emoji">🧤</span>
            <span className="name">Muralha</span>
            {mur ? (
              <span className="lvl">
                {mur.emoji ? `${mur.emoji} ` : ""}{mur.nome} · {mur.media.toFixed(1)}/jogo
              </span>
            ) : (
              <span className="muted" style={{ fontSize: 12 }}>sem dono</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Goleiros (média de gols sofridos)</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Muralha precisa de {minGoleiro}+ partidas no gol.
        </p>
        <div className="list">
          {goleiros.map((j, i) => (
            <div className="player" key={j.id}>
              <span className="num">{i + 1}</span>
              <span className="name">{j.emoji ? `${j.emoji} ` : ""}{j.nome}</span>
              <span className="lvl">{j.media.toFixed(1)}/jogo ({j.jogosGoleiro})</span>
            </div>
          ))}
          {goleiros.length === 0 && <div className="empty">Ninguém pegou no gol ainda.</div>}
        </div>
      </div>

      <Ranking titulo="Artilheiro" campo="totalGols" sufixo="⚽" lista={aprovados} />
      <Ranking titulo="Garçom (assistências)" campo="totalAssistencias" sufixo="🅰" lista={aprovados} />
      <Ranking titulo="Xerife (desarmes)" campo="totalDesarmes" sufixo="🛡" lista={aprovados} />
      <Ranking titulo="Pontual (chega no horário)" campo="pontualidades" sufixo="⏰" lista={aprovados} />
      <Ranking titulo="Mais vitórias" campo="vitorias" sufixo="🔥" lista={aprovados} />
      <Ranking titulo="Empatador (mais empates)" campo="empates" sufixo="🤝" lista={aprovados} />
      <Ranking titulo="Fominha (mais jogos)" campo="totalJogos" sufixo="👟" lista={aprovados} />

      <Sequencias titulo="Sequências do mês" desde={inicioMes()} lista={aprovados} />
      <Sequencias titulo="Sequências do ano" desde={inicioAno()} lista={aprovados} />
    </>
  );
}

function Sequencias({ titulo, desde, lista }) {
  return (
    <div className="card">
      <h2>{titulo}</h2>
      <div className="list">
        {TIPOS_SEQ.map((t) => {
          const lider = liderSequencia(lista, t.r, desde);
          return (
            <div className="player" key={t.r}>
              <span className="premio-emoji">{t.e}</span>
              <span className="name">{t.l}</span>
              {lider ? (
                <span className="lvl">
                  {lider.jogador.emoji ? `${lider.jogador.emoji} ` : ""}{lider.jogador.nome} · {lider.n}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ranking({ titulo, campo, sufixo, lista }) {
  const ranking = [...lista]
    .filter((j) => (j[campo] || 0) > 0)
    .sort((a, b) => (b[campo] || 0) - (a[campo] || 0))
    .slice(0, 10);

  return (
    <div className="card">
      <h2>{titulo}</h2>
      <div className="list">
        {ranking.map((j, i) => (
          <div className="player" key={j.id}>
            <span className="num">{i + 1}</span>
            <span className="name">{j.emoji ? `${j.emoji} ` : ""}{j.nome}</span>
            <span className="lvl">{j[campo] || 0} {sufixo}</span>
          </div>
        ))}
        {ranking.length === 0 && <div className="empty">Sem registros ainda.</div>}
      </div>
    </div>
  );
}
