import { useEffect, useState } from "react";
import { useAuth, papelDoUsuario, podeVerCaixa } from "./context/AuthContext";
import {
  getPelada,
  listarJogadores,
  cadastrarJogador,
  abrirSessao,
  getSessaoAberta,
  getUltimaSessao,
  encerrarSessoesAbertas,
  aceitarPresidencia,
  cancelarTransferencia,
} from "./lib/data";
import Jogo from "./components/Jogo";
import Partidas from "./components/Partidas";
import Jogadores from "./components/Jogadores";
import Stats from "./components/Stats";
import Votacao from "./components/Votacao";
import Local from "./components/Local";
import Temporada from "./components/Temporada";
import Fechamento from "./components/Fechamento";
import HallDaFama from "./components/HallDaFama";
import CardJogador from "./components/CardJogador";
import Caixa from "./components/Caixa";
import Freguesia from "./components/Freguesia";
import SeletorPelada from "./components/SeletorPelada";
import Ajustes from "./components/Ajustes";
import Perfil from "./components/Perfil";
import Inicio from "./components/Inicio";
import JogadorDetalhe from "./components/JogadorDetalhe";
import { getPrevisao, iconeTempo, previsaoNoHorario } from "./lib/clima";
import {
  notificarUmaVez, ehVesperaDeJogo, ehDiaDeJogo, resultadoLiberado, pedirPermissao,
} from "./lib/notificacoes";
import { horaDeAbrirConfirmacao, filaLiberada } from "./lib/agenda";
import { conquistasDoDia } from "./lib/premios";

const DIAS_CURTO = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// "QUA 19:00" se a pelada tem dia/horário fixo.
function rotuloAgenda(pelada) {
  if (!pelada || pelada.diaSemana == null || !pelada.horario) return "";
  return `${DIAS_CURTO[pelada.diaSemana]} ${pelada.horario}`;
}

// App já instalado (rodando como PWA standalone)?
function appInstalado() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function ehOpera() {
  return /OPR\/|Opera|OPT\//i.test(navigator.userAgent);
}

// Início, Jogo, Elenco e Meu perfil ficam no menu superior; o resto, na barra inferior.
const TABS = [
  { key: "partidas", label: "Histórico" },
  { key: "stats", label: "Estatísticas" },
  { key: "votacao", label: "Votos" },
  { key: "local", label: "Local" },
];

// Botão de convite reutilizável: copia o link com ?pelada=CÓDIGO.
function BotaoConvidar({ peladaId, className = "btn ghost sm" }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    const link = `${window.location.origin}${window.location.pathname}?pelada=${peladaId}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copie o link de convite:", link);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <button className={className} onClick={copiar}>
      {copiado ? "Copiado!" : "Convidar"}
    </button>
  );
}

// Rota (mapa) + previsão do tempo, ao lado do horário da pelada.
function LocalInfo({ pelada }) {
  const local = pelada?.local;
  const [clima, setClima] = useState(null);
  useEffect(() => {
    if (local?.lat == null) {
      setClima(null);
      return;
    }
    getPrevisao(local.lat, local.lng)
      .then(setClima)
      .catch(() => setClima(null));
  }, [local?.lat, local?.lng]);

  if (!local || (!local.endereco && local.lat == null)) return null;
  const dest = local.lat != null ? `${local.lat},${local.lng}` : local.endereco;
  const rota = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;

  // Previsão no horário do jogo (se houver dia fixo); senão, o tempo atual.
  const prev = previsaoNoHorario(clima, pelada);
  const temp = prev ? prev.temp : clima?.current?.temperature_2m;
  const code = prev ? prev.code : clima?.current?.weather_code;

  return (
    <>
      <a
        className="agenda-chip"
        href={rota}
        target="_blank"
        rel="noreferrer"
        title={local.endereco || "Ver rota"}
      >
        📍 Local
      </a>
      {temp != null && (
        <span
          className="agenda-chip"
          title={prev ? "Previsão no horário do jogo" : "Tempo agora"}
        >
          {Math.round(temp)}° {iconeTempo(code)}
        </span>
      )}
    </>
  );
}

export default function App() {
  const { user, entrar, sair } = useAuth();
  const [peladaId, setPeladaId] = useState(() =>
    localStorage.getItem("peladaId"),
  );
  const [pelada, setPelada] = useState(null);
  const [jogadores, setJogadores] = useState([]);
  const [sessaoId, setSessaoId] = useState(null); // detectado do Firestore
  const [sessaoAberta, setSessaoAberta] = useState(null); // doc da sessão aberta
  const [sessaoVotacao, setSessaoVotacao] = useState(null); // última sessão (vota mesmo encerrada)
  const [tab, setTab] = useState("inicio"); // login cai no Início
  const [carregando, setCarregando] = useState(true);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  const [mostrarCaixa, setMostrarCaixa] = useState(false);
  const [bannerOff, setBannerOff] = useState(false);
  const [muralhaMin, setMuralhaMin] = useState(3); // do dia de jogo (sessão aberta)
  const [installPrompt, setInstallPrompt] = useState(null); // PWA: instalar app
  const [mostrarAjudaInstalar, setMostrarAjudaInstalar] = useState(false);
  const [jogadorDetalheId, setJogadorDetalheId] = useState(null); // modal de jogador

  async function recarregar() {
    setJogadores(await listarJogadores(peladaId));
  }
  async function recarregarPelada() {
    setPelada(await getPelada(peladaId));
  }

  // PWA: captura o evento de instalação para um botão próprio.
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    const instalado = () => setInstallPrompt(null);
    window.addEventListener("appinstalled", instalado);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", instalado);
    };
  }, []);

  // Abre sempre o modal (com botão nativo dentro, se disponível) — garante que
  // algo acontece em qualquer navegador (Opera/Safari não disparam o prompt).
  function instalarApp() {
    setMostrarAjudaInstalar(true);
  }
  async function instalarNativo() {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setMostrarAjudaInstalar(false);
  }

  // Link de convite: ?pelada=CÓDIGO seleciona a pelada e limpa a URL.
  useEffect(() => {
    const convite = new URLSearchParams(window.location.search).get("pelada");
    if (convite) {
      localStorage.setItem("peladaId", convite);
      setPeladaId(convite);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!user || !peladaId) return;
    setCarregando(true);
    (async () => {
      const p = await getPelada(peladaId);
      setPelada(p);
      if (p) {
        setJogadores(await listarJogadores(peladaId));
        // Detecta a pelada do dia em qualquer aparelho (sem localStorage).
        const aberta = await getSessaoAberta(peladaId);
        setSessaoId(aberta?.id || null);
        setSessaoAberta(aberta || null);
        // Votação usa a última sessão, mesmo encerrada (vota depois do jogo).
        setSessaoVotacao(aberta || (await getUltimaSessao(peladaId)));
        setMuralhaMin(aberta?.muralhaMinJogos ?? 3);
      } else {
        setJogadores([]);
        setSessaoId(null);
        setSessaoAberta(null);
        setSessaoVotacao(null);
      }
      setCarregando(false);
    })();
  }, [user, peladaId]);

  // Abertura é MANUAL: no horário definido (antecedência), avisa os gestores
  // para abrir a confirmação. Não abre sozinho (jogador só confirma depois disso).
  useEffect(() => {
    if (!user || !pelada || sessaoId) return; // já tem sessão aberta
    const papel = papelDoUsuario(pelada, user.uid);
    if (papel !== "presidente" && papel !== "admin") return; // só avisa gestor
    if (!horaDeAbrirConfirmacao(pelada, sessaoVotacao)) return;
    notificarUmaVez(
      `abrir_${pelada.id}_${new Date().toDateString()}`,
      "Hora de abrir a confirmação ⚽",
      `Toque em "Abrir confirmação" pra galera confirmar presença em ${pelada.nome || "sua pelada"}.`,
    );
  }, [user, pelada, sessaoId, sessaoVotacao]);

  // Lembretes locais (app aberto): véspera e dia de jogo (1x cada, por dia).
  useEffect(() => {
    if (!pelada) return;
    const hoje = new Date().toDateString();
    if (ehVesperaDeJogo(pelada)) {
      notificarUmaVez(
        `vespera_${pelada.id}_${hoje}`,
        `Amanhã tem pelada — ${pelada.nome || "Pelada"}`,
        `${rotuloAgenda(pelada)} · já confirma sua presença!`,
      );
    }
    if (ehDiaDeJogo(pelada)) {
      notificarUmaVez(
        `hoje_${pelada.id}_${hoje}`,
        `Hoje tem pelada — ${pelada.nome || "Pelada"}`,
        `${rotuloAgenda(pelada)} · confirme sua presença!`,
      );
    }
  }, [pelada]);

  // Pelada aberta pelo gestor: avisa quem ainda não confirmou presença.
  useEffect(() => {
    if (!sessaoAberta || !user) return;
    const presente = (sessaoAberta.presencaConfirmada || []).includes(user.uid);
    if (!presente) {
      notificarUmaVez(
        `presenca_${sessaoAberta.id}`,
        `Pelada aberta — ${pelada?.nome || "bora!"} ⚽`,
        "O dia de jogo foi aberto. Confirme sua presença no app.",
      );
    }
  }, [sessaoAberta, user, pelada]);

  // Cobranças: avisa o jogador quando o presidente cobra a mensalidade do mês
  // ou a diária do dia (1x por cobrança).
  useEffect(() => {
    if (!pelada || !user) return;
    const eu = jogadores.find((j) => j.id === user.uid);
    if (!eu) return;
    const mes = pelada.mesCobranca || new Date().toISOString().slice(0, 7);
    const m = eu.mensalidades?.[mes];
    if (eu.mensalista && m?.st === "cobrado") {
      notificarUmaVez(
        `cobranca_${pelada.id}_${mes}_${user.uid}`,
        "Mensalidade em aberto 💰",
        `A mensalidade de ${mes} (R$ ${(m.v || 0).toFixed(2)}) foi cobrada. Acerte com o presidente.`,
      );
    }
  }, [pelada, jogadores, user]);

  // Pós-pelada: lembra de avaliar a galera; e avisa quando o resultado sai (24h).
  useEffect(() => {
    if (!sessaoVotacao || !user) return;
    const encerrada = sessaoVotacao.status === "encerrada";
    const presente = (sessaoVotacao.presencaConfirmada || []).includes(user.uid);
    if (encerrada && presente && !resultadoLiberado(sessaoVotacao)) {
      notificarUmaVez(
        `voto_${sessaoVotacao.id}`,
        "Avalie a galera ⭐",
        "A pelada acabou — dê as notas na aba Votos.",
      );
    }
    if (resultadoLiberado(sessaoVotacao)) {
      notificarUmaVez(
        `resultado_${sessaoVotacao.id}`,
        "Saiu o resultado 🏆",
        "O Craque e o Pereba da pelada já estão disponíveis.",
      );
    }
  }, [sessaoVotacao, user]);

  // Conquistas da pelada (do dia): avisa o jogador dos destaques que ele levou.
  useEffect(() => {
    if (!sessaoVotacao || sessaoVotacao.status !== "encerrada" || !user) return;
    const eu = jogadores.find((j) => j.id === user.uid);
    if (!eu) return;
    conquistasDoDia(eu, sessaoVotacao).forEach((c) => {
      notificarUmaVez(
        `conq_${sessaoVotacao.id}_${user.uid}_${c.key}`,
        `${c.emoji} ${c.nome}!`,
        "Você foi destaque na pelada.",
      );
    });
  }, [sessaoVotacao, jogadores, user]);

  function selecionarPelada(id) {
    localStorage.setItem("peladaId", id);
    setPeladaId(id);
    setPelada(null);
    setJogadores([]);
    setSessaoId(null);
    setSessaoAberta(null);
    setSessaoVotacao(null);
    setTab("inicio");
  }

  function trocarPelada() {
    localStorage.removeItem("peladaId");
    setPeladaId(null);
    setSessaoId(null);
    setSessaoAberta(null);
    setSessaoVotacao(null);
    setPelada(null);
    setJogadores([]);
  }

  if (user === undefined)
    return <div className="center-screen">Carregando…</div>;

  if (!user)
    return (
      <div className="app">
        <div className="center-screen">
          <div>
            <div
              className="brand"
              style={{ justifyContent: "center", fontSize: 28 }}
            >
              <span className="dot" /> Pelada
            </div>
            <p className="muted" style={{ margin: "16px 0 24px" }}>
              Organize os jogos da galera num lugar só.
            </p>
            <button className="btn" onClick={entrar}>
              Entrar com Google
            </button>
          </div>
        </div>
      </div>
    );

  if (!peladaId)
    return <SeletorPelada uid={user.uid} onSelecionar={selecionarPelada} />;

  const meuCadastro = jogadores.find((j) => j.id === user.uid);
  const papel = papelDoUsuario(pelada, user.uid);
  const ehGestor = papel === "presidente" || papel === "admin";
  // Gestor sempre entra; jogador comum só depois de aprovado pelo presidente.
  const souJogador = ehGestor || meuCadastro?.status === "aprovado";
  const aguardandoAprovacao = !ehGestor && meuCadastro?.status === "pendente";
  // Mensalidade cobrada (devendo) do mês de cobrança ativo para o jogador logado?
  const mesAtivo = pelada?.mesCobranca || new Date().toISOString().slice(0, 7);
  const minhaMens = meuCadastro?.mensalidades?.[mesAtivo];
  const mensalidadeEmAberto = meuCadastro?.mensalista && minhaMens?.st === "cobrado";
  const valorCobrado = minhaMens?.v || 0;

  // Caixa fica no menu do Admin; Início e Jogo no topo. Abas inferiores = TABS.
  const tabsVisiveis = TABS;
  const tabsValidas = ["inicio", "jogo", "jogadores", ...tabsVisiveis.map((t) => t.key)];
  const tabAtual = tabsValidas.includes(tab) ? tab : "inicio";
  // Aba ativa quando não está no Perfil/Admin/Caixa (p/ destacar a nav do topo).
  const navAtiva = !mostrarPerfil && !mostrarAdmin && !mostrarCaixa ? tabAtual : null;

  // Navega para uma aba e sai do Perfil/Admin/Caixa.
  function irPara(t) {
    setTab(t);
    setMostrarPerfil(false);
    setMostrarAdmin(false);
    setMostrarCaixa(false);
  }

  async function pedirCadastro() {
    await cadastrarJogador(peladaId, user.uid, {
      nome: user.displayName || "Sem nome",
      foto: user.photoURL || "",
    });
    await recarregar();
  }

  // Abre a confirmação da pelada (cria a sessão). Chamado pelo Admin.
  async function abrirConfirmacao() {
    const existente = await getSessaoAberta(peladaId);
    const id = existente?.id || (await abrirSessao(peladaId));
    const atual = existente || (await getSessaoAberta(peladaId));
    setSessaoId(id);
    setSessaoAberta(atual);
    setSessaoVotacao(atual);
    setMuralhaMin(atual?.muralhaMinJogos ?? 3);
  }

  // Encerra a pelada (fecha TODAS as sessões abertas, sem deixar sobra). Votação continua.
  async function encerrarPelada() {
    await encerrarSessoesAbertas(peladaId);
    setSessaoId(null);
    setSessaoAberta(null);
    setSessaoVotacao(await getUltimaSessao(peladaId)); // mantém p/ votação
  }

  return (
    <div className="app">
      <div
        className="topbar"
        style={{ flexDirection: "column", alignItems: "stretch", gap: 14 }}
      >
        <div className="brand">
          <span className="dot" /> {pelada?.nome || "Pelada"}
          {rotuloAgenda(pelada) && (
            <span className="brand-agenda">{rotuloAgenda(pelada)}</span>
          )}
          {pelada && <LocalInfo pelada={pelada} />}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {pelada && souJogador && (
            <>
              <button
                className={`btn sm ${navAtiva === "inicio" ? "" : "ghost"}`}
                onClick={() => irPara("inicio")}
              >
                🏠 Início
              </button>
              <button
                className={`btn sm ${navAtiva === "jogo" ? "" : "ghost"}`}
                onClick={() => irPara("jogo")}
              >
                ⚽ Jogo
              </button>
              <button
                className={`btn sm ${navAtiva === "jogadores" ? "" : "ghost"}`}
                onClick={() => irPara("jogadores")}
              >
                Elenco
              </button>
            </>
          )}
          {pelada && papel === "presidente" && (
            <button
              className={`btn sm ${mostrarAdmin ? "warn" : "ghost"}`}
              onClick={() => {
                setMostrarAdmin((v) => !v);
                setMostrarPerfil(false);
                setMostrarCaixa(false);
              }}
            >
              Admin
            </button>
          )}
          {pelada && podeVerCaixa(pelada, papel) && (
            <button
              className={`btn sm ${mostrarCaixa ? "warn" : "ghost"}`}
              onClick={() => {
                setMostrarCaixa((v) => !v);
                setMostrarPerfil(false);
                setMostrarAdmin(false);
              }}
            >
              💰 Caixa
            </button>
          )}
          {pelada && souJogador && (
            <button
              className={`btn sm ${mostrarPerfil ? "warn" : "ghost"}`}
              onClick={() => {
                setMostrarPerfil((v) => !v);
                setMostrarAdmin(false);
                setMostrarCaixa(false);
              }}
            >
              Meu perfil
            </button>
          )}
          {!appInstalado() && (
            <button className="btn sm" onClick={instalarApp} title="Instalar na tela inicial">
              📲 Instalar
            </button>
          )}
        </div>
      </div>

      {pelada?.transferenciaPresidencia?.paraUid === user.uid && (
        <div className="card">
          <h2>Presidência oferecida 👑</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Você foi escolhido para ser o novo presidente de {pelada.nome}.
            Aceita?
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              onClick={async () => {
                await aceitarPresidencia(peladaId, user.uid);
                await recarregarPelada();
              }}
            >
              Aceitar
            </button>
            <button
              className="btn ghost"
              onClick={async () => {
                await cancelarTransferencia(peladaId);
                await recarregarPelada();
              }}
            >
              Recusar
            </button>
          </div>
        </div>
      )}

      {pelada && souJogador && mensalidadeEmAberto && (
        <div className="card" style={{ borderColor: "var(--ball-dim)" }}>
          <h2 style={{ margin: 0, color: "var(--ball)" }}>Mensalidade em aberto 💰</h2>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            A mensalidade de <b>R$ {valorCobrado.toFixed(2)}</b> deste mês foi cobrada e ainda
            não consta como paga. Acerte com o presidente da pelada.
          </p>
        </div>
      )}


      {pelada && souJogador && ehDiaDeJogo(pelada) && !bannerOff && (
        <div className="card" style={{ borderColor: "var(--grass-dim)" }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0, color: "var(--grass)" }}>
              Hoje tem pelada! ⚽
            </h2>
            <button className="btn ghost sm" onClick={() => setBannerOff(true)}>
              ✕
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 12 }}>
            {rotuloAgenda(pelada) || "É hoje"} — confirme sua presença.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              onClick={() => {
                setTab("jogo");
                setMostrarPerfil(false);
                setMostrarAdmin(false);
              }}
            >
              Ir para o jogo
            </button>
            {typeof Notification !== "undefined" &&
              Notification.permission === "default" && (
                <button className="btn ghost" onClick={pedirPermissao}>
                  Ativar lembretes
                </button>
              )}
          </div>
        </div>
      )}

      {!pelada && !carregando && (
        <div className="card">
          <p className="muted">
            Pelada <b>{peladaId}</b> não encontrada. Ela pode ter sido removida
            — use <b>Trocar</b> para escolher ou criar outra.
          </p>
        </div>
      )}

      {pelada && aguardandoAprovacao && (
        <div className="card">
          <h2>Aguardando aprovação</h2>
          <p className="muted">
            Seu cadastro foi enviado. O presidente da pelada precisa aprovar
            antes de você entrar no elenco.
          </p>
        </div>
      )}

      {pelada && !souJogador && !aguardandoAprovacao && (
        <div className="card">
          <h2>Bem-vindo</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            Você ainda não faz parte do elenco. Peça seu cadastro — o presidente
            aprova.
          </p>
          <button className="btn" onClick={pedirCadastro}>
            Pedir para entrar
          </button>
        </div>
      )}

      {pelada && souJogador && ehGestor && !meuCadastro && (
        <div className="card">
          <p className="muted" style={{ marginBottom: 12 }}>
            Você gerencia esta pelada, mas ainda não está no elenco.
          </p>
          <button className="btn" onClick={pedirCadastro}>
            Entrar no elenco
          </button>
        </div>
      )}

      {pelada && souJogador && mostrarPerfil && (
        <>
          <button
            className="btn ghost sm"
            style={{ marginBottom: 12 }}
            onClick={() => setMostrarPerfil(false)}
          >
            ← Voltar
          </button>
          <Perfil
            pelada={pelada}
            jogador={meuCadastro}
            jogadores={jogadores}
            muralhaMin={muralhaMin}
            onVoltar={() => setMostrarPerfil(false)}
            onTrocarPelada={trocarPelada}
            onSalvo={async () => {
              await recarregar();
            }}
          />
          <CardJogador
            jogadores={jogadores}
            pelada={pelada}
            muralhaMin={muralhaMin}
          />
          <Freguesia pelada={pelada} jogadores={jogadores} />
        </>
      )}

      {pelada && papel === "presidente" && mostrarAdmin && (
        <>
          <button
            className="btn ghost sm"
            style={{ marginBottom: 12 }}
            onClick={() => setMostrarAdmin(false)}
          >
            ← Voltar
          </button>
          <Ajustes
            pelada={pelada}
            jogadores={jogadores}
            recarregar={recarregar}
            recarregarPelada={recarregarPelada}
            sessaoAberta={sessaoAberta}
            onAbrirConfirmacao={abrirConfirmacao}
            onEncerrarPelada={encerrarPelada}
          />
        </>
      )}

      {pelada && podeVerCaixa(pelada, papel) && mostrarCaixa && (
        <>
          <button
            className="btn ghost sm"
            style={{ marginBottom: 12 }}
            onClick={() => setMostrarCaixa(false)}
          >
            ← Voltar
          </button>
          <Caixa
            pelada={pelada}
            jogadores={jogadores}
            sessaoId={sessaoAberta?.id || null}
            recarregar={recarregar}
            recarregarPelada={recarregarPelada}
          />
        </>
      )}

      {pelada && souJogador && !mostrarPerfil && !mostrarAdmin && !mostrarCaixa && (
        <>
          {tabAtual === "inicio" && (
            <Inicio
              pelada={pelada}
              jogadores={jogadores}
              sessaoId={sessaoAberta?.id || null}
              sessaoAtiva={!!sessaoAberta && filaLiberada(pelada)}
              onIrParaJogo={() => setTab("jogo")}
              onIrPara={irPara}
              onAbrirJogador={setJogadorDetalheId}
            />
          )}
          {tabAtual === "jogo" && (
            <Jogo pelada={pelada} jogadores={jogadores} sessaoId={sessaoId} />
          )}
          {tabAtual === "partidas" && (
            <Partidas pelada={pelada} jogadores={jogadores} />
          )}
          {tabAtual === "jogadores" && (
            <Jogadores
              pelada={pelada}
              jogadores={jogadores}
              recarregar={recarregar}
              onAbrirJogador={setJogadorDetalheId}
            />
          )}
          {tabAtual === "stats" && (
            <>
              <Fechamento pelada={pelada} jogadores={jogadores} muralhaMin={muralhaMin} />
              <HallDaFama pelada={pelada} />
              <Stats jogadores={jogadores} muralhaMin={muralhaMin} />
              <Temporada jogadores={jogadores} />
            </>
          )}
          {tabAtual === "votacao" && (
            <Votacao
              pelada={pelada}
              jogadores={jogadores}
              sessaoId={sessaoVotacao?.id || null}
            />
          )}
          {tabAtual === "local" && <Local pelada={pelada} />}
          <div className="tabbar">
            {tabsVisiveis.map((t) => (
              <button
                key={t.key}
                className={`tab ${tabAtual === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
            <BotaoConvidar peladaId={pelada.id} className="tab" />
            <button className="tab" onClick={sair}>Sair</button>
          </div>
        </>
      )}

      {jogadorDetalheId && (
        <JogadorDetalhe
          pelada={pelada}
          jogador={jogadores.find((j) => j.id === jogadorDetalheId)}
          jogadores={jogadores}
          sessao={sessaoAberta}
          muralhaMin={muralhaMin}
          onFechar={() => setJogadorDetalheId(null)}
        />
      )}

      {mostrarAjudaInstalar && (
        <div className="modal-overlay" onClick={() => setMostrarAjudaInstalar(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setMostrarAjudaInstalar(false)}>✕</button>
            <h2>Instalar o app 📲</h2>

            {installPrompt && (
              <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={instalarNativo}>
                Instalar agora
              </button>
            )}

            <p className="muted" style={{ marginTop: 12, fontWeight: 700, fontSize: 13 }}>
              Ou instale pelo navegador:
            </p>
            {ehIOS() ? (
              <p className="muted" style={{ marginTop: 6 }}>
                <b>iPhone/iPad (Safari):</b> toque em <b>Compartilhar</b> (ícone ⬆️ embaixo) e depois
                em <b>"Adicionar à Tela de Início"</b>.
              </p>
            ) : ehOpera() ? (
              <>
                <p className="muted" style={{ marginTop: 6 }}>
                  <b>Opera (celular):</b> menu <b>O</b> (canto inferior) → role até
                  <b> "Adicionar à tela inicial"</b>. No <b>Opera (PC):</b> menu (canto superior) →
                  procure <b>"Instalar Pelada"</b>.
                </p>
                <p className="muted" style={{ marginTop: 8, color: "var(--ball)", fontSize: 12 }}>
                  ⚠️ O Opera tem suporte limitado a apps web (e o <b>Opera Mini</b> não instala).
                  Se não achar a opção, abra <b>meucolete-ba954.web.app</b> no <b>Chrome</b> — lá é
                  só tocar em <b>"Instalar"</b>.
                </p>
              </>
            ) : (
              <p className="muted" style={{ marginTop: 6 }}>
                <b>Chrome/Edge/Samsung:</b> menu (⋮) → <b>"Instalar app"</b> / "Adicionar à tela
                inicial", ou o ícone de instalar na barra de endereço.
              </p>
            )}
            <button
              className="btn ghost" style={{ width: "100%", marginTop: 14 }}
              onClick={() => setMostrarAjudaInstalar(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
