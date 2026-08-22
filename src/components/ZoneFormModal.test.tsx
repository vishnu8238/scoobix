import { expect, test } from "vitest";

/**
 * Validates manual boundary closure for GeoJSON Polygon
 */
function validateAndCloseBoundary(points: [number, number][]) {
  if (points.length < 3) {
    throw new Error("Draw a zone boundary with at least 3 points before saving.");
  }

  // Deduplicate consecutive points
  const unique = points.filter((c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]);
  
  // Open ring logic
  const openRing = unique.length > 1 &&
    unique[0][0] === unique[unique.length - 1][0] &&
    unique[0][1] === unique[unique.length - 1][1]
      ? unique.slice(0, -1)
      : unique;

  if (openRing.length < 3) {
     throw new Error("Draw a zone boundary with at least 3 points before saving.");
  }

  // Closed GeoJSON ring, [lng, lat]
  const ring = [...openRing, [...openRing[0]] as [number, number]];
  return { type: "Polygon", coordinates: [ring] };
}

test("manual boundary closure creates a valid 4-point ring from 3 points", () => {
  const points: [number, number][] = [
    [73.1812, 22.3072], // A
    [73.1912, 22.3072], // B
    [73.1812, 22.3172], // C
  ];
  
  const geojson = validateAndCloseBoundary(points);
  
  expect(geojson.type).toBe("Polygon");
  expect(geojson.coordinates[0]).toHaveLength(4);
  expect(geojson.coordinates[0][0]).toEqual(geojson.coordinates[0][3]); // A == A'
});

test("manual boundary closure handles already closed input", () => {
  const points: [number, number][] = [
    [73.1812, 22.3072],
    [73.1912, 22.3072],
    [73.1812, 22.3172],
    [73.1812, 22.3072],
  ];
  
  const geojson = validateAndCloseBoundary(points);
  
  expect(geojson.coordinates[0]).toHaveLength(4);
  expect(geojson.coordinates[0][0]).toEqual(geojson.coordinates[0][3]);
});

test("manual boundary throws on less than 3 points", () => {
  const points: [number, number][] = [[73.1812, 22.3072], [73.1912, 22.3072]];
  expect(() => validateAndCloseBoundary(points)).toThrow("at least 3 points");
});
