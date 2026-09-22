const KEY = "toyswap_token";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
}
