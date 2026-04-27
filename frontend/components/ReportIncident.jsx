import React, { useState, useRef, useEffect } from "react";

// Nagpur places list
const NAGPUR_PLACES = [
  { name: "Railway Station",          full: "Nagpur Railway Station, Nagpur" },
  { name: "Ajni Railway Station",     full: "Ajni Railway Station, Nagpur" },
  { name: "Itwari Railway Station",   full: "Itwari Railway Station, Nagpur" },
  { name: "Airport",                  full: "Dr. Babasaheb Ambedkar International Airport, Nagpur" },
  { name: "MSRTC Bus Stand",          full: "MSRTC Central Bus Stand, Nagpur" },
  { name: "Ganeshpeth Bus Stand",     full: "Ganeshpeth Bus Stand, Nagpur" },

  { name: "Zero Mile",                full: "Zero Mile, Nagpur" },
  { name: "Sitabuldi",                full: "Sitabuldi, Nagpur" },
  { name: "Sadar",                    full: "Sadar, Nagpur" },
  { name: "Mahal",                    full: "Mahal, Nagpur" },
  { name: "Itwari",                   full: "Itwari, Nagpur" },
  { name: "Gandhibagh",               full: "Gandhibagh, Nagpur" },
  { name: "Civil Lines",              full: "Civil Lines, Nagpur" },
  { name: "Dharampeth",               full: "Dharampeth, Nagpur" },
  { name: "Ramdaspeth",               full: "Ramdaspeth, Nagpur" },
  { name: "Shankar Nagar",            full: "Shankar Nagar, Nagpur" },
  { name: "Seminary Hills",           full: "Seminary Hills, Nagpur" },
  { name: "Bajaj Nagar",              full: "Bajaj Nagar, Nagpur" },
  { name: "Laxmi Nagar",              full: "Laxmi Nagar, Nagpur" },
  { name: "Trimurti Nagar",           full: "Trimurti Nagar, Nagpur" },
  { name: "Pratap Nagar",             full: "Pratap Nagar, Nagpur" },
  { name: "Manish Nagar",             full: "Manish Nagar, Nagpur" },
  { name: "Wardhaman Nagar",          full: "Wardhaman Nagar, Nagpur" },
  { name: "Lakadganj",                full: "Lakadganj, Nagpur" },
  { name: "Nandanvan",                full: "Nandanvan, Nagpur" },
  { name: "Sakkardara",               full: "Sakkardara, Nagpur" },
  { name: "Mankapur",                 full: "Mankapur, Nagpur" },
  { name: "Kapil Nagar",              full: "Kapil Nagar, Nagpur" },
  { name: "Zingabai Takli",           full: "Zingabai Takli, Nagpur" },
  { name: "Wathoda",                  full: "Wathoda, Nagpur" },
  { name: "Besa",                     full: "Besa, Nagpur" },
  { name: "Khapri",                   full: "Khapri, Nagpur" },
  { name: "Sonegaon",                 full: "Sonegaon, Nagpur" },
  { name: "Ambazari",                 full: "Ambazari, Nagpur" },
  { name: "Khamla",                   full: "Khamla, Nagpur" },
  { name: "Hingna",                   full: "Hingna, Nagpur" },
  { name: "Butibori",                 full: "Butibori, Nagpur" },
  { name: "Kalamna",                  full: "Kalamna, Nagpur" },
  { name: "Pardi",                    full: "Pardi, Nagpur" },
  { name: "Jaripatka",                full: "Jaripatka, Nagpur" },
  { name: "Gittikhadan",              full: "Gittikhadan, Nagpur" },
  { name: "Nari",                     full: "Nari, Nagpur" },
  { name: "Yashodhara Nagar",         full: "Yashodhara Nagar, Nagpur" },
  { name: "Indora",                   full: "Indora, Nagpur" },
  { name: "Kachimet",                 full: "Kachimet, Nagpur" },
  { name: "Rana Pratap Nagar",        full: "Rana Pratap Nagar, Nagpur" },
  { name: "Gokulpeth",                full: "Gokulpeth, Nagpur" },
  { name: "Shivaji Nagar",            full: "Shivaji Nagar, Nagpur" },
  { name: "New Subhedar Layout",      full: "New Subhedar Layout, Nagpur" },
  { name: "Tehsil",                   full: "Tehsil, Nagpur" },

  { name: "Wardha Road",              full: "Wardha Road, Nagpur" },
  { name: "Kamptee Road",             full: "Kamptee Road, Nagpur" },
  { name: "Amravati Road",            full: "Amravati Road, Nagpur" },
  { name: "Katol Road",               full: "Katol Road, Nagpur" },
  { name: "Koradi Road",              full: "Koradi Road, Nagpur" },
  { name: "Hingna Road",              full: "Hingna Road, Nagpur" },
  { name: "Ajni Square",              full: "Ajni Square, Nagpur" },
  { name: "Pratap Nagar Square",      full: "Pratap Nagar Square, Nagpur" },
  { name: "Variety Square",           full: "Variety Square, Nagpur" },
  { name: "Telephone Exchange Square",full: "Telephone Exchange Square, Nagpur" },
  { name: "Cotton Market",            full: "Cotton Market, Nagpur" },

  { name: "Futala Lake",              full: "Futala Lake, Nagpur" },
  { name: "Ambazari Lake",            full: "Ambazari Lake, Nagpur" },
  { name: "Gorewada Lake",            full: "Gorewada Lake, Nagpur" },
  { name: "Sakkardara Lake",          full: "Sakkardara Lake, Nagpur" },
  { name: "Gorewada Zoo",             full: "Gorewada International Zoo, Nagpur" },
  { name: "Maharajbagh Zoo",          full: "Maharajbagh Zoo, Nagpur" },
  { name: "Ambazari Garden",          full: "Ambazari Garden, Nagpur" },
  { name: "Kasturchand Park",         full: "Kasturchand Park, Nagpur" },

  { name: "Medical Square",           full: "Medical Square, Nagpur" },
  { name: "GMCH",                     full: "Government Medical College & Hospital (GMCH), Nagpur" },
  { name: "AIIMS Nagpur",             full: "AIIMS Nagpur, Nagpur" },
  { name: "Wockhardt Hospital",       full: "Wockhardt Hospital, Nagpur" },
  { name: "Alexis Hospital",          full: "Alexis Multispeciality Hospital, Nagpur" },
  { name: "Orange City Hospital",     full: "Orange City Hospital, Nagpur" },
  { name: "Kingsway Hospital",        full: "Kingsway Hospital, Nagpur" },
  { name: "Lata Mangeshkar Hospital", full: "Lata Mangeshkar Hospital, Nagpur" },

  { name: "VNIT",                     full: "VNIT (Visvesvaraya National Institute of Technology), Nagpur" },
  { name: "RCOEM",                    full: "RCOEM (Shri Ramdeobaba College of Engineering), Nagpur" },
  { name: "Nagpur University",        full: "RTM Nagpur University, Nagpur" },
  { name: "Hislop College",           full: "Hislop College, Nagpur" },
  { name: "Institute of Science",     full: "Institute of Science, Nagpur" },
  { name: "Symbiosis Nagpur",         full: "Symbiosis International University, Nagpur" },
  { name: "NIMS",                     full: "Nagpur Institute of Management Studies, Nagpur" },
  { name: "DY Patil College",         full: "DY Patil College of Engineering, Nagpur" },

  { name: "Empress City Mall",        full: "Empress City Mall, Nagpur" },
  { name: "Nagpur Central Mall",      full: "Nagpur Central Mall, Nagpur" },
  { name: "Poonam Mall",              full: "Poonam Mall, Nagpur" },
  { name: "Eternity Mall",            full: "Eternity Mall, Nagpur" },
  { name: "Big Bazaar Sitabuldi",     full: "Big Bazaar, Sitabuldi, Nagpur" },
  { name: "Lokmat Square Market",     full: "Lokmat Square Market, Nagpur" },
  { name: "Buty Layout Market",       full: "Buty Layout Market, Nagpur" },

  { name: "Deekshabhoomi",            full: "Deekshabhoomi, Nagpur" },
  { name: "Adasa Ganesh Temple",      full: "Adasa Ganesh Temple, Nagpur" },
  { name: "Tekdi Ganesh Mandir",      full: "Tekdi Ganesh Mandir, Dharampeth, Nagpur" },
  { name: "Dragon Palace Temple",     full: "Dragon Palace Buddhist Temple, Nagpur" },
  { name: "Swaminarayan Temple",      full: "Swaminarayan Temple, Nagpur" },
  { name: "Nagpur Cathedral",         full: "Cathedral Church of All Saints, Nagpur" },
  { name: "Jama Masjid",              full: "Jama Masjid, Nagpur" },
  { name: "Raman Science Centre",     full: "Raman Science Centre, Nagpur" },

  { name: "NMC Office",               full: "Nagpur Municipal Corporation Office, Nagpur" },
  { name: "District Court",           full: "District & Sessions Court, Nagpur" },
  { name: "High Court",               full: "Bombay High Court Nagpur Bench, Nagpur" },
  { name: "Collectorate",             full: "District Collectorate, Nagpur" },
  { name: "Police Commissioner Office", full: "Police Commissioner Office, Nagpur" },
  { name: "Nagpur GPO",               full: "General Post Office (GPO), Nagpur" },
];

// Autocomplete sub-component
function LocationSearch({ value, onChange }) {
  const [query, setQuery]           = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]             = useState(false);
  const [touched, setTouched]       = useState(false);
  const [confirmed, setConfirmed]   = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setTouched(true);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(e) {
    const val = e.target.value;
    setQuery(val);
    setConfirmed(false);
    onChange({ target: { name: "location", value: "" } }); // invalidate until a suggestion is picked
    if (!val.trim()) { setSuggestions([]); setOpen(false); return; }
    const q = val.toLowerCase();
    const filtered = NAGPUR_PLACES.filter(
      p => p.name.toLowerCase().includes(q) || p.full.toLowerCase().includes(q)
    );
    setSuggestions(filtered);
    setOpen(true);
  }

  function handleSelect(place) {
    setQuery(place.full);
    setConfirmed(true);
    onChange({ target: { name: "location", value: place.full } });
    setSuggestions([]);
    setOpen(false);
  }

  const showError = touched && !confirmed && query.trim().length > 0;

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <input
        name="location"
        value={query}
        onChange={handleInput}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
        onBlur={() => setTouched(true)}
        placeholder="Search location in Nagpur..."
        required
        autoComplete="off"
        className={`p-3 rounded-lg border ${showError ? "border-red-400" : "border-gray-300 dark:border-gray-600"}
          bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200
          placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full transition`}
      />

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200
          dark:border-gray-600 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {suggestions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-400 text-center">No Nagpur locations found</li>
          ) : (
            suggestions.slice(0, 8).map((place, i) => (
              <li
                key={i}
                onMouseDown={() => handleSelect(place)}
                className="flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-blue-50
                  dark:hover:bg-gray-700 border-b last:border-0 border-gray-100 dark:border-gray-700"
              >
                <span className="text-blue-500 mt-0.5">📍</span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{place.name}</p>
                  <p className="text-xs text-gray-400">{place.full}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Validation message */}
      {showError && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          ⚠ Please select a valid Nagpur location from the list
        </p>
      )}

      {/* Hidden input carries the confirmed value to formspree */}
      <input type="hidden" name="location" value={value} />
    </div>
  );
}

// Main component
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

        {/* Location — now uses autocomplete */}
        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-gray-700 dark:text-gray-300 text-sm">
            Location <span className="text-gray-400 font-normal">(Nagpur only)</span>
          </label>
          <LocationSearch value={formData.location} onChange={handleChange} />
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