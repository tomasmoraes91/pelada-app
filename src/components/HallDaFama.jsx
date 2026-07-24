// ============================================================
// HALL DA FAMA — campeões das temporadas encerradas (por ano).
// ============================================================
import { useEffect, useState } from "react";
import { getHallDaFama } from "../lib/data";

const PREMIOS = [
  { k: "pontos", emoji: "👑", nome: "Campeão", campo: "valor", sufixo: "pts" },
  { k: "artilheiro", emoji: "⚽", nome: "Artilheiro", campo: "valor", sufixo: "gols" },
  { k: "garcom", emoji: "🅰", nome: "Garçom", campo: "valor", sufixo: "assist." },
  { k: "xerife", emoji: "🛡", nome: "Xerifão", campo: "valor", sufixo: "desarmes" },
  { k: "muralha", emoji: "🧤", nome: "Muralha", campo: "media", sufixo: "/jogo" },
];

export default function HallDaFama({ pelada }) {
  const [anos, setAnos] = useState(null);

  useEffect(() => {
    getHallDaFama(pelada.id).then(setAnos).catch(() => setAnos([]));
  }, [pelada.id]);

  if (!anos || anos.length === 0) return null;

  return (
    <div className="card">
      <h2>Hall da Fama 🏛️</h2>
      {anos.map((t) => (
        <div key={t.id} style={{ marginTop: 8 }}>
          <p className="muted" style={{ margin: "8px 0 6px", fontFamily: "var(--pixel)", fontSize: 11, color: "var(--ball)" }}>
            {t.ano}
          </p>
          <div className="list">
            {PREMIOS.map(({ k, emoji, nome, campo, sufixo }) => {
              const c = t.campeoes?.[k];
              if (!c) return null;
              const valor = campo === "media" ? Number(c.media).toFixed(1) : c.valor;
              return (
                <div className="player" key={k}>
                  <span className="premio-emoji">{emoji}</span>
                  <span className="name">{nome}</span>
                  <span className="lvl">{c.nome} · {valor} {sufixo}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
