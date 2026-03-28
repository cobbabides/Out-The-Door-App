export interface Place {
  place_id: string;
  name: string;
  photoRef?: string;   // Google photo reference (pass to getPhotoUrl)
  photoUrl?: string;   // Direct image URL (Yelp, etc.)
  vicinity: string;
  rating?: number;
  reviewCount?: number;
  price?: string;      // "$", "$$", etc.
  url?: string;        // Yelp page or maps link
}

export function getPhotoUrl(photoRef: string, maxWidth = 400): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoRef}&key=${key}`;
}

export async function searchPlaces(
  keyword: string,
  lat: number,
  lon: number,
  radius = 5000 // m
): Promise<Place[]> {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lon}` +
    `&radius=${radius}` +
    `&keyword=${encodeURIComponent(keyword)}` +
    `&key=${key}` +
    `&opennow=true`;
  const res = await fetch(url);
  const json = await res.json();
  return (json.results ?? []).slice(0, 10).map((p: any) => ({
    place_id: p.place_id,
    name: p.name,
    vicinity: p.vicinity,
    photoRef: p.photos?.[0]?.photo_reference,
    rating: p.rating,
  }));
}
