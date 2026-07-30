import { useEffect, useState } from "react";

function getRiskColor(risk) {
  if (!risk) return "text-blue-600 dark:text-blue-400";
  const r = risk.toLowerCase();
  if (r === "low" || r === "safe") return "text-green-600 dark:text-green-400";
  if (r === "medium") return "text-yellow-600 dark:text-yellow-400";
  if (r === "high") return "text-red-600 dark:text-red-400";
  return "text-blue-600 dark:text-blue-400";
}

function getIsolationColor(status) {
  if (!status) return "text-gray-500";
  if (status === "Well Connected")
    return "text-green-600 dark:text-green-400";
  if (status === "Moderately Isolated")
    return "text-yellow-600 dark:text-yellow-400";
  if (status === "Highly Isolated")
    return "text-red-600 dark:text-red-400";
  return "text-gray-500";
}

export default function Dashboard() {
  const [location, setLocation] = useState(null);
  const [risk, setRisk] = useState("Checking...");
  const [alertMessage, setAlertMessage] = useState("");
  const [safetyMode, setSafetyMode] = useState(false);
  const [isolationStatus, setIsolation] = useState("Unknown");
  const [nearbyZones, setNearbyZones] = useState(null);
  const [error, setError] = useState("");

  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: "",
    relationship: "",
  });

  const [savedContacts, setSavedContacts] = useState([]);

  const toggleSafetyMode = () => setSafetyMode((v) => !v);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Allow only digits and max 10 digits for phone
    if (name === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      setContact({ ...contact, phone: digitsOnly });
      return;
    }

    setContact({ ...contact, [name]: value });
  };

  // Email validation -> only valid @....com emails
  const isValidEmail = (email) => {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/.test(email);
  };

  // Phone validation -> exactly 10 digits
  const isValidPhone = (phone) => {
    return /^\d{10}$/.test(phone);
  };

  const saveContact = async (e) => {
    e.preventDefault();

    // Email Validation
    if (!isValidEmail(contact.email)) {
      alert("❌ Enter a valid .com email address");
      return;
    }

    // Phone Validation
    if (!isValidPhone(contact.phone)) {
      alert("❌ Phone number must be exactly 10 digits");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:5000/save-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: [contact] }),
      });

      if (!res.ok) throw new Error();

      setSavedContacts((prev) => [...prev, contact]);

      setContact({
        name: "",
        phone: "",
        email: "",
        relationship: "",
      });

      alert("✅ Emergency contact saved!");
    } catch {
      alert("❌ Failed to save contact");
    }
  };

  const checkRisk = async (lat, lon) => {
    try {
      const res = await fetch("http://127.0.0.1:5000/check-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });

      const data = await res.json();

      setRisk(data.risk_level || "Unknown");

      setAlertMessage(
        data.risk_level?.toLowerCase() === "high" && safetyMode
          ? data.alert || "High Risk Area!"
          : ""
      );
    } catch {
      setRisk("Error");
    }
  };

  const checkIsolation = async (lat, lon) => {
    try {
      const res = await fetch("http://127.0.0.1:5000/check-isolation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });

      const data = await res.json();

      setIsolation(data.status || "Unknown");
      setNearbyZones(data.nearby_zones ?? null);
    } catch {
      setIsolation("Error");
    }
  };

  const sendSOS = async () => {
    if (!location) return alert("Location not available");

    try {
      await fetch("http://127.0.0.1:5000/send-emergency-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lon,
          time: new Date().toLocaleString(),
        }),
      });

      alert("🚨 SOS Sent!");
    } catch {
      alert("❌ Failed to send SOS");
    }
  };

  useEffect(() => {
    const id = navigator.geolocation.watchPosition((pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      setLocation({ lat, lon });

      checkRisk(lat, lon);
      checkIsolation(lat, lon);
    });

    return () => navigator.geolocation.clearWatch(id);
  }, [safetyMode]);

  return (
    <div className="w-full min-h-[calc(100vh-56px)] bg-gray-50 dark:bg-gray-900 transition-colors py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-semibold text-blue-900 dark:text-blue-400">
            Women Safety Dashboard
          </h1>

          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Real-time safety monitoring for your location
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl text-red-700 dark:text-red-300 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Safety Mode Banner */}
        <div
          className={`flex items-center justify-between p-5 rounded-2xl border-l-4 shadow transition-colors ${
            safetyMode
              ? "bg-red-50 dark:bg-red-900/20 border-red-500"
              : "bg-green-50 dark:bg-green-900/20 border-green-500"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full animate-pulse ${
                safetyMode ? "bg-red-500" : "bg-green-500"
              }`}
            />

            <div>
              <p
                className={`font-semibold ${
                  safetyMode
                    ? "text-red-700 dark:text-red-300"
                    : "text-green-700 dark:text-green-300"
                }`}
              >
                Safety Mode is {safetyMode ? "Active" : "Inactive"}
              </p>
            </div>
          </div>

          <span
            className={`text-xs font-bold tracking-widest px-3 py-1 rounded-full ${
              safetyMode
                ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"
                : "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300"
            }`}
          >
            {safetyMode ? "PROTECTED" : "STANDBY"}
          </span>
        </div>

        {/* Alert */}
        {alertMessage && (
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-xl text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
            ⚠️ {alertMessage}
          </div>
        )}

        {/* Location + Isolation cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Location */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-3">
              📍 Location
            </h3>

            {location ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lat</span>

                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    {location.lat.toFixed(5)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-500">Lng</span>

                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    {location.lon.toFixed(5)}
                  </span>
                </div>

                <hr className="border-gray-100 dark:border-gray-700" />

                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Risk</span>

                  <span className={`font-bold text-sm ${getRiskColor(risk)}`}>
                    {risk}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <span className="animate-spin">⟳</span> Acquiring…
              </div>
            )}
          </div>

          {/* Isolation */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-3">
              🔒 Isolation
            </h3>

            <p
              className={`text-lg font-bold ${getIsolationColor(
                isolationStatus
              )}`}
            >
              {isolationStatus}
            </p>

            {nearbyZones !== null && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {nearbyZones} hotspot zone
                {nearbyZones !== 1 ? "s" : ""} nearby
              </p>
            )}

            <p className="text-xs text-gray-400 mt-2">
              Area connectivity status
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={toggleSafetyMode}
            className={`py-3 rounded-xl text-white font-semibold transition ${
              safetyMode
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            🛡 {safetyMode ? "Turn OFF Safety" : "Turn ON Safety"}
          </button>

          <button
            onClick={sendSOS}
            className="py-3 rounded-xl font-semibold border-2 border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            🚨 Emergency SOS
          </button>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
          <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-4">
            📞 Emergency Contacts
          </h3>

          <form onSubmit={saveContact} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "name", placeholder: "Full Name" },
                { name: "phone", placeholder: "Phone Number" },
                { name: "email", placeholder: "Email Address" },
                { name: "relationship", placeholder: "Relationship" },
              ].map(({ name, placeholder }) => (
                <input
                  key={name}
                  type={name === "email" ? "email" : "text"}
                  name={name}
                  placeholder={placeholder}
                  value={contact[name]}
                  onChange={handleChange}
                  required
                  maxLength={name === "phone" ? 10 : undefined}
                  className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                />
              ))}
            </div>

            <button
              type="submit"
              className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition"
            >
              + Save Contact
            </button>
          </form>

          {savedContacts.length > 0 && (
            <>
              <hr className="my-4 border-gray-100 dark:border-gray-700" />

              <div className="flex flex-wrap gap-2">
                {savedContacts.map((c, i) => (
                  <div key={i} className="relative group">
                    <button className="px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition">
                      {c.name}
                    </button>

                    {/* Tooltip */}
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl p-3 shadow-lg text-xs text-gray-600 dark:text-gray-300 z-10 leading-6">
                      <p>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Name:
                        </span>{" "}
                        {c.name}
                      </p>

                      <p>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Phone:
                        </span>{" "}
                        {c.phone}
                      </p>

                      <p>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Email:
                        </span>{" "}
                        {c.email}
                      </p>

                      <p>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Relation:
                        </span>{" "}
                        {c.relationship}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}