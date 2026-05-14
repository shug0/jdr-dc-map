import type { MapPoint } from "./types";
import type { ViewState } from "./pdf-viewer";
import { requireElement } from "./dom";

type PopupResult =
  | { action: "confirm"; name: string }
  | { action: "delete" }
  | { action: "cancel" };

function showPopup(
  screenX: number,
  screenY: number,
  initialName: string,
  showDelete: boolean
): Promise<PopupResult> {
  return new Promise((resolve) => {
    const popup = requireElement("inline-popup");
    const input = requireElement<HTMLInputElement>("popup-name-input");
    const btnConfirm = requireElement<HTMLButtonElement>("popup-confirm");
    const btnDelete = requireElement<HTMLButtonElement>("popup-delete");
    const btnCancel = requireElement<HTMLButtonElement>("popup-cancel");

    const viewport = requireElement("viewport");
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const popupW = 200;
    const popupH = 90;
    popup.style.left = `${Math.min(screenX + 8, vw - popupW - 8)}px`;
    popup.style.top = `${Math.min(screenY - 20, vh - popupH - 8)}px`;

    input.value = initialName;
    btnDelete.style.display = showDelete ? "flex" : "none";
    popup.classList.add("open");
    input.focus();
    input.select();

    function cleanup(): void {
      popup.classList.remove("open");
      btnConfirm.removeEventListener("click", onConfirm);
      btnDelete.removeEventListener("click", onDelete);
      btnCancel.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKey);
    }

    function onConfirm(): void {
      const name = input.value.trim();
      if (!name) return;
      cleanup();
      resolve({ action: "confirm", name });
    }

    function onDelete(): void {
      cleanup();
      resolve({ action: "delete" });
    }

    function onCancel(): void {
      cleanup();
      resolve({ action: "cancel" });
    }

    function onKey(event: KeyboardEvent): void {
      if (event.key === "Enter") onConfirm();
      if (event.key === "Escape") onCancel();
    }

    btnConfirm.addEventListener("click", onConfirm);
    btnDelete.addEventListener("click", onDelete);
    btnCancel.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKey);
  });
}

export function initDebugMode(
  overlay: HTMLElement,
  getViewState: () => ViewState,
  points: MapPoint[],
  onPointsChange: () => void
): { toggle: () => boolean } {
  const viewportEl = requireElement("viewport");
  const badge = requireElement("debug-badge");
  let active = false;

  function applyActive(): void {
    badge.style.display = active ? "block" : "none";
    overlay.classList.toggle("interactive", active);
  }

  overlay.addEventListener("click", async (event) => {
    if (!active) return;

    const popup = document.getElementById("inline-popup") as HTMLElement;
    if (popup.classList.contains("open")) return;

    const target = event.target as HTMLElement;
    if (target.closest(".marker")) return;

    viewportEl.classList.add("debug-placing");

    const rect = overlay.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const viewState = getViewState();
    const normX = (clickX - viewState.offsetX) / viewState.pdfWidth;
    const normY = (clickY - viewState.offsetY) / viewState.pdfHeight;

    const vpRect = viewportEl.getBoundingClientRect();
    const result = await showPopup(event.clientX - vpRect.left, event.clientY - vpRect.top, "", false);
    viewportEl.classList.remove("debug-placing");

    if (result.action === "confirm") {
      const newPoint: MapPoint = {
        id: `point-${Date.now()}`,
        name: result.name,
        x: Math.max(0, Math.min(1, normX)),
        y: Math.max(0, Math.min(1, normY)),
        zoom: viewState.scale,
      };
      points.push(newPoint);
      onPointsChange();
    }
  });

  return {
    toggle(): boolean {
      active = !active;
      applyActive();
      return active;
    },
  };
}

export async function handleMarkerEdit(
  point: MapPoint,
  markerEl: HTMLElement,
  points: MapPoint[],
  onPointsChange: () => void
): Promise<void> {
  const viewport = document.getElementById("viewport") as HTMLElement;
  const rect = markerEl.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();

  const result = await showPopup(
    rect.left - viewportRect.left + rect.width / 2,
    rect.top - viewportRect.top,
    point.name,
    true
  );

  if (result.action === "confirm") {
    point.name = result.name;
    onPointsChange();
  } else if (result.action === "delete") {
    const index = points.findIndex((p) => p.id === point.id);
    if (index !== -1) points.splice(index, 1);
    onPointsChange();
  }
}
