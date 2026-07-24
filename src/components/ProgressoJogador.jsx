// ============================================================
// PROGRESSO / EVOLUÇÃO do jogador — sequência atual, forma recente
// (últimos resultados) e a próxima conquista a desbloquear.
// (As conquistas já ganhas aparecem no card de Conquistas.)
// ============================================================
import { badgesDoJogador } from "../lib/premios";

const ROTULO_SEQ = {
  V: { l: "vitórias", e: "🔥" },
  E: { l: "empates", e: "🤝" },
  D: { l: "derrotas", e: "❄️" },
};

function sequenciaAtual(historico) {
  const lista = (historico || []).filter((h) => h && h.r).sort((a, b) => a.t - b.t);
  if (!lista.length) return null;
  const r = lista[lista.length - 1].r;
  let n = 0;
  for (let i = lista.length - 1; i >= 0; i--) {
    if (lista[i].r === r) n++;
    else break;
  }
  return { r, n };
}

export default function ProgressoJogador({ pelada, jogador, jogadores, muralhaMin }) {
  const { marcos } = badgesDoJogador(jogador, jogadores, muralhaMin);
  const proxima = marcos
    .filter((m) => !m.ganhou)
    .sort((a, b) => (a.meta - a.valor) - (b.meta - b.valor))[0];
  const seq = sequenciaAtual(jogador.historico);
  const forma = (jogador.historico || [])
    .filter((h) => h && h.r)
    .sort((a, b) => a.t - b.t)
    .slice(-15);
  const jogos = jogador.totalJogos || 0;
  const aprov = jogos ? Math.round(((jogador.vitorias || 0) / jogos) * 100) : 0;

  if (!seq && forma.length === 0 && !proxima) return null;

  return (
    <div className="card">
      <h2>Seu progresso 🏅</h2>

      {seq && seq.n >= 2 && (
        <p style={{ fontWeight: 700, marginBottom: 12 }}>
          {ROTULO_SEQ[seq.r].e} {seq.n} {ROTULO_SEQ[seq.r].l} seguidas!
        </p>
      )}

      {forma.length > 0 && (
        <>
          <p className="muted" style={{ marginBottom: 6 }}>
            Últimos jogos · {aprov}% de vitórias
          </p>
          <div className="forma">
            {forma.map((h, i) => (
              <span key={i} className={`f f-${h.r}`}>{h.r}</span>
            ))}
          </div>
        </>
      )}

      {proxima && (
        <>
          <p className="muted" style={{ margin: "14px 0 6px" }}>
            Próxima conquista: {proxima.emoji} {proxima.nome} ({proxima.valor}/{proxima.meta})
          </p>
          <span className="hab-bar">
            <i style={{ width: Math.min(100, (proxima.valor / proxima.meta) * 100) + "%" }} />
          </span>
        </>
      )}
    </div>
  );
}
