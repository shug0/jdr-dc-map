import type { ViewState } from "./pdf-viewer";
import type { MapPoint } from "./types";

export function initDebugInfo(
  overlay: HTMLElement,
  getViewState: () => ViewState,
  getPoints: () => MapPoint[]
): void {
  const btnToggle = document.getElementById("btn-toggle-info") as HTMLButtonElement;
  const panel = document.getElementById("debug-info-panel") as HTMLElement;
  const content = document.getElementById("debug-info-content") as HTMLElement;
  const btnCopy = document.getElementById("btn-copy-info") as HTMLButtonElement;

  let cursorNormX = 0;
  let cursorNormY = 0;
  let isOpen = false;

  btnToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    btnToggle.classList.toggle("active", isOpen);
    if (isOpen) render();
  });

  document.addEventListener("click", (event) => {
    if (isOpen && !panel.contains(event.target as Node) && event.target !== btnToggle) {
      isOpen = false;
      panel.classList.remove("open");
      btnToggle.classList.remove("active");
    }
  });

  overlay.addEventListener("mousemove", (event) => {
    const rect = overlay.getBoundingClientRect();
    const viewState = getViewState();
    cursorNormX = (event.clientX - rect.left) / viewState.pdfWidth;
    cursorNormY = (event.clientY - rect.top) / viewState.pdfHeight;
    if (isOpen) render();
  });

  function render(): void {
    const vs = getViewState();
    const points = getPoints();

    const lines = [
      `scale      ${vs.scale.toFixed(3)}`,
      `pdfWidth   ${vs.pdfWidth.toFixed(0)} px`,
      `pdfHeight  ${vs.pdfHeight.toFixed(0)} px`,
      `offsetX    ${vs.offsetX.toFixed(1)}`,
      `offsetY    ${vs.offsetY.toFixed(1)}`,
      ``,
      `cursor x   ${cursorNormX.toFixed(4)}  (${(cursorNormX * vs.pdfWidth).toFixed(0)} px)`,
      `cursor y   ${cursorNormY.toFixed(4)}  (${(cursorNormY * vs.pdfHeight).toFixed(0)} px)`,
      ``,
      `points     ${points.length}`,
    ];

    content.innerHTML = lines
      .map((line) => {
        const sep = line.indexOf(" ");
        if (sep === -1 || line.trim() === "") return line;
        const key = line.slice(0, sep);
        const val = line.slice(sep);
        return `${key}<span class="info-val">${val}</span>`;
      })
      .join("\n");
  }

  btnCopy.addEventListener("click", () => {
    const vs = getViewState();
    const points = getPoints();

    const text = [
      `=== Map Viewer Debug ===`,
      `scale:     ${vs.scale.toFixed(3)}`,
      `pdfWidth:  ${vs.pdfWidth.toFixed(0)} px`,
      `pdfHeight: ${vs.pdfHeight.toFixed(0)} px`,
      `offsetX:   ${vs.offsetX.toFixed(1)}`,
      `offsetY:   ${vs.offsetY.toFixed(1)}`,
      `cursor:    x=${cursorNormX.toFixed(4)}, y=${cursorNormY.toFixed(4)}`,
      ``,
      `points (${points.length}):`,
      JSON.stringify(points, null, 2),
    ].join("\n");

    void navigator.clipboard.writeText(text).then(() => {
      btnCopy.textContent = "✓ Copié";
      btnCopy.classList.add("copied");
      setTimeout(() => {
        btnCopy.textContent = "📋 Copier";
        btnCopy.classList.remove("copied");
      }, 1500);
    });
  });
}
