const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

export async function fetchRavenolData(query: string): Promise<string | null> {
  try {
    // 1. Search for the query (VIN or car details)
    const searchUrl = `https://podbor.ravenol.ru/search/?q=${encodeURIComponent(query)}`;
    let searchRes;
    try {
      searchRes = await fetchWithTimeout(`/api/proxy/ravenol?url=${encodeURIComponent(searchUrl)}`);
    } catch (e) {
      searchRes = { ok: false };
    }
    
    // Fallback to corsproxy.io if our proxy fails (e.g., Vercel IP blocked)
    if (!searchRes.ok) {
      try {
        searchRes = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(searchUrl)}`);
      } catch (e) {
        return null; // Both failed
      }
    }
    
    if (!searchRes.ok) return null;
    const searchHtml = await searchRes.text();

    let carHtml = '';
    
    // Check if this is already a car page (redirected directly to result)
    if (searchHtml.includes('ravwidg-results') || searchHtml.includes('ravwidg-car-info') || searchHtml.includes('ravwidg-unit-title')) {
      carHtml = searchHtml;
    } else {
      // Extract the primary car page URL from search results
      const match = searchHtml.match(/<a[^>]+href="(\/[0-9]+-[a-z-]+\/[^"]+)"/i);
      if (!match) return null;

      const carUrl = `https://podbor.ravenol.ru${match[1]}`;

      // Fetch the car page via proxy
      let carRes;
      try {
        carRes = await fetchWithTimeout(`/api/proxy/ravenol?url=${encodeURIComponent(carUrl)}`);
      } catch (e) {
        carRes = { ok: false };
      }
      
      // Fallback to corsproxy.io if our proxy fails
      if (!carRes.ok) {
        try {
          carRes = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(carUrl)}`);
        } catch (e) {
          return null;
        }
      }
      
      if (!carRes.ok) return null;
      carHtml = await carRes.text();
    }

    // Strip HTML tags to reduce token usage
    const parser = new DOMParser();
    const doc = parser.parseFromString(carHtml, 'text/html');
    
    // Try to get the car title specifically
    const title = doc.querySelector('.ravwidg-car-title')?.textContent || 
                  doc.querySelector('h1')?.textContent || 
                  '';

    // Extract text from the main content area
    const content = doc.body.innerText || doc.body.textContent || '';
    
    // Clean up excessive whitespace
    const cleanText = `${title}\n${content}`.replace(/\s+/g, ' ').trim();
    
    return cleanText;
  } catch (error) {
    console.error("Failed to fetch from Ravenol:", error);
    return null;
  }
}
