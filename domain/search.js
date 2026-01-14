// @ts-check

/**
 * @typedef {Object} SearchOptions
 * @property {boolean} [includeArchived]
 * @property {number} [limit]
 */

function normalizeText(text){
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text){
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

/**
 * Score a candidate against a query.
 * - startsWith match: 3
 * - includes match: 1
 * All tokens must be present somewhere in the candidate.
 * @param {string} query
 * @param {string} candidate
 * @returns {number}
 */
export function scoreMatch(query, candidate){
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if(!q || !c) return 0;

  const tokens = tokenize(q);
  for(const token of tokens){
    if(!c.includes(token)) return 0;
  }

  if(c.startsWith(q)) return 3;
  return 1;
}

/**
 * Search roster items by label and aliases.
 * @param {{label:string, aliases?:string[], archived?:boolean}[]} items
 * @param {string} query
 * @param {SearchOptions} [options]
 * @returns {any[]}
 */
export function searchRosterItems(items, query, options = {}){
  const list = Array.isArray(items) ? items : [];
  const includeArchived = !!options.includeArchived;
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : Infinity;

  const filtered = list.filter((item) => includeArchived || !item?.archived);
  const q = normalizeText(query);
  if(!q){
    return filtered
      .slice()
      .sort((a, b) => normalizeText(a.label).localeCompare(normalizeText(b.label)))
      .slice(0, limit);
  }

  const scored = [];
  for(const item of filtered){
    const labelScore = scoreMatch(q, item?.label || "");
    let best = labelScore;
    const aliases = Array.isArray(item?.aliases) ? item.aliases : [];
    for(const alias of aliases){
      const score = scoreMatch(q, alias);
      if(score > best) best = score;
    }
    if(best > 0){
      scored.push({ item, score: best });
    }
  }

  scored.sort((a, b) => {
    if(b.score !== a.score) return b.score - a.score;
    return normalizeText(a.item.label).localeCompare(normalizeText(b.item.label));
  });

  return scored.slice(0, limit).map((entry) => entry.item);
}

export default {
  searchRosterItems,
  scoreMatch
};
