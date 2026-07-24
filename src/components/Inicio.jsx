// ============================================================
// INÍCIO — painel da pelada: próximo jogo, destaques e elenco.
// Tudo derivado dos agregados já carregados (sem leitura extra,
// exceto a previsão do tempo, que é gratuita e sem chave).
// ============================================================
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getPrevisao, previsaoNoHorario, iconeTempo } from "../lib/clima";
import { premiacao, muralha } from "../lib/premios";
import { getFreguesia } from "../lib/data";
import PresencaAntecipada from "./PresencaAntecipada";

// Maior por uma métrica (ignora zeros).
function topPor(arr, fn) {
  let best = null;
  (arr || []).forEach((x) => {
    const v = fn(x);
    if (v > 0 && (!best || v > fn(best))) best = x;
  });
  return best;
}

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function Inicio({ pelada, jogadores, sessaoId, sessaoAtiva, onIrParaJogo, onIrPara }) {
  const { user } = useAuth();
  const aprovados = jogadores.filter((j) => j.status === "aprovado");
  const eu = aprovados.find((j) => j.id === user?.uid);
  const [clima, setClima] = useState(null);
  const [freguesia, setFreguesia] = useState(null);
  const nomeDe = (uid) => jogadores.find((j) => j.id === uid)?.nome || "—";

  useEffect(() => {
    if (!user) return;
    getFreguesia(pelada.id, user.uid).then(setFreguesia).catch(() => setFreguesia([]));
  }, [pelada.id, user]);

  const fregues = topPor(freguesia, (c) => c.vitorias);   // você mais venceu
  const carrasco = topPor(freguesia, (c) => c.derrotas);  // mais te venceu
  const { lat, lng } = pelada.local || {};

  useEffect(() => {
    if (lat == null) return;
    getPrevisao(lat, lng).then(setClima).catch(() => setClima(null));
  }, [lat, lng]);

  const prev = previsaoNoHorario(clima, pelada);
  const temAgenda = pelada.diaSemana != null && pelada.horario;

  // Destaques: líderes por categoria (mesmos critérios do Stats).
  const premios = premiacao(jogadores);
  const lider = (key) => premios.find((p) => p.key === key);
  const pontos = [...aprovados].sort((a, b) => (b.pontosTemporada || 0) - (a.pontosTemporada || 0))[0];
  const mur = muralha(jogadores, pelada.muralhaMinJogos);

  const destaques = [
    pontos?.pontosTemporada > 0 && { emoji: "👑", nome: "Líder de pontos", j: pontos, v: `${pontos.pontosTemporada} pts` },
    destaqueDe(lider("totalGols"), "⚽", "Artilheiro"),
    destaqueDe(lider("totalAssistencias"), "🅰", "Garçom"),
    destaqueDe(lider("vitorias"), "🔥", "Vencedor"),
    mur && { emoji: "🧤", nome: "Muralha", j: mur, v: `${mur.media.toFixed(1)}/jogo` },
  ].filter(Boolean);

  return (
    <>
      {/* PRÓXIMA PELADA */}
      <div className="card">
        <h2>Próxima pelada</h2>
        {temAgenda ? (
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {DIAS[pelada.diaSemana]} às {pelada.horario}
          </p>
        ) : (
          <p className="muted" style={{ marginBottom: 6 }}>Sem dia fixo definido.</p>
        )}
        {pelada.local?.endereco && (
          <p className="muted" style={{ marginBottom: 8 }}>📍 {pelada.local.endereco}</p>
        )}
        {(prev || clima?.current) && (
          <div className="row" style={{ gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>
              {Math.round(prev ? prev.temp : clima.current.temperature_2m)}°{" "}
              {iconeTempo(prev ? prev.code : clima.current.weather_code)}
            </span>
            <span className="muted">
              {prev
                ? prev.chuva != null
                  ? `${prev.chuva}% de chuva no horário`
                  : "no horário do jogo"
                : "agora"}
            </span>
          </div>
        )}
        {sessaoAtiva && (
          <button className="btn warn" style={{ marginTop: 10 }} onClick={onIrParaJogo}>
            Tem jogo rolando — entrar
          </button>
        )}
      </div>

      {/* PRESENÇA ANTECIPADA (quando o dia de jogo está aberto) */}
      {sessaoId && (
        <PresencaAntecipada pelada={pelada} sessaoId={sessaoId} jogadores={jogadores} />
      )}

      {/* DESTAQUES */}
      <div className="card">
        <h2 className="card-link" onClick={() => onIrPara?.("stats")}>
          Destaques 🏆 <span className="card-link-seta">›</span>
        </h2>
        {destaques.length === 0 ? (
          <p className="muted">Ainda sem estatísticas. Bora jogar!</p>
        ) : (
          <div className="list">
            {destaques.map((d) => (
              <div className="player" key={d.nome}>
                <span className="premio-emoji">{d.emoji}</span>
                <span className="name">{d.nome}</span>
                <span className="lvl">{d.j.nome} · {d.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIVALIDADES (do jogador logado) */}
      {eu && (fregues || carrasco) && (
        <div className="card">
          <h2>Suas rivalidades 🎯</h2>
          <div className="list">
            {fregues && (
              <div className="player">
                <span className="premio-emoji">😎</span>
                <span className="name">Seu freguês</span>
                <span className="lvl">{nomeDe(fregues.adversario)} · {fregues.vitorias}V</span>
              </div>
            )}
            {carrasco && (
              <div className="player">
                <span className="premio-emoji">😱</span>
                <span className="name">Seu carrasco</span>
                <span className="lvl">{nomeDe(carrasco.adversario)} · {carrasco.derrotas}D</span>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}

function destaqueDe(premio, emoji, nome) {
  if (!premio?.lider) return null;
  return { emoji, nome, j: premio.lider, v: `${premio.valor}` };
}
