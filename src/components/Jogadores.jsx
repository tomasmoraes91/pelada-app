import { useState } from "react";
import { useAuth, papelDoUsuario, podeEditarNiveis } from "../context/AuthContext";
import {
  forcaJogador, overall, mediaAvaliacoes, temAvaliacao,
} from "../lib/habilidades";
import { removerJogador, definirAdmin, setMensalista } from "../lib/data";
import EditorHabilidades from "./EditorHabilidades";

export default function Jogadores({ pelada, jogadores, recarregar, onAbrirJogador }) {
  const { user } = useAuth();
  const papel = papelDoUsuario(pelada, user?.uid);
  const podeAvaliar = podeEditarNiveis(pelada, papel);
  const ehGestor = papel === "presidente" || papel === "admin";
  const [avaliando, setAvaliando] = useState(null); // uid em avaliação
  const [ordem, setOrdem] = useState("ovr");        // "ovr" | "alfabetica"
  const [filtro, setFiltro] = useState("todos");    // "todos" | "mensalistas"

  // Gestor remove um jogador do elenco (ex: desistiu da pelada).
  async function remover(j) {
    if (!window.confirm(`Remover ${j.nome} do elenco? As estatísticas dele serão apagadas.`)) return;
    await removerJogador(pelada.id, j.id);
    if ((pelada.adminUids || []).includes(j.id)) await definirAdmin(pelada.id, j.id, false);
    recarregar();
  }

  async function toggleMensalista(j) {
    await setMensalista(pelada.id, j.id, !j.mensalista);
    recarregar();
  }

  const tipo = pelada.configHabilidadeTipo || "detalhada";
  const aprovados = jogadores
    .filter((j) => j.status === "aprovado")
    .filter((j) => filtro === "todos" || j.mensalista)
    .sort((a, b) =>
      ordem === "alfabetica"
        ? (a.nome || "").localeCompare(b.nome || "")
        : forcaJogador(b, pelada) - forcaJogador(a, pelada)
    );

  function ovrTexto(j) {
    const av = j.avaliacoes || {};
    return temAvaliacao(av) ? overall(mediaAvaliacoes(av, tipo), tipo) : "—";
  }

  return (
    <>
      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Elenco ({aprovados.length})</h2>
          <div className="row" style={{ gap: 6 }}>
            <button
              className={`btn sm ${ordem === "ovr" ? "" : "ghost"}`}
              onClick={() => setOrdem("ovr")}
            >
              OVR
            </button>
            <button
              className={`btn sm ${ordem === "alfabetica" ? "" : "ghost"}`}
              onClick={() => setOrdem("alfabetica")}
            >
              A–Z
            </button>
          </div>
        </div>
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <button
            className={`btn sm ${filtro === "todos" ? "" : "ghost"}`}
            onClick={() => setFiltro("todos")}
          >
            Todos
          </button>
          <button
            className={`btn sm ${filtro === "mensalistas" ? "" : "ghost"}`}
            onClick={() => setFiltro("mensalistas")}
          >
            💳 Mensalistas
          </button>
        </div>

        <div className="list">
          {aprovados.map((j) => (
            <div key={j.id}>
              <div className="player">
                <button className="name name-link" onClick={() => onAbrirJogador?.(j.id)}>
                  {j.nome}{j.mensalista && <span title="Mensalista"> 💳</span>}
                </button>
                <span className="ovr-badge" title="OVR (média das avaliações)">
                  {ovrTexto(j)}
                </span>
                {ehGestor && (
                  <button
                    className={`btn sm ${j.mensalista ? "warn" : "ghost"}`}
                    title="Mensalista (paga mensalidade)"
                    onClick={() => toggleMensalista(j)}
                  >
                    💳
                  </button>
                )}
                {podeAvaliar && j.id !== user?.uid && (
                  <button
                    className={`btn sm ${avaliando === j.id ? "warn" : "ghost"}`}
                    onClick={() => setAvaliando(avaliando === j.id ? null : j.id)}
                  >
                    {avaliando === j.id ? "Fechar" : "Avaliar"}
                  </button>
                )}
                {ehGestor && j.id !== pelada.presidenteUid && (
                  <button className="btn danger sm" title="Remover do elenco" onClick={() => remover(j)}>
                    ✕
                  </button>
                )}
              </div>
              {podeAvaliar && j.id !== user?.uid && avaliando === j.id && (
                <EditorHabilidades
                  pelada={pelada}
                  jogador={j}
                  onSalvo={() => { setAvaliando(null); recarregar(); }}
                />
              )}
            </div>
          ))}
          {aprovados.length === 0 && <div className="empty">Sem jogadores ainda.</div>}
        </div>
      </div>
    </>
  );
}
