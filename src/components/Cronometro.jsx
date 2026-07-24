import { useEffect, useRef, useState } from "react";

// AudioContext único, criado/retomado no 1º toque do usuário (mobile exige
// gesto p/ liberar o som; reusar o mesmo contexto faz o apito de fim tocar).
let _ctx = null;
function getCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!_ctx) _ctx = new Ctx();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// Apito sintetizado (sem arquivo): onda quadrada com trinado agudo.
// `n` = número de apitos seguidos (1 = início; 2 = fim de partida).
function apito(n = 1) {
  const ctx = getCtx();
  if (!ctx) return;
  let t = ctx.currentTime;
  for (let i = 0; i < n; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1900, t);
    osc.frequency.setValueAtTime(2400, t + 0.05);
    osc.frequency.setValueAtTime(1900, t + 0.1);
    osc.frequency.setValueAtTime(2400, t + 0.15);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.setValueAtTime(0.35, t + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
    t += 0.42;
  }
}

export default function Cronometro({ duracaoMin = 0 }) {
  const [seg, setSeg] = useState(0);
  const [rodando, setRodando] = useState(false);
  const ref = useRef(null);
  const apitouFim = useRef(false);
  const alvo = duracaoMin > 0 ? duracaoMin * 60 : 0;
  const acabou = alvo > 0 && seg >= alvo;

  useEffect(() => {
    if (rodando) ref.current = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(ref.current);
  }, [rodando]);

  // Apito de fim ao atingir a duração definida pelo presidente.
  useEffect(() => {
    if (alvo > 0 && seg >= alvo && rodando && !apitouFim.current) {
      apitouFim.current = true;
      setRodando(false);
      apito(2);
    }
  }, [seg, alvo, rodando]);

  function iniciarPausar() {
    if (rodando) {
      setRodando(false);
      return;
    }
    if (seg === 0 || acabou) {
      setSeg(0);
      apitouFim.current = false;
    }
    apito(1); // apito de início (gesto do usuário libera o áudio)
    setRodando(true);
  }

  function zerar() {
    setRodando(false);
    setSeg(0);
    apitouFim.current = false;
  }

  // Regressivo quando há duração; senão, progressivo.
  const mostra = alvo > 0 ? Math.max(0, alvo - seg) : seg;
  const mm = String(Math.floor(mostra / 60)).padStart(2, "0");
  const ss = String(mostra % 60).padStart(2, "0");

  return (
    <div className="card">
      <h2>Cronômetro{alvo > 0 ? ` · ${duracaoMin} min` : ""}</h2>
      <div className="clock" style={acabou ? { color: "var(--danger)" } : undefined}>
        {mm}:{ss}
      </div>
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn" onClick={iniciarPausar}>
          {rodando ? "Pausar" : acabou ? "Reiniciar" : "Iniciar"}
        </button>
        <button className="btn ghost" onClick={zerar}>
          Zerar
        </button>
      </div>
      {alvo > 0 && (
        <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          🔔 Apita ao iniciar e quando zerar o tempo da partida.
        </p>
      )}
    </div>
  );
}
