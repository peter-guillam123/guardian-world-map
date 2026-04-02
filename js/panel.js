// ---------------------------------------------------------------------------
// Panel module — story detail slide-in (single + list views)
// ---------------------------------------------------------------------------

import { CATEGORY_COLORS } from "./map.js";

const panel = document.getElementById("panel");
const panelContent = document.getElementById("panel-content");
const panelClose = document.getElementById("panel-close");

let onStorySelectCallback = null;

panelClose.addEventListener("click", close);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});

export function setOnStorySelect(callback) {
  onStorySelectCallback = callback;
}

function relativeTime(isoDate) {
  const diffMs = Date.now() - Date.parse(isoDate);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- Single story detail view ---

export function open(props) {
  const color = CATEGORY_COLORS[props.category] || CATEGORY_COLORS.other;

  let html = `
    <span class="panel-category" style="background: ${color}">${escapeHtml(props.category)}</span>
    <div class="panel-location">${escapeHtml(props.location_name)}</div>
    <div class="panel-time">${relativeTime(props.published)}</div>
  `;

  if (props.thumbnail) {
    html += `<img class="panel-thumbnail" src="${escapeAttr(props.thumbnail)}" alt="" loading="lazy" onload="this.classList.add('loaded')">`;
  } else {
    // Fallback gradient card with category name
    html += `<div class="panel-thumbnail-fallback" style="background: linear-gradient(135deg, ${color}22, ${color}44)">
      <span style="color: ${color}">${escapeHtml(props.category)}</span>
    </div>`;
  }

  html += `
    <h2 class="panel-headline">${escapeHtml(props.headline)}</h2>
    <p class="panel-summary">${escapeHtml(props.summary)}</p>
    <a class="panel-link" href="${escapeAttr(props.url)}" target="_blank" rel="noopener noreferrer">
      Read on The Guardian &rarr;
    </a>
  `;

  panelContent.innerHTML = html;
  panel.classList.remove("hidden");
}

// --- Cluster story list view ---

export function openList(stories, clusterCoords) {
  // Sort by published date (newest first)
  const sorted = [...stories].sort(
    (a, b) => Date.parse(b.published) - Date.parse(a.published)
  );

  let html = `<div class="panel-list-header">${sorted.length} stories in this area</div>`;

  for (const s of sorted) {
    const color = CATEGORY_COLORS[s.category] || CATEGORY_COLORS.other;
    html += `
      <button class="panel-list-item" data-story-id="${escapeAttr(s.id)}">
        <span class="panel-list-dot" style="background: ${color}"></span>
        <div class="panel-list-body">
          <div class="panel-list-headline">${escapeHtml(s.headline)}</div>
          <div class="panel-list-meta">
            <span class="panel-list-cat" style="color: ${color}">${escapeHtml(s.category)}</span>
            &middot; ${escapeHtml(s.location_name)} &middot; ${relativeTime(s.published)}
          </div>
        </div>
      </button>
    `;
  }

  panelContent.innerHTML = html;
  panel.classList.remove("hidden");

  // Wire click handlers on list items
  panelContent.querySelectorAll(".panel-list-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = item.dataset.storyId;
      const story = sorted.find((s) => s.id === id);
      if (story) {
        open(story);
        if (onStorySelectCallback) onStorySelectCallback(story);
      }
    });
  });
}

export function close() {
  panel.classList.add("hidden");
}

// Security: escape HTML to prevent XSS from story data
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
