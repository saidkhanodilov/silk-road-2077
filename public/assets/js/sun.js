// Where the sun is right now, for the globe's real day and night and the clock in the top bar.
// Low-precision formulas from the Astronomical Almanac, good to about a degree.

const RAD = Math.PI / 180;

export const TASHKENT = { lat: 41.31, lon: 69.24 };

/** The point on Earth where the sun is straight overhead at Unix time `ms`, in degrees. */
export function subsolarPoint(ms = Date.now()) {
  const n = ms / 86400000 - 10957.5; // days since 2000-01-01 12:00 UTC
  const g = (357.528 + 0.9856003 * n) * RAD; // the sun's mean anomaly
  const lambda = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // its ecliptic longitude
  const tilt = (23.439 - 4e-7 * n) * RAD;
  const dec = Math.asin(Math.sin(tilt) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(tilt) * Math.sin(lambda), Math.cos(lambda));
  const gmst = 280.46061837 + 360.98564736629 * n; // Greenwich sidereal time, in degrees
  const lon = ((((ra / RAD - gmst) % 360) + 540) % 360) - 180;
  return { lat: dec / RAD, lon };
}

/** True while any part of the sun is above the horizon at a place. */
export function isDaytime(lat, lon, ms = Date.now()) {
  const s = subsolarPoint(ms);
  const cosZenith = Math.sin(lat * RAD) * Math.sin(s.lat * RAD)
    + Math.cos(lat * RAD) * Math.cos(s.lat * RAD) * Math.cos((lon - s.lon) * RAD);
  return cosZenith > -0.0145; // sunrise and sunset are at -0.833°, refraction included
}
