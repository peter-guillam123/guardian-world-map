// ---------------------------------------------------------------------------
// Animations module — pulse-in for new stories, opacity refresh
// ---------------------------------------------------------------------------

import { CATEGORY_COLORS } from "./map.js";

let mapInstance = null;

export function setMapInstance(map) {
  mapInstance = map;
}

/**
 * Animate new story arrivals with a pulse marker.
 * Creates a temporary DOM element at the story's coordinates,
 * plays the CSS animation, then removes it.
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
    el.style.color = color; // Used by ripple box-shadow via currentColor

    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(mapInstance);

    // Remove after animation completes (pulse-in 0.6s + ripple 1.5s + buffer)
    setTimeout(() => marker.remove(), 2500);
  }
}
