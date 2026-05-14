import * as pdfjsLib from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.2;

export type ViewState = {
  scale: number;
  offsetX: number;
  offsetY: number;
  pdfWidth: number;
  pdfHeight: number;
};

type PdfViewer = {
  getViewState: () => ViewState;
  setScale: (scale: number) => Promise<void>;
  centerOn: (normX: number, normY: number, scale: number) => Promise<void>;
};

export async function initPdfViewer(
  viewport: HTMLElement,
  canvasContainer: HTMLElement,
  canvas: HTMLCanvasElement,
  onViewChange: (viewState: ViewState) => void
): Promise<PdfViewer> {
  const pdf = await pdfjsLib.getDocument("/assets/carte.pdf").promise;
  const page = await pdf.getPage(1);

  let currentScale = 1;
  let renderedScale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let pdfWidth = 0;
  let pdfHeight = 0;
  let renderTask: ReturnType<PDFPageProxy["render"]> | null = null;
  let commitTimer: ReturnType<typeof setTimeout> | null = null;

  async function renderPage(scale: number): Promise<void> {
    if (renderTask) {
      renderTask.cancel();
      renderTask = null;
    }

    const pdfViewport = page.getViewport({ scale });
    const offscreen = document.createElement("canvas");
    offscreen.width = pdfViewport.width;
    offscreen.height = pdfViewport.height;

    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    try {
      renderTask = page.render({ canvasContext: ctx, viewport: pdfViewport });
      await renderTask.promise;
      renderTask = null;

      // Copie atomique : le canvas visible n'est jamais blanc
      pdfWidth = pdfViewport.width;
      pdfHeight = pdfViewport.height;
      canvas.width = pdfViewport.width;
      canvas.height = pdfViewport.height;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
    } catch {
      // annulation volontaire — pas d'erreur à propager
    }
  }

  function applyTransform(): void {
    const cssScale = currentScale / renderedScale;
    canvasContainer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${cssScale})`;
    onViewChange({
      scale: currentScale,
      offsetX,
      offsetY,
      pdfWidth: pdfWidth * cssScale,
      pdfHeight: pdfHeight * cssScale,
    });
  }

  async function commitRender(): Promise<void> {
    await renderPage(currentScale);
    renderedScale = currentScale;
    clampOffset();
    applyTransform();
  }

  function clampOffset(): void {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const margin = 80;
    const cssScale = currentScale / renderedScale;
    const visW = pdfWidth * cssScale;
    const visH = pdfHeight * cssScale;
    offsetX = Math.min(vw - margin, Math.max(margin - visW, offsetX));
    offsetY = Math.min(vh - margin, Math.max(margin - visH, offsetY));
  }

  async function setScale(newScale: number, focalX?: number, focalY?: number): Promise<void> {
    newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    if (newScale === currentScale) return;

    if (focalX !== undefined && focalY !== undefined) {
      const ratio = newScale / currentScale;
      offsetX = focalX - (focalX - offsetX) * ratio;
      offsetY = focalY - (focalY - offsetY) * ratio;
    }

    currentScale = newScale;
    applyTransform();
    updateZoomLabel();

    if (commitTimer !== null) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitTimer = null;
      void commitRender();
    }, 120);
  }

  function updateZoomLabel(): void {
    const label = document.getElementById("zoom-label");
    if (label) label.textContent = `${Math.round(currentScale * 100)}%`;
  }

  // Zoom molette — normalisé souris/trackpad
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const focalX = event.clientX - rect.left;
    const focalY = event.clientY - rect.top;

    let deltaY = event.deltaY;
    if (event.deltaMode === 1) deltaY *= 16;   // lignes → pixels
    if (event.deltaMode === 2) deltaY *= 400;  // pages → pixels
    deltaY = Math.max(-150, Math.min(150, deltaY)); // clamp anti-burst

    const factor = Math.pow(0.998, deltaY);
    void setScale(currentScale * factor, focalX, focalY);
  }, { passive: false });

  // Boutons zoom
  document.getElementById("btn-zoom-in")?.addEventListener("click", () => {
    void setScale(currentScale + ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
  });
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => {
    void setScale(currentScale - ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
  });

  // Pan au drag
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOffsetStartX = 0;
  let dragOffsetStartY = 0;

  viewport.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement).closest(".marker, #controls, #zoom-controls, #points-dialog, #inline-popup, #debug-badge")) return;
    isDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOffsetStartX = offsetX;
    dragOffsetStartY = offsetY;
    viewport.classList.add("dragging");
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) return;
    offsetX = dragOffsetStartX + (event.clientX - dragStartX);
    offsetY = dragOffsetStartY + (event.clientY - dragStartY);
    clampOffset();
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      viewport.classList.remove("dragging");
    }
  });

  // Rendu initial + centrage
  await renderPage(currentScale);
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  offsetX = (vw - pdfWidth) / 2;
  offsetY = (vh - pdfHeight) / 2;
  applyTransform();
  updateZoomLabel();

  return {
    getViewState: () => ({ scale: currentScale, offsetX, offsetY, pdfWidth, pdfHeight }),
    setScale,
    async centerOn(normX: number, normY: number, targetScale: number): Promise<void> {
      await setScale(targetScale);
      const vwInner = viewport.clientWidth;
      const vhInner = viewport.clientHeight;
      offsetX = vwInner / 2 - normX * pdfWidth;
      offsetY = vhInner / 2 - normY * pdfHeight;
      clampOffset();
      applyTransform();
    },
  };
}
