import { useState } from "react";
import { criarPelada, buscarPeladas } from "../lib/data";

// Tela pós-login: o usuário cria a própria pelada ou busca/entra em uma
// existente (por nome ou pelo código). Ao escolher, chama onSelecionar(id);
// o App carrega a pelada e o fluxo de aprovação cuida do resto.
export default function SeletorPelada({ uid, onSelecionar }) {
  const [aba, setAba] = useState("entrar"); // "entrar" | "criar"

  return (
    <div className="app">
      <div className="center-screen">
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div className="brand" style={{ justifyContent: "center", fontSize: 28, marginBottom: 20 }}>
            <span className="dot" /> Pelada
          </div>

          <div className="row" style={{ gap: 8, marginBottom: 16 }}>
            <button
              className={`btn ${aba === "entrar" ? "" : "ghost"} sm`}
              style={{ flex: 1 }}
              onClick={() => setAba("entrar")}
            >
              Entrar numa pelada
            </button>
            <button
              className={`btn ${aba === "criar" ? "" : "ghost"} sm`}
              style={{ flex: 1 }}
              onClick={() => setAba("criar")}
            >
              Criar pelada
            </button>
          </div>

          {aba === "entrar"
            ? <Buscar onSelecionar={onSelecionar} />
            : <Criar uid={uid} onSelecionar={onSelecionar} />}
        </div>
      </div>
    </div>
  );
}

function Buscar({ onSelecionar }) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function buscar(e) {
    e.preventDefault();
    if (!termo.trim()) return;
    setCarregando(true);
    setErro("");
    try {
      setResultados(await buscarPeladas(termo));
    } catch {
      setErro("Não foi possível buscar agora. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="card">
      <form className="row" style={{ gap: 8 }} onSubmit={buscar}>
        <input
          className="input"
          style={{ flex: 1, margin: 0 }}
          placeholder="Nome ou código da pelada"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <button className="btn sm" disabled={carregando}>
          {carregando ? "..." : "Buscar"}
        </button>
      </form>

      {erro && <p className="muted" style={{ marginTop: 12 }}>{erro}</p>}

      {resultados && (
        <div className="list" style={{ marginTop: 12 }}>
          {resultados.map((p) => (
            <div className="player" key={p.id}>
              <span className="name">{p.nome || p.id}</span>
              <span className="muted" style={{ fontSize: 12 }}>{p.id}</span>
              <button className="btn sm" onClick={() => onSelecionar(p.id)}>Entrar</button>
            </div>
          ))}
          {resultados.length === 0 && (
            <div className="empty">Nenhuma pelada encontrada.</div>
          )}
        </div>
      )}
    </div>
  );
}

function Criar({ uid, onSelecionar }) {
  const [nome, setNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  async function criar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setCriando(true);
    setErro("");
    try {
      const id = await criarPelada({ nome }, uid);
      onSelecionar(id);
    } catch {
      setErro("Não foi possível criar agora. Tente de novo.");
      setCriando(false);
    }
  }

  return (
    <div className="card">
      <form onSubmit={criar}>
        <p className="muted" style={{ marginBottom: 12 }}>
          Você vira o presidente e recebe um código para compartilhar com a galera.
        </p>
        <input
          className="input"
          placeholder="Nome da pelada (ex: Pelada de quarta)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <button className="btn" disabled={criando} style={{ marginTop: 12, width: "100%" }}>
          {criando ? "Criando..." : "Criar pelada"}
        </button>
        {erro && <p className="muted" style={{ marginTop: 12 }}>{erro}</p>}
      </form>
    </div>
  );
}
