import { useState } from "react";
import Navbar from "./components/Navbar";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import HeatmapPanel from "./components/HeatmapPanel";
import MapWithSafeRouting from "./components/MapWithSafeRouting";
import RoutePanel from "./components/RoutePanel";
import ReportIncident from "./components/ReportIncident";
import SafetyTips from "./components/SafetyTips";

async function geocode(text) {
  const trimmed = text.trim();
  const parts = trimmed.split(",").map((s) => s.trim());
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data && data.length > 0)
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
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

    const origin      = await geocode(originText);
    const destination = await geocode(destText);

    if (!origin) {
      setStatus(`❌ Could not find: "${originText}"`);
      setLoading(false);
      return;
    }
    if (!destination) {
      setStatus(`❌ Could not find: "${destText}"`);
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