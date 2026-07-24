// ============================================================
// AGENDA — abertura da pelada e liberação da fila, no fuso de Brasília.
//  - A SESSÃO abre com a antecedência definida pelo presidente
//    (confirmacaoAntecedenciaHoras), para a confirmação de presença —
//    pode ser dias antes.
//  - A FILA de chegada (que monta o sorteio) só libera 1h antes do jogo.
// Roda no cliente: o 1º gestor que abrir o app na janela dispara a abertura.
// ============================================================

const TZ = "America/Sao_Paulo";

// "Agora" com os campos (dia/hora) no fuso de Brasília.
export function agoraBrasilia() {
  const d = new Date();
  return new Date(d.toLocaleString("en-US", { timeZone: TZ }));
}

function emBrasilia(date) {
  return new Date(date.toLocaleString("en-US", { timeZone: TZ }));
}

// Próximo horário do jogo (Date em campos de Brasília), sempre no futuro.
export function proximoJogo(pelada) {
  const bsb = agoraBrasilia();
  const [h, m] = pelada.horario.split(":").map(Number);
  const alvo = new Date(bsb);
  alvo.setHours(h, m, 0, 0);
  let diff = (pelada.diaSemana - bsb.getDay() + 7) % 7;
  if (diff === 0 && alvo.getTime() <= bsb.getTime()) diff = 7; // já passou hoje
  alvo.setDate(alvo.getDate() + diff);
  return alvo;
}

// Ocorrência de (dia da semana, "HH:MM") imediatamente ANTES de `alvo` (Date).
function ocorrenciaAntes(alvo, dia, horario) {
  const [h, m] = horario.split(":").map(Number);
  const d = new Date(alvo);
  d.setDate(d.getDate() - ((alvo.getDay() - dia + 7) % 7));
  d.setHours(h, m, 0, 0);
  if (d.getTime() >= alvo.getTime()) d.setDate(d.getDate() - 7);
  return d;
}

// Já é hora de avisar os gestores p/ abrir a confirmação? O presidente define
// o dia+horário do aviso (ex: Seg 12:00). Vale dessa hora até o jogo, e
// `ultimaSessao` evita avisar de novo no mesmo ciclo. (App só chama sem sessão.)
export function horaDeAbrirConfirmacao(pelada, ultimaSessao) {
  if (!pelada || pelada.diaSemana == null || !pelada.horario) return false;
  if (pelada.confirmacaoDiaSemana == null || !pelada.confirmacaoHorario) return false;
  const agora = agoraBrasilia().getTime();
  const jogo = proximoJogo(pelada);
  const aviso = ocorrenciaAntes(jogo, pelada.confirmacaoDiaSemana, pelada.confirmacaoHorario).getTime();
  if (agora < aviso || agora >= jogo.getTime()) return false; // fora da janela

  const t = ultimaSessao?.data?.toDate ? ultimaSessao.data.toDate() : null;
  if (t && emBrasilia(t).getTime() >= aviso) return false; // já abriu neste ciclo
  return true;
}

// A FILA de chegada (entra no sorteio) abre 1h antes do jogo, no dia.
// Sem dia/horário fixo (pelada avulsa), libera sempre.
export function filaLiberada(pelada) {
  if (!pelada || pelada.diaSemana == null || !pelada.horario) return true;
  const bsb = agoraBrasilia();
  if (bsb.getDay() !== pelada.diaSemana) return false;
  const [h, m] = pelada.horario.split(":").map(Number);
  const alvo = h * 60 + m;
  const agora = bsb.getHours() * 60 + bsb.getMinutes();
  return agora >= alvo - 60;
}
