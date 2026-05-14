import * as pdfjsLib from "pdfjs-dist";
import type { PDFPageProxy } from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const MIN_SCALE = 0.5;
const MAX_SCALE = 2;
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
  let animationId: number | null = null;

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

  // Touch : pan + pinch-to-zoom
  let touchStartX = 0;
  let touchStartY = 0;
  let touchOffsetStartX = 0;
  let touchOffsetStartY = 0;
  let pinchStartDist = 0;
  let pinchStartScale = 0;
  let pinchMidX = 0;
  let pinchMidY = 0;
  let isTouching = false;

  function touchMidpoint(touches: TouchList): { x: number; y: number } {
    const rect = viewport.getBoundingClientRect();
    if (touches.length === 1) {
      return { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    };
  }

  function touchDistance(touches: TouchList): number {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.hypot(dx, dy);
  }

  viewport.addEventListener("touchstart", (event) => {
    if ((event.target as HTMLElement).closest(".marker, #controls, #zoom-controls, #points-dialog, #inline-popup, #debug-badge")) return;
    event.preventDefault();

    if (animationId !== null) { cancelAnimationFrame(animationId); animationId = null; }

    isTouching = true;
    const mid = touchMidpoint(event.touches);
    touchStartX = mid.x;
    touchStartY = mid.y;
    touchOffsetStartX = offsetX;
    touchOffsetStartY = offsetY;

    if (event.touches.length === 2) {
      pinchStartDist = touchDistance(event.touches);
      pinchStartScale = currentScale;
      pinchMidX = mid.x;
      pinchMidY = mid.y;
    }
  }, { passive: false });

  viewport.addEventListener("touchmove", (event) => {
    if (!isTouching) return;
    event.preventDefault();

    const mid = touchMidpoint(event.touches);

    if (event.touches.length === 2) {
      const dist = touchDistance(event.touches);
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale * (dist / pinchStartDist)));
      const ratio = newScale / currentScale;
      offsetX = pinchMidX - (pinchMidX - offsetX) * ratio;
      offsetY = pinchMidY - (pinchMidY - offsetY) * ratio;
      currentScale = newScale;
      updateZoomLabel();
    } else {
      offsetX = touchOffsetStartX + (mid.x - touchStartX);
      offsetY = touchOffsetStartY + (mid.y - touchStartY);
    }

    clampOffset();
    applyTransform();
  }, { passive: false });

  const endTouch = (): void => {
    if (!isTouching) return;
    isTouching = false;
    if (commitTimer !== null) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => { commitTimer = null; void commitRender(); }, 120);
  };

  viewport.addEventListener("touchend", endTouch);
  viewport.addEventListener("touchcancel", endTouch);

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
    centerOn(normX: number, normY: number, targetScale: number): Promise<void> {
      return new Promise((resolve) => {
        if (animationId !== null) cancelAnimationFrame(animationId);
        if (commitTimer !== null) { clearTimeout(commitTimer); commitTimer = null; }

        const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
        const vwInner = viewport.clientWidth;
        const vhInner = viewport.clientHeight;

        const startScale = currentScale;
        const startX = offsetX;
        const startY = offsetY;

        const cssScaleAtTarget = clampedScale / renderedScale;
        const visW = pdfWidth * cssScaleAtTarget;
        const visH = pdfHeight * cssScaleAtTarget;
        let targetX = vwInner / 2 - normX * visW;
        let targetY = vhInner / 2 - normY * visH;
        targetX = Math.min(vwInner - 80, Math.max(80 - visW, targetX));
        targetY = Math.min(vhInner - 80, Math.max(80 - visH, targetY));

        const duration = 500;
        const startTime = performance.now();

        function easeInOut(progress: number): number {
          return progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        }

        function tick(now: number): void {
          const elapsed = now - startTime;
          const progress = easeInOut(Math.min(elapsed / duration, 1));

          currentScale = startScale + (clampedScale - startScale) * progress;
          offsetX = startX + (targetX - startX) * progress;
          offsetY = startY + (targetY - startY) * progress;
          updateZoomLabel();
          applyTransform();

          if (elapsed < duration) {
            animationId = requestAnimationFrame(tick);
          } else {
            animationId = null;
            void commitRender().then(resolve);
          }
        }

        animationId = requestAnimationFrame(tick);
      });
    },
  };
}
