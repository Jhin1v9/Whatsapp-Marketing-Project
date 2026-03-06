export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    // Evita quebrar deploy quando a env ainda aponta para localhost.
    if (
      typeof window !== "undefined" &&
      window.location?.hostname &&
      !["localhost", "127.0.0.1"].includes(window.location.hostname) &&
      (configured.includes("localhost") || configured.includes("127.0.0.1"))
    ) {
      return window.location.origin;
    }

    return configured;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "http://127.0.0.1:3001";
}
