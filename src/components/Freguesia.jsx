// ============================================================
// FREGUESIA — contra quem você mais ganha / mais perde (adversários)
// PARCERIAS — com quem você mais joga/ganha/empata/perde jogando junto
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getFreguesia, getParcerias } from "../lib/data";

// Maior por uma métrica (ignora zeros).
function topPor(arr, fn) {
  let best = null;
  (arr || []).forEach((x) => {
    const v = fn(x);
    if (v > 0 && (!best || v > fn(best))) best = x;
  });
  return best;
}

export default function Freguesia({ pelada, jogadores }) {
  const { user } = useAuth();
  const [dados, setDados] = useState(null);
  const [parcerias, setParcerias] = useState(null);

  const nome = useMemo(() => {
    const m = {};
    jogadores.forEach((j) => (m[j.id] = j.nome));
    return (uid) => m[uid] || "—";
  }, [jogadores]);

  useEffect(() => {
    if (!user) return;
    getFreguesia(pelada.id, user.uid).then(setDados);
    getParcerias(pelada.id, user.uid).then(setParcerias);
  }, [pelada.id, user]);

  const total = (p) => p.vitorias + p.empates + p.derrotas;
  const maisJunto = topPor(parcerias, total);
  const maisVenceu = topPor(parcerias, (p) => p.vitorias);
  const maisEmpatou = topPor(parcerias, (p) => p.empates);
  const maisPerdeu = topPor(parcerias, (p) => p.derrotas);
  const top3Junto = [...(parcerias || [])].sort((a, b) => total(b) - total(a)).slice(0, 3);

  const fregues = topPor(dados, (c) => c.vitorias);   // você mais venceu
  const carrasco = topPor(dados, (c) => c.derrotas);  // quem mais te venceu
  const top3Saldo = [...(dados || [])].sort((a, b) => (b.vitorias - b.derrotas) - (a.vitorias - a.derrotas));

  return (
    <>
      <div className="card">
        <h2>Parcerias 🤝</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Com quem você joga junto.
        </p>
        {!parcerias ? (
          <div className="empty">Carregando…</div>
        ) : parcerias.length === 0 ? (
          <div className="empty">Jogue algumas partidas para gerar suas parcerias.</div>
        ) : (
          <>
            <div className="list">
              <Destaque emoji="🤝" titulo="Mais jogou junto" p={maisJunto} nome={nome} valor={maisJunto && `${total(maisJunto)}x`} />
              <Destaque emoji="🏆" titulo="Mais venceu junto" p={maisVenceu} nome={nome} valor={maisVenceu && `${maisVenceu.vitorias}V`} />
              <Destaque emoji="🤝" titulo="Mais empatou junto" p={maisEmpatou} nome={nome} valor={maisEmpatou && `${maisEmpatou.empates}E`} />
              <Destaque emoji="❄️" titulo="Mais perdeu junto" p={maisPerdeu} nome={nome} valor={maisPerdeu && `${maisPerdeu.derrotas}D`} />
            </div>
            <p className="muted" style={{ margin: "14px 0 8px" }}>Top 3 companheiros</p>
            <div className="list">
              {top3Junto.map((p, i) => (
                <div className="player" key={p.parceiro}>
                  <span className="num">{["🥇", "🥈", "🥉"][i]}</span>
                  <span className="name">{nome(p.parceiro)}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {p.vitorias}V {p.empates}E {p.derrotas}D
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Sua freguesia 🎯</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Contra cada adversário direto.
        </p>
        {!dados ? (
          <div className="empty">Carregando…</div>
        ) : dados.length === 0 ? (
          <div className="empty">Jogue algumas partidas para gerar sua freguesia.</div>
        ) : (
          <>
            <div className="list">
              <Destaque emoji="😎" titulo="Seu freguês" p={fregues}
                nome={nome} chave="adversario" valor={fregues && `${fregues.vitorias}V`} />
              <Destaque emoji="😱" titulo="Seu carrasco" p={carrasco}
                nome={nome} chave="adversario" valor={carrasco && `${carrasco.derrotas}D`} />
            </div>
            <p className="muted" style={{ margin: "14px 0 8px" }}>Saldo por adversário</p>
            <div className="list">
              {top3Saldo.map((c) => {
                const saldo = c.vitorias - c.derrotas;
                return (
                  <div className="player" key={c.adversario}>
                    <span className="name">{nome(c.adversario)}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{c.vitorias}V {c.derrotas}D</span>
                    <span className="lvl" style={{ color: saldo >= 0 ? "var(--grass)" : "var(--danger)" }}>
                      {saldo > 0 ? `+${saldo}` : saldo}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Destaque({ emoji, titulo, p, nome, valor, chave = "parceiro" }) {
  return (
    <div className="player">
      <span className="premio-emoji">{emoji}</span>
      <span className="name">{titulo}</span>
      <span className="lvl">{p ? `${nome(p[chave])} · ${valor}` : "—"}</span>
    </div>
  );
}
