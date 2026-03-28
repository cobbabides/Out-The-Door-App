import { LocalEvent } from "./scrapers/types";

// Recreation Information Database (RIDB) — recreation.gov
// Supports true lat/lon + radius search, unlike NPS.
// Auth: apikey request header

const BASE = "https://ridb.recreation.gov/api/v1";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function fetchRecGov(path: string, params: Record<string, string | number>) {
  const key = process.env.EXPO_PUBLIC_RECGOV_KEY;
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { apikey: key ?? "" },
  });
  if (!res.ok) throw new Error(`RecGov API error: ${res.status}`);
  return res.json();
}

export async function getNearbyFacilities(
  lat: number,
  lon: number,
  radiusMi = 50,
  limit = 20
): Promise<LocalEvent[]> {
  const today = new Date().toISOString().split("T")[0];

  // Fetch campgrounds/facilities and rec areas in parallel
  const [facilitiesRes, recAreasRes] = await Promise.all([
    fetchRecGov("/facilities", { latitude: lat, longitude: lon, radius: radiusMi, limit }),
    fetchRecGov("/recareas", { latitude: lat, longitude: lon, radius: radiusMi, limit }),
  ]);

  const facilities: any[] = facilitiesRes.RECDATA ?? [];
  const recAreas: any[] = recAreasRes.RECDATA ?? [];

  const toLocalEvent = (item: any, isRecArea = false): LocalEvent => {
    const id = isRecArea ? `recgov-area-${item.RecAreaID}` : `recgov-${item.FacilityID}`;
    const title = isRecArea ? item.RecAreaName : item.FacilityName;
    const description = stripHtml(
      isRecArea ? (item.RecAreaDescription ?? "") : (item.FacilityDescription ?? "")
    );
    const url = isRecArea
      ? `https://www.recreation.gov/camping/gateways/${item.RecAreaID}`
      : (item.FacilityReservationURL || `https://www.recreation.gov`);
    const image: string | undefined =
      (item.MEDIA ?? []).find((m: any) => m.MediaType === "Image")?.URL;
    const addrObj = (item.FACILITYADDRESS ?? item.RECAREAADDRESS ?? [])
      .find((a: any) => a.AddressType === "Default");
    const address: string | undefined = addrObj
      ? `${addrObj.City}, ${addrObj.AddressStateCode}`
      : undefined;

    return {
      id,
      title,
      venue: title,
      address,
      date: today,
      description,
      url,
      image,
      price: item.FacilityUseFeeDescription
        ? stripHtml(item.FacilityUseFeeDescription)
        : undefined,
      category: "outdoor",
      source: "recgov",
    };
  };

  const results: LocalEvent[] = [
    ...facilities.filter((f) => f.Enabled !== false).map((f) => toLocalEvent(f, false)),
    ...recAreas.map((r) => toLocalEvent(r, true)),
  ];

  // Deduplicate by title
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  });
}
