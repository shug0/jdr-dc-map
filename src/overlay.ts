import type { MapPoint } from "./types";
import type { ViewState } from "./pdf-viewer";

type MarkerClickHandler = (point: MapPoint, markerEl: HTMLElement) => void;

export function renderMarkers(
  overlay: HTMLElement,
  points: MapPoint[],
  viewState: ViewState,
  onMarkerClick: MarkerClickHandler
): void {
  overlay.querySelectorAll(".marker").forEach((el) => el.remove());

  for (const point of points) {
    const screenX = point.x * viewState.pdfWidth;
    const screenY = point.y * viewState.pdfHeight;

    const marker = document.createElement("div");
    marker.className = "marker";
    marker.dataset["pointId"] = point.id;
    marker.style.left = `${screenX}px`;
    marker.style.top = `${screenY}px`;

    const dot = document.createElement("div");
    dot.className = "marker-dot";

    const label = document.createElement("div");
    label.className = "marker-label";
    label.textContent = point.name;

    marker.appendChild(dot);
    marker.appendChild(label);
    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      onMarkerClick(point, marker);
    });

    overlay.appendChild(marker);
  }
}
