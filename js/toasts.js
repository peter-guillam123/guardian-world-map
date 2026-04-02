// ---------------------------------------------------------------------------
// Toasts module — notification cards for new story arrivals
// ---------------------------------------------------------------------------

import { CATEGORY_COLORS } from "./map.js";

const MAX_TOASTS = 3;
const TOAST_DURATION = 6000;

let container = null;
let onToastClickCallback = null;

export function initToasts(onClick) {
  container = document.getElementById("toast-container");
  onToastClickCallback = onClick;
}

export function showNewStoryToasts(stories) {
  if (!container) return;

  // Show newest first, limit to MAX_TOASTS
  const toShow = stories.slice(0, MAX_TOASTS);

  // Dismiss excess existing toasts
  const existing = container.querySelectorAll(".toast");
  const excess = existing.length + toShow.length - MAX_TOASTS;
  for (let i = 0; i < excess && i < existing.length; i++) {
    dismissToast(existing[i]);
  }

  // Stagger new toasts
  toShow.forEach((story, i) => {
    setTimeout(() => createToast(story), i * 300);
  });
}

function createToast(story) {
  const color = CATEGORY_COLORS[story.category] || CATEGORY_COLORS.other;

  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `
    <div class="toast-color-bar" style="background: ${color}"></div>
    <div class="toast-body">
      <div class="toast-cat" style="color: ${color}">${escapeHtml(story.category)}</div>
      <div class="toast-headline">${escapeHtml(truncate(story.headline, 80))}</div>
      <div class="toast-location">${escapeHtml(story.location.name)}</div>
    </div>
    <div class="toast-progress">
      <div class="toast-progress-bar" style="animation-duration: ${TOAST_DURATION}ms"></div>
    </div>
  `;

  el.addEventListener("click", () => {
    dismissToast(el);
    if (onToastClickCallback) onToastClickCallback(story);
  });

  container.appendChild(el);

  // Trigger entrance animation
  requestAnimationFrame(() => el.classList.add("visible"));

  // Auto-dismiss
  setTimeout(() => dismissToast(el), TOAST_DURATION);
}

function dismissToast(el) {
  if (!el || el.classList.contains("dismissing")) return;
  el.classList.add("dismissing");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  // Fallback removal if animationend doesn't fire
  setTimeout(() => el.remove(), 400);
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "\u2026";
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
