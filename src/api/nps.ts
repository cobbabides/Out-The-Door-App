import { LocalEvent } from "./scrapers/types";

// NPS API — fetches parks by state, filters to radius client-side
// No lat/lon search available; distance computed from park's latLong field.

const NEARBY_STATES = ["OH", "KY", "IN", "WV", "PA"]; // expand for wider searches

function parseLatLong(latLong: string): { lat: number; lon: number } | null {
  const match = latLong.match(/lat:([\-\d.]+),\s*long:([\-\d.]+)/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lon: parseFloat(match[2]) };
}

function distanceMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getNearbyParks(
  lat: number,
  lon: number,
  radiusMi = 75
): Promise<LocalEvent[]> {
  const key = process.env.EXPO_PUBLIC_NPS_KEY;
  const stateCode = NEARBY_STATES.join(",");
  const url =
    `https://developer.nps.gov/api/v1/parks` +
    `?stateCode=${stateCode}&limit=150&fields=images,addresses&api_key=${key}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`NPS API error: ${res.status}`);
  const json = await res.json();

  const today = new Date().toISOString().split("T")[0];

  return (json.data ?? [])
    .filter((p: any) => {
      if (!p.latLong) return false;
      const coords = parseLatLong(p.latLong);
      if (!coords) return false;
      return distanceMi(lat, lon, coords.lat, coords.lon) <= radiusMi;
    })
    .map((p: any): LocalEvent => {
      const physicalAddr = (p.addresses ?? []).find((a: any) => a.type === "Physical");
      const address = physicalAddr
        ? `${physicalAddr.line1}, ${physicalAddr.city}, ${physicalAddr.stateCode}`
        : undefined;

      return {
        id: `nps-${p.parkCode}`,
        title: p.fullName,
        venue: p.fullName,
        address,
        date: today,
        description: p.description,
        url: p.url,
        image: p.images?.[0]?.url,
        category: "outdoor",
        source: "nps",
      };
    });
}
