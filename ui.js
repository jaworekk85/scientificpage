function setupTabsAndPanel() {
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach(tab => {
        tab.classList.remove("active");
      });

      btn.classList.add("active");

      document.querySelectorAll(".view").forEach(view => {
        view.classList.remove("active");
      });

      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  document.getElementById("togglePanel").addEventListener("click", () => {
    document.querySelector(".controls-panel").classList.toggle("active");
  });
}
