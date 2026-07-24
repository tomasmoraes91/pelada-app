import { useEffect, useState } from "react";
import { getPrevisao, linkRota, descricaoTempo, iconeTempo, previsaoNoHorario } from "../lib/clima";
import Mapa from "./Mapa";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function Local({ pelada }) {
  const [clima, setClima] = useState(null);
  const [erro, setErro] = useState(null);
  const { lat, lng, endereco } = pelada.local || {};

  useEffect(() => {
    if (lat == null) return;
    getPrevisao(lat, lng).then(setClima).catch(() => setErro("Não foi possível carregar o tempo."));
  }, [lat, lng]);

  if (lat == null) return <div className="empty">Local não cadastrado.</div>;

  const prev = previsaoNoHorario(clima, pelada);

  return (
    <div className="card">
      <h2>Local da pelada</h2>
      <p style={{ fontWeight: 600, marginBottom: 12 }}>{endereco}</p>

      <Mapa lat={lat} lng={lng} altura={220} />

      {prev ? (
        <div style={{ marginTop: 12 }}>
          <p className="muted" style={{ marginBottom: 4 }}>
            Previsão para {DIAS[prev.quando.getDay()]} às {pelada.horario}
          </p>
          <div className="row between">
            <span style={{ fontSize: 32, fontWeight: 800 }}>
              {Math.round(prev.temp)}° {iconeTempo(prev.code)}
            </span>
            <span className="muted">
              {descricaoTempo(prev.code)}
              {prev.chuva != null && ` · ${prev.chuva}% chuva`}
            </span>
          </div>
        </div>
      ) : (
        clima && (
          <div className="row between" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 800 }}>
              {Math.round(clima.current.temperature_2m)}° {iconeTempo(clima.current.weather_code)}
            </span>
            <span className="muted">{descricaoTempo(clima.current.weather_code)}</span>
          </div>
        )
      )}
      {erro && <p className="muted">{erro}</p>}

      <a href={linkRota(lat, lng)} target="_blank" rel="noreferrer">
        <button className="btn" style={{ marginTop: 14 }}>Traçar rota no mapa</button>
      </a>
    </div>
  );
}
