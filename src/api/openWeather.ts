// Uses Open-Meteo (open-meteo.com) — free, no API key required, 10k calls/day.
// WMO weather code reference: https://open-meteo.com/en/docs#weathervariables

export interface WeatherContext {
  temp: number;
  description: string;
  isRainy: boolean;
  isCold: boolean;
  isHot: boolean;
  sunsetTime: string;
  icon: string;
}

// WMO 4677 weather interpretation codes
function interpretCode(code: number): { description: string; icon: string; isRainy: boolean } {
  if (code === 0) return { description: "clear sky", icon: "☀️", isRainy: false };
  if (code <= 2) return { description: "partly cloudy", icon: "⛅", isRainy: false };
  if (code === 3) return { description: "overcast", icon: "☁️", isRainy: false };
  if (code <= 49) return { description: "foggy", icon: "🌫️", isRainy: false };
  if (code <= 57) return { description: "drizzle", icon: "🌦️", isRainy: true };
  if (code <= 67) return { description: "rain", icon: "🌧️", isRainy: true };
  if (code <= 77) return { description: "snow", icon: "❄️", isRainy: false };
  if (code <= 82) return { description: "rain showers", icon: "🌧️", isRainy: true };
  if (code <= 86) return { description: "snow showers", icon: "🌨️", isRainy: false };
  return { description: "thunderstorm", icon: "⛈️", isRainy: true };
}

function formatSunset(isoTime: string): string {
  // isoTime is "HH:MM" local time from Open-Meteo daily sunset
  const [h, m] = isoTime.split("T")[1]?.split(":") ?? isoTime.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<WeatherContext> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weathercode` +
    `&daily=sunset` +
    `&temperature_unit=fahrenheit` +
    `&timezone=auto` +
    `&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();

  const temp = Math.round(data.current.temperature_2m);
  const code: number = data.current.weathercode;
  const { description, icon, isRainy } = interpretCode(code);
  const sunsetIso: string = data.daily.sunset?.[0] ?? "";

  return {
    temp,
    description,
    isRainy,
    isCold: temp < 45,
    isHot: temp > 85,
    sunsetTime: sunsetIso ? formatSunset(sunsetIso) : "—",
    icon,
  };
}
