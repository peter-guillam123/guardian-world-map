// ---------------------------------------------------------------------------
// Panel module — story detail slide-in
// ---------------------------------------------------------------------------

import { CATEGORY_COLORS } from "./map.js";

const panel = document.getElementById("panel");
const panelContent = document.getElementById("panel-content");
const panelClose = document.getElementById("panel-close");

panelClose.addEventListener("click", close);

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close();
});

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

export function open(props) {
  const color = CATEGORY_COLORS[props.category] || CATEGORY_COLORS.other;

  let html = `
    <span class="panel-category" style="background: ${color}">${escapeHtml(props.category)}</span>
    <div class="panel-location">${escapeHtml(props.location_name)}</div>
    <div class="panel-time">${relativeTime(props.published)}</div>
  `;

  if (props.thumbnail) {
    html += `<img class="panel-thumbnail" src="${escapeAttr(props.thumbnail)}" alt="" loading="lazy">`;
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
