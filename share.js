import { saveBookmark } from "./db.js";

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : "";
}

function detectBrowser(text) {
  const value = text.toLowerCase();
  if (value.includes("brave")) {
    return "mobile-brave";
  }
  if (value.includes("chrome")) {
    return "mobile-chrome";
  }
  return "unknown-mobile";
}

async function main() {
  const params = new URLSearchParams(location.search);
  const title = params.get("title") || "";
  const text = params.get("text") || "";
  const sharedUrl = params.get("url") || extractUrl(text);

  if (sharedUrl) {
    await saveBookmark({
      title,
      url: sharedUrl,
      text,
      sourceBrowser: detectBrowser(navigator.userAgent)
    });
    location.replace("/index.html?saved=1");
    return;
  }

  location.replace("/index.html?error=no-url");
}

main().catch(() => {
  location.replace("/index.html?error=save-failed");
});
