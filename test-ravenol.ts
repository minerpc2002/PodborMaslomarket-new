async function run() {
  const searchUrl = `https://podbor.ravenol.ru/search/?q=${encodeURIComponent('VF3LRHNYWFS343639')}`;
  const res = await fetch(searchUrl);
  const html = await res.text();
  const linkMatches = [...html.matchAll(/<a[^>]+href="(\/[0-9]+-[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  
  const hintTokens = "Peugeot 3008 II".toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 1);
  const candidates = [];
  for (const m of linkMatches) {
    const href = m[1];
    const text = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (href.match(/^\/(1-cars|3-moto|4-trucks|5-agro|6-industrial|7-marine|8-oldtimer|2-favorites)\/?$/i)) continue;
    let score = (href.match(/\//g) || []).length * 15;
    if (href.startsWith('/1-cars/')) score += 50;
    
    for (const token of hintTokens) {
      if (text.toLowerCase().includes(token) || href.toLowerCase().includes(token)) score += 30;
    }
    candidates.push({ href, text, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  console.log("Top Candidates:");
  console.log(candidates.slice(0, 3));
}
run();
