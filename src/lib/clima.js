// ============================================================
// CLIMA (Open-Meteo, grátis e sem API key) + ROTAS
// ============================================================

export async function getPrevisao(lat, lng) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,precipitation,weather_code` +
    `&hourly=temperature_2m,precipitation_probability,weather_code` +
    `&forecast_days=8&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Falha ao buscar previsão");
  return r.json();
}

// Próximo horário do jogo (Date) a partir do dia/horário fixo da pelada.
function proximoJogo(diaSemana, horario) {
  const [h, m] = horario.split(":").map(Number);
  const agora = new Date();
  const alvo = new Date(agora);
  alvo.setHours(h, m, 0, 0);
  let diff = (diaSemana - agora.getDay() + 7) % 7;
  if (diff === 0 && alvo.getTime() < agora.getTime()) diff = 7; // já passou hoje
  alvo.setDate(alvo.getDate() + diff);
  return alvo;
}

// Chave "YYYY-MM-DDTHH:00" no fuso local (como vem o hourly.time da API).
function chaveHora(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
}

// Previsão EXATA na hora do próximo jogo (ou null se fora do alcance/sem dia fixo).
// Retorna { temp, code, chuva, quando }.
export function previsaoNoHorario(clima, pelada) {
  const horas = clima?.hourly?.time;
  if (!horas || pelada?.diaSemana == null || !pelada?.horario) return null;
  const alvo = proximoJogo(pelada.diaSemana, pelada.horario);
  const i = horas.indexOf(chaveHora(alvo));
  if (i < 0) return null;
  return {
    temp: clima.hourly.temperature_2m?.[i],
    code: clima.hourly.weather_code?.[i],
    chuva: clima.hourly.precipitation_probability?.[i],
    quando: alvo,
  };
}

// Link de rota: abre o Google Maps / app de mapas do usuário.
export function linkRota(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// Ícone do tempo a partir do código WMO (chuva ou não).
export function iconeTempo(code) {
  if (code >= 95) return "⛈️";       // tempestade
  if (code >= 51) return "🌧️";       // garoa / chuva / pancadas
  if (code === 45 || code === 48) return "🌫️"; // névoa
  if (code === 3) return "☁️";        // nublado
  if (code === 1 || code === 2) return "🌤️"; // sol entre nuvens
  return "☀️";                        // céu limpo
}

// Tradução simples dos códigos WMO mais comuns.
export function descricaoTempo(code) {
  const m = {
    0: "Céu limpo", 1: "Predomínio de sol", 2: "Parcialmente nublado",
    3: "Nublado", 45: "Névoa", 51: "Garoa fraca", 61: "Chuva fraca",
    63: "Chuva moderada", 65: "Chuva forte", 80: "Pancadas de chuva",
    95: "Tempestade",
  };
  return m[code] ?? "Indefinido";
}
