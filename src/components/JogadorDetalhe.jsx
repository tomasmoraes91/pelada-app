// ============================================================
// DETALHE DO JOGADOR — modal aberto ao clicar no nome de alguém.
// Mostra avatar, OVR, status na pelada do dia, todas as estatísticas
// e as conquistas. Somente leitura.
// ============================================================
import { useRef } from "react";
import { toPng } from "html-to-image";
import { ovrExibicao } from "../lib/habilidades";
import { badgesDoJogador } from "../lib/premios";
import EstatisticasJogador from "./EstatisticasJogador";

export default function JogadorDetalhe({ pelada, jogador, jogadores, sessao, muralhaMin, onFechar }) {
  const cardRef = useRef(null);
  if (!jogador) return null;

  async function compartilhar() {
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2, cacheBust: true, backgroundColor: "#14331f",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `${jogador.nome}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${jogador.nome} — ${pelada.nome || "pelada"}` });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${jogador.nome}.png`;
        a.click();
      }
    } catch {
      // Foto externa pode bloquear a imagem; nesse caso não faz nada.
    }
  }

  const ovr = ovrExibicao(jogador, pelada);
  const escala = pelada?.configHabilidadeEscala || "estrelas";
  const posicao = jogador.posicao || (jogador.jogosGoleiro > 0 ? "GOL" : "LIN");
  const camisa = jogador.numero ? `#${jogador.numero}` : "";
  const { coroas, marcos } = badgesDoJogador(jogador, jogadores, muralhaMin);
  const ganhou = marcos.filter((m) => m.ganhou);

  // Status na pelada do dia (se houver sessão aberta).
  const status = (() => {
    if (!sessao || sessao.status === "encerrada") return null;
    if ((sessao.presencaConfirmada || []).includes(jogador.id)) return { e: "🏟️", t: "Já chegou (na fila)" };
    if ((sessao.goleirosFixos || []).includes(jogador.id)) return { e: "🧤", t: "Veio só pra agarrar" };
    if ((sessao.presencaAntecipada || []).includes(jogador.id)) return { e: "✅", t: "Confirmou presença" };
    if ((sessao.naoVou || []).includes(jogador.id)) return { e: "❌", t: "Avisou que não vai" };
    return { e: "—", t: "Sem confirmação ainda" };
  })();

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onFechar} aria-label="Fechar">✕</button>

        <div ref={cardRef} style={{ background: "var(--surface)" }}>
        <div className="jd-head">
          {jogador.emoji ? (
            <div className="jd-avatar">{jogador.emoji}</div>
          ) : jogador.foto ? (
            <img className="jd-avatar" src={jogador.foto} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="jd-avatar">⚽</div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>{jogador.nome}</h2>
            <div className="jd-pos">{posicao}{camisa && ` · ${camisa}`}</div>
            <div className="jd-ovr">
              {escala === "estrelas" ? <EstrelasOvr n={ovr} /> : <span className="jd-ovrnum">OVR {ovr}</span>}
            </div>
          </div>
        </div>

        {status && (
          <div className="jd-status">
            <span style={{ fontSize: 18 }}>{status.e}</span> {status.t}
          </div>
        )}

        <h3 style={{ margin: "16px 0 8px" }}>Estatísticas</h3>
        <EstatisticasJogador j={jogador} />

        {(coroas.length > 0 || ganhou.length > 0) && (
          <>
            <h3 style={{ margin: "16px 0 8px" }}>Conquistas</h3>
            <div className="badges-wrap">
              {coroas.map((c) => (
                <span className="badge coroa" key={c.key}>
                  <span className="b-emoji">{c.emoji}</span> {c.nome}
                </span>
              ))}
              {ganhou.map((m) => (
                <span className="badge" key={m.key}>
                  <span className="b-emoji">{m.emoji}</span> {m.nome}
                </span>
              ))}
            </div>
          </>
        )}
        </div>

        <button className="btn" style={{ width: "100%", marginTop: 16 }} onClick={compartilhar}>
          📤 Compartilhar
        </button>
        <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  );
}

// OVR como 5 estrelas vazadas, preenchidas até o nível do jogador.
function EstrelasOvr({ n, max = 5 }) {
  const cheio = Math.max(0, Math.min(max, Math.round(n)));
  return (
    <span className="jd-stars" title={`${cheio} de ${max}`}>
      {"★".repeat(cheio)}
      <span className="off">{"★".repeat(max - cheio)}</span>
    </span>
  );
}
