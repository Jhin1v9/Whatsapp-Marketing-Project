export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim().length
    ? String(process.env.NEXT_PUBLIC_API_BASE_URL)
    : "http://localhost:3001";
}
