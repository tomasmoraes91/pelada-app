// ============================================================
// CARDS DO JOGADOR
//  1) Card de desempenho (estilo FIFA) — já existia
//  2) Card de habilidades — atributos avaliados (config da pelada)
// ============================================================
import { useRef } from "react";
import { toPng } from "html-to-image";
import { useAuth } from "../context/AuthContext";
import {
  ATRIBUTOS, escalaMax, overall, temAvaliacao, mediaAvaliacoes, qtdAvaliadores,
  ovrExibicao,
} from "../lib/habilidades";
import { badgesDoJogador } from "../lib/premios";

export default function CardJogador({ jogadores, pelada, muralhaMin }) {
  const { user } = useAuth();
  const cardRef = useRef(null);
  const eu = jogadores.find((j) => j.id === user?.uid);
  if (!eu) return <div className="empty">Cadastre-se para ver seu card.</div>;

  // OVR na mesma forma de avaliação da pelada (estrelas 0–5 ou número 0–99).
  const ovr = ovrExibicao(eu, pelada);
  const escala = pelada?.configHabilidadeEscala || "estrelas";
  const posicao = eu.posicao || (eu.jogosGoleiro > 0 ? "GOL" : "LIN");
  const camisa = eu.numero ? ` · #${eu.numero}` : "";

  const texto =
    `⚽ Meu card na pelada\n` +
    `${eu.nome} — OVR ${ovr}\n` +
    `Gols: ${eu.totalGols || 0} | Jogos: ${eu.totalJogos || 0} | ` +
    `Vitórias: ${eu.vitorias || 0} | Pontos: ${eu.pontosTemporada || 0}`;
  const linkWhats = `https://wa.me/?text=${encodeURIComponent(texto)}`;

  async function compartilharImagem() {
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "meu-card.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `Meu card na ${pelada?.nome || "pelada"}` });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "meu-card.png";
        a.click();
      }
    } catch {
      // Se não der pra gerar a imagem (ex: foto externa), cai no texto.
      window.open(linkWhats, "_blank");
    }
  }

  return (
    <>
      <div className="card">
        <h2>Meu card</h2>
        <div className="fifa-card" ref={cardRef}>
          <div className="fifa-top">
            {escala === "estrelas" ? (
              <EstrelasOvr n={ovr} />
            ) : (
              <span className="fifa-ovr">{ovr}</span>
            )}
            <span className="fifa-pos">{posicao}{camisa}</span>
          </div>
          {eu.emoji ? (
            <div className="fifa-foto fifa-foto-vazia">{eu.emoji}</div>
          ) : eu.foto ? (
            <img className="fifa-foto" src={eu.foto} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="fifa-foto fifa-foto-vazia">⚽</div>
          )}
          <div className="fifa-nome">{eu.nome}</div>
          <div className="fifa-stats">
            <Stat l="GOL" v={eu.totalGols || 0} />
            <Stat l="JOG" v={eu.totalJogos || 0} />
            <Stat l="VIT" v={eu.vitorias || 0} />
            <Stat l="PTS" v={eu.pontosTemporada || 0} />
          </div>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={compartilharImagem}>
          Compartilhar card (imagem)
        </button>
        <a href={linkWhats} target="_blank" rel="noreferrer">
          <button className="btn ghost" style={{ marginTop: 8 }}>Compartilhar texto</button>
        </a>
      </div>

      <CardHabilidades pelada={pelada} jogador={eu} />
      <Conquistas eu={eu} jogadores={jogadores} muralhaMin={muralhaMin} />
    </>
  );
}

function Conquistas({ eu, jogadores, muralhaMin }) {
  const { coroas, marcos } = badgesDoJogador(eu, jogadores, muralhaMin);
  const ganhos = marcos.filter((m) => m.ganhou);
  const aFazer = marcos.filter((m) => !m.ganhou);

  return (
    <div className="card">
      <h2>Minhas conquistas</h2>
      <div className="badges-wrap">
        {coroas.map((c) => (
          <span className="badge coroa" key={c.key}>
            <span className="b-emoji">{c.emoji}</span> {c.nome}
          </span>
        ))}
        {ganhos.map((m) => (
          <span className="badge" key={m.key}>
            <span className="b-emoji">{m.emoji}</span> {m.nome}
          </span>
        ))}
        {coroas.length === 0 && ganhos.length === 0 && (
          <p className="muted">Nenhuma conquista ainda. Joga que vem!</p>
        )}
      </div>

      {aFazer.length > 0 && (
        <>
          <p className="muted" style={{ margin: "14px 0 8px" }}>Próximas</p>
          <div className="badges-wrap">
            {aFazer.map((m) => (
              <span className="badge locked" key={m.key}>
                <span className="b-emoji">{m.emoji}</span> {m.nome} ({m.valor}/{m.meta})
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CardHabilidades({ pelada, jogador }) {
  const tipo = pelada?.configHabilidadeTipo || "detalhada";
  const escala = pelada?.configHabilidadeEscala || "estrelas";
  const avaliacoes = jogador.avaliacoes || {};
  const media = mediaAvaliacoes(avaliacoes, tipo);
  const n = qtdAvaliadores(avaliacoes);

  return (
    <div className="card">
      <h2>Habilidades</h2>
      {!temAvaliacao(avaliacoes) ? (
        <p className="muted">
          Você ainda não foi avaliado. Quem tem permissão pode avaliar pela aba Elenco.
        </p>
      ) : (
        <>
          <div className="hab-ovr">
            <span className="hab-ovr-v">{overall(media, tipo)}</span>
            <span className="hab-ovr-l">
              Média de {n} {n === 1 ? "avaliação" : "avaliações"}
              {escala === "estrelas" ? " · 0–5" : " · 0–99"}
            </span>
          </div>
          {tipo === "simples" ? (
            <HabRow label="Geral" valor={media.geral} escala={escala} />
          ) : (
            <div className="list">
              {ATRIBUTOS.map((a) => (
                <HabRow key={a.key} label={a.nome} valor={media[a.key]} escala={escala} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Linha de atributo: estrelas (1–5) ou barra + número (0–99).
export function HabRow({ label, valor, escala }) {
  const max = escalaMax(escala);
  const v = Math.max(0, Math.min(max, Number(valor) || 0));
  return (
    <div className="hab-row">
      <span className="lab">{label}</span>
      {escala === "estrelas" ? (
        <span className="stars">
          {"★".repeat(v)}
          <span className="off">{"★".repeat(max - v)}</span>
        </span>
      ) : (
        <>
          <span className="hab-bar"><i style={{ width: (v / max) * 100 + "%" }} /></span>
          <span className="val">{v}</span>
        </>
      )}
    </div>
  );
}

function Stat({ l, v }) {
  return (
    <div className="fifa-stat">
      <span className="fifa-stat-v">{v}</span>
      <span className="fifa-stat-l">{l}</span>
    </div>
  );
}

// OVR como 5 estrelas vazadas, preenchidas até o nível do jogador.
function EstrelasOvr({ n, max = 5 }) {
  const cheio = Math.max(0, Math.min(max, Math.round(n)));
  return (
    <span className="fifa-stars" title={`${cheio} de ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < cheio ? "on" : "off"}>★</span>
      ))}
    </span>
  );
}
