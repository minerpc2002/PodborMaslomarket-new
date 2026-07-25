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

export async function fetchRavenolData(query: string, hint?: string, brand?: string): Promise<string | null> {
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
      const brandToken = brand ? brand.toLowerCase().split(/[\s,.-]+/)[0] : null;

      for (const m of linkMatches) {
        const href = m[1];
        const text = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        
        // Skip top-level category pages and non-car sections
        if (href.match(/^\/(1-cars|3-moto|4-trucks|5-agro|6-industrial|7-marine|8-oldtimer|2-favorites)\/?$/i)) {
          continue;
        }

        const lowerText = text.toLowerCase();
        const lowerHref = href.toLowerCase();

        // STRICT BRAND FILTERING: If we know the brand, skip candidates that don't match it in the href
        // The href usually looks like /1-cars/396-nissan/1620-micra...
        if (brandToken && href.startsWith('/1-cars/')) {
           const brandPartMatch = href.match(/^\/1-cars\/\d+-([^\/]+)/);
           if (brandPartMatch) {
             const hrefBrand = brandPartMatch[1].toLowerCase();
             // Simple contains check, e.g. "mercedes-benz" contains "mercedes"
             if (!hrefBrand.includes(brandToken) && !brandToken.includes(hrefBrand)) {
               continue; // Skip! Wrong brand entirely
             }
           }
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
      
      const titleEl = doc.querySelector('title');
      if (titleEl) title = titleEl.textContent?.replace(/\s+/g, ' ').trim() || '';
      
      const nodes = doc.querySelectorAll('.aggregate_node_wrapp');
      content = Array.from(nodes).map(node => {
        const h4 = node.querySelector('.aggregate_node_title');
        const unitName = h4 ? (h4.textContent || '').replace(/\s+/g, ' ').trim() : 'Unknown Unit';
        const products = Array.from(node.querySelectorAll('.node_product_item_title_wrapp')).map(p => {
          const link = p.querySelector('a');
          return link ? (link.textContent || '').replace(/\s+/g, ' ').trim() : '';
        }).filter(Boolean);
        return `${unitName}\n${products.join('\n')}`;
      }).join('\n\n');
    } else {
      const titleMatch = carHtml.match(/<title>([\s\S]*?)<\/title>/i);
      title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
      
      // Node fallback for regex extraction
      const nodeMatches = [...carHtml.matchAll(/<div class="aggregate_node_wrapp"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi)];
      content = nodeMatches.map(m => {
        const block = m[1];
        const h4Match = block.match(/<h4 class="aggregate_node_title"[^>]*>([\s\S]*?)<\/h4>/i);
        const unitName = h4Match ? h4Match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : 'Unknown';
        const productMatches = [...block.matchAll(/<div class="node_product_item_title_wrapp"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/gi)];
        const products = productMatches.map(pm => pm[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
        return `${unitName}\n${products.join('\n')}`;
      }).join('\n\n');
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
