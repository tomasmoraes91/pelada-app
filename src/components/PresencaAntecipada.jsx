// ============================================================
// PRESENÇA ANTECIPADA — confirmar "Vou / Não vou" ANTES do jogo.
// É separada da ordem de chegada (não mexe na fila nem no sorteio).
// Tem nº de vagas: quem confirma acima do limite entra na lista de espera.
// Reutilizável: recebe a sessão pronta (prop `sessao`) ou assina pelo id.
// ============================================================
import { useEffect, useState } from "react";
import { useAuth, papelDoUsuario } from "../context/AuthContext";
import { ouvirSessao, confirmarAntecipada } from "../lib/data";

export default function PresencaAntecipada({ pelada, sessaoId, sessao: sessaoProp, jogadores }) {
  const { user } = useAuth();
  const [sessaoLocal, setSessaoLocal] = useState(null);
  const sessao = sessaoProp ?? sessaoLocal;
  const papel = papelDoUsuario(pelada, user?.uid);
  const ehGestor = papel === "presidente" || papel === "admin";

  useEffect(() => {
    if (sessaoProp || !sessaoId) return;
    return ouvirSessao(pelada.id, sessaoId, setSessaoLocal);
  }, [pelada.id, sessaoId, sessaoProp]);

  if (!sessao || sessao.status === "encerrada") return null;
  const id = sessao.id || sessaoId;

  const nome = (uid) => jogadores.find((j) => j.id === uid)?.nome || "—";
  const vou = sessao.presencaAntecipada || [];
  const nao = sessao.naoVou || [];
  const vagas = pelada.vagas ?? null; // definido pelo presidente no Admin
  const confirmados = vagas != null ? vou.slice(0, vagas) : vou;
  const espera = vagas != null ? vou.slice(vagas) : [];
  const meuStatus = vou.includes(user?.uid) ? "vou" : nao.includes(user?.uid) ? "nao" : null;
  const souDoElenco = ehGestor || jogadores.some((j) => j.id === user?.uid && j.status === "aprovado");

  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Vai jogar? ⚽</h2>
        <span className="muted">
          {vou.length}{vagas != null ? `/${vagas}` : ""} confirmados
        </span>
      </div>
      <p className="muted" style={{ marginTop: 6, marginBottom: 12, fontSize: 12 }}>
        Confirmação antecipada — não vale como ordem de chegada.
        {vagas != null && " Acima das vagas entra na lista de espera."}
      </p>

      {souDoElenco && (
        <div className="row" style={{ gap: 8 }}>
          <button
            className={`btn ${meuStatus === "vou" ? "" : "ghost"}`} style={{ flex: 1 }}
            onClick={() => confirmarAntecipada(pelada.id, id, user.uid, meuStatus === "vou" ? null : true)}
          >
            ✅ Vou
          </button>
          <button
            className={`btn ${meuStatus === "nao" ? "warn" : "ghost"}`} style={{ flex: 1 }}
            onClick={() => confirmarAntecipada(pelada.id, id, user.uid, meuStatus === "nao" ? null : false)}
          >
            ❌ Não vou
          </button>
        </div>
      )}

      {confirmados.length > 0 && (
        <div className="list" style={{ marginTop: 12 }}>
          {confirmados.map((uid, i) => (
            <div className="player" key={uid}>
              <span className="num">{i + 1}</span>
              <span className="name">{nome(uid)}{uid === user?.uid && " (você)"}</span>
            </div>
          ))}
        </div>
      )}

      {espera.length > 0 && (
        <>
          <p className="muted" style={{ margin: "12px 0 8px" }}>Lista de espera</p>
          <div className="list">
            {espera.map((uid, i) => (
              <div className="player" key={uid}>
                <span className="num" style={{ color: "var(--muted)" }}>{vagas + i + 1}</span>
                <span className="name">{nome(uid)}{uid === user?.uid && " (você)"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {nao.length > 0 && (
        <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          Não vão: {nao.map(nome).join(", ")}
        </p>
      )}

      {vou.length === 0 && nao.length === 0 && (
        <div className="empty" style={{ marginTop: 8 }}>Ninguém confirmou ainda. Seja o primeiro!</div>
      )}
    </div>
  );
}
