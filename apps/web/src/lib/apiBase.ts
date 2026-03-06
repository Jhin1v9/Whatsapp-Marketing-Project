export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (typeof window !== "undefined" && window.location?.origin) {
    if (!configured || configured.length === 0) {
      return window.location.origin;
    }

    try {
      const parsed = new URL(configured);
      const sameHost = parsed.hostname === window.location.hostname;
      const pointsToLocalhost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
      const runningOnLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

      // Em preview/producao, evita cross-origin para endpoints internos do app.
      if (!sameHost && !runningOnLocalhost) {
        return window.location.origin;
      }

      // Corrige env esquecida em localhost durante deploy.
      if (!runningOnLocalhost && pointsToLocalhost) {
        return window.location.origin;
      }

      return configured;
    } catch {
      return window.location.origin;
    }
  }

  if (configured && configured.length > 0) {
    return configured;
  }

  return "http://127.0.0.1:3001";
}
