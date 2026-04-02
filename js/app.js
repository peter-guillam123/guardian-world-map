// ---------------------------------------------------------------------------
// App module — main entry point, wiring, polling
// ---------------------------------------------------------------------------

import { initMap, updateSource, onStoryClick, flyTo, tickHaloAnimation } from "./map.js";
import { fetchStories, filterByHours, storiesToGeoJSON } from "./stories.js";
import { initFilters, getActiveHours, getHiddenCategories } from "./filters.js";
import { open as openPanel, openList as openPanelList, setOnStorySelect } from "./panel.js";
import { setMapInstance, animateNewStories, ambientPing } from "./animations.js";
import { initToasts, showNewStoryToasts } from "./toasts.js";

const POLL_INTERVAL = 60_000; // 60 seconds
const STALE_THRESHOLD = 10 * 60_000; // 10 minutes
const AMBIENT_PING_INTERVAL = 25_000; // 25 seconds
const HALO_TICK_INTERVAL = 80; // ~12fps for breathing glow

let allStories = [];
let isFirstLoad = true;
let lastGeneratedAt = null;

// ---------------------------------------------------------------------------
// Refresh cycle
// ---------------------------------------------------------------------------

async function refresh() {
  try {
    const { stories, meta, newStories } = await fetchStories();
    allStories = stories;

    // Update map with filtered stories
    applyFilter();

    // Animate new arrivals (skip on first load)
    if (!isFirstLoad && newStories.length > 0) {
      animateNewStories(newStories);
      showNewStoryToasts(newStories);
    }

    // Update UI chrome
    lastGeneratedAt = meta.generated_at;
    updateStoryCount();
    tickTimestamp();
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
  const filtered = filterByHours(allStories, hours, getHiddenCategories());
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

/** Live-ticking timestamp — called every second */
function tickTimestamp() {
  const el = document.getElementById("updated-at");
  if (!lastGeneratedAt) return;

  const diff = Date.now() - Date.parse(lastGeneratedAt);
  const secs = Math.floor(diff / 1000);

  if (secs < 5) {
    el.textContent = "Updated just now";
  } else if (secs < 60) {
    el.textContent = `Updated ${secs}s ago`;
  } else {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins < 60) {
      el.textContent = `Updated ${mins}m ${remSecs.toString().padStart(2, "0")}s ago`;
    } else {
      el.textContent = `Updated ${Math.floor(mins / 60)}h ${mins % 60}m ago`;
    }
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

  // Wire individual story click → panel
  // Wire cluster click → panel list view
  onStoryClick(
    (props) => openPanel(props),
    (stories, coords) => openPanelList(stories, coords)
  );

  // When a story is selected from the list, fly to it
  setOnStorySelect((story) => {
    if (story.location_lng && story.location_lat) {
      flyTo([parseFloat(story.location_lng), parseFloat(story.location_lat)]);
    }
  });

  // Wire filter changes
  initFilters((hours) => applyFilter());

  // Wire toast clicks → fly to story + open panel
  initToasts((story) => {
    const { lng, lat } = story.location;
    flyTo([lng, lat], 6);
    // Small delay to let fly animation start before opening panel
    setTimeout(() => {
      openPanel({
        ...story,
        location_name: story.location.name,
        thumbnail: story.thumbnail || "",
      });
    }, 300);
  });

  // Initial fetch
  refresh();

  // Start polling
  setInterval(refresh, POLL_INTERVAL);

  // Live timestamp tick — every second
  setInterval(tickTimestamp, 1000);

  // Ambient ping — random story pulse every ~25s
  setInterval(ambientPing, AMBIENT_PING_INTERVAL);

  // Halo breathing animation tick
  setInterval(tickHaloAnimation, HALO_TICK_INTERVAL);
});
