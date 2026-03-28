import { Place } from "./places";

// Yelp Fusion API — business search
// Note: CORS blocks this on web/browser. Works fine on native iOS/Android.
// Auth: Bearer token in Authorization header.

const BASE = "https://api.yelp.com/v3";

// Map our app keywords → Yelp category aliases
const KEYWORD_TO_YELP: Record<string, string> = {
  cafe: "coffee",
  bar: "bars",
  restaurant: "restaurants",
  "art gallery": "galleries,museums",
  park: "parks",
  cinema: "movietheaters",
  museum: "museums",
  attraction: "amusements,landmarks_and_historical_buildings",
  "indoor climbing": "climbing,sportclubs",
  "point_of_interest": "active,arts",
};

function priceLabel(price?: string): string | undefined {
  return price; // Yelp already returns "$", "$$", etc.
}

export async function searchYelp(
  keyword: string,
  lat: number,
  lon: number,
  radiusM = 5000,
  limit = 10
): Promise<Place[]> {
  const key = process.env.EXPO_PUBLIC_YELP_KEY;
  const categories = KEYWORD_TO_YELP[keyword.toLowerCase()] ?? keyword;
  const radius = Math.min(radiusM, 40000); // Yelp max is 40,000m

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    radius: String(Math.round(radius)),
    categories,
    limit: String(limit),
    sort_by: "best_match",
    open_now: "true",
  });

  const res = await fetch(`${BASE}/businesses/search?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) throw new Error(`Yelp error: ${res.status}`);
  const json = await res.json();

  return (json.businesses ?? []).map((b: any): Place => ({
    place_id: `yelp-${b.id}`,
    name: b.name,
    vicinity: b.location?.display_address?.join(", ") ?? "",
    photoUrl: b.image_url,
    rating: b.rating,
    reviewCount: b.review_count,
    price: priceLabel(b.price),
    url: b.url,
  }));
}
