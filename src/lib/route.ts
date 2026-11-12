/**
 * Distância rodoviária entre dois endereços usando serviços abertos do OpenStreetMap:
 *  - Nominatim (endereço → coordenadas)
 *  - OSRM (rota de carro → distância e tempo)
 * Só é chamado quando o usuário clica em "Calcular distância". Se falhar, a distância é digitada à mão.
 */
async function geocode(address: string): Promise<{ lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'pt-BR' } });
  if (!res.ok) throw new Error('Serviço de mapas indisponível no momento.');
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) throw new Error(`Endereço não encontrado: "${address}". Tente incluir cidade e estado.`);
  return { lat: Number(data[0].lat), lon: Number(data[0].lon) };
}

export async function routeDistance(origin: string, destination: string): Promise<{ km: number; minutes: number }> {
  if (!origin.trim() || !destination.trim()) throw new Error('Informe a origem e o destino.');
  const a = await geocode(origin);
  // Nominatim pede no máximo 1 consulta por segundo.
  await new Promise((r) => setTimeout(r, 1100));
  const b = await geocode(destination);
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`);
  if (!res.ok) throw new Error('Não foi possível calcular a rota agora. Informe a distância manualmente.');
  const data = (await res.json()) as { code: string; routes?: Array<{ distance: number; duration: number }> };
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Rota não encontrada entre os endereços.');
  return { km: Math.round((data.routes[0].distance / 1000) * 10) / 10, minutes: Math.round(data.routes[0].duration / 60) };
}

/** Link do Google Maps com a rota (para conferir pedágios e trajeto). */
export const mapsRouteUrl = (origin: string, destination: string) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
