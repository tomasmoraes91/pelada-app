// ============================================================
// AJUSTES — só o presidente. Centraliza:
//  - escolha de admins
//  - quem pode avaliar (níveis) e quem vê o caixa
//  - link de convite
// ============================================================
import { useState } from "react";
import {
  setConfigPelada, definirAdmin, aprovarJogador, removerJogador,
  oferecerPresidencia, cancelarTransferencia, listarSessoesPeriodo, encerrarTemporada,
  zerarEstatisticas,
} from "../lib/data";
import { inicioPeriodo, agregarPeriodo, premiosPeriodo } from "../lib/fechamento";
import MapaPicker from "./MapaPicker";

const OPCOES = [
  { v: "presidente", l: "Só presidente" },
  { v: "admins", l: "Presidente + admins" },
  { v: "todos", l: "Todos os jogadores" },
];

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];


const OPCOES_TIPO = [
  { v: "simples", l: "Simples (1 nota geral)" },
  { v: "detalhada", l: "Detalhada (6 atributos)" },
];

const OPCOES_ESCALA = [
  { v: "estrelas", l: "Estrelas (1 a 5)" },
  { v: "numero", l: "Número (0 a 99)" },
];

const OPCOES_SEQ = [
  { v: "ambos", l: "Saem os dois (como empate)" },
  { v: "soVencedor", l: "Sai só o vencedor" },
];

const OPCOES_PARTIDAS = [
  { v: "admins", l: "Presidente + admins" },
  { v: "todos", l: "Todos os jogadores" },
];

const OPCOES_CAIXA = [
  { v: "presidente", l: "Só o presidente" },
  { v: "admins", l: "Presidente + admins" },
];

const OPCOES_FORMACAO = [
  { v: "chegada", l: "Ordem de chegada" },
  { v: "sorteio", l: "Sorteio equilibrado (times fixos)" },
  { v: "sorteioChegada", l: "Sorteio de quem chegou no horário + chegada" },
];

export default function Ajustes({
  pelada, jogadores, recarregar, recarregarPelada,
  sessaoAberta, onAbrirConfirmacao, onEncerrarPelada,
}) {
  const pendentes = jogadores.filter((j) => j.status === "pendente");
  const aprovados = jogadores.filter((j) => j.status === "aprovado");
  const adminUids = pelada.adminUids || [];
  const [addAdmin, setAddAdmin] = useState(false);
  const [buscaAdmin, setBuscaAdmin] = useState("");
  const [encerrando, setEncerrando] = useState(false);
  const anoAtual = new Date().getFullYear();

  const admins = aprovados.filter((j) => adminUids.includes(j.id));
  const elegiveisAdmin = aprovados.filter(
    (j) => j.id !== pelada.presidenteUid && !adminUids.includes(j.id)
      && j.nome.toLowerCase().includes(buscaAdmin.trim().toLowerCase())
  );

  async function mudarConfig(campo, valor) {
    await setConfigPelada(pelada.id, { [campo]: valor });
    await recarregarPelada();
  }

  // Encerra a temporada do ano: coroa os campeões no Hall da Fama e zera os pontos.
  async function encerrarAno() {
    if (!window.confirm(
      `Encerrar a temporada ${anoAtual}? Os campeões vão pro Hall da Fama e os pontos zeram. Faça isso depois do último jogo do ano.`
    )) return;
    setEncerrando(true);
    try {
      const desde = inicioPeriodo("ano");
      const sessoes = await listarSessoesPeriodo(pelada.id, desde);
      const p = premiosPeriodo(agregarPeriodo(sessoes, jogadores, desde), jogadores);
      const top = [...aprovados].sort((a, b) => (b.pontosTemporada || 0) - (a.pontosTemporada || 0))[0];
      const campeoes = {
        pontos: top?.pontosTemporada > 0 ? { nome: top.nome, valor: top.pontosTemporada } : null,
        artilheiro: p.artilheiro,
        garcom: p.garcom,
        xerife: p.xerife,
        muralha: p.muralha,
      };
      await encerrarTemporada(pelada.id, anoAtual, campeoes, aprovados.map((j) => j.id));
      await recarregar();
      window.alert(`Temporada ${anoAtual} encerrada! Confira o Hall da Fama na aba Estatísticas.`);
    } finally {
      setEncerrando(false);
    }
  }

  async function toggleAdmin(uid, ehAdmin) {
    await definirAdmin(pelada.id, uid, ehAdmin);
    await recarregarPelada();
  }

  async function oferecer(uid) {
    await oferecerPresidencia(pelada.id, uid);
    await recarregarPelada();
  }
  async function cancelar() {
    await cancelarTransferencia(pelada.id);
    await recarregarPelada();
  }

  function abrirConfirmacao() {
    if (window.confirm(
      "Abrir a confirmação da próxima pelada? A galera poderá marcar Vou / Não vou e o dia de jogo fica disponível."
    )) onAbrirConfirmacao?.();
  }
  function encerrarPelada() {
    if (window.confirm(
      "Encerrar a pelada? Fecha a confirmação e o dia de jogo (a votação continua disponível). Não dá pra reabrir a mesma."
    )) onEncerrarPelada?.();
  }

  async function aprovar(uid) { await aprovarJogador(pelada.id, uid); recarregar(); }
  async function recusar(uid) { await removerJogador(pelada.id, uid); recarregar(); }

  async function zerarStats() {
    if (!window.confirm(
      "ZERAR todas as estatísticas (gols, jogos, vitórias, freguesia, parcerias) de TODOS os jogadores? Use só para limpar testes. Não dá pra desfazer."
    )) return;
    await zerarEstatisticas(pelada.id, aprovados.map((j) => j.id));
    await recarregar();
    window.alert("Estatísticas zeradas.");
  }

  return (
    <>
      <div className="card" style={{ borderColor: sessaoAberta ? "var(--grass-dim)" : "var(--ball-dim)" }}>
        <h2>Dia de jogo</h2>
        {sessaoAberta ? (
          <>
            <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
              ✅ <b>Aberta</b> — a galera confirma presença (Vou / Não vou) e o dia de jogo está rolando.
            </p>
            <button className="btn danger" onClick={encerrarPelada}>Encerrar a pelada</button>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
              🔒 <b>Fechada</b>. Abra a confirmação para a galera dizer se vai à próxima pelada
              (ainda sem contar pontualidade — isso é na chegada, 1h antes).
            </p>
            <button className="btn" onClick={abrirConfirmacao}>Abrir confirmação</button>
          </>
        )}
      </div>

      <ConviteCard pelada={pelada} />

      <div className="card">
        <h2>Convidados ({pendentes.length})</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Aceite ou recuse quem pediu para entrar.
        </p>
        <div className="list">
          {pendentes.map((j) => (
            <div className="player" key={j.id}>
              <span className="name">{j.nome}</span>
              <button className="btn sm" onClick={() => aprovar(j.id)}>Aceitar</button>
              <button className="btn danger sm" onClick={() => recusar(j.id)}>Recusar</button>
            </div>
          ))}
          {pendentes.length === 0 && <div className="empty">Ninguém aguardando.</div>}
        </div>
      </div>

      <div className="card">
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          💰 Mensalistas, diaristas e caixa agora ficam no botão <b>Caixa</b> (no topo).
        </p>
      </div>

      <div className="card">
        <h2>Dia e horário da pelada</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Se a pelada é fixa, aparece no topo (ex: QUA 19:00).
        </p>
        <div className="row" style={{ gap: 8 }}>
          <select
            className="input" style={{ margin: 0, flex: 1 }}
            value={pelada.diaSemana ?? ""}
            onChange={(e) =>
              mudarConfig("diaSemana", e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">—</option>
            {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <input
            className="input" style={{ margin: 0, flex: 1 }}
            type="time"
            value={pelada.horario || ""}
            onChange={(e) => mudarConfig("horario", e.target.value || null)}
          />
        </div>
        <p className="muted" style={{ margin: "12px 0 8px" }}>
          Tolerância de pontualidade (min após o horário)
        </p>
        <input
          className="input" style={{ margin: 0 }}
          type="number" min="0" max="60"
          value={pelada.toleranciaMin ?? 10}
          onChange={(e) =>
            mudarConfig("toleranciaMin", e.target.value === "" ? 10 : Number(e.target.value))
          }
        />
        <p className="muted" style={{ margin: "12px 0 8px" }}>
          Avisar para abrir a confirmação (dia e hora — ex: Seg 12:00)
        </p>
        <div className="row" style={{ gap: 8 }}>
          <select
            className="input" style={{ margin: 0, flex: 1 }}
            value={pelada.confirmacaoDiaSemana ?? ""}
            onChange={(e) =>
              mudarConfig("confirmacaoDiaSemana", e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">—</option>
            {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <input
            className="input" style={{ margin: 0, flex: 1 }}
            type="time"
            value={pelada.confirmacaoHorario || ""}
            onChange={(e) => mudarConfig("confirmacaoHorario", e.target.value || null)}
          />
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Nesse dia/hora, você (e os admins) recebem um aviso para abrir a confirmação
          (botão <b>Abrir confirmação</b>). Só depois disso a galera diz se vai.
          A fila de chegada (que monta o sorteio) abre sempre <b>1h antes do jogo</b>.
        </p>
      </div>

      <div className="card">
        <h2>Formato do jogo</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Jogadores por time (5 = futsal/quadra, 7 = society, 11 = campo) e duração de cada
          partida (o cronômetro apita no fim).
        </p>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
              {pelada.goleiroDedicado ? "Jogadores de linha por time" : "Jogadores por time"}
            </p>
            <input
              className="input" style={{ margin: 0 }}
              type="number" min="1" max="11"
              value={pelada.jogadoresPorTime ?? 5}
              onChange={(e) =>
                mudarConfig("jogadoresPorTime", e.target.value === "" ? 5 : Number(e.target.value))
              }
            />
          </div>
          <div style={{ flex: 1 }}>
            <p className="muted" style={{ marginBottom: 6, fontSize: 12 }}>Duração (min)</p>
            <input
              className="input" style={{ margin: 0 }}
              type="number" min="1" max="90"
              value={pelada.duracaoPartidaMin ?? 10}
              onChange={(e) =>
                mudarConfig("duracaoPartidaMin", e.target.value === "" ? 10 : Number(e.target.value))
              }
            />
          </div>
        </div>

        <p className="muted" style={{ margin: "14px 0 6px", fontSize: 12 }}>
          Vagas na confirmação antecipada (vazio = sem limite; acima entra na lista de espera)
        </p>
        <input
          className="input" style={{ margin: 0 }}
          type="number" min="0" max="100" placeholder="sem limite"
          value={pelada.vagas ?? ""}
          onChange={(e) => mudarConfig("vagas", e.target.value === "" ? null : Number(e.target.value))}
        />

        <p className="muted" style={{ margin: "14px 0 8px" }}>Goleiro</p>
        <button
          className={`btn sm ${pelada.goleiroDedicado ? "warn" : "ghost"}`}
          style={{ width: "100%" }}
          onClick={() => mudarConfig("goleiroDedicado", !pelada.goleiroDedicado)}
        >
          {pelada.goleiroDedicado ? "Goleiro à parte ✓" : "Goleiro entra na conta da linha"}
        </button>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Ligado: cada time é <b>{pelada.jogadoresPorTime ?? 5} na linha + 1 goleiro</b> (ex: futsal).
          O goleiro pode ser fixo ou alguém da fila de espera — quem vai pro gol{" "}
          <b>não perde a vez</b> de jogar na linha.
        </p>
      </div>

      <div className="card">
        <h2>Como formar os times</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Estilo do botão de montar times no dia de jogo.
        </p>
        <Escolha
          opcoes={OPCOES_FORMACAO}
          valor={pelada.modoFormacao || "sorteio"}
          onEscolher={(v) => mudarConfig("modoFormacao", v)}
        />
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          <b>Chegada</b>: times pela ordem que chegaram. <b>Sorteio</b>: equilibra todos em
          times fixos que rodam por vitória. <b>Sorteio + chegada</b>: equilibra os 2 primeiros
          times com quem chegou no horário; o resto entra por ordem de chegada. Em todos, quem
          perde vai pro fim e entra o próximo da fila.
        </p>
      </div>

      <div className="card">
        <h2>Rodízio e sequências</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          No modo rodízio (giro por vitória). Regras definidas por você.
        </p>

        <p className="muted" style={{ marginBottom: 6, fontSize: 12 }}>
          Sequência máxima de vitórias (0 = sem limite)
        </p>
        <input
          className="input" style={{ margin: 0 }}
          type="number" min="0" max="20"
          value={pelada.sequenciaMaxVitorias ?? 0}
          onChange={(e) =>
            mudarConfig("sequenciaMaxVitorias", e.target.value === "" ? 0 : Number(e.target.value))
          }
        />
        {(pelada.sequenciaMaxVitorias ?? 0) > 0 && (
          <>
            <p className="muted" style={{ margin: "12px 0 8px", fontSize: 12 }}>
              Ao bater a sequência, o time campeão:
            </p>
            <Escolha
              opcoes={OPCOES_SEQ}
              valor={pelada.modoSequenciaMax || "ambos"}
              onEscolher={(v) => mudarConfig("modoSequenciaMax", v)}
            />
          </>
        )}

        <p className="muted" style={{ margin: "14px 0 8px" }}>Empate</p>
        <button
          className={`btn sm ${pelada.empateSaemDois ? "warn" : "ghost"}`}
          style={{ width: "100%" }}
          onClick={() => mudarConfig("empateSaemDois", !pelada.empateSaemDois)}
        >
          {pelada.empateSaemDois ? "Saem os dois ✓" : "Perguntar a cada empate"}
        </button>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Ligado: no empate, os dois times descem na ordem e entram os próximos da fila.
        </p>
      </div>

      <LocalEditor pelada={pelada} salvar={(local) => mudarConfig("local", local)} />

      <div className="card">
        <h2>Quem pode avaliar jogadores</h2>
        <Escolha
          valor={pelada.configNiveis || "presidente"}
          onEscolher={(v) => mudarConfig("configNiveis", v)}
        />
      </div>

      <div className="card">
        <h2>Quem pode lançar partidas</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Operar o dia de jogo: gols, empate, sorteio, fim de partida.
        </p>
        <Escolha
          opcoes={OPCOES_PARTIDAS}
          valor={pelada.configPartidas || "admins"}
          onEscolher={(v) => mudarConfig("configPartidas", v)}
        />
      </div>

      <div className="card">
        <h2>Quem vê o caixa</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Quem pode ver o dinheiro da pelada (entradas, saídas, saldo).
        </p>
        <Escolha
          opcoes={OPCOES_CAIXA}
          valor={pelada.configCaixa || "presidente"}
          onEscolher={(v) => mudarConfig("configCaixa", v)}
        />
      </div>

      <div className="card">
        <h2>Card de habilidades</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Tipo de avaliação:
        </p>
        <Escolha
          opcoes={OPCOES_TIPO}
          valor={pelada.configHabilidadeTipo || "detalhada"}
          onEscolher={(v) => mudarConfig("configHabilidadeTipo", v)}
        />
        <p className="muted" style={{ margin: "14px 0 12px" }}>Escala:</p>
        <Escolha
          opcoes={OPCOES_ESCALA}
          valor={pelada.configHabilidadeEscala || "estrelas"}
          onEscolher={(v) => mudarConfig("configHabilidadeEscala", v)}
        />
      </div>

      <div className="card">
        <h2>Admins</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Admins ajudam a gerir a pelada (abrir o dia, sortear, lançar caixa). Você pode
          passar a presidência para um admin — ele precisa aceitar.
        </p>

        {pelada.transferenciaPresidencia?.paraUid && (
          <div className="player" style={{ marginBottom: 10 }}>
            <span className="name">
              👑 Aguardando {nomeDe(aprovados, pelada.transferenciaPresidencia.paraUid)} aceitar…
            </span>
            <button className="btn danger sm" onClick={cancelar}>Cancelar</button>
          </div>
        )}

        <div className="list">
          <div className="player">
            <span className="name">{nomeDe(aprovados, pelada.presidenteUid)}</span>
            <span className="pill ok">Presidente</span>
          </div>
          {admins.map((j) => (
            <div className="player" key={j.id}>
              <span className="name">{j.nome}</span>
              <span className="tp-acoes">
                <button
                  className="btn ghost sm"
                  title="Passar a presidência para este admin"
                  disabled={!!pelada.transferenciaPresidencia?.paraUid}
                  onClick={() => oferecer(j.id)}
                >
                  👑 Presidente
                </button>
                <button className="btn danger sm" onClick={() => toggleAdmin(j.id, false)}>
                  Remover
                </button>
              </span>
            </div>
          ))}
          {admins.length === 0 && (
            <div className="empty">Nenhum admin além do presidente.</div>
          )}
        </div>

        {!addAdmin ? (
          <button
            className="btn ghost" style={{ width: "100%", marginTop: 10 }}
            onClick={() => { setAddAdmin(true); setBuscaAdmin(""); }}
          >
            + Adicionar admin
          </button>
        ) : (
          <div style={{ marginTop: 10 }}>
            <input
              className="input" style={{ margin: 0 }}
              placeholder="Buscar jogador do elenco…"
              value={buscaAdmin}
              onChange={(e) => setBuscaAdmin(e.target.value)}
              autoFocus
            />
            <div className="list" style={{ marginTop: 8 }}>
              {elegiveisAdmin.map((j) => (
                <div className="player" key={j.id}>
                  <span className="name">{j.nome}</span>
                  <button
                    className="btn sm"
                    onClick={async () => { await toggleAdmin(j.id, true); setAddAdmin(false); }}
                  >
                    Tornar admin
                  </button>
                </div>
              ))}
              {elegiveisAdmin.length === 0 && (
                <div className="empty">Nenhum jogador disponível.</div>
              )}
            </div>
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setAddAdmin(false)}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ borderColor: "var(--ball-dim)" }}>
        <h2>Encerrar a temporada {anoAtual}</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Faça depois do último jogo do ano: coroa os campeões no <b>Hall da Fama</b> e
          <b> zera os pontos</b> de todos (os totais de carreira continuam).
        </p>
        <button className="btn" onClick={encerrarAno} disabled={encerrando}>
          {encerrando ? "Encerrando…" : `🏆 Encerrar ${anoAtual} e coroar campeões`}
        </button>
      </div>

      <div className="card" style={{ borderColor: "var(--danger-dim)" }}>
        <h2>Zerar estatísticas</h2>
        <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
          Apaga gols, jogos, vitórias, sequências, freguesia e parcerias de <b>todos</b>.
          Use para limpar testes antes de a pelada valer. Perfil, nível e mensalidade ficam. Não tem volta.
        </p>
        <button className="btn danger" onClick={zerarStats}>
          🧹 Zerar todas as estatísticas
        </button>
      </div>

    </>
  );
}

function nomeDe(lista, uid) {
  return lista.find((j) => j.id === uid)?.nome || "o jogador";
}

function LocalEditor({ pelada, salvar }) {
  const [endereco, setEndereco] = useState(pelada.local?.endereco || "");
  const [lat, setLat] = useState(pelada.local?.lat ?? "");
  const [lng, setLng] = useState(pelada.local?.lng ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erroGeo, setErroGeo] = useState("");

  function usarMinha() {
    setErroGeo("");
    if (!navigator.geolocation) { setErroGeo("Sem GPS neste aparelho."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => setErroGeo("Não foi possível obter a localização.")
    );
  }

  async function onSalvar() {
    setSalvando(true);
    await salvar({
      endereco: endereco.trim(),
      lat: lat === "" ? null : Number(lat),
      lng: lng === "" ? null : Number(lng),
    });
    setSalvando(false);
  }

  const latN = lat === "" ? null : Number(lat);
  const lngN = lng === "" ? null : Number(lng);

  return (
    <div className="card">
      <h2>Local da pelada</h2>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
        Toque no mapa para marcar o local (ou use o GPS). Aparece no topo com rota e previsão.
      </p>
      <input
        className="input"
        placeholder="Endereço (ex: Quadra do bairro)"
        value={endereco}
        onChange={(e) => setEndereco(e.target.value)}
      />

      <MapaPicker
        lat={latN} lng={lngN} altura={220}
        onPick={(la, ln) => { setLat(la.toFixed(6)); setLng(ln.toFixed(6)); }}
      />
      <p className="muted" style={{ margin: "6px 0 10px", fontSize: 12 }}>
        📍 Toque no ponto exato da quadra/campo no mapa.
      </p>

      <div className="row" style={{ gap: 8 }}>
        <input
          className="input" style={{ margin: 0, flex: 1 }}
          placeholder="Latitude"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <input
          className="input" style={{ margin: 0, flex: 1 }}
          placeholder="Longitude"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
        />
      </div>
      <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={usarMinha}>
        Usar minha localização atual
      </button>
      {erroGeo && <p className="muted" style={{ marginTop: 8 }}>{erroGeo}</p>}
      <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={onSalvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar local"}
      </button>
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Lat/long habilitam a previsão do tempo. Dica: no celular, na quadra, toque em
        “Usar minha localização”.
      </p>
    </div>
  );
}

function Escolha({ valor, onEscolher, opcoes = OPCOES }) {
  return (
    <div className="list">
      {opcoes.map((o) => (
        <button
          key={o.v}
          className={`btn sm ${valor === o.v ? "" : "ghost"}`}
          style={{ width: "100%" }}
          onClick={() => valor !== o.v && onEscolher(o.v)}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function ConviteCard({ pelada }) {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?pelada=${pelada.id}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // fallback: seleciona via prompt se clipboard indisponível
      window.prompt("Copie o link de convite:", link);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="card">
      <h2>Convidar para a pelada</h2>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>
        Código: <b style={{ color: "var(--ball)" }}>{pelada.id}</b>
      </p>
      <button className="btn" onClick={copiar}>
        {copiado ? "Link copiado! ✓" : "Copiar link de convite"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(
          `⚽ Bora pra ${pelada.nome || "pelada"}! Entra aqui: ${link}`
        )}`}
        target="_blank"
        rel="noreferrer"
      >
        <button className="btn ghost" style={{ marginTop: 8 }}>
          Compartilhar no WhatsApp
        </button>
      </a>
    </div>
  );
}
