import type { MapPoint } from "./types";

type NavigateHandler = (point: MapPoint) => void;

export function initPointsDialog(onNavigate: NavigateHandler): {
  refresh: (points: MapPoint[], isDebug: boolean) => void;
} {
  const btnToggle = document.getElementById("btn-toggle-dialog") as HTMLButtonElement;
  const dialog = document.getElementById("points-dialog") as HTMLElement;
  const pointsList = document.getElementById("points-list") as HTMLElement;
  const debugFooter = document.getElementById("dialog-debug-footer") as HTMLElement;
  const btnExport = document.getElementById("btn-export") as HTMLButtonElement;

  btnToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    dialog.classList.toggle("open");
    btnToggle.classList.toggle("active");
  });

  // Fermer en cliquant hors de la dialog
  document.addEventListener("click", (event) => {
    if (dialog.classList.contains("open") && !dialog.contains(event.target as Node)) {
      dialog.classList.remove("open");
      btnToggle.classList.remove("active");
    }
  });

  btnExport.addEventListener("click", () => {
    // points sont remontés via le callback refresh — on lit depuis le store global
    const dataStr = (window as unknown as { __mapPoints: MapPoint[] }).__mapPoints;
    const blob = new Blob([JSON.stringify(dataStr, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "points.json";
    anchor.click();
    URL.revokeObjectURL(url);
  });

  function refresh(points: MapPoint[], isDebug: boolean): void {
    pointsList.innerHTML = "";

    if (points.length === 0) {
      const empty = document.createElement("div");
      empty.className = "points-empty";
      empty.textContent = isDebug
        ? "Cliquez sur la carte pour ajouter un point."
        : "Aucun point configuré.";
      pointsList.appendChild(empty);
    } else {
      for (const point of points) {
        const item = document.createElement("div");
        item.className = "point-item";

        const dot = document.createElement("div");
        dot.className = "point-item-dot";

        const name = document.createElement("span");
        name.className = "point-item-name";
        name.textContent = point.name;

        item.appendChild(dot);
        item.appendChild(name);
        item.addEventListener("click", () => {
          dialog.classList.remove("open");
          btnToggle.classList.remove("active");
          onNavigate(point);
        });

        pointsList.appendChild(item);
      }
    }

    if (isDebug) {
      debugFooter.classList.add("visible");
    } else {
      debugFooter.classList.remove("visible");
    }
  }

  return { refresh };
}
