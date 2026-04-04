import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef } from "react";

/* ─── Tile layers ──────────────────────────────────────────── */
const TILES = {
  light: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark:  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

/* ─── Risk colour helpers ──────────────────────────────────── */
function riskKey(count) {
  if (count > 10000) return "critical";
  if (count > 5000)  return "high";
  if (count > 2000)  return "medium";
  return "low";
}

const RISK = {
  critical: { fill: "#ef4444", stroke: "#991b1b", label: "Critical" },
  high:     { fill: "#f97316", stroke: "#c2410c", label: "High"     },
  medium:   { fill: "#eab308", stroke: "#92400e", label: "Medium"   },
  low:      { fill: "#22c55e", stroke: "#166534", label: "Low"      },
};

/* ─── Tile-switcher button rendered inside the map ─────────── */
function MapThemeButton({ mapMode, setMapMode }) {
  const map = useMap();
  const isDark = mapMode === "dark";

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 1000,
      }}
    >
      <button
        onClick={() => setMapMode(isDark ? "light" : "dark")}
        title={isDark ? "Switch to Light Map" : "Switch to Dark Map"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.25)",
          background: isDark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.9)",
          color: isDark ? "#e2e8f0" : "#1e293b",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          backdropFilter: "blur(6px)",
          userSelect: "none",
          transition: "all 0.2s ease",
        }}
      >
        {isDark ? "☀️ Light Map" : "🌙 Dark Map"}
      </button>
    </div>
  );
}

/* ─── Tooltip styles injected once ─────────────────────────── */
const TOOLTIP_CSS = `
  .hotspot-tip .leaflet-tooltip {
    background: #0f172a !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 10px !important;
    color: #f1f5f9 !important;
    font-family: system-ui, sans-serif !important;
    font-size: 12px !important;
    padding: 8px 12px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
    pointer-events: none !important;
    min-width: 160px;
    line-height: 1.6;
  }
  .hotspot-tip .leaflet-tooltip::before { display:none !important; }
`;

/* ─── Route colours by route_id ─────────────────────────────── */
const ROUTE_COLORS = {
  fastest: "#3b82f6",   // blue
  safest:  "#22c55e",   // green
};
function routeColor(id) {
  return ROUTE_COLORS[id] || "#a855f7";
}

/* ─── Parse "lat, lon" text → [lat, lon] ───────────────────── */
function parseCoord(text) {
  if (!text) return null;
  const parts = text.split(",").map((s) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts;
  return null;
}

/* ─── Extract polyline coords from route segments ───────────── */
function routeToPolyline(route) {
  if (!route || !route.segments || route.segments.length === 0) return [];
  const pts = [];
  route.segments.forEach((seg, i) => {
    if (i === 0) pts.push([seg.start.lat, seg.start.lon]);
    pts.push([seg.end.lat, seg.end.lon]);
  });
  return pts;
}

/* ─── Main component ─────────────────────────────────────────
   Props:
     timeMode        – "auto" | "day" | "night"   (hotspot layer)
     routes          – array from backend /api/v1/routes/calculate
     selectedRoute   – route_id string of the selected route
*/
export default function MapWithSafeRouting({
  timeMode = "auto",
  routes = [],
  selectedRoute = null,
}) {
  const [features, setFeatures]   = useState([]);
  const [mapMode,  setMapMode]    = useState("light");
  const [loading,  setLoading]    = useState(true);
  const styleInjected             = useRef(false);

  /* Inject tooltip CSS once */
  if (!styleInjected.current) {
    const tag = document.createElement("style");
    tag.textContent = TOOLTIP_CSS;
    document.head.appendChild(tag);
    styleInjected.current = true;
  }

  /* Resolve day / night */
  const resolvedMode = (() => {
    if (timeMode === "auto") {
      const h = new Date().getHours();
      return h >= 21 || h <= 4 ? "night" : "day";
    }
    return timeMode;
  })();

  /* Fetch hotspot GeoJSON */
  useEffect(() => {
    setLoading(true);
    const url =
      resolvedMode === "night"
        ? "http://127.0.0.1:5000/api/v1/hotspots/night"
        : "http://127.0.0.1:5000/api/v1/hotspots/day";

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setFeatures(data.features || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [resolvedMode]);

  /* Build route polylines */
  const routePolylines = routes.map((r) => ({
    id:     r.route_id,
    name:   r.name,
    coords: routeToPolyline(r),
    color:  routeColor(r.route_id),
    active: r.route_id === selectedRoute,
    dist:   r.summary?.total_distance_km,
    time:   r.summary?.estimated_time_minutes,
  }));

  return (
    <div style={{ height: "600px", width: "100%", position: "relative" }}>

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(7,9,15,0.55)", backdropFilter: "blur(4px)",
          color: "#94a3b8", fontFamily: "system-ui", fontSize: 14, gap: 10,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate"
                from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
            </path>
          </svg>
          Loading hotspots…
        </div>
      )}

      <MapContainer
        center={[21.1458, 79.0882]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        preferCanvas={true}   /* faster rendering for many circles */
      >
        {/* Tile layer – keyed so it swaps instantly */}
        <TileLayer key={mapMode} url={TILES[mapMode]} />

        {/* Dark/Light toggle button inside map */}
        <MapThemeButton mapMode={mapMode} setMapMode={setMapMode} />

        {/* ── Hotspot circles ── */}
        {features.map((feature, i) => {
          const p     = feature.properties || {};
          const count = p.count || 0;
          const key   = riskKey(count);
          const risk  = RISK[key];
          const clat  = p.center_lat;
          const clng  = p.center_lng;
          if (!clat || !clng) return null;

          /* Radius: 6–18px, nicely scaled */
          const radius = Math.max(6, Math.min(18, 6 + Math.log10(Math.max(count, 1)) * 3));

          const tooltipContent = `
            <div style="font-weight:700;margin-bottom:4px;color:${risk.fill}">
              ${risk.label} Risk Zone
            </div>
            <div>Incidents: <b>${count.toLocaleString()}</b></div>
            <div>Lat: ${clat.toFixed(4)}, Lng: ${clng.toFixed(4)}</div>
            <div style="margin-top:4px;font-size:11px;color:#64748b">
             
            </div>
          `;

          return (
            <CircleMarker
              key={i}
              center={[clat, clng]}
              radius={radius}
              className="hotspot-tip"
              pathOptions={{
                fillColor:   risk.fill,
                fillOpacity: 0.55,
                color:       risk.stroke,
                weight:      1.5,
              }}
              eventHandlers={{
                mouseover: (e) => e.target.setStyle({ fillOpacity: 0.88, weight: 2.5 }),
                mouseout:  (e) => e.target.setStyle({ fillOpacity: 0.55, weight: 1.5 }),
              }}
            >
              <Tooltip
                direction="top"
                offset={[0, -radius]}
                opacity={1}
                className="hotspot-tip"
              >
                <div dangerouslySetInnerHTML={{ __html: tooltipContent }} />
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* ── Route polylines ── */}
        {routePolylines.map((r) =>
          r.coords.length > 0 ? (
            <Polyline
              key={r.id}
              positions={r.coords}
              pathOptions={{
                color:   r.color,
                weight:  r.active ? 6 : 3.5,
                opacity: r.active ? 1 : 0.55,
                dashArray: r.active ? undefined : "8 5",
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: "system-ui", fontSize: 12, lineHeight: 1.6 }}>
                  <b style={{ color: r.color }}>{r.name}</b><br />
                  🚗 {r.dist} km &nbsp;·&nbsp; ⏱ {r.time} min
                </div>
              </Tooltip>
            </Polyline>
          ) : null
        )}

      </MapContainer>
    </div>
  );
}