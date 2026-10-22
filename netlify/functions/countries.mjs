// GET /api/countries -> live Joshua Project country data in the data/countries.json shape.
// The API key stays on the server (Netlify environment variable JP_API_KEY); it never
// reaches the browser. Netlify's CDN caches the answer, so Joshua Project is called at most
// a few times a day. If anything fails this returns 502 and the page uses the static file.
import { fetchJpCountries, toSiteData } from '../lib/jp-map.mjs';
import fallback from '../../data/countries.json' with { type: 'json' };

export default async () => {
  const key = (globalThis.Netlify && Netlify.env.get('JP_API_KEY')) || process.env.JP_API_KEY;
  try {
    const rows = await fetchJpCountries(key, { timeoutMs: 8000 });
    const body = toSiteData(rows, fallback);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // browsers: 10 min. Netlify CDN: 6 h fresh, then serve stale up to 1 day while refreshing.
        'cache-control': 'public, max-age=600',
        'netlify-cdn-cache-control': 'public, durable, s-maxage=21600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    // Do not echo the error text: it could contain the request URL (and so the key).
    console.error('Joshua Project API failed:', err && err.name);
    return new Response(JSON.stringify({ error: 'Live data unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
};

export const config = { path: '/api/countries' };
