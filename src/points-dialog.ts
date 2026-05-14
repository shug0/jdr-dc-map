import type { MapPoint } from "./types";
import { requireElement } from "./dom";

type NavigateHandler = (point: MapPoint) => void;

export function initPointsDialog(onNavigate: NavigateHandler): {
  refresh: (points: MapPoint[], isDebug: boolean) => void;
} {
  const pointsList = requireElement("points-list");
  const debugFooter = requireElement("dialog-debug-footer");
  const btnExport = requireElement<HTMLButtonElement>("btn-export");

  btnExport.addEventListener("click", () => {
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
        item.addEventListener("click", () => onNavigate(point));

        pointsList.appendChild(item);
      }
    }

    debugFooter.classList.toggle("visible", isDebug);
  }

  return { refresh };
}
