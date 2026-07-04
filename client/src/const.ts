export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// L-05: einheitlicher Produktname. Der deployte Wert kommt aus VITE_APP_TITLE;
// ist er nicht gesetzt, gilt «Portfoliomanager» (konsistent mit Sidebar/Dashboard).
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Portfoliomanager";

export const APP_LOGO =
  import.meta.env.VITE_APP_LOGO ||
  "https://placehold.co/128x128/E1E7EF/1F2937?text=App";

export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  return `${oauthPortalUrl}?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
};