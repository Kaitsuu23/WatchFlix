// ── Watch History ──
const HISTORY_KEY = 'watchflix_history';
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function removeHistoryItem(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(h => h._id !== id)));
  renderHistorySections();
}
function clearHistory(type) {
  if (type === 'continue') {
    const kept = getHistory().filter(h => !(h.type === 'series' && h.episodeSlug));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(kept));
  } else {
    localStorage.removeItem(HISTORY_KEY);
  }
  renderHistorySections();
}

function renderHistorySections() {
  const all = getHistory();
  const continueList = all.filter(h => h.type === 'series' && h.episodeSlug);
  const recentList   = all.slice(0, 12);

  const continueSection = document.getElementById('continueSection');
  const recentSection   = document.getElementById('recentSection');
  const continueRow     = document.getElementById('continueRow');
  const recentRow       = document.getElementById('recentRow');

  // Continue watching
  if (continueList.length) {
    continueSection.classList.remove('hidden');
    continueRow.innerHTML = '';
    continueList.slice(0, 10).forEach(h => continueRow.appendChild(makeHistoryCard(h, true)));
  } else {
    continueSection.classList.add('hidden');
  }

  // Recently viewed
  if (recentList.length) {
    recentSection.classList.remove('hidden');
    recentRow.innerHTML = '';
    recentList.forEach(h => recentRow.appendChild(makeHistoryCard(h, false)));
  } else {
    recentSection.classList.add('hidden');
  }
}

function makeHistoryCard(h, isContinue) {
  const card = document.createElement('div');
  card.className = 'history-card';
  const href = isContinue && h.episodeSlug
    ? `/${h.episodeSlug}`
    : `/player/${encodeURIComponent(h._id)}/${h.type || 'movie'}`;

  const epLabel = isContinue && h.season && h.episode
    ? `S${h.season} E${h.episode}` : '';

  // progress: episode / totalEpisodes in current season
  let progressBar = '';
  if (isContinue && h.episode && h.totalEpisodes) {
    const pct = Math.round((h.episode / h.totalEpisodes) * 100);
    progressBar = `<div class="history-progress"><div class="history-progress-fill" style="width:${pct}%"></div></div>`;
  }

  card.innerHTML = `
    <img src="${h.posterImg || ''}" alt="${escHtml(h.title)}" loading="lazy" />
    <div class="history-card-info">
      <div class="history-card-title">${escHtml(h.title)}</div>
      ${epLabel ? `<div class="history-card-ep">${epLabel}${h.totalEpisodes ? ` / ${h.totalEpisodes}` : ''}</div>` : ''}
      ${progressBar}
    </div>
    <button class="history-card-remove" title="Hapus">✕</button>
  `;
  card.querySelector('.history-card-remove').addEventListener('click', e => {
    e.stopPropagation();
    removeHistoryItem(h._id);
  });
  card.addEventListener('click', () => location.href = href);
  return card;
}

const API = '';

// drama dropdown
const dramaBtn  = document.getElementById('dramaBtn');
const dramaMenu = document.getElementById('dramaMenu');
if (dramaBtn && dramaMenu) {
  dramaBtn.addEventListener('click', e => { e.stopPropagation(); dramaMenu.classList.toggle('open'); });
  document.addEventListener('click', () => dramaMenu.classList.remove('open'));
}

// ── State ──
const state = {
  section: 'movies',
  page: 1,
};

// ── DOM refs ──
const movieGrid    = document.getElementById('movieGrid');
const loader       = document.getElementById('loader');
const emptyState   = document.getElementById('emptyState');
const prevBtn      = document.getElementById('prevBtn');
const nextBtn      = document.getElementById('nextBtn');
const pageInfo     = document.getElementById('pageInfo');
const resultCount  = document.getElementById('resultCount');
const sectionTitle = document.getElementById('sectionTitle');
const searchInput  = document.getElementById('searchInput');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalClose   = document.getElementById('modalClose');
const heroTitle    = document.getElementById('heroTitle');
const heroDesc     = document.getElementById('heroDesc');
const heroPoster   = document.getElementById('heroPoster');
const heroPlay     = document.getElementById('heroPlay');
const heroInfo     = document.getElementById('heroInfo');

// ── Init ──
async function init() {
  await loadContent();
}

// ── API ──
async function apiFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function buildEndpoint() {
  const { section, page } = state;
  const pg = page > 1 ? `?page=${page}` : '';
  const map = {
    movies:       `/movies`,
    popular:      `/movies/popular`,
    'top-rated':  `/movies/top-rated`,
    'drama-popular':  `/series/popular`,
    'drama-latest':   `/series`,
    'drama-ongoing':  `/series/ongoing`,
    'drama-complete': `/series/complete`,
    'drama-west':     `/series/west`,
    'drama-asian':    `/series/asian`,
    'drama-rating':   `/series/top-rated`,
    'drama-release':  `/series/recent`,
  };
  const base = map[section] || `/movies`;
  return `${base}${pg}`;
}

// ── Load Content ──
async function loadContent() {
  showLoader();
  try {
    const data  = await apiFetch(buildEndpoint());
    const items = Array.isArray(data) ? data : (data.results || []);
    const totalPages = data.totalPages || null;
    hideLoader();
    renderGrid(items);
    updateHero(items);
    resultCount.textContent = totalPages
      ? `Halaman ${state.page} dari ${totalPages}`
      : (items.length ? `${items.length} hasil` : '');
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = totalPages ? state.page >= totalPages : false;
    pageInfo.textContent = `Halaman ${state.page}`;
  } catch (err) {
    hideLoader();
    emptyState.classList.remove('hidden');
    console.error(err);
  }
}

function renderGrid(items) {
  movieGrid.innerHTML = '';
  if (!items.length) { emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');
  items.forEach(item => movieGrid.appendChild(createCard(item)));
}

function createCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  const poster = item.posterImg || item.poster || '';
  const title  = item.title || item.name || 'Untitled';
  const year   = item.year || item.release_year || '';
  const rating = item.rating || '';
  const type   = item.type || '';
  card.innerHTML = `
    ${poster ? `<img src="${escHtml(poster)}" alt="${escHtml(title)}" loading="lazy" />` : ''}
    <div class="card-overlay">
      <div class="card-play">▶</div>
      <div class="card-title">${escHtml(title)}</div>
      <div class="card-meta">
        ${year   ? `<span class="badge badge-quality">${year}</span>` : ''}
        ${rating ? `<span class="badge badge-rating">⭐ ${rating}</span>` : ''}
        ${type   ? `<span class="badge badge-type">${escHtml(type)}</span>` : ''}
      </div>
    </div>`;
  card.addEventListener('click', () => {
    const id = item._id || item.id || item.slug || '';
    location.href = `/player/${encodeURIComponent(id)}/${item.type || 'movie'}`;
  });
  return card;
}

function updateHero(items) {
  if (!items.length) return;
  const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
  heroTitle.textContent = item.title || item.name || 'Selamat Datang';
  heroDesc.textContent  = item.synopsis || item.description || 'Temukan ribuan film dan series terbaik';
  if (item.posterImg || item.poster) {
    heroPoster.style.backgroundImage = `url('${item.posterImg || item.poster}')`;
    heroPoster.style.backgroundSize  = 'cover';
    heroPoster.style.backgroundPosition = 'center';
  }
  heroPlay.onclick = () => {
    const id = item._id || item.id || '';
    location.href = `/player/${encodeURIComponent(id)}/${item.type || 'movie'}`;
  };
  heroInfo.onclick = heroPlay.onclick;
}

// ── Section nav ──
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.dataset.section) return;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.section = btn.dataset.section;
    state.page    = 1;
    searchInput.value = '';
    updateSectionTitle();
    loadContent();
  });
});



document.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', e => {
    e.stopPropagation();
    dramaMenu.classList.remove('open');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    dramaBtn.classList.add('active');
    state.section = item.dataset.section;
    state.page    = 1;
    searchInput.value = '';
    sectionTitle.textContent = `Drama — ${item.textContent.trim()}`;
    loadContent();
  });
});

function updateSectionTitle() {
  const map = {
    movies:           'Film Terbaru',
    popular:          'Film Populer',
    'top-rated':      'Top Rated',
    'drama-popular':  'Drama Terpopuler',
    'drama-latest':   'Drama Terbaru',
    'drama-ongoing':  'Drama Ongoing',
    'drama-complete': 'Drama Komplit',
    'drama-west':     'Drama West Region',
    'drama-asian':    'Drama Asian Region',
    'drama-rating':   'Drama Rating',
    'drama-release':  'Drama Release',
  };
  sectionTitle.textContent = map[state.section] || 'Film';
}

// ── Search ──
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) location.href = `/search/${encodeURIComponent(q)}`;
  }
});

// ── Pagination ──
prevBtn.addEventListener('click', () => {
  if (state.page > 1) { state.page--; loadContent(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});
nextBtn.addEventListener('click', () => {
  state.page++; loadContent(); window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Modal close ──
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function closeModal() {
  modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Loader ──
function showLoader() {
  loader.classList.remove('hidden');
  movieGrid.innerHTML = '';
  emptyState.classList.add('hidden');
  for (let i = 0; i < 12; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    movieGrid.appendChild(sk);
  }
}
function hideLoader() { loader.classList.add('hidden'); }

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Filter panel ──
const filterToggle = document.getElementById('filterToggle');
const filterPanel  = document.getElementById('filterPanel');
const fpApply      = document.getElementById('fpApply');
const fpCancel     = document.getElementById('fpCancel');
const fpSort       = document.getElementById('fpSort');
const fpType       = document.getElementById('fpType');
const fpGenre      = document.getElementById('fpGenre');
const fpCountry    = document.getElementById('fpCountry');
const fpYear       = document.getElementById('fpYear');

// load filter options
(async () => {
  try {
    const [genres, countries, years] = await Promise.all([
      apiFetch('/genres').catch(() => []),
      apiFetch('/countries').catch(() => []),
      apiFetch('/years').catch(() => []),
    ]);
    genres.forEach(g => fpGenre.innerHTML += `<option value="${escHtml(g.parameter)}">${escHtml(g.name)}</option>`);
    countries.forEach(c => fpCountry.innerHTML += `<option value="${escHtml(c.parameter)}">${escHtml(c.name)}</option>`);
    years.forEach(y => fpYear.innerHTML += `<option value="${escHtml(y.parameter)}">${escHtml(y.parameter)}</option>`);
  } catch {}
})();

filterToggle.addEventListener('click', e => {
  e.stopPropagation();
  const isHidden = filterPanel.style.display === 'none';
  filterPanel.style.display = isHidden ? 'flex' : 'none';
  filterToggle.textContent = isHidden ? 'FILTER ▲' : 'FILTER ▼';
});
document.addEventListener('click', e => {
  if (filterPanel.style.display === 'none') return;
  if (!filterPanel.contains(e.target) && e.target !== filterToggle) {
    filterPanel.style.display = 'none';
    filterToggle.textContent = 'FILTER ▼';
  }
});
fpCancel.addEventListener('click', () => {
  filterPanel.style.display = 'none';
  filterToggle.textContent = 'FILTER ▼';
});
fpApply.addEventListener('click', () => {
  const parts = [fpSort.value, fpType.value,
    fpGenre.value   || '-',
    fpCountry.value || '-',
    fpYear.value    || '-',
  ];
  // trim trailing dashes
  while (parts[parts.length - 1] === '-') parts.pop();
  location.href = `/filter/${parts.join('/')}`;
});

// ── Start ──
const urlParams = new URLSearchParams(location.search);
const redirectSection = urlParams.get('section');
if (redirectSection) {
  state.section = redirectSection;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === redirectSection);
  });
  if (redirectSection.startsWith('drama')) dramaBtn.classList.add('active');
}

// render history on load
renderHistorySections();
document.getElementById('clearContinue')?.addEventListener('click', () => clearHistory('continue'));
document.getElementById('clearRecent')?.addEventListener('click',   () => clearHistory('all'));

init();
