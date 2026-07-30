import React, { useState, useEffect, useRef } from "react";

// ============================================================================
// Autocomplete Input Component
// ============================================================================
const LocationAutocomplete = ({
  label,
  value,
  onChange,
  onSelect,
  onClearData,
  placeholder
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const wrapperRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions with debounce
  useEffect(() => {
    // Only fetch if we have 2+ characters and the menu is meant to be open
    if (!value || value.length < 2 || !showMenu) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      setLoading(true);

      try {
        // Bounding box for Nagpur to strictly restrict results:
        // Min Lon: 78.9, Min Lat: 20.9, Max Lon: 79.2, Max Lat: 21.3
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          value
        )}&bbox=78.9,20.9,79.2,21.3&limit=15`;
        
        const res = await fetch(url, { signal: abortControllerRef.current.signal });
        const data = await res.json();

        // Process and filter results
        const filtered = (data.features || [])
          .filter((f) => {
            const props = f.properties;
            if (!props) return false;
            // Additional fallback filter just in case bbox catches borders
            const state = (props.state || "").toLowerCase();
            const city = (props.city || "").toLowerCase();
            const county = (props.county || "").toLowerCase();
            const district = (props.district || "").toLowerCase();
            
            const isMH = state.includes("maharashtra");
            const isNagpur =
              city.includes("nagpur") ||
              county.includes("nagpur") ||
              district.includes("nagpur") ||
              (props.name || "").toLowerCase().includes("nagpur");
              
            return isMH && isNagpur;
          })
          .map((f) => {
            const props = f.properties;
            const name = props.name || "Unknown Place";
            
            // Build a clean full address without duplicate words
            const addressParts = [
              props.street,
              props.locality,
              props.city,
              props.state,
              props.postcode
            ].filter(Boolean);
            
            const fullAddress = [...new Set(addressParts)].join(", ");

            return {
              name,
              fullAddress,
              lat: f.geometry.coordinates[1],
              lon: f.geometry.coordinates[0],
            };
          })
          .filter((item) => item.name);

        // Deduplicate suggestions that point to the same name and nearby coordinates
        const unique = [];
        const map = new Set();
        for (const item of filtered) {
          const key = `${item.name}-${item.lat.toFixed(3)}-${item.lon.toFixed(3)}`;
          if (!map.has(key)) {
            map.add(key);
            unique.push(item);
          }
        }

        setSuggestions(unique.slice(0, 10)); // Limit to max 10 to keep DOM light
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Autocomplete fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [value, showMenu]);

  return (
    <div className="flex flex-col relative" ref={wrapperRef}>
      <label className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onClearData(); // Clear the exact coordinate data since text changed
            setShowMenu(true);
          }}
          onFocus={() => {
            if (value && value.length >= 2) setShowMenu(true);
          }}
          className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 transition text-sm"
        />
        {/* Loading Indicator */}
        {loading && showMenu && (
          <div className="absolute right-3 top-3.5">
            <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block"></span>
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showMenu && suggestions.length > 0 && (
        <ul className="absolute z-50 top-[72px] w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
          {suggestions.map((s, idx) => (
            <li
              key={idx}
              onClick={() => {
                onSelect(s);
                setShowMenu(false);
              }}
              className="p-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition flex flex-col"
            >
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                📍 {s.name}
              </span>
              {s.fullAddress && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {s.fullAddress}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ============================================================================
// Main RoutePanel Component
// ============================================================================
export default function RoutePanel({
  originText,
  setOriginText,
  destText,
  setDestText,
  timeMode,
  setTimeMode,
  handleGetRoute,
  loading,
  status,
  routes,
  selectedRoute,
  setSelectedRoute,
  liveLocation: liveLocationProp = null,
  setLiveLocation,
}) {
  const [internalLive, setInternalLive] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationError, setLocationError] = useState("");
  const watchIdRef = useRef(null);

  // New state to store exact coordinates from autocomplete or live location
  // Structure: { name: string, lat: number, lon: number }
  const [originData, setOriginData] = useState(null);
  const [destData, setDestData] = useState(null);

  const liveLocation = internalLive || liveLocationProp;

  const startLiveLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setInternalLive(loc);
        if (setLiveLocation) setLiveLocation(loc);
        setIsTracking(true);
        setLocationError("");
      },
      (err) => {
        if (err.code === 1) setLocationError("❌ Location permission denied. Please allow access in your browser.");
        else if (err.code === 2) setLocationError("❌ Location unavailable. Check your GPS/network.");
        else if (err.code === 3) setLocationError("❌ Location request timed out. Try again.");
        else setLocationError("❌ Could not get location.");
        setIsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const stopLiveLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setInternalLive(null);
    if (setLiveLocation) setLiveLocation(null);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const useLiveAsOrigin = () => {
    if (!liveLocation) {
      setLocationError("⚠️ Enable live location first.");
      return;
    }
    setOriginText(`${liveLocation.lat.toFixed(6)}, ${liveLocation.lon.toFixed(6)}`);
    setOriginData({
      name: "Live Location",
      lat: liveLocation.lat,
      lon: liveLocation.lon,
    });
    setLocationError("");
  };

  // Swap origin ↔ destination, including their text and stored coordinate data
  const swapLocations = () => {
    setOriginText(destText);
    setDestText(originText);
    
    const tempCoords = originData;
    setOriginData(destData);
    setDestData(tempCoords);
  };

  // Wrapper for handleGetRoute to pass along exact coordinates if available
  const onGetRouteClick = () => {
    // By passing originData and destData, the parent App.jsx can optionally
    // intercept exact coordinates without breaking its existing signature.
    // If handleGetRoute takes no arguments, it safely ignores them.
    handleGetRoute(originData, destData);
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border-t-4 border-blue-600 p-6 flex flex-col gap-5 transition">
      <h2 className="text-2xl font-semibold text-blue-900 dark:text-blue-400 text-center tracking-tight">
        🗺️ Safe Route Planner
      </h2>

      {/* Origin + Destination with swap */}
      <div className="flex flex-col gap-2">
        {/* Origin Autocomplete */}
        <LocationAutocomplete
          label="Origin"
          placeholder="Place name or lat, lon"
          value={originText}
          onChange={setOriginText}
          onClearData={() => setOriginData(null)}
          onSelect={(suggestion) => {
            setOriginText(suggestion.name);
            setOriginData({
              name: suggestion.name,
              lat: suggestion.lat,
              lon: suggestion.lon,
            });
          }}
        />

        {/* Swap button */}
        <div className="flex justify-center z-10 my-1">
          <button
            onClick={swapLocations}
            title="Swap origin and destination"
            className="w-9 h-9 flex items-center justify-center rounded-full border-2 border-blue-400 bg-white dark:bg-gray-800 text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition shadow-sm text-base font-bold"
          >
            ⇅
          </button>
        </div>

        {/* Destination Autocomplete */}
        <LocationAutocomplete
          label="Destination"
          placeholder="Place name or lat, lon"
          value={destText}
          onChange={setDestText}
          onClearData={() => setDestData(null)}
          onSelect={(suggestion) => {
            setDestText(suggestion.name);
            setDestData({
              name: suggestion.name,
              lat: suggestion.lat,
              lon: suggestion.lon,
            });
          }}
        />
      </div>

      {/* Live Location Section */}
      <div className="flex flex-col gap-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 mt-2">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          Live Location
        </p>

        {/* Tracking status */}
        {liveLocation && isTracking && (
          <div className="text-xs text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            {liveLocation.lat.toFixed(5)}, {liveLocation.lon.toFixed(5)}
          </div>
        )}

        {locationError && (
          <div className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2">
            {locationError}
          </div>
        )}

        <button
          onClick={isTracking ? stopLiveLocation : startLiveLocation}
          className={`w-full py-2.5 rounded-lg text-white text-sm font-semibold transition flex items-center justify-center gap-2 ${
            isTracking
              ? "bg-red-500 hover:bg-red-600"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isTracking ? "bg-white animate-pulse" : "bg-green-300"
            }`}
          />
          {isTracking ? "Stop Tracking" : "Enable Live Location"}
        </button>

        <button
          onClick={useLiveAsOrigin}
          disabled={!liveLocation}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 border ${
            liveLocation
              ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              : "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60"
          }`}
        >
          📌 Use as Origin
        </button>
      </div>

      {/* Time Mode */}
      <div className="flex flex-col mt-1">
        <label className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Time Mode
        </label>
        <select
          value={timeMode}
          onChange={(e) => setTimeMode(e.target.value)}
          className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition text-sm"
        >
          <option value="auto">⚡ Auto (Day / Night)</option>
          <option value="day">☀️ Day</option>
          <option value="night">🌙 Night</option>
        </select>
      </div>

      {/* Get Route */}
      <button
        onClick={onGetRouteClick}
        disabled={loading}
        className={`py-3 mt-1 rounded-lg text-white font-semibold transition text-sm ${
          loading
            ? "bg-blue-300 dark:bg-blue-800 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 active:scale-95"
        }`}
      >
        {loading ? "⏳ Finding Routes..." : "🗺️ Get Safe Routes"}
      </button>

      {/* Status */}
      {status && (
        <div className="p-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg border border-gray-200 dark:border-gray-600">
          {status}
        </div>
      )}

      {/* Route Options */}
      {routes && routes.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Route Options
          </p>
          {routes.map((r) => (
            <div
              key={r.route_id}
              onClick={() => setSelectedRoute(r.route_id)}
              className={`p-3 rounded-lg cursor-pointer border text-sm transition flex flex-col gap-0.5 ${
                selectedRoute === r.route_id
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200"
                  : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:border-blue-400"
              }`}
            >
              <p className="font-semibold">{r.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                🚶 {r.summary.total_distance_km} km &nbsp;·&nbsp; ⏱{" "}
                {r.summary.estimated_time_minutes} mins
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}