/**
 * One-tap turn-by-turn navigation (Zomato/Swiggy style).
 *
 * Opens the device's native navigation app with the destination pre-filled:
 *   iOS      → Apple Maps (system default) with a Google Maps fallback
 *   Android  → Google Maps navigation intent
 *   Desktop  → Google Maps web, OpenStreetMap when coordinates are missing
 *
 * The rider never copies an address — we always pass coordinates when we have
 * them and fall back to the address string otherwise.
 */

export type NavTarget = {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  label?: string;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1);
}

const hasCoords = (t: NavTarget): t is NavTarget & { lat: number; lng: number } =>
  typeof t.lat === "number" && typeof t.lng === "number" && Number.isFinite(t.lat) && Number.isFinite(t.lng);

/** Build the best navigation URL for the current device. */
export function navigationUrl(target: NavTarget): string | null {
  if (hasCoords(target)) {
    const { lat, lng } = target;
    if (isIOS()) return `maps://?daddr=${lat},${lng}&dirflg=d`;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  const q = (target.address ?? "").trim();
  if (!q) return null;
  if (isIOS()) return `maps://?daddr=${encodeURIComponent(q)}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`;
}

/** OpenStreetMap fallback — used when the native/Google handler doesn't open. */
export function osmUrl(target: NavTarget): string | null {
  if (hasCoords(target)) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${target.lat},${target.lng}`;
  }
  const q = (target.address ?? "").trim();
  return q ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}` : null;
}

/**
 * Launch navigation. Returns false when there is nothing to navigate to.
 * On iOS the `maps://` scheme is attempted first and we fall back to the
 * Google Maps web URL if the page is still visible shortly after.
 */
export function startNavigation(target: NavTarget): boolean {
  const url = navigationUrl(target);
  if (!url) return false;
  if (typeof window === "undefined") return false;

  if (url.startsWith("maps://")) {
    const start = Date.now();
    window.location.href = url;
    setTimeout(() => {
      if (document.visibilityState === "visible" && Date.now() - start < 2500) {
        const web = hasCoords(target)
          ? `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`
          : osmUrl(target);
        if (web) window.open(web, "_blank", "noopener");
      }
    }, 1200);
    return true;
  }

  window.open(url, "_blank", "noopener");
  return true;
}
