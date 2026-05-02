export function isAllowedYouTubeUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (!["https:", "http:"].includes(url.protocol)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  const allowedHost =
    hostname === "youtu.be" ||
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com";

  if (!allowedHost) {
    return false;
  }

  if (hostname === "youtu.be") {
    return url.pathname.length > 1;
  }

  if (url.pathname === "/watch") {
    return Boolean(url.searchParams.get("v"));
  }

  return url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/");
}
