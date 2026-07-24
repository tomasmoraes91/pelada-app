// Grade com todas as estatísticas de um jogador, derivadas dos agregados.
// Usada no Meu Perfil e no detalhe de qualquer jogador.
export default function EstatisticasJogador({ j }) {
  const jogos = j.totalJogos || 0;
  const vit = j.vitorias || 0;
  const emp = j.empates || 0;
  const der = Math.max(0, jogos - vit - emp);
  const gols = j.totalGols || 0;
  const jg = j.jogosGoleiro || 0;
  const sofridos = j.golsSofridos || 0;

  const itens = [
    { l: "Gols", v: gols },
    { l: "Méd. gols/jogo", v: jogos ? (gols / jogos).toFixed(2) : "0" },
    { l: "Assistências", v: j.totalAssistencias || 0 },
    { l: "Desarmes", v: j.totalDesarmes || 0 },
    { l: "Jogos", v: jogos },
    { l: "Vitórias", v: vit },
    { l: "Empates", v: emp },
    { l: "Derrotas", v: der },
    { l: "Jogos no gol", v: jg },
    { l: "Gols sofridos", v: sofridos },
    { l: "Méd. sofridos", v: jg ? (sofridos / jg).toFixed(2) : "—" },
    { l: "Pontos", v: j.pontosTemporada || 0 },
  ];

  return (
    <div className="stat-grid">
      {itens.map((it) => (
        <div className="stat-tile" key={it.l}>
          <span className="stat-v">{it.v}</span>
          <span className="stat-l">{it.l}</span>
        </div>
      ))}
    </div>
  );
}
