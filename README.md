# Brutal Facts globe (v2)

An interactive 3D globe. Hover over a country, or tap it on a phone, to see that country's "Brutal Facts."

## Run locally
The data loads with `fetch`, so open it through a small local server instead of double-clicking the file:

    cd npl_globe && python3 -m http.server 8000
    # then open http://localhost:8000

It works fully offline. The globe library, fonts, map shapes, and data are all bundled in this folder.

## Live Joshua Project data (Netlify)
The page first asks `/api/countries` for live data. That's a Netlify Function
(`netlify/functions/countries.mjs`) that calls the Joshua Project API
(`https://api.joshuaproject.net/v1/countries.json`) with the `JP_API_KEY` environment
variable, so the key never reaches the browser. Netlify's CDN caches the answer for about
6 hours. If the function is missing, slow (7 s), or broken, the page quietly uses the saved
`data/countries.json` instead.

- `netlify.toml`: build command `node scripts/build.mjs`, publish folder `dist`, functions folder `netlify/functions`.
- `scripts/build.mjs`: copies the public files into `dist/`. If `JP_API_KEY` is set, it also refreshes `dist/data/countries.json` from the API. If the API fails, the build keeps the saved file.
- `netlify/lib/jp-map.mjs`: the field mapping, used by both of the above.
- Functions only run on a Git-connected site or a `netlify deploy --build` from the Netlify CLI. **Drag-and-drop uploads skip the function and the build**, so the site would just show the saved file.
- The API has no `WorkersNeeded`, so "Workers needed" still comes from the saved CSV download (the footer says so).
- The API's `Population` is the country population. The CSV's `PoplPeoples` was the sum of its people groups, so populations are about 1% higher with live data.

Local test with live data (needs the key in your shell, never in a file in this folder):

    node scripts/build.mjs
    netlify dev --offline --port 8888      # then open http://localhost:8888/?live=1
    python3 test_live.py                   # hovers Japan, Sweden, Greece on live data

On localhost the page skips the live call unless the URL has `?live=1`, so the older
`test_*.py` files (plain `python3 -m http.server`) still test the saved-file fallback.
Add `?static=1` anywhere to force the saved file.

## Files
- `index.html`, `css/style.css`, `js/app.js`: the site
- `lib/globe.gl.min.js`: globe.gl v2.46.2 (MIT, see `lib/globe.gl-LICENSE.txt`). three.js is bundled inside it.
- `fonts/`: Fredoka (titles) and Open Sauce Sans (body). Both are under the SIL Open Font License.
- `data/countries.json`: Joshua Project "All Countries" CSV, converted to JSON (downloaded 2026-10-19)
- `data/countries.geojson`: Natural Earth 1:50m country borders (public domain), simplified, with Antarctica removed
- `jp-AllCountriesListing.csv` + `prep_data.py`: the raw source file and the script that rebuilds `data/`. Re-download the CSV from https://joshuaproject.net/resources/datasets, update `DOWNLOADED`, and run `python3 prep_data.py`.

## Data notes
- The "Data provided by Joshua Project" credit and link in the footer is required by Joshua Project's terms. Their data is for non-commercial use only.
- "Estimated far from God" = population × (1 − % Evangelical), rounded to the nearest 1,000. It's a rough estimate, and Joshua Project itself advises against turning % Evangelical into absolute numbers.
- Blank values in the CSV show as "No data." Joshua Project leaves % Evangelical blank for India, Pakistan, Bangladesh, Nepal, Sri Lanka, and Bhutan.

## v2 features
- **Search box** (top left): type part of a country name, pick a suggestion (mouse, tap, or arrow keys + Enter). The globe turns to that country, highlights it, and pins its panel. Escape or the x button resets.
- **Least reached view**: third toggle button. Colors countries by Joshua Project's country Progress Level (`JPScaleCtry`, 1 = Unreached ... 5 = Significantly reached). Grey = no data.
- **Pray for <Country>**: button in a pinned panel. The prayer prompt is built only from that country's Joshua Project fields (population, % Evangelical, unreached groups, people in unreached groups, workers needed, main religion). Lines with missing data are skipped. "Copy prayer" copies it.
- `test_features.py` is the headless Playwright test for these.
