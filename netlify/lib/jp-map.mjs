// Shared by the Netlify Function (netlify/functions/countries.mjs) and the build script
// (scripts/build.mjs). Turns the Joshua Project API /v1/countries.json response into the
// same shape as data/countries.json, so js/app.js does not care where the data came from.
//
// Field mapping (static CSV column -> live API field):
//   name         Ctry                -> Ctry
//   pop          PoplPeoples         -> Population   (API has no PoplPeoples; see README)
//   pctEvan      PercentEvangelical  -> PercentEvangelical
//   pctChristian PercentChristianity -> PercentChristianity
//   peoples      CntPeoples          -> CntPeoples
//   upgs         CntPeoplesLR        -> CntPeoplesLR
//   popUpgs      PoplPeoplesLR       -> PoplPeoplesLR
//   religion     ReligionPrimary     -> ReligionPrimary
//   window1040   10_40Window (Y/N)   -> Window1040 (Y/N)
//   jpScale      JPScaleCtry         -> JPScaleCtry
//   workers      WorkersNeeded       -> NOT IN THE API. Kept from the static download.

export const JP_COUNTRIES_URL = 'https://api.joshuaproject.net/v1/countries.json';

function num(v) {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function scale(v) {
  const n = num(v);
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export async function fetchJpCountries(apiKey, { timeoutMs = 15000 } = {}) {
  if (!apiKey) throw new Error('JP_API_KEY is not set');
  const url = JP_COUNTRIES_URL + '?limit=1000&api_key=' + encodeURIComponent(apiKey);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('Joshua Project API returned HTTP ' + r.status);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length < 200) throw new Error('Unexpected Joshua Project API response');
    return rows;
  } finally {
    clearTimeout(t);
  }
}

// rows: API array. fallback: parsed data/countries.json (used only for WorkersNeeded).
export function toSiteData(rows, fallback, now = new Date()) {
  const old = (fallback && fallback.countries) || {};
  const countries = {};
  for (const r of rows) {
    const iso = r && r.ISO3;
    if (!iso) continue;
    const prev = old[iso] || {};
    countries[iso] = {
      name: r.Ctry || prev.name || iso,
      pop: num(r.Population),
      pctEvan: num(r.PercentEvangelical),
      pctChristian: num(r.PercentChristianity),
      peoples: num(r.CntPeoples),
      upgs: num(r.CntPeoplesLR),
      popUpgs: num(r.PoplPeoplesLR),
      workers: prev.workers ?? null,
      religion: r.ReligionPrimary || null,
      window1040: r.Window1040 === 'Y',
      jpScale: scale(r.JPScaleCtry),
    };
  }
  return {
    source: 'Joshua Project API (api.joshuaproject.net/v1/countries.json)',
    live: true,
    fetched: now.toISOString(),
    downloaded: now.toISOString().slice(0, 10),
    workersSource: 'Joshua Project All Countries Listing CSV, downloaded ' + ((fallback && fallback.downloaded) || 'unknown'),
    countries,
  };
}
