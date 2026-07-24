// ============================================================
// RESUMO DO DIA — card compartilhável (imagem) com os destaques
// da pelada: artilheiro, garçom e xerife do dia (de sessao.placar)
// e o Craque (da votação, quando já revelada). Vira post no grupo.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { getResumoVotacao } from "../lib/data";
import { resultadoLiberado } from "../lib/notificacoes";
import { mvpDoDia } from "../lib/premios";

function dataBR(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
}

export default function ResumoDia({ pelada, sessao, jogadores }) {
  const ref = useRef(null);
  const [craque, setCraque] = useState(null);
  const nome = (uid) => jogadores.find((j) => j.id === uid)?.nome || "—";

  // Melhor de cada categoria do dia (gols/assist/desarmes), a partir do placar.
  const placar = sessao.placar || {};
  const top = (campo) => {
    let best = null;
    Object.entries(placar).forEach(([uid, v]) => {
      const n = v?.[campo] || 0;
      if (n > 0 && (!best || n > best.n)) best = { uid, n };
    });
    return best;
  };
  const artilheiro = top("gols");
  const garcom = top("assist");
  const xerife = top("desarmes");
  const mvp = mvpDoDia(sessao, jogadores); // melhor por DADOS (não é o votado)
  const temDestaque = artilheiro || garcom || xerife || craque || mvp;

  // Craque do dia: só quando a votação está revelada (24h ou todos votaram).
  useEffect(() => {
    let vivo = true;
    getResumoVotacao(pelada.id, sessao.id)
      .then((r) => {
        if (!vivo) return;
        const votos = r?.votos || {};
        const presentes = sessao.presencaConfirmada || [];
        const votaram = presentes.filter((uid) => votos[uid]).length;
        const todos = presentes.length > 0 && votaram >= presentes.length;
        if (!resultadoLiberado(sessao) && !todos) return setCraque(null);
        const medias = presentes
          .map((uid) => {
            const notas = Object.values(votos).map((v) => v?.[uid]).filter((n) => typeof n === "number");
            return { uid, media: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null };
          })
          .filter((x) => x.media != null)
          .sort((a, b) => b.media - a.media);
        setCraque(medias[0] || null);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [pelada.id, sessao.id]);

  function textoResumo() {
    return [
      `⚽ ${pelada.nome || "Pelada"} — ${dataBR(sessao.data)}`,
      craque && `🏆 Craque da galera: ${nome(craque.uid)}`,
      mvp && `🌟 MVP do dia: ${mvp.nome} (${mvp.score} pts)`,
      artilheiro && `⚽ Artilheiro: ${nome(artilheiro.uid)} (${artilheiro.n})`,
      garcom && `🅰 Garçom: ${nome(garcom.uid)} (${garcom.n})`,
      xerife && `🛡 Xerife: ${nome(xerife.uid)} (${xerife.n})`,
    ].filter(Boolean).join("\n");
  }

  function mandarNoGrupo() {
    window.open(`https://wa.me/?text=${encodeURIComponent(textoResumo())}`, "_blank");
  }

  async function compartilhar() {
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "resumo-pelada.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `Resumo da ${pelada.nome || "pelada"}` });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "resumo-pelada.png";
        a.click();
      }
    } catch {
      mandarNoGrupo(); // se a imagem falhar, manda o texto
    }
  }

  if (!temDestaque) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="resumo-card" ref={ref}>
        <div className="resumo-top">
          <span className="resumo-nome">{pelada.nome || "Pelada"}</span>
          <span className="resumo-data">{dataBR(sessao.data)}</span>
        </div>
        <div className="resumo-list">
          {craque && <Linha emoji="🏆" rotulo="Craque da galera" valor={nome(craque.uid)} />}
          {mvp && <Linha emoji="🌟" rotulo="MVP do dia (dados)" valor={`${mvp.nome} · ${mvp.score} pts`} />}
          {artilheiro && <Linha emoji="⚽" rotulo="Artilheiro do dia" valor={`${nome(artilheiro.uid)} · ${artilheiro.n}`} />}
          {garcom && <Linha emoji="🅰" rotulo="Garçom do dia" valor={`${nome(garcom.uid)} · ${garcom.n}`} />}
          {xerife && <Linha emoji="🛡" rotulo="Xerife do dia" valor={`${nome(xerife.uid)} · ${xerife.n}`} />}
        </div>
        <div className="resumo-rodape">⚽ pelada.app</div>
      </div>
      <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={compartilhar}>
        📤 Compartilhar resumo (imagem)
      </button>
      <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={mandarNoGrupo}>
        💬 Mandar no grupo (texto)
      </button>
    </div>
  );
}

function Linha({ emoji, rotulo, valor }) {
  return (
    <div className="resumo-linha">
      <span className="resumo-emoji">{emoji}</span>
      <span className="resumo-rotulo">{rotulo}</span>
      <span className="resumo-valor">{valor}</span>
    </div>
  );
}
