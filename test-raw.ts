import { getGeminiClient, callGeminiWithRetry } from "./src/lib/gemini.js";
import { defaultPrompts } from "./src/lib/defaultPrompts.js";
import { fetchRavenolData } from "./src/lib/ravenol.js";
import { JSDOM } from "jsdom";
global.DOMParser = new JSDOM().window.DOMParser;
global.fetchWithTimeout = async (url) => {
  if (url.startsWith("/api/proxy")) {
    url = decodeURIComponent(url.replace("/api/proxy/ravenol?url=", ""));
  }
  return fetch(url);
};

async function run() {
  const ravenolData = await fetchRavenolData("Peugeot 308 T9", "Peugeot 3008 II");
  console.log("Ravenol Title:", ravenolData?.split("\n")[0]);
  console.log("----");
}
run();
