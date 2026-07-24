// ============================================================
// MEU PERFIL — nome, emoji (avatar), posição (DEF/MC/AC) e número.
// Esses dados também aparecem no card do jogador.
// ============================================================
import { useState } from "react";
import { setPerfil } from "../lib/data";
import EstatisticasJogador from "./EstatisticasJogador";
import ProgressoJogador from "./ProgressoJogador";

export const POSICOES = [
  { v: "DEF", l: "Defesa" },
  { v: "MC", l: "Meio" },
  { v: "AC", l: "Ataque" },
];

// Avatares: bastante variedade, mas SEM sequências ZWJ (ex: "🧑‍🦰" ruivo)
// que em alguns navegadores quebram e mostram 2 rostos. Aqui só emoji base
// (+ tom de pele), que é amplamente suportado.
export const EMOJIS = [
  // Pessoas (tons de pele variados)
  "🧑🏻", "🧑🏽", "🧑🏿", "👨🏻", "👨🏽", "👨🏿", "👩🏻", "👩🏽", "👩🏿",
  "🧔🏻", "🧔🏽", "🧔🏿", "👱🏻", "👱🏽", "👴🏽", "👵🏽", "👦🏽", "👧🏽",
  // Personagens
  "🦸🏽", "🥷🏽", "🤴🏽", "👸🏽", "🤵🏽", "👮🏽", "👷🏽", "💂🏽", "🕵🏽", "🧙🏽",
  "🤡", "🤠", "👽", "🤖", "🎃", "💀", "👻", "🦹🏽",
  // Mascotes
  "🦁", "🐯", "🐶", "🐺", "🦊", "🐻", "🦅", "🐲", "🦈", "🦄", "🐗", "🐉",
  // Bola e troféus
  "⚽", "🥅", "🧤", "🏆", "🥇", "🔥",
];

export default function Perfil({ pelada, jogador, jogadores, muralhaMin, onSalvo, onVoltar, onTrocarPelada }) {
  const [nome, setNome] = useState(jogador?.nome || "");
  const [emoji, setEmoji] = useState(jogador?.emoji || "");
  const [posicao, setPosicao] = useState(jogador?.posicao || "");
  const [numero, setNumero] = useState(jogador?.numero ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    const num = numero === "" ? null : Math.max(1, Math.min(99, Number(numero)));
    await setPerfil(pelada.id, jogador.id, {
      nome: nome.trim(),
      emoji: emoji || null,
      posicao: posicao || null,
      numero: num,
    });
    setSalvando(false);
    onSalvo?.();
  }

  if (!jogador) {
    return (
      <div className="card">
        <p className="muted">Entre no elenco para configurar seu perfil.</p>
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={onVoltar}>Voltar</button>
        {onTrocarPelada && (
          <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={onTrocarPelada}>
            Trocar de pelada
          </button>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="card">
      <h2>Minhas estatísticas</h2>
      <EstatisticasJogador j={jogador} />
    </div>

    {jogadores && (
      <ProgressoJogador
        pelada={pelada}
        jogador={jogador}
        jogadores={jogadores}
        muralhaMin={muralhaMin}
      />
    )}

    <div className="card">
      <h2>Meu perfil</h2>

      <p className="muted" style={{ marginBottom: 8 }}>Nome</p>
      <input
        className="input"
        placeholder="Seu nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      <p className="muted" style={{ margin: "8px 0" }}>Avatar (emoji)</p>
      <div className="emoji-grid">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className={`emoji-opt ${emoji === e ? "on" : ""}`}
            onClick={() => setEmoji(emoji === e ? "" : e)}
          >
            {e}
          </button>
        ))}
      </div>

      <p className="muted" style={{ margin: "16px 0 8px" }}>Posição</p>
      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        {POSICOES.map((p) => (
          <button
            key={p.v}
            className={`btn sm ${posicao === p.v ? "" : "ghost"}`}
            style={{ flex: 1 }}
            onClick={() => setPosicao(p.v)}
          >
            {p.v}
          </button>
        ))}
      </div>

      <p className="muted" style={{ marginBottom: 8 }}>Número da camisa</p>
      <input
        className="input"
        type="number"
        min="1"
        max="99"
        placeholder="Ex: 10"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
      />

      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn ghost" style={{ flex: 1 }} onClick={onVoltar}>Voltar</button>
        <button className="btn" style={{ flex: 1 }} onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {onTrocarPelada && (
        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 16 }}
          onClick={onTrocarPelada}
        >
          Trocar de pelada
        </button>
      )}
    </div>
    </>
  );
}
