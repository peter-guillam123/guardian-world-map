// ---------------------------------------------------------------------------
// Filters module — time filter buttons
// ---------------------------------------------------------------------------

let activeHours = 12;
let onChangeCallback = null;

export function initFilters(onChange) {
  onChangeCallback = onChange;

  const bar = document.getElementById("time-filters");
  const buttons = bar.querySelectorAll(".filter-btn");
  const indicator = bar.querySelector(".filter-indicator");

  // Position indicator on the active button
  function positionIndicator(btn) {
    indicator.style.width = btn.offsetWidth + "px";
    indicator.style.transform = `translateX(${btn.offsetLeft - 3}px)`;
  }

  // Initialize indicator position
  const activeBtn = bar.querySelector(".filter-btn.active");
  if (activeBtn) {
    // Defer to let layout settle
    requestAnimationFrame(() => positionIndicator(activeBtn));
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const hours = parseInt(btn.dataset.hours, 10);
      if (hours === activeHours) return;

      // Update active state
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      positionIndicator(btn);

      activeHours = hours;
      if (onChangeCallback) onChangeCallback(hours);
    });
  });
}

export function getActiveHours() {
  return activeHours;
}
