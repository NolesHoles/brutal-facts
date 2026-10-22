(function () {
  'use strict';
  var RED = '#E82624', NO_DATA = '#2e2e33';

  // Color scales: redder = more lostness.
  var SCALES = {
    evan: {
      title: '% Evangelical',
      bins: [
        { max: 0.5, color: '#E82624', label: 'Under 0.5%' },
        { max: 2,   color: '#c4413c', label: '0.5 – 2%' },
        { max: 5,   color: '#9c524f', label: '2 – 5%' },
        { max: 10,  color: '#7a6362', label: '5 – 10%' },
        { max: 20,  color: '#8c8c90', label: '10 – 20%' },
        { max: Infinity, color: '#c9c9cd', label: '20% and up' }
      ],
      value: function (d) { return d ? d.pctEvan : null; }
    },
    unreached: {
      title: 'Share living in unreached groups',
      bins: [
        { max: 10, color: '#c9c9cd', label: 'Under 10%' },
        { max: 25, color: '#8c8c90', label: '10 – 25%' },
        { max: 50, color: '#7a6362', label: '25 – 50%' },
        { max: 75, color: '#9c524f', label: '50 – 75%' },
        { max: 90, color: '#c4413c', label: '75 – 90%' },
        { max: Infinity, color: '#E82624', label: '90% and up' }
      ],
      value: function (d) {
        if (!d || d.pop == null || d.popUpgs == null || d.pop === 0) return null;
        return 100 * d.popUpgs / d.pop;
      }
    },
    // Joshua Project Progress Scale for the whole country (JPScaleCtry, 1-5).
    least: {
      title: 'Least reached',
      subtitle: 'Joshua Project Progress Level',
      bins: [
        { max: 1.5, color: '#E82624', label: '1 · Unreached' },
        { max: 2.5, color: '#c4413c', label: '2 · Minimally reached' },
        { max: 3.5, color: '#9c524f', label: '3 · Superficially reached' },
        { max: 4.5, color: '#8c8c90', label: '4 · Partially reached' },
        { max: Infinity, color: '#c9c9cd', label: '5 · Significantly reached' }
      ],
      note: '1 = 2% or fewer evangelical and 5% or fewer Christian. 5 = over 10% evangelical.',
      value: function (d) { return d && d.jpScale != null ? d.jpScale : null; }
    }
  };
  var LEVEL_NAMES = { 1: 'Unreached', 2: 'Minimally reached', 3: 'Superficially reached', 4: 'Partially reached', 5: 'Significantly reached' };

  var mode = 'evan', data = {}, hovered = null, pinned = null, cardFeat = null;
  var card = document.getElementById('card');
  var isTouch = window.matchMedia('(hover: none)').matches;
  if (isTouch) {
    document.querySelector('.sub').textContent = 'Tap a country. See the lostness.';
    document.querySelector('.card-hint').textContent = 'Tap a country to pin it.';
  }

  // ---------- Want to help? panel ----------
  var helpBtn = document.getElementById('help-btn'), modal = document.getElementById('help-modal');
  function openHelp() { modal.hidden = false; modal.querySelector('.modal-close').focus(); }
  function closeHelp() { if (modal.hidden) return; modal.hidden = true; helpBtn.focus(); }
  helpBtn.addEventListener('click', openHelp);
  modal.querySelector('.modal-close').addEventListener('click', closeHelp);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeHelp(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) { closeHelp(); return; }
    if (document.activeElement === searchInput) return; // the search box handles its own Escape
    if (pinned) resetSearch();
  });

  // ---------- formatting (only real values; missing -> "No data") ----------
  function fmtInt(v) { return v == null ? null : Math.round(v).toLocaleString('en-US'); }
  function fmtPct(v) {
    if (v == null) return null;
    if (v > 0 && v < 0.01) return '< 0.01%';
    return (v < 10 ? v.toFixed(2) : v.toFixed(1)) + '%';
  }
  function farFromGod(d) {
    if (!d || d.pop == null || d.pctEvan == null) return null;
    return Math.round(d.pop * (1 - d.pctEvan / 100) / 1000) * 1000; // rounded to nearest 1,000
  }

  function colorFor(feat) {
    var s = SCALES[mode], v = s.value(data[feat.properties.iso3]);
    if (v == null) return NO_DATA;
    for (var i = 0; i < s.bins.length; i++) if (v < s.bins[i].max) return s.bins[i].color;
    return s.bins[s.bins.length - 1].color;
  }

  function renderLegend() {
    var s = SCALES[mode], html = '<h3>' + s.title + '</h3>';
    if (s.subtitle) html += '<div class="legend-sub">' + s.subtitle + '</div>';
    s.bins.forEach(function (b) { html += '<div class="row"><span class="sw" style="background:' + b.color + '"></span>' + b.label + '</div>'; });
    html += '<div class="row"><span class="sw" style="background:' + NO_DATA + ';border:1px solid #444"></span>No data</div>';
    if (s.note) html += '<div class="legend-note">' + s.note + '</div>';
    document.getElementById('legend').innerHTML = html;
  }

  function row(label, value) {
    return '<dt>' + label + '</dt>' + (value == null ? '<dd class="na">No data</dd>' : '<dd>' + value + '</dd>');
  }

  function fillCard(feat) {
    var d = data[feat.properties.iso3];
    card.querySelector('.card-title').textContent = d ? d.name : feat.properties.name;
    var f = farFromGod(d);
    var bv = card.querySelector('.big-value');
    bv.textContent = f == null ? 'No data' : '≈ ' + fmtInt(f);
    var html = '';
    html += row('Population', fmtInt(d && d.pop));
    html += row('% Evangelical', fmtPct(d && d.pctEvan));
    html += row('People groups', fmtInt(d && d.peoples));
    html += row('Unreached people groups', fmtInt(d && d.upgs));
    html += row('Living in unreached groups', fmtInt(d && d.popUpgs));
    html += row('Workers needed', fmtInt(d && d.workers));
    html += row('Main religion', d && d.religion ? d.religion : null);
    card.querySelector('.facts').innerHTML = html;
    card.querySelector('.level').innerHTML = 'Progress level: ' + (d && d.jpScale != null
      ? '<b>' + d.jpScale + ' · ' + LEVEL_NAMES[d.jpScale] + '</b>' : '<span class="na">No data</span>');
    var nm = d ? d.name : feat.properties.name;
    card.querySelector('.pray-name').textContent = nm;
    if (cardFeat !== feat) closePrayer();
    cardFeat = feat;
    card.hidden = false;
    document.body.classList.add('card-open');
  }

  var mouse = { x: 0, y: 0 };
  function placeCard() {
    if (pinned || window.innerWidth <= 640) return;
    var w = card.offsetWidth, h = card.offsetHeight, pad = 18;
    var x = mouse.x + pad, y = mouse.y + pad;
    if (x + w > window.innerWidth - 10) x = mouse.x - w - pad;
    if (y + h > window.innerHeight - 40) y = window.innerHeight - h - 40;
    card.style.left = Math.max(10, x) + 'px';
    card.style.top = Math.max(10, y) + 'px';
  }
  document.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; if (!card.hidden) placeCard(); });

  function hideCard() { card.hidden = true; document.body.classList.remove('card-open'); }
  function unpin() {
    clearSearchText();
    pinned = null; card.classList.remove('pinned'); card.querySelector('.close').hidden = true;
    if (hovered) fillCard(hovered); else hideCard();
    refresh();
  }
  card.querySelector('.close').addEventListener('click', unpin);

  // ---------- globe ----------
  var el = document.getElementById('globe');
  var world = Globe({ animateIn: false })(el)
    .backgroundColor('#000000')
    .showAtmosphere(true).atmosphereColor(RED).atmosphereAltitude(0.12)
    .polygonsTransitionDuration(250)
    .polygonCapColor(function (f) { return (f === hovered || f === pinned) ? '#ffffff' : colorFor(f); })
    .polygonSideColor(function () { return 'rgba(232,38,36,0.35)'; })
    .polygonStrokeColor(function () { return 'rgba(0,0,0,0.55)'; })
    .polygonAltitude(function (f) { return (f === hovered || f === pinned) ? 0.06 : 0.008; })
    .onPolygonHover(function (f) {
      if (isTouch) return;
      hovered = f || null;
      el.style.cursor = f ? 'pointer' : 'grab';
      if (!pinned) { if (f) { fillCard(f); placeCard(); } else hideCard(); }
      refresh();
    })
    .onPolygonClick(function (f) {
      if (f !== pinned) clearSearchText();
      pin(f);
      clampCard();
    })
    .onGlobeClick(function () { if (pinned) unpin(); });

  var mat = world.globeMaterial();
  mat.color.set('#0c0c10');
  if (mat.emissive) mat.emissive.set('#050507');
  if (mat.shininess !== undefined) mat.shininess = 4;

  world.controls().autoRotate = true;
  world.controls().autoRotateSpeed = 0.35;
  el.addEventListener('pointerdown', function () { world.controls().autoRotate = false; });
  world.pointOfView({ lat: 20, lng: 20, altitude: window.innerWidth <= 640 ? 3.4 : 2.3 }, 0);

  function sizeGlobe() { world.width(window.innerWidth).height(window.innerHeight); }
  window.addEventListener('resize', sizeGlobe); sizeGlobe();

  function refresh() {
    world.polygonCapColor(world.polygonCapColor()).polygonAltitude(world.polygonAltitude());
  }

  document.querySelectorAll('.toggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.mode;
      document.querySelectorAll('.toggle button').forEach(function (x) { x.classList.toggle('on', x === b); });
      renderLegend(); refresh();
    });
  });

  function pin(f) {
    pinned = f; fillCard(f);
    card.classList.add('pinned'); card.querySelector('.close').hidden = false;
    placeCard(); refresh();
    world.controls().autoRotate = false;
  }
  // Desktop: park a search-pinned card on the right side, clear of the header buttons.
  function placePinnedCard() {
    if (window.innerWidth <= 640) return;
    card.style.left = (window.innerWidth - card.offsetWidth - 28) + 'px';
    card.style.top = '96px';
    clampCard();
  }
  function clampCard() {
    if (window.innerWidth <= 640 || card.hidden) return;
    var r = card.getBoundingClientRect(), maxBottom = window.innerHeight - 40;
    if (r.bottom > maxBottom) card.style.top = Math.max(10, r.top - (r.bottom - maxBottom)) + 'px';
  }

  // ---------- prayer prompt (built only from this country's Joshua Project fields) ----------
  function roughNum(v) {
    if (v >= 1e9) return (Math.round(v / 1e8) / 10).toLocaleString('en-US') + ' billion';
    if (v >= 1e6) return (Math.round(v / 1e5) / 10).toLocaleString('en-US') + ' million';
    if (v >= 1000) return (Math.round(v / 1000) * 1000).toLocaleString('en-US');
    return Math.round(v).toLocaleString('en-US');
  }
  function pctWords(v) {
    if (v === 0) return '0%';
    if (v < 0.1) return 'less than 0.1%';
    return (v < 10 ? (Math.round(v * 10) / 10) : Math.round(v)) + '%';
  }
  // "the United States", "the Philippines", "the Central African Republic"...
  function withThe(n) {
    if (/^the /i.test(n) || /^(Isle of Man|Micronesia)/.test(n)) return n;
    if (/^Congo, Democratic Republic of/.test(n)) return 'the Democratic Republic of the Congo';
    if (/^Congo, Republic of the/.test(n)) return 'the Republic of the Congo';
    return /^(United |Bahamas|Gambia|Netherlands|Philippines|Maldives|Comoros|Seychelles|Vatican|British |Virgin Islands)|Republic$|Islands( \(.*\))?$/.test(n) ? 'the ' + n : n;
  }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function has(v) { return v != null && v > 0; }
  function prayerFor(feat) {
    var d = data[feat.properties.iso3], name = withThe(d ? d.name : feat.properties.name);
    if (!d) return 'Pray for the people of ' + name + '.';
    var pop = has(d.pop) ? '~' + roughNum(d.pop) : null;
    var pe = d.pctEvan != null ? (d.pctEvan > 0 && d.pctEvan < 0.1 ? 'Less than 0.1%' : 'About ' + pctWords(d.pctEvan)) : null;
    var upgs = has(d.upgs) ? Math.round(d.upgs) : null;
    var lr = has(d.popUpgs) ? roughNum(d.popUpgs) : null;
    var wk = has(d.workers) ? Math.round(d.workers).toLocaleString('en-US') : null;
    var rel = d.religion || null;
    var upgTxt = upgs && (upgs.toLocaleString('en-US') + ' unreached people ' + plural(upgs, 'group', 'groups'));
    var T = [
      [ pop ? 'Pray for the ' + pop + ' people in ' + name + '.' : 'Pray for the people of ' + name + '.',
        pe && pe + ' are evangelical.',
        upgTxt && 'Ask God to send laborers to the ' + upgTxt + '.',
        wk && 'Joshua Project estimates ' + wk + ' ' + plural(d.workers, 'worker is', 'workers are') + ' needed. Pray for them to be raised up.' ],
      [ 'Lord, we lift up ' + name + (pop ? ' and its ' + pop + ' people.' : '.'),
        lr && 'About ' + lr + ' people here live in unreached people groups.',
        pe && pe + ' are evangelical. Pray for the believers there to grow and share.',
        upgTxt && 'Ask God to open doors among the ' + upgTxt + '.' ],
      [ 'Pray for ' + name + (pop ? ', home to ' + pop + ' people.' : '.'),
        rel && 'Joshua Project lists the main religion as ' + rel + '.',
        pe && pe + ' are evangelical.',
        upgTxt && 'Ask God to send workers to the ' + upgTxt + (wk ? ', where an estimated ' + wk + ' ' + plural(d.workers, 'worker is', 'workers are') + ' needed.' : '.') ]
    ];
    var h = 0, iso = feat.properties.iso3 || name;
    for (var i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) % 997;
    return T[h % T.length].filter(Boolean).join(' ');
  }
  var prayBtn = card.querySelector('.pray-btn'), prayer = document.getElementById('prayer');
  function closePrayer() { prayer.hidden = true; prayBtn.setAttribute('aria-expanded', 'false'); card.querySelector('.copy-status').textContent = ''; }
  prayBtn.addEventListener('click', function () {
    if (!prayer.hidden) { closePrayer(); clampCard(); return; }
    prayer.querySelector('.prayer-text').textContent = prayerFor(cardFeat);
    prayer.hidden = false; prayBtn.setAttribute('aria-expanded', 'true');
    clampCard();
    if (window.innerWidth <= 640) prayer.scrollIntoView({ block: 'nearest' });
  });
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (ok, fail) {
      var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      var done = false; try { done = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done ? ok() : fail();
    });
  }
  card.querySelector('.copy-btn').addEventListener('click', function () {
    var st = card.querySelector('.copy-status');
    copyText(prayer.querySelector('.prayer-text').textContent).then(
      function () { st.textContent = 'Copied!'; },
      function () { st.textContent = 'Could not copy. Press and hold the text to copy it.'; });
  });

  // ---------- search ----------
  var searchInput = document.getElementById('search'), searchList = document.getElementById('search-list'),
      searchClear = document.getElementById('search-clear'), searchItems = [], matches = [], active = -1;
  var ALIASES = { USA: ['usa', 'us', 'america', 'united states of america'], GBR: ['uk', 'britain', 'great britain', 'england', 'scotland', 'wales'],
    COD: ['drc', 'congo kinshasa', 'democratic republic of the congo'], COG: ['congo brazzaville'], CIV: ['ivory coast'], MMR: ['burma'],
    KOR: ['south korea'], PRK: ['north korea'], ARE: ['uae'], CZE: ['czechia'], TUR: ['turkiye'], NLD: ['holland'] };
  function norm(t) { return (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function buildSearch(features) {
    // One entry per country: a few countries have extra map pieces (e.g. Australia's small territories); keep the biggest.
    var byIso = {}, size = function (f) { return JSON.stringify(f.geometry.coordinates).length; };
    features.forEach(function (f) {
      var k = f.properties.iso3 || f.properties.name;
      if (!byIso[k] || size(f) > size(byIso[k])) byIso[k] = f;
    });
    searchItems = Object.keys(byIso).map(function (k) { return byIso[k]; }).map(function (f) {
      var d = data[f.properties.iso3], name = d ? d.name : f.properties.name;
      var keys = [name, f.properties.name].concat(ALIASES[f.properties.iso3] || []).map(norm);
      if (f.properties.iso3) keys.push(f.properties.iso3.toLowerCase());
      return { feat: f, name: name, keys: keys.filter(function (k, i, a) { return k && a.indexOf(k) === i; }) };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function score(item, q) {
    var best = 99;
    item.keys.forEach(function (k, ki) {
      var s = k === q ? 0 : k.indexOf(q) === 0 ? 1 : (' ' + k).indexOf(' ' + q) >= 0 ? 2 : k.indexOf(q) >= 0 ? 3 : 99;
      if (s === 99 && q.length >= 3) { // loose match: same first letter, then the rest of the letters in order ("phlp" -> Philippines)
        var j = 0; for (var i = 0; i < k.length && j < q.length; i++) if (k[i] === q[j]) j++;
        if (j === q.length && k.replace(/ /g, '').indexOf(q[0]) === 0) s = 4;
      }
      if (s < 99 && ki > 0) s += 0.5; // matches on the main name rank first
      if (s < best) best = s;
    });
    return best;
  }
  function esc(t) { return t.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function showList() {
    var q = norm(searchInput.value);
    searchClear.hidden = !searchInput.value;
    if (!q) { hideList(); return; }
    matches = searchItems.map(function (it) { return { it: it, s: score(it, q) }; })
      .filter(function (m) { return m.s < 99; });
    var strong = matches.some(function (m) { return m.s < 4; });
    matches = matches.filter(function (m) { return !strong || m.s < 4; }) // loose letter matches only when nothing else fits
      .sort(function (a, b) { return a.s - b.s || a.it.name.localeCompare(b.it.name); })
      .slice(0, 8).map(function (m) { return m.it; });
    active = matches.length ? 0 : -1;
    searchList.innerHTML = matches.length ? matches.map(function (m, i) {
      return '<li role="option" id="opt-' + i + '" data-i="' + i + '"' + (i === active ? ' class="active" aria-selected="true"' : '') + '>' + esc(m.name) + '</li>';
    }).join('') : '<li class="empty" aria-disabled="true">No country found</li>';
    searchList.hidden = false; searchInput.setAttribute('aria-expanded', 'true');
    searchInput.setAttribute('aria-activedescendant', active >= 0 ? 'opt-' + active : '');
  }
  function hideList() { searchList.hidden = true; searchInput.setAttribute('aria-expanded', 'false'); searchInput.removeAttribute('aria-activedescendant'); }
  function setActive(i) {
    if (!matches.length) return;
    active = (i + matches.length) % matches.length;
    [].forEach.call(searchList.children, function (li, j) { li.classList.toggle('active', j === active); li.setAttribute('aria-selected', j === active ? 'true' : 'false'); });
    searchInput.setAttribute('aria-activedescendant', 'opt-' + active);
  }
  function centerOf(f) {
    var g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates, best = null, bestA = -1;
    polys.forEach(function (p) {
      var r = p[0], a = 0, cx = 0, cy = 0;
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        var c = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += c; cx += (r[j][0] + r[i][0]) * c; cy += (r[j][1] + r[i][1]) * c;
      }
      if (Math.abs(a) > bestA) {
        bestA = Math.abs(a);
        var xs = r.map(function (c) { return c[0]; }), ys = r.map(function (c) { return c[1]; });
        var span = Math.max(Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, ys) - Math.min.apply(null, ys));
        best = a ? { lng: cx / (3 * a), lat: cy / (3 * a), span: span } : { lng: xs[0], lat: ys[0], span: span };
      }
    });
    return best;
  }
  function choose(item) {
    searchInput.value = item.name; searchClear.hidden = false; hideList();
    if (isTouch || window.innerWidth <= 640) searchInput.blur();
    var c = centerOf(item.feat), alt = Math.min(2.4, Math.max(1.25, 1 + c.span / 45));
    if (window.innerWidth <= 640) alt += 1.0;
    // On phones the panel covers the bottom half, so aim a little south to keep the country in view above it.
    world.pointOfView({ lat: window.innerWidth <= 640 ? c.lat - 14 : c.lat, lng: c.lng, altitude: alt }, 1100);
    pin(item.feat);
    placePinnedCard();
  }
  function clearSearchText() { searchInput.value = ''; searchClear.hidden = true; hideList(); }
  function resetSearch() {
    var had = !!pinned;
    clearSearchText();
    if (pinned) unpin();
    if (had) { var p = world.pointOfView(); world.pointOfView({ lat: p.lat, lng: p.lng, altitude: window.innerWidth <= 640 ? 3.4 : 2.3 }, 800); }
  }
  searchInput.addEventListener('input', showList);
  searchInput.addEventListener('focus', function () { if (searchInput.value && !pinned) showList(); });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (searchList.hidden) showList(); else setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (searchList.hidden) showList(); if (active >= 0 && matches[active]) choose(matches[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); if (!searchList.hidden && searchInput.value && !pinned) hideList(); else resetSearch(); }
  });
  searchList.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus while clicking
  searchList.addEventListener('click', function (e) {
    var li = e.target.closest('li[data-i]'); if (li) choose(matches[+li.dataset.i]);
  });
  searchClear.addEventListener('click', function () { resetSearch(); searchInput.focus(); });
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest('.search')) hideList(); });

  // ---------- load data ----------
  // Live Joshua Project data comes from our own Netlify Function (/api/countries), which keeps
  // the API key on the server. If it is missing, slow, or broken, use the static file instead.
  // On localhost (plain python http.server) the live call is skipped unless the URL has ?live=1.
  var LIVE_URL = 'api/countries', STATIC_URL = 'data/countries.json';
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var wantLive = !/[?&]static=1\b/.test(location.search) && (!isLocal || /[?&]live=1\b/.test(location.search));
  function getJson(url, ms) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl && setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error(url + ' HTTP ' + r.status);
      return r.json();
    });
  }
  function validCountries(j) { return j && j.countries && Object.keys(j.countries).length > 100 ? j : Promise.reject(new Error('bad data')); }
  function loadCountries() {
    var stat = function () { return getJson(STATIC_URL, 30000).then(validCountries); };
    if (!wantLive) return stat();
    return getJson(LIVE_URL, 7000).then(validCountries).catch(function (e) {
      console.warn('Live Joshua Project data unavailable, using the saved copy.', e && e.message);
      return stat();
    });
  }
  function fallbackDate(src) { var m = /(\d{4}-\d{2}-\d{2})/.exec(src); return m ? fmtDate(m[1]) : null; }
  function fmtDate(iso) {
    var dt = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  Promise.all([
    loadCountries(),
    fetch('data/countries.geojson').then(function (r) { return r.json(); })
  ]).then(function (res) {
    data = res[0].countries;
    var note = document.getElementById('src-note');
    if (res[0].live && res[0].fetched) {
      note.textContent = 'Live country data, updated ' + fmtDate(res[0].fetched) + '.' +
        (res[0].workersSource ? ' "Workers needed" is from the saved ' + (fallbackDate(res[0].workersSource) || '') + ' download.' : '');
    } else if (res[0].downloaded) {
      note.textContent = 'Country data downloaded ' + fmtDate(res[0].downloaded) + '.';
    }
    note.dataset.live = res[0].live ? '1' : '0';
    world.polygonsData(res[1].features);
    buildSearch(res[1].features);
    renderLegend();
    window.__brutalFacts = { world: world, ready: true, features: res[1].features, prayerFor: prayerFor, data: data, live: !!res[0].live, source: res[0].source };
  }).catch(function (err) {
    console.error('Could not load data', err);
    document.querySelector('.sub').textContent = 'Could not load the data. Open this through a web server, not as a file.';
  });
})();
