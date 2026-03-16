const API = 'http://localhost:8080';
const state = { sort: 'populer', type: 'movie', genre: '', country: '', year: '', page: 1 };

const movieGrid = document.getElementById('movieGrid');
const loader    = document.getElementById('loader');
const emptyState= document.getElementById('emptyState');
const prevBtn   = document.getElementById('prevBtn');
const nextBtn   = document.getElementById('nextBtn');
const pageInfo  = document.getElementById('pageInfo');
const fpPageInfo= document.getElementById('fpPageInfo');
const fpToggle  = document.getElementById('fpToggle');
const fpPanel   = document.getElementById('fpPanel');
const fpApply   = document.getElementById('fpApply');
const fpCancel  = document.getElementById('fpCancel');
const fpSort    = document.getElementById('fpSort');
const fpType    = document.getElementById('fpType');
const fpGenre   = document.getElementById('fpGenre');
const fpCountry = document.getElementById('fpCountry');
const fpYear    = document.getElementById('fpYear');

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(i => { const k = i.parameter||i; if(seen.has(k)) return false; seen.add(k); return true; });
}

async function init() {
  const [genres, countries, years] = await Promise.all([
    apiFetch('/genres').catch(() => []),
    apiFetch('/countries').catch(() => []),
    apiFetch('/years').catch(() => []),
  ]);

  dedupe(genres).forEach(g => {
    fpGenre.innerHTML += `<option value="${escHtml(g.parameter)}">${escHtml(g.name)}</option>`;
  });
  dedupe(countries).forEach(c => {
    fpCountry.innerHTML += `<option value="${escHtml(c.parameter)}">${escHtml(c.name)}</option>`;
  });
  dedupe(years).forEach(y => {
    fpYear.innerHTML += `<option value="${escHtml(y.parameter)}">${escHtml(y.parameter)}</option>`;
  });

  // restore from URL path: /filter/sort/type/genre/country/year/page
  const segments = location.pathname.replace(/^\/filter\/?/, '').split('/').filter(Boolean);
  const [seg0='populer', seg1='movie', seg2='', seg3='', seg4='', seg5=''] = segments;
  const sortVal    = seg0 !== '-' ? seg0 : 'populer';
  const typeVal    = seg1 !== '-' ? seg1 : 'movie';
  const genreVal   = seg2 !== '-' ? seg2 : '';
  const countryVal = seg3 !== '-' ? seg3 : '';
  const yearVal    = seg4 !== '-' ? seg4 : '';
  const pageVal    = seg5 ? Number(seg5) : (Number(new URLSearchParams(location.search).get('page')) || 1);

  fpSort.value    = state.sort    = sortVal;
  fpType.value    = state.type    = typeVal;
  fpGenre.value   = state.genre   = genreVal;
  fpCountry.value = state.country = countryVal;
  fpYear.value    = state.year    = yearVal;
  state.page = pageVal;

  loadResults();
}

// drama dropdown
const dramaBtn  = document.getElementById('dramaBtn');
const dramaMenu = document.getElementById('dramaMenu');
if (dramaBtn && dramaMenu) {
  dramaBtn.addEventListener('click', e => { e.stopPropagation(); dramaMenu.classList.toggle('open'); });
  document.addEventListener('click', () => dramaMenu.classList.remove('open'));
}

// toggle panel
fpToggle.addEventListener('click', e => {
  e.stopPropagation();
  fpPanel.classList.toggle('hidden');
  fpToggle.textContent = fpPanel.classList.contains('hidden') ? 'FILTER ▼' : 'FILTER ▲';
});
document.addEventListener('click', e => {
  if (!fpPanel.contains(e.target) && e.target !== fpToggle) {
    fpPanel.classList.add('hidden');
    fpToggle.textContent = 'FILTER ▼';
  }
});
fpCancel.addEventListener('click', () => {
  fpPanel.classList.add('hidden');
  fpToggle.textContent = 'FILTER ▼';
});

fpApply.addEventListener('click', () => {
  state.sort    = fpSort.value;
  state.type    = fpType.value;
  state.genre   = fpGenre.value;
  state.country = fpCountry.value;
  state.year    = fpYear.value;
  state.page    = 1;
  fpPanel.classList.add('hidden');
  fpToggle.textContent = 'FILTER ▼';
  loadResults();
});

prevBtn.addEventListener('click', () => { if(state.page>1){ state.page--; loadResults(); window.scrollTo({top:0,behavior:'smooth'}); } });
nextBtn.addEventListener('click', () => { state.page++; loadResults(); window.scrollTo({top:0,behavior:'smooth'}); });

async function loadResults() {
  loader.classList.remove('hidden');
  movieGrid.innerHTML = '';
  emptyState.classList.add('hidden');

  const parts = [state.sort, state.type,
    state.genre   || '-',
    state.country || '-',
    state.year    || '-',
  ];
  if (state.page > 1) parts.push(state.page);
  // trim trailing dashes (but keep page if present)
  const hasPage = state.page > 1;
  if (!hasPage) while (parts[parts.length - 1] === '-') parts.pop();
  else {
    // remove dashes before page
    const page = parts.pop();
    while (parts[parts.length - 1] === '-') parts.pop();
    parts.push(page);
  }
  history.replaceState(null, '', `/filter/${parts.join('/')}`);

  try {
    const apiParams = new URLSearchParams({ sort: state.sort, type: state.type });
    if (state.genre)   apiParams.set('genre',   state.genre);
    if (state.country) apiParams.set('country', state.country);
    if (state.year)    apiParams.set('year',    state.year);
    if (state.page > 1) apiParams.set('page',   state.page);
    const data  = await apiFetch(`/api/filter?${apiParams.toString()}`);
    const items = Array.isArray(data) ? data : (data.results || []);
    const totalPages = data.totalPages || null;
    loader.classList.add('hidden');
    pageInfo.textContent = `Halaman ${state.page}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = totalPages ? state.page >= totalPages : false;
    if (!items.length) { emptyState.classList.remove('hidden'); return; }
    fpPageInfo.textContent = totalPages
      ? `Halaman ${state.page} dari ${totalPages}`
      : `Halaman ${state.page} — ${items.length} hasil`;
  const sortLabel = { populer: 'Populer', latest: 'Terbaru', rating: 'Top Rating', release: 'Release' };
  const bc = document.getElementById('fpBreadcrumb');
  if (bc) bc.textContent = sortLabel[state.sort] || state.sort;
    items.forEach(item => movieGrid.appendChild(createCard(item)));
  } catch {
    loader.classList.add('hidden');
    emptyState.classList.remove('hidden');
  }
}

function createCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  const poster = item.posterImg || item.poster || '';
  const title  = item.title || 'Untitled';
  const year   = item.year || '';
  const rating = item.rating || '';
  card.innerHTML = `
    ${poster ? `<img src="${escHtml(poster)}" alt="${escHtml(title)}" loading="lazy" />` : ''}
    <div class="card-overlay">
      <div class="card-play">▶</div>
      <div class="card-title">${escHtml(title)}</div>
      <div class="card-meta">
        ${year   ? `<span class="badge badge-quality">${year}</span>` : ''}
        ${rating ? `<span class="badge badge-rating">⭐ ${rating}</span>` : ''}
      </div>
    </div>`;
  card.addEventListener('click', () => {
    const id = item._id || item.id || '';
    location.href = `/player/${encodeURIComponent(id)}/${item.type || state.type}`;
  });
  return card;
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
