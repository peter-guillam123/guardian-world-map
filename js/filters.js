// ---------------------------------------------------------------------------
// Filters module — time filter buttons + category legend toggles
// ---------------------------------------------------------------------------

let activeHours = 12;
const hiddenCategories = new Set();
let onChangeCallback = null;

export function initFilters(onChange) {
  onChangeCallback = onChange;

  // --- Time filter buttons ---
  const bar = document.getElementById("time-filters");
  const buttons = bar.querySelectorAll(".filter-btn");
  const indicator = bar.querySelector(".filter-indicator");

  function positionIndicator(btn) {
    indicator.style.width = btn.offsetWidth + "px";
    indicator.style.transform = `translateX(${btn.offsetLeft - 3}px)`;
  }

  const activeBtn = bar.querySelector(".filter-btn.active");
  if (activeBtn) {
    requestAnimationFrame(() => positionIndicator(activeBtn));
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const hours = parseInt(btn.dataset.hours, 10);
      if (hours === activeHours) return;

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      positionIndicator(btn);

      activeHours = hours;
      if (onChangeCallback) onChangeCallback();
    });
  });

  // --- Category legend toggles ---
  const legendItems = document.querySelectorAll("#legend .legend-item");
  legendItems.forEach((item) => {
    item.style.cursor = "pointer";
    const category = item.textContent.trim().toLowerCase();
    item.dataset.category = category;

    item.addEventListener("click", () => {
      if (hiddenCategories.has(category)) {
        hiddenCategories.delete(category);
        item.classList.remove("legend-item-off");
      } else {
        hiddenCategories.add(category);
        item.classList.add("legend-item-off");
      }
      if (onChangeCallback) onChangeCallback();
    });
  });
}

export function getActiveHours() {
  return activeHours;
}

export function getHiddenCategories() {
  return hiddenCategories;
}
