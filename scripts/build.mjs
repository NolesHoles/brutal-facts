// Netlify build step (also runs locally): copies the public site into dist/ and, when
// JP_API_KEY is set, refreshes dist/data/countries.json from the Joshua Project API.
// If the API fails, the build still succeeds with the bundled static data/countries.json.
//   node scripts/build.mjs
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchJpCountries, toSiteData } from '../netlify/lib/jp-map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PUBLIC = ['index.html', 'css', 'js', 'lib', 'fonts', 'img', 'data'];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const p of PUBLIC) cpSync(join(root, p), join(dist, p), { recursive: true });

const staticData = JSON.parse(readFileSync(join(root, 'data/countries.json'), 'utf8'));
const key = process.env.JP_API_KEY;
if (!key) {
  console.log('JP_API_KEY not set: using the static data/countries.json (downloaded ' + staticData.downloaded + ').');
} else {
  try {
    const rows = await fetchJpCountries(key);
    const fresh = toSiteData(rows, staticData);
    fresh.live = false; // baked in at build time; the page still tries /api/countries first
    fresh.source = 'Joshua Project API, refreshed at build time';
    writeFileSync(join(dist, 'data/countries.json'), JSON.stringify(fresh));
    console.log('Refreshed dist/data/countries.json from the Joshua Project API: ' + Object.keys(fresh.countries).length + ' countries.');
  } catch (err) {
    console.warn('Joshua Project API refresh failed (' + (err && err.name) + '); keeping the static data/countries.json.');
  }
}
console.log('Built ' + dist);
