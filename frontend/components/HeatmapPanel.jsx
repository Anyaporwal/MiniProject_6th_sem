import React from "react";

export default function HeatmapPanel({ timeMode, setTimeMode }) {
  return (
    <div className="
      max-w-[340px]
      bg-white dark:bg-gray-900
      p-6 rounded-[14px] shadow-lg
      border border-gray-200 dark:border-gray-700
      flex flex-col gap-3 font-sans
    ">
      <h3 className="text-center font-semibold tracking-wide text-gray-800 dark:text-gray-200">
        Risk Heatmap
      </h3>

      <p className="text-sm text-red-700 dark:text-red-300
        bg-red-100 dark:bg-red-900/40 p-2.5 rounded-md
        border border-red-200 dark:border-red-700 font-medium">
        Red circles indicate high crime density zones. Hover a circle for details.
      </p>

      {/* Time mode */}
      <select
        value={timeMode}
        onChange={(e) => setTimeMode(e.target.value)}
        className="p-2.5 rounded-lg border border-gray-300 dark:border-gray-600
          bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200
          text-sm outline-none cursor-pointer transition
          hover:border-blue-600 focus:border-blue-600"
      >
        <option value="auto">Auto Mode (Day / Night)</option>
        <option value="day">☀️ Day View</option>
        <option value="night">🌙 Night View</option>
      </select>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 mt-1">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Risk Legend
        </p>
        {[
          { color: "#ef4444", label: "Critical  (10,000+ incidents)" },
          { color: "#f97316", label: "High  (5,000 – 10,000)"       },
          { color: "#eab308", label: "Medium  (2,000 – 5,000)"      },
          { color: "#22c55e", label: "Low  (< 2,000)"               },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        💡 Use the 🌙 / ☀️ button on the map to switch between dark and light tiles.
      </p>
    </div>
  );
}