// ---------------------------------------------------------------------------
// Animations module — pulse-in, ambient periodic pings
// ---------------------------------------------------------------------------

import { CATEGORY_COLORS } from "./map.js";

let mapInstance = null;

export function setMapInstance(map) {
  mapInstance = map;
}

/**
 * Animate new story arrivals with a pulse marker.
 */
export function animateNewStories(newStories) {
  if (!mapInstance || !newStories.length) return;

  for (const story of newStories) {
    const { lng, lat } = story.location;
    const color = CATEGORY_COLORS[story.category] || CATEGORY_COLORS.other;
    const size = 8 + story.significance * 4;

    const el = document.createElement("div");
    el.className = "story-pulse";
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.background = color;
    el.style.color = color;

    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(mapInstance);

    setTimeout(() => marker.remove(), 2500);
  }
}

/**
 * Ambient ping — pick a random visible story and play a subtle ping animation.
 * Called periodically to create a sense of liveness.
 */
export function ambientPing() {
  if (!mapInstance) return;

  const features = mapInstance.queryRenderedFeatures({ layers: ["unclustered-point"] });
  if (!features.length) return;

  // Pick a random visible feature
  const feature = features[Math.floor(Math.random() * features.length)];
  const coords = feature.geometry.coordinates;
  const color = CATEGORY_COLORS[feature.properties.category] || CATEGORY_COLORS.other;

  const el = document.createElement("div");
  el.className = "ambient-ping";
  el.style.borderColor = color;

  const marker = new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat(coords)
    .addTo(mapInstance);

  setTimeout(() => marker.remove(), 2000);
}
