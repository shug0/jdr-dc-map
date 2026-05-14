const loadingScreen = document.getElementById("loading-screen") as HTMLElement;

export function hideLoadingScreen(): void {
  loadingScreen.classList.add("fade-out");
  loadingScreen.addEventListener(
    "transitionend",
    () => loadingScreen.remove(),
    { once: true }
  );
}
