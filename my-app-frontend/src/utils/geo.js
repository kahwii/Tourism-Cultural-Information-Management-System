// TEMP FOR TESTING: widened from 250m to 50000m (50km) so check-ins can be
// tested from anywhere in Metro Manila without traveling to each church.
// MUST be reverted to 250 before this goes back to real production use.
export const CHECKIN_RADIUS_M = 250;

// "14.5794, 121.0359" -> { lat, lon }
export function parseCoords(str) {
  if (!str) return null;
  const parts = String(str).split(",").map(s => parseFloat(s.trim()));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { lat: parts[0], lon: parts[1] };
}

// Great-circle distance in meters between two {lat, lon} points.
export function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ask the browser for the user's current position.
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser does not support location services."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const msg =
          err.code === 1 ? "Location access was denied. Please allow location in your browser to check in."
          : err.code === 2 ? "Couldn't get your location right now. Please try again."
          : "Location lookup timed out. Please try again.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Verify the user is within `maxMeters` of the target coords.
// Returns { ok, distance, accuracy, skipped }.
export async function verifyAtLocation(coordsStr, maxMeters = CHECKIN_RADIUS_M) {
  const target = parseCoords(coordsStr);
  if (!target) return { ok: true, distance: null, skipped: true }; // no coords -> can't verify, allow
  const me = await getPosition();
  const distance = Math.round(haversineMeters(me, target));
  const accuracy = Math.round(me.accuracy || 0);
  // give a little leeway for GPS inaccuracy
  const ok = distance <= maxMeters + Math.min(accuracy, 100);
  return { ok, distance, accuracy, skipped: false, lat: me.lat, lon: me.lon };
}
