import React, { useState, useEffect, useRef } from "react";

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
  const [isTracking, setIsTracking]     = useState(false);
  const [locationError, setLocationError] = useState("");
  const watchIdRef = useRef(null);

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
        if (err.code === 1)      setLocationError("❌ Location permission denied. Please allow access in your browser.");
        else if (err.code === 2) setLocationError("❌ Location unavailable. Check your GPS/network.");
        else if (err.code === 3) setLocationError("❌ Location request timed out. Try again.");
        else                     setLocationError("❌ Could not get location.");
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
    if (!liveLocation) { setLocationError("⚠️ Enable live location first."); return; }
    setOriginText(`${liveLocation.lat.toFixed(6)}, ${liveLocation.lon.toFixed(6)}`);
    setLocationError("");
  };

  // Swap origin ↔ destination
  const swapLocations = () => {
    setOriginText(destText);
    setDestText(originText);
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border-t-4 border-blue-600 p-6 flex flex-col gap-5 transition">

      <h2 className="text-2xl font-semibold text-blue-900 dark:text-blue-400 text-center tracking-tight">
        🗺️ Safe Route Planner
      </h2>

      {/* Origin + Destination with swap */}
      <div className="flex flex-col gap-2">

        {/* Origin */}
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Origin
          </label>
          <input
            placeholder="Place name or lat, lon"
            value={originText}
            onChange={(e) => setOriginText(e.target.value)}
            className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 transition text-sm"
          />
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button
            onClick={swapLocations}
            title="Swap origin and destination"
            className="w-9 h-9 flex items-center justify-center rounded-full border-2 border-blue-400 bg-white dark:bg-gray-800 text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition shadow-sm text-base font-bold"
          >
            ⇅
          </button>
        </div>

        {/* Destination */}
        <div className="flex flex-col">
          <label className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Destination
          </label>
          <input
            placeholder="Place name or lat, lon"
            value={destText}
            onChange={(e) => setDestText(e.target.value)}
            className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 transition text-sm"
          />
        </div>
      </div>

      {/* Live Location Section */}
      <div className="flex flex-col gap-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
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
          <span className={`w-2.5 h-2.5 rounded-full ${isTracking ? "bg-white animate-pulse" : "bg-green-300"}`} />
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
      <div className="flex flex-col">
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
        onClick={handleGetRoute}
        disabled={loading}
        className={`py-3 rounded-lg text-white font-semibold transition text-sm ${
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
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Route Options
          </p>
          {routes.map((r) => (
            <div
              key={r.route_id}
              onClick={() => setSelectedRoute(r.route_id)}
              className={`p-3 rounded-lg cursor-pointer border text-sm transition ${
                selectedRoute === r.route_id
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200"
                  : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:border-blue-400"
              }`}
            >
              <p className="font-semibold mb-0.5">{r.name}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                🚶 {r.summary.total_distance_km} km &nbsp;·&nbsp; ⏱ {r.summary.estimated_time_minutes} mins
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}