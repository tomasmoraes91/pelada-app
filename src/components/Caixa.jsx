// ============================================================
// CAIXA — saldo + cobrança de mensalistas e diaristas + lançamentos.
// ============================================================
import { useEffect, useState } from "react";
import { useAuth, papelDoUsuario } from "../context/AuthContext";
import {
  getCaixa, lancarCaixa, setConfigPelada, ouvirSessao,
  cobrarJogadorMes, marcarPagoMes, desmarcarPagoMes, virarMes,
  setDiariaPaga, addDiaristaAvulso,
} from "../lib/data";

const mesAtualStr = () => new Date().toISOString().slice(0, 7);

export default function Caixa({ pelada, jogadores, sessaoId, recarregar, recarregarPelada }) {
  const { user } = useAuth();
  const papel = papelDoUsuario(pelada, user?.uid);
  const ehGestor = papel === "presidente" || papel === "admin";

  const mesCobranca = pelada.mesCobranca || mesAtualStr();
  const [caixa, setCaixa] = useState(null);
  const [sessao, setSessao] = useState(null);
  const [tipo, setTipo] = useState("entrada");
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState("");
  const [buscaDia, setBuscaDia] = useState("");

  async function recarregarCaixa() { setCaixa(await getCaixa(pelada.id, mesCobranca)); }
  useEffect(() => { recarregarCaixa(); }, [pelada.id, mesCobranca]);
  useEffect(() => {
    if (!sessaoId) { setSessao(null); return; }
    return ouvirSessao(pelada.id, sessaoId, setSessao);
  }, [pelada.id, sessaoId]);

  const aprovados = jogadores.filter((j) => j.status === "aprovado");
  const mensalistas = aprovados.filter((j) => j.mensalista);
  const stDe = (j) => j.mensalidades?.[mesCobranca]?.st;
  const valDe = (j) => j.mensalidades?.[mesCobranca]?.v || pelada.valorMensalidade || 0;
  const pagos = mensalistas.filter((j) => stDe(j) === "pago");
  const devedores = mensalistas.filter((j) => stDe(j) === "cobrado");
  const recebido = pagos.reduce((s, j) => s + valDe(j), 0);
  const aReceber = devedores.reduce((s, j) => s + valDe(j), 0);

  const sessaoAberta = sessao && sessao.status !== "encerrada";
  const pagasSet = new Set(sessao?.diaristasPagos || []);
  const presentes = sessao?.presencaConfirmada || [];
  const convidados = sessao?.convidados || {};
  const avulsos = sessao?.diariasAvulsas || [];
  // Candidatos à diária: não-mensalistas presentes + convidados do sorteio + avulsos.
  // Todos entram DEVENDO; só viram "pago" quando o gestor valida.
  const candidatosDia = [
    ...aprovados.filter((j) => !j.mensalista && presentes.includes(j.id)).map((j) => ({ id: j.id, nome: j.nome })),
    ...Object.entries(convidados).map(([id, c]) => ({ id, nome: `${c.nome} (conv.)` })),
    ...avulsos.map((a) => ({ id: a.id, nome: `${a.nome} (avulso)` })),
  ].sort((a, b) => (pagasSet.has(a.id) ? 1 : 0) - (pagasSet.has(b.id) ? 1 : 0)); // devendo primeiro
  const diariasRecebidas = candidatosDia.filter((c) => pagasSet.has(c.id)).length * (pelada.valorDiaria || 0);

  async function cicloMensalidade(j) {
    const st = stDe(j);
    if (!st) {
      const v = pelada.valorMensalidade || 0;
      if (v <= 0) { window.alert("Defina o valor da mensalidade."); return; }
      await cobrarJogadorMes(pelada.id, j.id, mesCobranca, v);
    } else if (st === "cobrado") {
      await marcarPagoMes(pelada.id, j.id, mesCobranca);
      await lancarCaixa(pelada.id, mesCobranca, { tipo: "entrada", descricao: `Mensalidade · ${j.nome}`, valor: valDe(j) });
    } else {
      if (!window.confirm("Desfazer o pagamento? Lança um estorno no caixa.")) return;
      await desmarcarPagoMes(pelada.id, j.id, mesCobranca);
      await lancarCaixa(pelada.id, mesCobranca, { tipo: "saida", descricao: `Estorno mensalidade · ${j.nome}`, valor: valDe(j) });
    }
    recarregar?.(); recarregarCaixa();
  }

  async function virarOMes() {
    const [a, m] = mesCobranca.split("-").map(Number);
    const prox = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
    if (!window.confirm(`Virar para ${prox}? Os pagamentos do novo mês começam zerados (o histórico fica salvo).`)) return;
    await virarMes(pelada.id, prox);
    await recarregarPelada?.();
  }

  // Marca a diária como PAGA (validação do gestor) e lança no caixa. Ou desfaz.
  async function marcarPagoDiaria(c) {
    const v = pelada.valorDiaria || 0;
    if (pagasSet.has(c.id)) {
      if (!window.confirm("Desfazer o pagamento da diária? Lança um estorno no caixa.")) return;
      await setDiariaPaga(pelada.id, sessaoId, c.id, false);
      if (v > 0) await lancarCaixa(pelada.id, mesCobranca, { tipo: "saida", descricao: `Estorno diária · ${c.nome}`, valor: v });
    } else {
      if (v <= 0) { window.alert("Defina o valor da diária."); return; }
      await setDiariaPaga(pelada.id, sessaoId, c.id, true);
      await lancarCaixa(pelada.id, mesCobranca, { tipo: "entrada", descricao: `Diária · ${c.nome}`, valor: v });
    }
    recarregarCaixa();
  }

  // Adiciona um diarista AVULSO (fora do elenco) — entra devendo.
  async function addAvulso() {
    const nome = buscaDia.trim();
    if (!nome) return;
    await addDiaristaAvulso(pelada.id, sessaoId, nome);
    setBuscaDia("");
  }

  async function lancar() {
    const v = parseFloat(valor);
    if (!desc || !v) return;
    await lancarCaixa(pelada.id, mesCobranca, { tipo, descricao: desc, valor: v });
    setDesc(""); setValor(""); recarregarCaixa();
  }

  const nome = (uid) => aprovados.find((j) => j.id === uid)?.nome || "—";

  if (!caixa) return <div className="empty">Carregando caixa…</div>;
  const saldo = (caixa.totalEntrada || 0) - (caixa.totalSaida || 0);

  return (
    <>
      <div className="card">
        <h2>Caixa — {mesCobranca}</h2>
        <div className="caixa-saldo">
          <div><span className="muted">Entrou</span><b>R$ {(caixa.totalEntrada || 0).toFixed(2)}</b></div>
          <div><span className="muted">Saiu</span><b>R$ {(caixa.totalSaida || 0).toFixed(2)}</b></div>
          <div><span className="muted">Saldo</span>
            <b style={{ color: saldo >= 0 ? "var(--grass)" : "var(--danger)" }}>R$ {saldo.toFixed(2)}</b>
          </div>
        </div>
      </div>

      {/* MENSALISTAS */}
      {ehGestor && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Mensalistas</h2>
            <button className="btn ghost sm" onClick={virarOMes}>Virar o mês →</button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input" style={{ margin: 0, flex: 1, minWidth: 0 }}
              type="number" min="0" step="0.01" placeholder="R$ por mês"
              value={pelada.valorMensalidade ?? ""}
              onChange={async (e) => {
                await setConfigPelada(pelada.id, { valorMensalidade: e.target.value === "" ? null : parseFloat(e.target.value) });
                recarregarPelada?.();
              }}
            />
            <span className="muted" style={{ alignSelf: "center", fontSize: 12, whiteSpace: "nowrap" }}>
              {pagos.length}/{mensalistas.length} · R$ {recebido.toFixed(0)}
            </span>
          </div>
          <div className="list" style={{ marginTop: 8 }}>
            {mensalistas.map((j) => {
              const st = stDe(j);
              return (
                <div className="player" key={j.id}>
                  <span className="name">{j.nome}</span>
                  <button
                    className={`btn sm ${st === "pago" ? "" : st === "cobrado" ? "warn" : "ghost"}`}
                    onClick={() => cicloMensalidade(j)}
                  >
                    {st === "pago" ? "Pago ✓" : st === "cobrado" ? "Pago" : "Cobrar"}
                  </button>
                </div>
              );
            })}
            {mensalistas.length === 0 && <div className="empty">Marque mensalistas no Elenco (💳).</div>}
          </div>
          {aReceber > 0 && (
            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
              A receber: <b style={{ color: "var(--danger)" }}>R$ {aReceber.toFixed(2)}</b>
            </p>
          )}
        </div>
      )}

      {/* DIARISTAS (no dia da pelada) */}
      {ehGestor && sessaoAberta && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Diaristas (hoje)</h2>
            <span className="muted" style={{ fontSize: 12 }}>+ R$ {diariasRecebidas.toFixed(0)}</span>
          </div>
          <p className="muted" style={{ marginTop: -2, marginBottom: 10, fontSize: 12 }}>
            Presentes (não mensalistas), convidados do sorteio e avulsos entram <b>devendo</b>.
            Marque <b>Pago</b> só quando pagar de verdade.
          </p>
          <input
            className="input" style={{ margin: 0 }}
            type="number" min="0" step="0.01" placeholder="R$ diária"
            value={pelada.valorDiaria ?? ""}
            onChange={async (e) => {
              await setConfigPelada(pelada.id, { valorDiaria: e.target.value === "" ? null : parseFloat(e.target.value) });
              recarregarPelada?.();
            }}
          />
          <div className="list" style={{ marginTop: 10 }}>
            {candidatosDia.map((c) => {
              const pago = pagasSet.has(c.id);
              return (
                <div className="player" key={c.id}>
                  <span className="name">{c.nome}</span>
                  <button
                    className={`btn sm ${pago ? "" : "warn"}`}
                    onClick={() => marcarPagoDiaria(c)}
                  >
                    {pago ? "Pago ✓" : "Marcar pago"}
                  </button>
                </div>
              );
            })}
            {candidatosDia.length === 0 && (
              <div className="empty">Ninguém ainda. Convidados do sorteio e avulsos aparecem aqui.</div>
            )}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <input
              className="input" style={{ margin: 0, flex: 1, minWidth: 0 }}
              placeholder="Nome do diarista avulso"
              value={buscaDia}
              onChange={(e) => setBuscaDia(e.target.value)}
            />
            <button
              className="btn ghost" style={{ flex: "0 0 auto", width: "auto" }}
              disabled={!buscaDia.trim()}
              onClick={addAvulso}
            >
              + Avulso
            </button>
          </div>
        </div>
      )}

      {/* LANÇAMENTOS / EXTRATO */}
      <div className="card">
        <h2>Lançamentos</h2>
        <div className="list" style={{ marginTop: 4 }}>
          {[...(caixa.entradas || []).map((e) => ({ ...e, t: "entrada" })),
            ...(caixa.saidas || []).map((e) => ({ ...e, t: "saida" }))]
            .sort((a, b) => b.em - a.em)
            .map((it, i) => (
              <div className="player" key={i}>
                <span className="name">{it.descricao}</span>
                <span className="lvl" style={{ color: it.t === "entrada" ? "var(--grass)" : "var(--danger)" }}>
                  {it.t === "entrada" ? "+" : "−"} R$ {it.valor.toFixed(2)}
                </span>
              </div>
            ))}
          {(caixa.entradas || []).length + (caixa.saidas || []).length === 0 && (
            <div className="empty">Sem lançamentos neste mês.</div>
          )}
        </div>

        {ehGestor && (
          <div style={{ marginTop: 14 }}>
            <div className="row" style={{ gap: 8, marginBottom: 8 }}>
              <button className={`btn sm ${tipo === "entrada" ? "" : "ghost"}`} onClick={() => setTipo("entrada")}>Entrada</button>
              <button className={`btn sm ${tipo === "saida" ? "warn" : "ghost"}`} onClick={() => setTipo("saida")}>Saída</button>
            </div>
            <input className="input" placeholder="Descrição (ex: aluguel quadra)"
              value={desc} onChange={(e) => setDesc(e.target.value)} />
            <input className="input" type="number" placeholder="Valor R$"
              value={valor} onChange={(e) => setValor(e.target.value)} />
            <button className="btn" onClick={lancar}>Lançar</button>
          </div>
        )}
      </div>
    </>
  );
}
