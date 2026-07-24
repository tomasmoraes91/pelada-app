// ============================================================
// EDITOR DE HABILIDADES (para quem pode avaliar)
// Mostra os controles conforme a config da pelada (tipo + escala)
// e salva tudo de uma vez (1 escrita só, anti-custo).
// ============================================================
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { setMinhaAvaliacao } from "../lib/data";
import {
  ATRIBUTOS, chavesHabilidade, escalaMax, valorPadrao, limitar,
} from "../lib/habilidades";

export default function EditorHabilidades({ pelada, jogador, onSalvo }) {
  const { user } = useAuth();
  const tipo = pelada.configHabilidadeTipo || "detalhada";
  const escala = pelada.configHabilidadeEscala || "estrelas";
  const chaves = chavesHabilidade(tipo);

  // Carrega a MINHA avaliação anterior sobre este jogador (se houver).
  const [draft, setDraft] = useState(() => {
    const minha = jogador.avaliacoes?.[user?.uid] || {};
    const base = {};
    chaves.forEach((k) => {
      base[k] = minha[k] != null ? limitar(minha[k], escala) : valorPadrao(escala);
    });
    return base;
  });
  const [salvando, setSalvando] = useState(false);

  const rotulos = tipo === "simples"
    ? { geral: "Nota geral" }
    : Object.fromEntries(ATRIBUTOS.map((a) => [a.key, a.nome]));

  function mudar(k, v) {
    setDraft((d) => ({ ...d, [k]: limitar(v, escala) }));
  }

  async function salvar() {
    setSalvando(true);
    await setMinhaAvaliacao(pelada.id, jogador.id, user.uid, draft);
    setSalvando(false);
    onSalvo?.();
  }

  return (
    <div className="card hab-editor">
      <h2>Avaliar — {jogador.nome}</h2>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
        Sua nota entra na média com a dos outros avaliadores.
      </p>
      <div className="list">
        {chaves.map((k) => (
          <div className="hab-edit-row" key={k}>
            <span className="lab">{rotulos[k]}</span>
            {escala === "estrelas" ? (
              <Estrelas valor={draft[k]} onChange={(v) => mudar(k, v)} />
            ) : (
              <>
                <input
                  type="range" min="0" max={escalaMax(escala)} value={draft[k]}
                  onChange={(e) => mudar(k, e.target.value)}
                  style={{ flex: 1 }}
                />
                <span className="val">{draft[k]}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar avaliação"}
      </button>
    </div>
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
