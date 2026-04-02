// ---------------------------------------------------------------------------
// Stories module — fetch, diff, GeoJSON conversion
// ---------------------------------------------------------------------------

let currentStories = [];
let knownIds = new Set();

// Deterministic jitter so co-located stories don't stack
function jitter(id, lng, lat) {
  const hash = id.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  const absHash = Math.abs(hash);
  const angle = ((absHash % 360) * Math.PI) / 180;
  const dist = 0.012 + (absHash % 100) * 0.0003;
  return [lng + Math.cos(angle) * dist, lat + Math.sin(angle) * dist];
}

function computeOpacity(publishedIso) {
  const ageMs = Date.now() - Date.parse(publishedIso);
  const ageHours = ageMs / (1000 * 60 * 60);
  return Math.max(0.2, 1 - (ageHours / 24) * 0.8);
}

export function storiesToGeoJSON(stories) {
  return {
    type: "FeatureCollection",
    features: stories.map((s) => {
      const [lng, lat] = jitter(s.id, s.location.lng, s.location.lat);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          id: s.id,
          headline: s.headline,
          summary: s.summary,
          url: s.url,
          thumbnail: s.thumbnail || "",
          published: s.published,
          published_ts: Date.parse(s.published),
          category: s.category,
          significance: s.significance,
          section: s.section,
          location_name: s.location.name,
          opacity: computeOpacity(s.published),
        },
      };
    }),
  };
}

export async function fetchStories() {
  const cacheBust = `?t=${Date.now()}`;
  const res = await fetch(`data/stories.json${cacheBust}`);
  if (!res.ok) throw new Error(`Failed to fetch stories: ${res.status}`);
  const data = await res.json();

  const stories = data.stories || [];
  const meta = data.meta || {};

  // Find new stories (IDs we haven't seen before)
  const newStories = stories.filter((s) => !knownIds.has(s.id));

  // Update tracking state
  currentStories = stories;
  knownIds = new Set(stories.map((s) => s.id));

  return { stories, meta, newStories };
}

export function filterByHours(stories, hours, hiddenCategories) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return stories.filter((s) => {
    if (Date.parse(s.published) <= cutoff) return false;
    if (hiddenCategories && hiddenCategories.size && hiddenCategories.has(s.category)) return false;
    return true;
  });
}

export function getStoryById(stories, id) {
  return stories.find((s) => s.id === id);
}

export function getCurrentStories() {
  return currentStories;
}
