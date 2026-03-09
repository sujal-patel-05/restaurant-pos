/**
 * localOrderParser.js — Offline-capable regex/keyword parser.
 * Used as a fallback when the Groq LLM is unavailable or rate-limited.
 */

// ─── Number word → digit mapping ──────────────────────────────────────────────
const NUM_WORDS = {
  // English
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  couple: 2, few: 3, half: 1,
  // Hindi / Hinglish
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, paanch: 5, chhe: 6,
};

/**
 * Parse a voice transcript using keyword + alias matching.
 *
 * @param {string} transcript - Raw transcript text from Whisper.
 * @param {Array<{name: string, menu_item_id: string, price: number}>} menuItems
 * @param {Object} aliasMap - { "Masala Dosa": ["masala dosa", "dosa", ...], ... }
 * @returns {Array<{name, qty, menu_item_id, price}>}
 */
export function localParse(transcript, menuItems, aliasMap = {}) {
  if (!transcript?.trim()) return [];

  const lower = transcript.toLowerCase().trim();
  const results = [];
  const usedRanges = [];

  // Build flat list of (menuName, alias, len) sorted longest alias first
  // to prevent "dosa" matching before "masala dosa"
  const menuLookup = Object.fromEntries(menuItems.map((m) => [m.name, m]));

  const entries = Object.entries(aliasMap)
    .flatMap(([menuName, aliases]) =>
      (aliases || []).map((alias) => ({ menuName, alias: alias.toLowerCase(), len: alias.length }))
    )
    .sort((a, b) => b.len - a.len);

  // Also add exact menu names that aren't covered by aliases
  for (const item of menuItems) {
    const name = item.name.toLowerCase();
    if (!entries.find((e) => e.alias === name)) {
      entries.push({ menuName: item.name, alias: name, len: name.length });
    }
  }

  for (const { menuName, alias } of entries) {
    let searchFrom = 0;
    while (true) {
      const idx = lower.indexOf(alias, searchFrom);
      if (idx === -1) break;

      const alreadyMatched = usedRanges.some(
        ([start, end]) => idx < end && idx + alias.length > start
      );
      if (alreadyMatched) { searchFrom = idx + 1; continue; }

      // Look at up to 25 chars before match to find quantity word/digit
      const before = lower.substring(Math.max(0, idx - 25), idx).trim();
      const words = before.split(/\s+/).filter(Boolean);
      const lastWord = words[words.length - 1] || '';

      let qty = 1;
      if (NUM_WORDS[lastWord] !== undefined) {
        qty = NUM_WORDS[lastWord];
      } else if (/^\d+$/.test(lastWord)) {
        qty = parseInt(lastWord, 10);
      }

      const existing = results.find((r) => r.name === menuName);
      if (existing) {
        existing.qty += qty;
      } else {
        const meta = menuLookup[menuName];
        results.push({
          name: menuName,
          qty,
          menu_item_id: meta?.menu_item_id || meta?.id || '',
          price: meta?.price || 0,
        });
      }

      usedRanges.push([idx, idx + alias.length]);
      searchFrom = idx + alias.length;
    }
  }

  return results;
}
