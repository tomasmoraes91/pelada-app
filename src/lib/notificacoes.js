// ============================================================
// NOTIFICAÇÕES locais (app aberto) — Notification API do navegador.
// Sem custo/infra. Push com app FECHADO exige FCM + Cloud Function
// (frente separada, no backlog). Cada aviso dispara 1x por chave.
// ============================================================

export function podeNotificar() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export function pedirPermissao() {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Dispara uma notificação só uma vez por `chave` (memória no localStorage).
export function notificarUmaVez(chave, titulo, corpo) {
  if (!podeNotificar()) return false;
  if (localStorage.getItem(chave)) return false;
  localStorage.setItem(chave, "1");
  try {
    new Notification(titulo, { body: corpo });
    return true;
  } catch {
    return false;
  }
}

// Amanhã é o dia fixo da pelada?
export function ehVesperaDeJogo(pelada) {
  if (!pelada || pelada.diaSemana == null) return false;
  return (new Date().getDay() + 1) % 7 === pelada.diaSemana;
}

// Hoje é o dia fixo da pelada?
export function ehDiaDeJogo(pelada) {
  return pelada && pelada.diaSemana != null && new Date().getDay() === pelada.diaSemana;
}

// Quando uma sessão foi aberta (ms) — a partir do timestamp do Firestore.
export function abertaEmMs(sessao) {
  return sessao?.data?.toDate ? sessao.data.toDate().getTime() : null;
}

// Já passou 24h da abertura? (libera Craque/Pereba na Votação)
export function resultadoLiberado(sessao) {
  const t = abertaEmMs(sessao);
  return t != null && Date.now() >= t + 24 * 60 * 60 * 1000;
}
