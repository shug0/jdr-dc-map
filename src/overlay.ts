import type { MapPoint } from "./types";
import type { ViewState } from "./pdf-viewer";

type MarkerClickHandler = (point: MapPoint, markerEl: HTMLElement) => void;

const SVG_NS = "http://www.w3.org/2000/svg";

function createTail(side: "left" | "right"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "30");
  svg.setAttribute("height", "18");
  svg.setAttribute("viewBox", "0 0 30 18");
  svg.classList.add("marker-tail", `marker-tail--${side}`);

  const poly = document.createElementNS(SVG_NS, "polygon");
  poly.setAttribute("points", side === "left" ? "0,0 12,0 30,18 0,18" : "18,0 30,0 30,18 0,18");
  poly.classList.add("marker-tail-shape");
  svg.appendChild(poly);
  return svg;
}

export function renderMarkers(
  overlay: HTMLElement,
  points: MapPoint[],
  viewState: ViewState,
  onMarkerClick: MarkerClickHandler
): void {
  overlay.querySelectorAll(".marker").forEach((el) => el.remove());

  for (const point of points) {
    const screenX = viewState.offsetX + point.x * viewState.pdfWidth;
    const screenY = viewState.offsetY + point.y * viewState.pdfHeight;

    const marker = document.createElement("div");
    marker.className = "marker";
    marker.dataset["pointId"] = point.id;
    marker.style.left = `${screenX}px`;
    marker.style.top = `${screenY}px`;

    const inner = document.createElement("div");
    inner.className = "marker-inner";
    inner.style.setProperty("--s", String(Math.max(1, viewState.scale)));

    const ribbon = document.createElement("div");
    ribbon.className = "marker-ribbon";

    const tailLeft = createTail("left");
    const tailRight = createTail("right");

    const label = document.createElement("span");
    label.className = "marker-label";
    label.textContent = point.name;

    ribbon.appendChild(tailLeft);
    ribbon.appendChild(tailRight);
    ribbon.appendChild(label);
    inner.appendChild(ribbon);
    marker.appendChild(inner);

    marker.addEventListener("click", (event) => {
      event.stopPropagation();
      onMarkerClick(point, marker);
    });

    overlay.appendChild(marker);
  }
}
