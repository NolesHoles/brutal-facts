"""Build data/countries.json (Joshua Project) and data/countries.geojson (Natural Earth 1:50m)."""
import csv, json
SRC_CSV = 'jp-AllCountriesListing.csv'
DOWNLOADED = '2026-10-19'
rows = list(csv.reader(open(SRC_CSV, encoding='utf-8-sig')))
h = rows[2]
def num(v):
    if v is None or v.strip() == '': return None
    try: return float(v)
    except ValueError: return None
out = {}
for r in rows[3:]:
    if len(r) != len(h): continue
    d = dict(zip(h, r))
    out[d['ISO3']] = {
        'name': d['Ctry'],
        'pop': num(d['PoplPeoples']),
        'pctEvan': num(d['PercentEvangelical']),
        'pctChristian': num(d['PercentChristianity']),
        'peoples': num(d['CntPeoples']),
        'upgs': num(d['CntPeoplesLR']),
        'popUpgs': num(d['PoplPeoplesLR']),
        'workers': num(d['WorkersNeeded']),
        'religion': d['ReligionPrimary'] or None,
        'window1040': d['10_40Window'] == 'Y',
        'jpScale': int(d['JPScaleCtry']) if d['JPScaleCtry'].strip().isdigit() else None,
    }
json.dump({'source': 'Joshua Project, All Countries Listing (AllCountriesListing.csv)',
           'downloaded': DOWNLOADED, 'countries': out},
          open('data/countries.json', 'w'), separators=(',', ':'))

ALIAS = {'KOS': 'XKV'}
# Natural Earth draws some overseas territories inside the parent country's polygon;
# Joshua Project lists them separately, so split those parts out by location.
SPLIT = {
    'FRA': [('GUF', lambda x, y: -56 < x < -50 and 1 < y < 7),
            ('GLP', lambda x, y: -62 < x < -60.8 and 15.8 < y < 16.6),
            ('MTQ', lambda x, y: -61.4 < x < -60.7 and 14.3 < y < 15),
            ('REU', lambda x, y: 55 < x < 56 and -21.5 < y < -20.8),
            ('MYT', lambda x, y: 44.9 < x < 45.4 and -13.1 < y < -12.5)],
    'NOR': [('SJM', lambda x, y: y > 74)],
}  # Natural Earth Kosovo -> Joshua Project Kosovo
g = json.load(open('ne_50m.geojson'))
def rnd(c):
    if isinstance(c[0], (int, float)): return [round(c[0], 2), round(c[1], 2)]
    return [rnd(x) for x in c]
feats, missing = [], []
for f in g['features']:
    p = f['properties']
    if p['ADM0_A3'] == 'ATA': continue  # drop Antarctica
    iso = p['ISO_A3'] if p['ISO_A3'] != '-99' else p['ISO_A3_EH']
    if iso in ('-99', None): iso = p['ADM0_A3']
    iso = ALIAS.get(iso, iso)
    if iso in SPLIT and f['geometry']['type'] == 'MultiPolygon':
        groups = {}
        for poly in f['geometry']['coordinates']:
            xs = [c[0] for c in poly[0]]; ys = [c[1] for c in poly[0]]
            cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
            code = next((c for c, test in SPLIT[iso] if test(cx, cy)), iso)
            groups.setdefault(code, []).append(poly)
        for code, polys in groups.items():
            name = out[code]['name'] if code in out else p['ADMIN']
            feats.append({'type': 'Feature', 'properties': {'name': name, 'iso3': code},
                          'geometry': {'type': 'MultiPolygon', 'coordinates': rnd(polys)}})
        continue
    if iso not in out: missing.append(p['ADMIN'])
    feats.append({'type': 'Feature', 'properties': {'name': p['ADMIN'], 'iso3': iso},
                  'geometry': {'type': f['geometry']['type'], 'coordinates': rnd(f['geometry']['coordinates'])}})
json.dump({'type': 'FeatureCollection', 'features': feats}, open('data/countries.geojson', 'w'), separators=(',', ':'))
print(f'JP countries: {len(out)}; map polygons: {len(feats)}; polygons without JP data: {len(missing)}')
print('Missing:', ', '.join(missing))
