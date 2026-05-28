// src/components/widgets/WeatherWidget.tsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Widget } from "../../types/widget";

function interpretWeatherCode(code: number): { label: string; emoji: string } {
  if (code === 0)  return { label: "Clear sky",     emoji: "☀️" };
  if (code <= 2)   return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3)  return { label: "Overcast",      emoji: "☁️" };
  if (code <= 49)  return { label: "Foggy",         emoji: "🌫️" };
  if (code <= 59)  return { label: "Drizzle",       emoji: "🌦️" };
  if (code <= 69)  return { label: "Rain",          emoji: "🌧️" };
  if (code <= 79)  return { label: "Snow",          emoji: "❄️" };
  if (code <= 84)  return { label: "Rain showers",  emoji: "🌧️" };
  if (code <= 94)  return { label: "Snow showers",  emoji: "🌨️" };
  return                  { label: "Thunderstorm",  emoji: "⛈️" };
}

interface WeatherData { temperature: number; weatherCode: number; windSpeed: number; humidity: number; }
interface WeatherWidgetData { cityName?: string; lat?: number; lon?: number; }
interface WeatherWidgetProps { widget: Widget; onUpdateData: (widgetId: string, data: Record<string, unknown>) => void; }

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function getSavedData(widget: Widget): WeatherWidgetData {
  return {
    cityName: typeof widget.data.cityName === "string" ? widget.data.cityName : undefined,
    lat:      typeof widget.data.lat      === "number" ? widget.data.lat      : undefined,
    lon:      typeof widget.data.lon      === "number" ? widget.data.lon      : undefined,
  };
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ widget, onUpdateData }) => {
  const saved = getSavedData(widget);

  const [weather,   setWeather]   = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error,     setError]     = useState<string>("");
  const [cityInput, setCityInput] = useState<string>(saved.cityName ?? "");
  const [isEditing, setIsEditing] = useState<boolean>(!saved.lat);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setIsLoading(true);
    setError("");
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&wind_speed_unit=kmh&timezone=auto`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as {
        current: { temperature_2m: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number }
      };
      setWeather({
        temperature: Math.round(json.current.temperature_2m),
        weatherCode: json.current.weather_code,
        windSpeed:   Math.round(json.current.wind_speed_10m),
        humidity:    json.current.relative_humidity_2m,
      });
    } catch (e) {
      console.error("[Weather] fetchWeather failed:", e);
      setError("Failed to fetch weather. Check connection.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveLocation = useCallback(
    async (cityName: string, lat: number, lon: number) => {
      onUpdateData(widget.id, { ...widget.data, cityName, lat, lon });
      setCityInput(cityName);
      setIsEditing(false);
      await fetchWeather(lat, lon);
    },
    [fetchWeather, onUpdateData, widget.data, widget.id]
  );

  const handleSearch = useCallback(async () => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError("");
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
      const res    = await fetch(geoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json   = await res.json() as { results?: Array<{ latitude: number; longitude: number; name: string }> };
      if (!json.results || json.results.length === 0) {
        setError(`City "${trimmed}" not found.`);
        setIsLoading(false);
        return;
      }
      const { latitude, longitude, name } = json.results[0];
      await saveLocation(name, latitude, longitude);
    } catch (e) {
      console.error("[Weather] geocode failed:", e);
      setError("Geocoding failed. Try again.");
      setIsLoading(false);
    }
  }, [cityInput, saveLocation]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Current location is not available on this device.");
      return;
    }

    setIsLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        void saveLocation("Current location", latitude, longitude);
      },
      (locationError) => {
        console.error("[Weather] current location failed:", locationError);
        setError("Location permission was blocked. You can type a city instead.");
        setIsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  }, [saveLocation]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (saved.lat && saved.lon) { void fetchWeather(saved.lat, saved.lon); } }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!saved.lat || !saved.lon) return;
    timerRef.current = setInterval(() => {
      if (saved.lat && saved.lon) void fetchWeather(saved.lat, saved.lon);
    }, REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [saved.lat, saved.lon]);

  // ── Styles ────────────────────────────────────────────────────────────────
  // แก้ B3: เพิ่ม minWidth: 0 เพื่อให้ input ยืดหยุ่นได้เต็มที่ ไม่ดันปุ่ม Go หลุดขอบ
  const inputStyle: React.CSSProperties = {
    flex:        1,
    minWidth:    0,           // ← เพิ่มใหม่: ทำให้ input shrink ได้จริงใน flex container
    padding:     "6px 10px",
    borderRadius:"6px",
    border:      "1px solid var(--input-border)",
    background:  "var(--input-bg)",
    color:       "var(--text-primary)",
    fontSize:    "12px",
    outline:     "none",
    fontFamily:  "inherit",
  };

  const btnStyle: React.CSSProperties = {
    padding:     "6px 12px",
    borderRadius:"6px",
    border:      "1px solid var(--accent-color)",
    background:  "color-mix(in srgb, var(--accent-color) 15%, transparent)",
    color:       "var(--accent-color)",
    fontSize:    "11px",
    cursor:      "pointer",
    fontFamily:  "inherit",
    flexShrink:  0,
  };

  const { label: weatherLabel, emoji } = weather
    ? interpretWeatherCode(weather.weatherCode)
    : { label: "", emoji: "" };

  // ── Render: Set Location ──────────────────────────────────────────────────
  if (isEditing) {
    return (
      <div style={{ width: "100%", height: "100%", background: "var(--widget-bg)", borderRadius: "14px", border: "1px solid var(--widget-border)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px", flex: 1, justifyContent: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>🌤 Set Location</p>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. Bangkok"
              value={cityInput}
              maxLength={80}
              onChange={(e) => { setCityInput(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSearch(); }}
              autoFocus
            />
            <button style={btnStyle} onClick={() => void handleSearch()} disabled={isLoading}>
              {isLoading ? "…" : "Go"}
            </button>
          </div>
          <button
            style={{ ...btnStyle, width: "100%" }}
            onClick={handleUseCurrentLocation}
            disabled={isLoading}
          >
            Use current location
          </button>
          {error && <p style={{ fontSize: "11px", color: "var(--accent-red)" }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Render: Weather display ───────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", background: "var(--widget-bg)", borderRadius: "14px", border: "1px solid var(--widget-border)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <p style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-primary)" }}>
          🌤 {saved.cityName ?? widget.label}
        </p>
        <button
          style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", padding: "2px 6px" }}
          onClick={() => setIsEditing(true)}
          title="Change location"
        >
          ✎
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px", gap: "6px" }}>
        {isLoading && !weather && <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Loading…</p>}
        {error && !weather && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "11px", color: "var(--accent-red)", marginBottom: "8px" }}>{error}</p>
            <button style={btnStyle} onClick={() => { if (saved.lat && saved.lon) void fetchWeather(saved.lat, saved.lon); }}>Retry</button>
          </div>
        )}
        {weather && (
          <>
            <p style={{ fontSize: "42px", lineHeight: 1 }}>{emoji}</p>
            <p style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-primary)", lineHeight: 1 }}>{weather.temperature}°C</p>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{weatherLabel}</p>
            <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "10px", color: "var(--text-dim)" }}>Humidity</p>
                <p style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: "600" }}>{weather.humidity}%</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: "10px", color: "var(--text-dim)" }}>Wind</p>
                <p style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: "600" }}>{weather.windSpeed} km/h</p>
              </div>
            </div>
            <button
              style={{ ...btnStyle, marginTop: "8px", fontSize: "10px", padding: "4px 12px" }}
              onClick={() => { if (saved.lat && saved.lon) void fetchWeather(saved.lat, saved.lon); }}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WeatherWidget;
