import { requireElement } from "./dom";

const MESSAGES = [
  "Dépoussiérage des parchemins royaux…",
  "Repérage des sentiers du Marais des Chats-Teignes…",
  "Calibrage de la boussole par les miages de Château-haut…",
  "Tracé de la route d'Embrasse à Tourne-Bouchon…",
  "Vérification des zones d'exil avec le cabinet de Walter…",
  "Relevé des fumées noires au-dessus de la Casse-Auto…",
  "Triangulation du signal de la Tour Radio Brouillée…",
  "Consultation de Bilou Queue-de-Souris pour les passages secrets…",
  "Localisation de Sélénée dans les profondeurs de la Forêt Endormie…",
  "Estompage des brumes du Val aux Brumes…",
  "Confirmation de l'accès au port de la Capitaine Capucine…",
  "Mise en garde contre les Chiens de la Casse au nord-est…",
  "Réception des dernières nouvelles de Grand'Roue…",
  "Lever de l'ancre depuis le Paradis Blanc…",
  "La carte est prête. Bonne route, Chaton.",
];

const INTERVAL_MS = 3000;

const loadingScreen = requireElement("loading-screen");
const loadingText = requireElement("loading-text");

let messageIndex = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

function startMessages(): void {
  loadingText.textContent = MESSAGES[0];
  messageIndex = 1;

  intervalId = setInterval(() => {
    if (messageIndex >= MESSAGES.length) return;
    loadingText.classList.add("loading-text--fade");
    setTimeout(() => {
      loadingText.textContent = MESSAGES[messageIndex];
      messageIndex += 1;
      loadingText.classList.remove("loading-text--fade");
    }, 200);
  }, INTERVAL_MS);
}

export function hideLoadingScreen(): void {
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }

  loadingText.classList.add("loading-text--fade");
  setTimeout(() => {
    loadingText.textContent = "La carte est prête. Bonne route, Chaton.";
    loadingText.classList.remove("loading-text--fade");

    setTimeout(() => {
      loadingScreen.classList.add("fade-out");
      loadingScreen.addEventListener("transitionend", () => loadingScreen.remove(), { once: true });
    }, 500);
  }, 200);
}

startMessages();
