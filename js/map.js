// ---------------------------------------------------------------------------
// Map module — MapLibre GL JS setup, sources, layers, clustering
// ---------------------------------------------------------------------------

const CATEGORY_COLORS = {
  conflict: "#c0392b",
  climate:  "#27ae60",
  politics: "#2c3e50",
  economy:  "#d4a017",
  health:   "#8e44ad",
  culture:  "#e67e22",
  sport:    "#2980b9",
  tech:     "#16a085",
  other:    "#7f8c8d",
};

const CATEGORY_LIST = Object.keys(CATEGORY_COLORS);

// Build a MapLibre match expression for category → color
function categoryColorExpr() {
  const expr = ["match", ["get", "category"]];
  for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
    expr.push(cat, color);
  }
  expr.push("#7f8c8d"); // fallback
  return expr;
}

let map;

export function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    center: [10, 30],
    zoom: 2.2,
    minZoom: 1.5,
    maxZoom: 16,
    attributionControl: true,
  });

  map.on("load", () => {
    // Empty GeoJSON source — populated by stories module
    map.addSource("stories", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
      clusterProperties: {
        maxSignificance: ["max", ["get", "significance"]],
        sumStories: ["+", 1],
      },
    });

    // Layer: halo glow for high-significance stories (breathing animation via paint)
    map.addLayer({
      id: "story-halo",
      type: "circle",
      source: "stories",
      filter: ["all",
        ["!", ["has", "point_count"]],
        [">=", ["get", "significance"], 4],
      ],
      paint: {
        "circle-color": categoryColorExpr(),
        "circle-radius": [
          "interpolate", ["linear"], ["get", "significance"],
          4, 18,
          5, 24,
        ],
        "circle-opacity": 0.15,
        "circle-blur": 1,
      },
    });

    // Layer: cluster circles
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "stories",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "interpolate", ["linear"], ["get", "maxSignificance"],
          1, "#b0b0b0",
          3, "#d4a017",
          5, "#c0392b",
        ],
        "circle-radius": [
          "interpolate", ["linear"], ["get", "sumStories"],
          2, 16,
          10, 28,
          50, 40,
        ],
        "circle-opacity": 0.75,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(255,255,255,0.6)",
      },
    });

    // Layer: cluster count labels
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "stories",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 12,
        "text-font": ["Noto Sans Regular"],
      },
      paint: {
        "text-color": "#ffffff",
      },
    });

    // Layer: individual story dots
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "stories",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": categoryColorExpr(),
        "circle-radius": [
          "interpolate", ["linear"], ["get", "significance"],
          1, 5,
          3, 8,
          5, 13,
        ],
        "circle-opacity": ["get", "opacity"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(255,255,255,0.8)",
        "circle-stroke-opacity": ["get", "opacity"],
      },
    });
  });

  return map;
}

export function getMap() {
  return map;
}

export function updateSource(geojson) {
  const source = map.getSource("stories");
  if (source) source.setData(geojson);
}

export function setTimeFilter(cutoffTimestamp) {
  const filter = cutoffTimestamp
    ? [">=", ["get", "published_ts"], cutoffTimestamp]
    : true;

  map.setFilter("unclustered-point", ["all", ["!", ["has", "point_count"]], filter]);
}

export function onStoryClick(callback, clusterCallback) {
  // Click on individual story
  map.on("click", "unclustered-point", (e) => {
    const props = e.features[0].properties;
    callback(props);
  });

  // Click on cluster → get leaves and show in panel
  map.on("click", "clusters", async (e) => {
    const feature = e.features[0];
    const clusterId = feature.properties.cluster_id;
    const pointCount = feature.properties.point_count;
    const source = map.getSource("stories");

    try {
      const leaves = await source.getClusterLeaves(clusterId, pointCount, 0);
      if (leaves && leaves.length) {
        const stories = leaves.map((l) => l.properties);
        clusterCallback(stories, feature.geometry.coordinates);
      }
    } catch (err) {
      // Fallback: zoom into the cluster
      try {
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: zoom + 1,
          duration: 500,
        });
      } catch {}
    }
  });

  // Cursor pointer on hover
  for (const layer of ["unclustered-point", "clusters"]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

export function flyTo(lngLat, zoom) {
  map.flyTo({ center: lngLat, zoom: zoom || 6, duration: 800 });
}

// Animate the halo layer opacity for breathing effect
let haloPhase = 0;
export function tickHaloAnimation() {
  if (!map || !map.getLayer("story-halo")) return;
  haloPhase += 0.05;
  const opacity = 0.1 + Math.sin(haloPhase) * 0.08;
  map.setPaintProperty("story-halo", "circle-opacity", opacity);
}

export { CATEGORY_COLORS };
