// ---------------------------------------------------------------------------
// App module — main entry point, wiring, polling
// ---------------------------------------------------------------------------

import { initMap, updateSource, onStoryClick, getMap } from "./map.js";
import { fetchStories, filterByHours, storiesToGeoJSON } from "./stories.js";
import { initFilters, getActiveHours } from "./filters.js";
import { open as openPanel } from "./panel.js";
import { setMapInstance, animateNewStories } from "./animations.js";

const POLL_INTERVAL = 60_000; // 60 seconds
const STALE_THRESHOLD = 15 * 60_000; // 15 minutes

let allStories = [];
let isFirstLoad = true;

// ---------------------------------------------------------------------------
// Refresh cycle
// ---------------------------------------------------------------------------

async function refresh() {
  try {
    const { stories, meta, newStories } = await fetchStories();
    allStories = stories;

    // Update map with filtered stories
    applyFilter();

    // Animate new arrivals (skip on first load to avoid animating everything)
    if (!isFirstLoad && newStories.length > 0) {
      animateNewStories(newStories);
    }

    // Update UI chrome
    updateStoryCount();
    updateTimestamp(meta.generated_at);
    checkStaleness(meta.generated_at);

    // Hide loading overlay on first successful load
    if (isFirstLoad) {
      isFirstLoad = false;
      const overlay = document.getElementById("loading-overlay");
      overlay.classList.add("fade-out");
      setTimeout(() => overlay.remove(), 500);
    }
  } catch (err) {
    console.error("Failed to refresh stories:", err);
  }
}

function applyFilter() {
  const hours = getActiveHours();
  const filtered = filterByHours(allStories, hours);
  const geojson = storiesToGeoJSON(filtered);
  updateSource(geojson);
  updateStoryCount(filtered.length);
}

// ---------------------------------------------------------------------------
// UI updates
// ---------------------------------------------------------------------------

function updateStoryCount(count) {
  const el = document.getElementById("story-count");
  if (count !== undefined) {
    el.textContent = `${count} ${count === 1 ? "story" : "stories"}`;
  }
}

function updateTimestamp(isoDate) {
  const el = document.getElementById("updated-at");
  if (!isoDate) return;
  const diff = Date.now() - Date.parse(isoDate);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    el.textContent = "Updated just now";
  } else if (mins < 60) {
    el.textContent = `Updated ${mins}m ago`;
  } else {
    el.textContent = `Updated ${Math.floor(mins / 60)}h ago`;
  }
}

function checkStaleness(isoDate) {
  const warning = document.getElementById("stale-warning");
  const timeEl = document.getElementById("stale-time");
  if (!isoDate) return;

  const diff = Date.now() - Date.parse(isoDate);
  if (diff > STALE_THRESHOLD) {
    const mins = Math.floor(diff / 60000);
    timeEl.textContent = mins < 60 ? `${mins} minutes` : `${Math.floor(mins / 60)} hours`;
    warning.classList.remove("hidden");
  } else {
    warning.classList.add("hidden");
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const map = initMap();

map.on("load", () => {
  setMapInstance(map);

  // Wire story click → panel
  onStoryClick((props) => openPanel(props));

  // Wire filter changes
  initFilters((hours) => applyFilter());

  // Initial fetch
  refresh();

  // Start polling
  setInterval(refresh, POLL_INTERVAL);

  // Refresh opacity values every 60s (stories fade as they age)
  setInterval(() => applyFilter(), POLL_INTERVAL);
});
