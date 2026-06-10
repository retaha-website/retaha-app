export interface WeatherResult {
  temp: number;
  emoji: string;
  text: string;
}

const cache = new Map<string, { data: WeatherResult; ts: number }>();
const TTL = 60 * 60 * 1000; // 1h

const EMOJI: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export async function fetchWeather(lat: number, lng: number): Promise<WeatherResult | null> {
  const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const json = await res.json();
    const temp = Math.round(json.current?.temperature_2m ?? 0);
    const code: number = json.current?.weather_code ?? 0;
    const emoji = EMOJI[code] ?? '🌡️';
    const data: WeatherResult = { temp, emoji, text: `${temp}°C ${emoji}` };
    cache.set(key, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}
