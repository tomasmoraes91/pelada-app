// ============================================================
// VOTAÇÃO — cada presente dá 1–5 estrelas aos outros presentes.
// O melhor e o pior só são revelados quando a votação encerra:
// 24h após a abertura da pelada OU quando todos os presentes votam.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ouvirSessao, getResumoVotacao, salvarVotacao } from "../lib/data";
import { mvpDoDia } from "../lib/premios";

const PRAZO_MS = 24 * 60 * 60 * 1000;

export default function Votacao({ pelada, jogadores, sessaoId }) {
  const { user } = useAuth();
  const [sessao, setSessao] = useState(null);
  const [votos, setVotos] = useState(null);   // { votanteUid: { alvoUid: nota } }
  const [draft, setDraft] = useState({});
  const [salvando, setSalvando] = useState(false);

  const nome = useMemo(() => {
    const m = {};
    jogadores.forEach((j) => (m[j.id] = j));
    return (uid) => m[uid]?.nome || "—";
  }, [jogadores]);

  useEffect(() => {
    if (!sessaoId) return;
    const unsub = ouvirSessao(pelada.id, sessaoId, setSessao);
    getResumoVotacao(pelada.id, sessaoId).then((r) => {
      const v = r?.votos || {};
      setVotos(v);
      setDraft(v[user?.uid] || {});
    });
    return unsub;
  }, [pelada.id, sessaoId, user?.uid]);

  if (!sessaoId || !sessao || votos === null)
    return <div className="empty">Abra uma pelada para votar.</div>;

  const presentes = (sessao.presencaConfirmada || [])
    .map((uid) => jogadores.find((j) => j.id === uid))
    .filter(Boolean);
  const presentesIds = presentes.map((p) => p.id);
  const alvos = presentes.filter((p) => p.id !== user?.uid); // não vota em si
  const souPresente = presentesIds.includes(user?.uid);

  // Encerramento: 24h após abrir OU todos os presentes já votaram.
  const abertaEm = sessao.data?.toDate ? sessao.data.toDate().getTime() : null;
  const expirou = abertaEm ? Date.now() > abertaEm + PRAZO_MS : false;
  const votaram = presentesIds.filter((uid) => votos[uid]).length;
  const todosVotaram = presentesIds.length > 0 && votaram >= presentesIds.length;
  const revelar = expirou || todosVotaram;

  // Médias (só usadas na revelação).
  const medias = presentes
    .map((p) => {
      const notas = Object.values(votos)
        .map((v) => v?.[p.id])
        .filter((n) => typeof n === "number");
      return { jogador: p, media: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null, n: notas.length };
    })
    .filter((x) => x.media != null);
  const ranking = [...medias].sort((a, b) => b.media - a.media);
  const melhor = ranking[0];
  const pior = ranking[ranking.length - 1];
  const mvp = mvpDoDia(sessao, jogadores); // melhor por DADOS (não é o votado)

  async function enviar() {
    setSalvando(true);
    await salvarVotacao(pelada.id, sessaoId, user.uid, draft);
    const r = await getResumoVotacao(pelada.id, sessaoId);
    setVotos(r?.votos || {});
    setSalvando(false);
  }

  return (
    <>
      <div className="card">
        <h2>Votação da pelada ⭐</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          {revelar
            ? "Votação encerrada."
            : `${votaram} de ${presentesIds.length} presentes votaram · encerra em 24h ou quando todos votarem.`}
        </p>
      </div>

      {/* MVP por dados — sai na hora, independente da votação (Craque). */}
      {mvp && (
        <div className="card">
          <h2>MVP do dia 🌟</h2>
          <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
            Por dados: gol = 3, assistência = 2, desarme = 1, vitória = 2.
          </p>
          <div className="player">
            <span className="premio-emoji">🌟</span>
            <span className="name">{mvp.nome}</span>
            <span className="lvl">{mvp.score} pts</span>
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            {mvp.gols}⚽ {mvp.assist}🅰 {mvp.desarmes}🛡 · {mvp.vitorias} vitórias no dia
          </p>
        </div>
      )}

      {revelar ? (
        <>
          <div className="card">
            <h2>Resultado 🏆</h2>
            {melhor ? (
              <div className="list">
                <div className="player">
                  <span className="premio-emoji">🏆</span>
                  <span className="name">Craque da galera: {melhor.jogador.nome}</span>
                  <span className="lvl">{melhor.media.toFixed(1)}⭐</span>
                </div>
                {pior && pior.jogador.id !== melhor.jogador.id && (
                  <div className="player">
                    <span className="premio-emoji">🥶</span>
                    <span className="name">Pereba: {pior.jogador.nome}</span>
                    <span className="lvl">{pior.media.toFixed(1)}⭐</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty">Ninguém votou nesta pelada.</div>
            )}
          </div>

          {ranking.length > 0 && (
            <div className="card">
              <h2>Notas da galera</h2>
              <div className="list">
                {ranking.map((r, i) => (
                  <div className="player" key={r.jogador.id}>
                    <span className="num">{i + 1}</span>
                    <span className="name">{r.jogador.nome}</span>
                    <span className="lvl">{r.media.toFixed(1)}⭐ ({r.n})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : !souPresente ? (
        <div className="card">
          <p className="muted">Só quem esteve presente nesta pelada pode votar.</p>
        </div>
      ) : (
        <div className="card">
          <h2>Dê sua nota</h2>
          <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
            {votos[user?.uid] ? "Você já votou — pode revisar e salvar de novo." : "Avalie cada um de 1 a 5 estrelas."}
          </p>
          <div className="list">
            {alvos.map((p) => (
              <div className="hab-edit-row" key={p.id}>
                <span className="lab">{p.nome}</span>
                <Estrelas
                  valor={draft[p.id] || 0}
                  onChange={(n) => setDraft((d) => ({ ...d, [p.id]: n }))}
                />
              </div>
            ))}
            {alvos.length === 0 && <div className="empty">Sem outros presentes para avaliar.</div>}
          </div>
          {alvos.length > 0 && (
            <button className="btn" style={{ marginTop: 12 }} onClick={enviar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar votos"}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Estrelas({ valor, onChange }) {
  return (
    <span className="stars-edit">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= valor ? "on" : ""}`}
          onClick={() => onChange(n === valor ? n - 1 : n)}
          aria-label={`${n} estrelas`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
