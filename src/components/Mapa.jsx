// Mapa embutido via OpenStreetMap (grátis, sem API key) com marcador no local.
export default function Mapa({ lat, lng, altura = 200 }) {
  if (lat == null || lng == null) return null;
  const d = 0.004; // zoom da janela (bbox)
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const src =
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}` +
    `&layer=mapnik&marker=${lat},${lng}`;
  return (
    <iframe
      title="Mapa do local"
      className="mapa-embed"
      style={{ height: altura }}
      src={src}
      loading="lazy"
    />
  );
}
