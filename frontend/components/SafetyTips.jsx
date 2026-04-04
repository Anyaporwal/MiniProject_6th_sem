import React from "react";

export default function SafetyTips() {
  return (
    <div className="max-w-6xl mx-auto my-10 px-4 animate-[fadeIn_1s_ease] transition-colors">

      {/* Header */}
      <h1 className="text-center mb-2 text-blue-900 dark:text-blue-400 text-3xl md:text-4xl font-semibold">
        🛡️ Public Safety Guide
      </h1>

      <p className="text-center text-gray-600 dark:text-gray-300 mb-8 text-base md:text-lg">
        Follow these safety guidelines while traveling or moving around the city.
      </p>

      {/* Safety Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl border-l-4 border-blue-600 shadow-lg hover:-translate-y-1 hover:shadow-xl transition transform">
          <h3 className="mb-2 text-blue-600 dark:text-blue-400 text-lg font-semibold">🚶 General Safety</h3>
          <ul className="pl-5 leading-7 text-gray-700 dark:text-gray-200">
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Avoid isolated or poorly lit areas at night.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Stay aware of your surroundings.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Keep emergency contacts easily accessible.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Inform friends/family when travelling alone.</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl border-l-4 border-blue-600 shadow-lg hover:-translate-y-1 hover:shadow-xl transition transform">
          <h3 className="mb-2 text-blue-600 dark:text-blue-400 text-lg font-semibold">🚗 Travel Safety</h3>
          <ul className="pl-5 leading-7 text-gray-700 dark:text-gray-200">
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Share live location with trusted contacts.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Use verified transport services.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Keep your phone charged.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Avoid displaying valuables in crowded areas.</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl border-l-4 border-blue-600 shadow-lg hover:-translate-y-1 hover:shadow-xl transition transform">
          <h3 className="mb-2 text-blue-600 dark:text-blue-400 text-lg font-semibold">🚆 Public Transport</h3>
          <ul className="pl-5 leading-7 text-gray-700 dark:text-gray-200">
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Stay near populated areas or station staff.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Prefer well-lit stations and stops.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Report suspicious activity immediately.</li>
            <li className="transition-transform hover:translate-x-1 hover:text-blue-600 dark:hover:text-blue-400">Stand near CCTV monitored zones.</li>
          </ul>
        </div>

      </div>

      {/* Helpline Section */}
      <div className="mt-10 bg-gradient-to-br from-blue-50 dark:from-gray-700 to-blue-100 dark:to-gray-800 p-6 md:p-8 rounded-xl shadow-lg transition-colors">

        <h2 className="text-blue-900 dark:text-blue-400 text-xl md:text-2xl font-semibold mb-4">
          📞 Emergency Helplines (Nagpur, Maharashtra)
        </h2>

        {[
          { name: "🚓 Police Emergency", number: "100" },
          { name: "🚨 National Emergency", number: "112" },
          { name: "👩 Women Helpline", number: "1091" },
          { name: "🚑 Ambulance", number: "108" },
          { name: "🔥 Fire Emergency", number: "101" },
          { name: "🧒 Child Helpline", number: "1098" },
          { name: "📍 Nagpur Police Control Room", number: "07122565001" }
        ].map((item, index) => (
          <div
            key={index}
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b last:border-none hover:bg-blue-50 dark:hover:bg-gray-700 px-2 rounded-md transition-colors"
          >
            <span className="mb-2 sm:mb-0 text-gray-800 dark:text-gray-200">{item.name}</span>

            <a
              href={`tel:${item.number}`}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-800 dark:hover:bg-blue-700 hover:shadow-md transition"
            >
              Call {item.number}
            </a>
          </div>
        ))}

      </div>
    </div>
  );
}