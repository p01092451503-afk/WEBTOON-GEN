const RECOVERY_KEY = "pilottoon.server-function-recovery";
const RECOVERY_WINDOW_MS = 30_000;

function isStaleServerFunctionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes("invalid server function id") ||
    normalized.includes("server function") && normalized.includes("500") ||
    normalized.includes("/_serverfn/") && normalized.includes("500")
  );
}

/**
 * Vite can restart while an older preview tab is still polling. In that case
 * the tab must reload once so TanStack can register the current server-fn IDs.
 */
export function recoverStaleServerFunction(error: unknown): boolean {
  if (typeof window === "undefined" || !isStaleServerFunctionError(error)) return false;

  const now = Date.now();
  const lastRecovery = Number(window.sessionStorage.getItem(RECOVERY_KEY) ?? "0");
  if (Number.isFinite(lastRecovery) && now - lastRecovery < RECOVERY_WINDOW_MS) return false;

  window.sessionStorage.setItem(RECOVERY_KEY, String(now));
  window.location.reload();
  return true;
}