import React, { useState } from "react";

export default function ReportIncident() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    severity: "Low Severity",
  });

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div className="w-full min-h-[calc(100vh-56px)] flex justify-center items-start p-8 bg-gray-50 dark:bg-gray-900 transition-colors">
      <form
        action="https://formspree.io/f/xzdjvlba"
        method="POST"
        className="w-full max-w-lg bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 border-t-4 border-t-blue-600 flex flex-col gap-5 transition-colors"
      >
        <h2 className="text-center text-2xl font-semibold text-blue-900 dark:text-blue-400">
          🚨 Report Incident
        </h2>

        {/* Incident Title */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">Incident Title</label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter incident title"
            required
            className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Describe what happened"
            rows={4}
            required
            className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y transition"
          />
        </div>

        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">Location</label>
          <input
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="Enter location"
            required
            className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Severity */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">Severity Level</label>
          <select
            name="severity"
            value={formData.severity}
            onChange={handleChange}
            className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition"
          >
            <option>Low Severity</option>
            <option>Medium Severity</option>
            <option>High Severity</option>
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="mt-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition w-full"
        >
          Submit Report
        </button>
      </form>
    </div>
  );
}