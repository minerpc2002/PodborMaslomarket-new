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

export async function fetchRavenolData(query: string, hint?: string): Promise<string | null> {
  try {
    // 1. Search for the query (VIN or car details)
    const searchUrl = `https://podbor.ravenol.ru/search/?q=${encodeURIComponent(query)}`;
    let searchRes;
    try {
      searchRes = await fetchWithTimeout(`/api/proxy/ravenol?url=${encodeURIComponent(searchUrl)}`);
    } catch (e) {
      searchRes = { ok: false } as any;
    }
    
    // Fallback to corsproxy.io if our proxy fails (e.g., Vercel IP blocked)
    if (!searchRes || !searchRes.ok) {
      try {
        searchRes = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(searchUrl)}`);
      } catch (e) {
        return null; // Both failed
      }
    }
    
    if (!searchRes || !searchRes.ok) return null;
    const searchHtml = await searchRes.text();

    let carHtml = '';
    
    // Check if this is already a car page (redirected directly to result)
    if (searchHtml.includes('ravwidg-results') || searchHtml.includes('ravwidg-car-info') || searchHtml.includes('ravwidg-unit-title')) {
      carHtml = searchHtml;
    } else {
      // Find candidate car links
      const linkMatches = [...searchHtml.matchAll(/<a[^>]+href="(\/[0-9]+-[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
      const candidates: { href: string; text: string; score: number }[] = [];

      const hintTokens = hint ? hint.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 1) : [];

      for (const m of linkMatches) {
        const href = m[1];
        const text = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        
        // Skip top-level category pages and non-car sections
        if (href.match(/^\/(1-cars|3-moto|4-trucks|5-agro|6-industrial|7-marine|8-oldtimer|2-favorites)\/?$/i)) {
          continue;
        }

        const slashCount = (href.match(/\//g) || []).length;
        // Deep detail links have 4+ slashes (e.g. /1-cars/365-mercedes-benz/1435-c-klass/202238-c-200/)
        let score = slashCount * 15;

        // Give strong preference to passenger cars section
        if (href.startsWith('/1-cars/')) {
          score += 50;
        }

        // Reward if link text or href contains hint tokens
        if (hintTokens.length > 0) {
          const lowerText = text.toLowerCase();
          const lowerHref = href.toLowerCase();
          for (const token of hintTokens) {
            if (lowerText.includes(token) || lowerHref.includes(token)) {
              score += 30;
            }
          }
        }

        candidates.push({ href, text, score });
      }

      if (candidates.length === 0) return null;

      // Sort candidates by score descending
      candidates.sort((a, b) => b.score - a.score);
      const selected = candidates[0];

      const carUrl = `https://podbor.ravenol.ru${selected.href}`;

      // Fetch the car page via proxy
      let carRes;
      try {
        carRes = await fetchWithTimeout(`/api/proxy/ravenol?url=${encodeURIComponent(carUrl)}`);
      } catch (e) {
        carRes = { ok: false } as any;
      }
      
      // Fallback to corsproxy.io if our proxy fails
      if (!carRes || !carRes.ok) {
        try {
          carRes = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(carUrl)}`);
        } catch (e) {
          return null;
        }
      }
      
      if (!carRes || !carRes.ok) return null;
      carHtml = await carRes.text();
    }

    // Strip HTML tags to reduce token usage
    let title = '';
    let content = '';

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(carHtml, 'text/html');
      
      // Remove product_parameters to reduce size
      const params = doc.querySelectorAll('.product_parameters');
      params.forEach(p => p.parentNode?.removeChild(p));
      
      title = doc.querySelector('.ravwidg-car-title')?.textContent || doc.querySelector('h1')?.textContent || '';
      content = doc.body?.innerText || doc.body?.textContent || '';
    } else {
      let cleanHtml = carHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                               .replace(/<style[\s\S]*?<\/style>/gi, '');
      // Remove product_parameters div blocks to vastly reduce token size
      cleanHtml = cleanHtml.replace(/<div[^>]*class="[^"]*product_parameters[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "");
      
      const titleMatch = cleanHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || cleanHtml.match(/class="ravwidg-car-title"[^>]*>([\s\S]*?)<\/div>/i);
      if (titleMatch) title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      content = cleanHtml.replace(/<[^>]+>/g, ' ');
    }

    // Clean up excessive whitespace
    const cleanText = `${title}\n${content}`.replace(/\s+/g, ' ').trim();
    if (cleanText.length < 100) return null;

    return cleanText;
  } catch (error) {
    console.error("Failed to fetch from Ravenol:", error);
    return null;
  }
}
