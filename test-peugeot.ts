import { JSDOM } from "jsdom";
global.DOMParser = new JSDOM().window.DOMParser;
global.fetchWithTimeout = async (url) => {
  if (url.startsWith("/api/proxy")) {
    url = decodeURIComponent(url.replace("/api/proxy/ravenol?url=", ""));
  }
  return fetch(url);
};

import { searchByVin } from "./src/lib/gemini.js";
import { useAppStore } from "./src/store/useAppStore.js";
async function run() {
  const oldGet = useAppStore.getState;
  useAppStore.getState = () => {
    const state = oldGet();
    return { ...state, aiTemperature: 0.1 };
  };
  
  const data = await searchByVin("VF3LRHNYWFS343639");
  console.log("FINAL RESULT Brand:", data.brand);
  console.log("FINAL RESULT Model:", data.model);
}
run();
