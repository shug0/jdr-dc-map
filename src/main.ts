import { initPdfViewer } from "./pdf-viewer";
import { renderMarkers } from "./overlay";
import { initPointsDialog } from "./points-dialog";
import { initDebugMode, handleMarkerEdit } from "./debug-mode";
import { initDebugInfo } from "./debug-info";
import { POINTS } from "./data/points";
import type { MapPoint } from "./types";
import type { ViewState } from "./pdf-viewer";

const viewport = document.getElementById("viewport") as HTMLElement;
const canvasContainer = document.getElementById("canvas-container") as HTMLElement;
const canvas = document.getElementById("pdf-canvas") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLElement;
const btnToggleDebug = document.getElementById("btn-toggle-debug") as HTMLButtonElement;

const points: MapPoint[] = [...POINTS];
let dialog: ReturnType<typeof initPointsDialog>;
let currentViewState: ViewState | null = null;
let isDebug = false;

function refreshUI(viewState?: ViewState): void {
  const state = viewState ?? currentViewState;
  if (!state) return;
  currentViewState = state;

  renderMarkers(
    overlay,
    points,
    state,
    isDebug
      ? (point, markerEl) => void handleMarkerEdit(point, markerEl, points, () => refreshUI())
      : (point) => void navigateToPoint(point)
  );
  dialog?.refresh(points, isDebug);
  (window as unknown as { __mapPoints: MapPoint[] }).__mapPoints = points;
}

async function navigateToPoint(point: MapPoint): Promise<void> {
  await viewer.centerOn(point.x, point.y, point.zoom);
}

const viewer = await initPdfViewer(viewport, canvasContainer, canvas, refreshUI);

dialog = initPointsDialog((point) => void navigateToPoint(point));

const debug = initDebugMode(overlay, () => viewer.getViewState(), points, () => refreshUI());

btnToggleDebug.addEventListener("click", () => {
  isDebug = debug.toggle();
  btnToggleDebug.classList.toggle("active", isDebug);
  refreshUI();
});

initDebugInfo(overlay, () => viewer.getViewState(), () => points);
