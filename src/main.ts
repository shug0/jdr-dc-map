import { initPdfViewer, type InitialView, type PdfViewer } from "./pdf-viewer";
import { renderMarkers } from "./overlay";
import { initPointsDialog } from "./points-dialog";
import { initDebugMode, handleMarkerEdit } from "./debug-mode";
import { initDebugInfo } from "./debug-info";
import { hideLoadingScreen } from "./loading-screen";
import { requireElement } from "./dom";
import { POINTS } from "./data/points";
import type { MapPoint } from "./types";
import type { ViewState } from "./pdf-viewer";

const viewport = requireElement("viewport");
const canvasContainer = requireElement("canvas-container");
const canvas = requireElement<HTMLCanvasElement>("pdf-canvas");
const overlay = requireElement("overlay");
const btnToggleDebug = requireElement<HTMLButtonElement>("btn-toggle-debug");
const btnToggleDialog = requireElement<HTMLButtonElement>("btn-toggle-dialog");
const pointsDialogEl = requireElement("points-dialog");

const points: MapPoint[] = [...POINTS];
let dialog: ReturnType<typeof initPointsDialog>;
let viewer: PdfViewer;
let debug: ReturnType<typeof initDebugMode>;
let currentViewState: ViewState | null = null;
let isDebug = false;

const isMobile = (): boolean => window.matchMedia("(max-width: 1024px)").matches;

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

const isDebugMode = new URLSearchParams(window.location.search).get("debug") === "true";
if (isDebugMode) requireElement("debug-controls").classList.add("visible");
if (isMobile()) pointsDialogEl.classList.remove("open");

dialog = initPointsDialog((point) => {
  void navigateToPoint(point);
  if (isMobile()) {
    pointsDialogEl.classList.remove("open");
    btnToggleDialog.textContent = "Les lieux ▾";
  }
});

btnToggleDebug.addEventListener("click", () => {
  isDebug = debug.toggle();
  btnToggleDebug.classList.toggle("active", isDebug);
  refreshUI();
});

btnToggleDialog.addEventListener("click", () => {
  const isOpen = pointsDialogEl.classList.toggle("open");
  btnToggleDialog.textContent = isOpen ? "Les lieux ▴" : "Les lieux ▾";
});

const INITIAL_VIEW_DESKTOP: InitialView = { offsetX: -1732.2, offsetY: -2956.5, scale: 1.305 };
const INITIAL_VIEW_MOBILE: InitialView = { offsetX: -2184.7, offsetY: -2918.0, scale: 1.295 };
const INITIAL_VIEW = isMobile() ? INITIAL_VIEW_MOBILE : INITIAL_VIEW_DESKTOP;

window.addEventListener("resize", () => refreshUI());

void (async () => {
  viewer = await initPdfViewer(viewport, canvasContainer, canvas, refreshUI, INITIAL_VIEW);
  hideLoadingScreen();

  dialog.refresh(points, isDebug);

  debug = initDebugMode(overlay, () => viewer.getViewState(), points, () => refreshUI());
  initDebugInfo(overlay, () => viewer.getViewState(), () => points);
})();
