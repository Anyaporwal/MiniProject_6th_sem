import { useState } from "react";
import Navbar from "./components/Navbar";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import HeatmapPanel from "./components/HeatmapPanel";
import MapWithSafeRouting from "./components/MapWithSafeRouting";
import RoutePanel from "./components/RoutePanel";
import ReportIncident from "./components/ReportIncident";
import SafetyTips from "./components/SafetyTips";

// Nagpur city center + max allowed radius for any geocoded/typed result.
// Anything resolved outside this radius is rejected rather than silently
// routed to, so a bad match never turns into a 500km "safe route".
const NAGPUR_CENTER = { lat: 21.1458, lon: 79.0882 };
const NAGPUR_RADIUS_KM = 35;

// Bounding box around Nagpur for Nominatim's viewbox+bounded params
// (roughly a 0.6° box centered on the city — comfortably covers the
// full urban area with margin, while still excluding other cities).
const NAGPUR_VIEWBOX = "78.79,21.45,79.39,20.85"; // left,top,right,bottom

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isInsideNagpur(lat, lon) {
  return distanceKm(NAGPUR_CENTER.lat, NAGPUR_CENTER.lon, lat, lon) <= NAGPUR_RADIUS_KM;
}

// Fallback geocoder — only used when the user typed free text or raw
// "lat, lon" WITHOUT picking a suggestion from RoutePanel's autocomplete.
// Restricted to Nagpur via Nominatim's viewbox+bounded, then double
// checked with a distance filter so nothing outside the city ever slips
// through as a "match".
async function geocode(text) {
  const trimmed = text.trim();
  const parts = trimmed.split(",").map((s) => s.trim());
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      if (!isInsideNagpur(lat, lon)) return { error: "outside_nagpur" };
      return { lat, lon };
    }
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        trimmed
      )}&format=json&limit=1&viewbox=${NAGPUR_VIEWBOX}&bounded=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (!isInsideNagpur(lat, lon)) return { error: "outside_nagpur" };
      return { lat, lon };
    }
  } catch (e) {
    console.error("Geocoding failed:", e);
  }
  return null;
}

export default function App() {
  const [activePage, setActivePage] = useState(
    () => localStorage.getItem("activePage") || "heatmap"
  );
  const handleSetActivePage = (page) => {
    setActivePage(page);
    localStorage.setItem("activePage", page);
  };

  const [timeMode, setTimeMode] = useState("auto");
  const [mapStyle, setMapStyle] = useState("street");

  const [originText, setOriginText]       = useState("");
  const [destText, setDestText]           = useState("");
  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState("");
  const [routes, setRoutes]               = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [liveLocation, setLiveLocation]   = useState(null);

  // Resolved coords for map markers
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords,   setDestCoords]   = useState(null);

  // Place selected from RoutePanel's Nagpur-only autocomplete dropdown.
  // { name, lat, lon } | null. When present, these coordinates are used
  // directly for routing — no re-geocoding, so no chance of the text
  // being re-resolved to the wrong place.
  const [originPlace, setOriginPlace] = useState(null);
  const [destPlace,   setDestPlace]   = useState(null);

  const handleGetRoute = async () => {
    if (!originText.trim() || !destText.trim()) {
      setStatus("⚠️ Please enter both origin and destination.");
      return;
    }
    setLoading(true);
    setStatus("📍 Resolving locations...");
    setRoutes([]);
    setSelectedRoute(null);
    setOriginCoords(null);
    setDestCoords(null);

    // Prefer coordinates from the autocomplete selection (already
    // Nagpur-restricted at the source). Only fall back to geocoding
    // the raw text if the user typed something without picking a
    // suggestion (e.g. manual "lat, lon" or free text).
    let origin = originPlace
      ? { lat: originPlace.lat, lon: originPlace.lon }
      : await geocode(originText);

    let destination = destPlace
      ? { lat: destPlace.lat, lon: destPlace.lon }
      : await geocode(destText);

    if (!origin || origin.error === "outside_nagpur") {
      setStatus(
        origin?.error === "outside_nagpur"
          ? `❌ "${originText}" is outside Nagpur. Please pick a location from the suggestions.`
          : `❌ Could not find: "${originText}"`
      );
      setLoading(false);
      return;
    }
    if (!destination || destination.error === "outside_nagpur") {
      setStatus(
        destination?.error === "outside_nagpur"
          ? `❌ "${destText}" is outside Nagpur. Please pick a location from the suggestions.`
          : `❌ Could not find: "${destText}"`
      );
      setLoading(false);
      return;
    }

    setOriginCoords(origin);
    setDestCoords(destination);
    setStatus("🔄 Fetching safe routes...");

    try {
      const res = await fetch("http://127.0.0.1:5000/api/v1/routes/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin:      { lat: origin.lat,      lon: origin.lon },
          destination: { lat: destination.lat, lon: destination.lon },
          preferences: { mode: timeMode },
        }),
      });
      const data = await res.json();
      const fetched = data.routes || [];
      if (fetched.length === 0) {
        setStatus("❌ No routes found. Try different locations.");
      } else {
        setRoutes(fetched);
        setSelectedRoute(fetched[0].route_id);
        setStatus("");
      }
    } catch {
      setStatus("❌ Failed to fetch routes. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors font-sans">
      <Navbar activePage={activePage} setActivePage={handleSetActivePage} />

      {activePage === "login" && <AuthPage />}

      {/* Heatmap */}
      {activePage === "heatmap" && (
        <div className="flex gap-6 p-6" style={{ minHeight: "calc(100vh - 56px)" }}>
          <div className="w-72 shrink-0">
            <HeatmapPanel timeMode={timeMode} setTimeMode={setTimeMode} />
          </div>
          <div className="flex-1 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700" style={{ minHeight: "600px" }}>
            <MapWithSafeRouting
              timeMode={timeMode}
              routes={[]}
              selectedRoute={null}
              mapStyle={mapStyle}
              setMapStyle={setMapStyle}
            />
          </div>
        </div>
      )}

      {/* Safe Route */}
      {activePage === "route" && (
        <div className="flex gap-6 p-6" style={{ minHeight: "calc(100vh - 56px)" }}>
          <div className="w-80 shrink-0">
            <RoutePanel
              originText={originText}
              setOriginText={setOriginText}
              destText={destText}
              setDestText={setDestText}
              timeMode={timeMode}
              setTimeMode={setTimeMode}
              handleGetRoute={handleGetRoute}
              loading={loading}
              status={status}
              routes={routes}
              selectedRoute={selectedRoute}
              setSelectedRoute={setSelectedRoute}
              setLiveLocation={setLiveLocation}
              originPlace={originPlace}
              setOriginPlace={setOriginPlace}
              destPlace={destPlace}
              setDestPlace={setDestPlace}
            />
          </div>
          <div className="flex-1 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700" style={{ minHeight: "600px" }}>
            <MapWithSafeRouting
              timeMode={timeMode}
              routes={routes}
              selectedRoute={selectedRoute}
              mapStyle={mapStyle}
              setMapStyle={setMapStyle}
              liveLocation={liveLocation}
              originCoords={originCoords}
              destCoords={destCoords}
            />
          </div>
        </div>
      )}

      {activePage === "report"    && <ReportIncident />}
      {activePage === "tips"      && <SafetyTips />}
      {activePage === "dashboard" && <Dashboard />}
    </div>
  );
}