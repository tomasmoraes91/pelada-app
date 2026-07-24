// Mapa interativo (Leaflet + tiles do OpenStreetMap, sem API key).
// Toque/clique no mapa define o marcador e devolve lat/lng via onPick.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PIN = L.divIcon({
  html: "📍",
  className: "mapa-pin",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

export default function MapaPicker({ lat, lng, onPick, altura = 240 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const temPonto = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  // Inicializa o mapa uma vez.
  useEffect(() => {
    const centro = temPonto ? [lat, lng] : [-15.78, -47.93]; // Brasília como fallback
    const map = L.map(elRef.current).setView(centro, temPonto ? 16 : 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    if (temPonto) markerRef.current = L.marker([lat, lng], { icon: PIN }).addTo(map);

    map.on("click", (e) => {
      const { lat: la, lng: ln } = e.latlng;
      if (markerRef.current) markerRef.current.setLatLng([la, ln]);
      else markerRef.current = L.marker([la, ln], { icon: PIN }).addTo(map);
      onPickRef.current?.(la, ln);
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0); // corrige tamanho após montar
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza o marcador quando lat/lng mudam por fora (ex: "usar minha localização").
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !temPonto) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else markerRef.current = L.marker([lat, lng], { icon: PIN }).addTo(map);
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, temPonto]);

  return <div ref={elRef} className="mapa-embed" style={{ height: altura }} />;
}
