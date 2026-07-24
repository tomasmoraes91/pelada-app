// ============================================================
// TEMPORADA — ranking de pontos + prêmios automáticos do mês
// Tudo calculado a partir dos agregados já salvos no jogador
// (zero leitura extra além do listarJogadores que o App já faz).
// ============================================================
export default function Temporada({ jogadores }) {
  const aprovados = jogadores.filter((j) => j.status === "aprovado");

  const ranking = [...aprovados].sort(
    (a, b) => (b.pontosTemporada || 0) - (a.pontosTemporada || 0)
  );

  // Prêmios
  const artilheiro = max(aprovados, (j) => j.totalGols);
  const presenca = max(aprovados, (j) => j.presencas);
  // Muralha: goleiro com menor média de gols sofridos (mín. 1 jogo no gol)
  const goleiros = aprovados.filter((j) => (j.jogosGoleiro || 0) > 0);
  const muralha = goleiros.length
    ? goleiros.reduce((m, j) =>
        media(j) < media(m) ? j : m
      )
    : null;
  // Pereba: mais jogos sem nenhum gol (zoeira da galera)
  const peraba = aprovados
    .filter((j) => (j.totalJogos || 0) >= 3 && (j.totalGols || 0) === 0)
    .sort((a, b) => b.totalJogos - a.totalJogos)[0];

  return (
    <>
      <div className="card">
        <h2>Prêmios da temporada (acumulado)</h2>
        <div className="list">
          <Premio titulo="🥇 Artilheiro" jogador={artilheiro}
            valor={artilheiro && `${artilheiro.totalGols} gols`} />
          <Premio titulo="🧤 Muralha" jogador={muralha}
            valor={muralha && `${media(muralha).toFixed(1)} gols/jogo`} />
          <Premio titulo="🏃 Presença" jogador={presenca}
            valor={presenca && `${presenca.presencas} jogos`} />
          <Premio titulo="🤡 Pereba" jogador={peraba}
            valor={peraba && `${peraba.totalJogos} jogos, 0 gol`} />
        </div>
      </div>

      <div className="card">
        <h2>Ranking da temporada</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Gol = 2 pts · Vitória = 3 · Presença = 1
        </p>
        <div className="list">
          {ranking.map((j, i) => (
            <div className="player" key={j.id}>
              <span className="num">{medalha(i)}</span>
              <span className="name">{j.nome}</span>
              <span className="lvl">{j.pontosTemporada || 0} pts</span>
            </div>
          ))}
          {ranking.length === 0 && <div className="empty">Sem pontos ainda.</div>}
        </div>
      </div>
    </>
  );
}

function Premio({ titulo, jogador, valor }) {
  return (
    <div className="player">
      <span className="name" style={{ flex: "0 0 130px" }}>{titulo}</span>
      <span className="name">{jogador ? jogador.nome : "—"}</span>
      {valor && <span className="lvl" style={{ fontSize: 13 }}>{valor}</span>}
    </div>
  );
}

function max(arr, fn) {
  if (!arr.length) return null;
  return arr.reduce((m, x) => (fn(x) > fn(m) ? x : m));
}
function media(j) {
  return (j.golsSofridos || 0) / Math.max(1, j.jogosGoleiro || 1);
}
function medalha(i) {
  return ["🥇", "🥈", "🥉"][i] || i + 1;
}
