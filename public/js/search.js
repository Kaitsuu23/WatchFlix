const API = '';

const searchInput  = document.getElementById('searchInput');
const movieGrid    = document.getElementById('movieGrid');
const loader       = document.getElementById('loader');
const emptyState   = document.getElementById('emptyState');
const emptyMsg     = document.getElementById('emptyMsg');
const sectionTitle = document.getElementById('sectionTitle');
const resultCount  = document.getElementById('resultCount');

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showLoader() { loader.classList.remove('hidden'); movieGrid.innerHTML = ''; emptyState.classList.add('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }

async function doSearch(q) {
  if (!q || q.length < 2) {
    movieGrid.innerHTML = '';
    resultCount.textContent = '';
    sectionTitle.textContent = 'Hasil Pencarian';
    emptyMsg.textContent = 'Ketik untuk mencari film atau series';
    emptyState.classList.remove('hidden');
    return;
  }

  showLoader();
  sectionTitle.textContent = `Hasil: "${q}"`;

  try {
    const data = await apiFetch(`/api/search/${encodeURIComponent(q)}`);
    hideLoader();

    if (!data || !data.length) {
      emptyMsg.textContent = `Tidak ada hasil untuk "${q}"`;
      emptyState.classList.remove('hidden');
      resultCount.textContent = '';
      return;
    }

    resultCount.textContent = `${data.length} hasil`;
    emptyState.classList.add('hidden');
    movieGrid.innerHTML = '';
    data.forEach(item => movieGrid.appendChild(createCard(item)));
  } catch (e) {
    hideLoader();
    emptyMsg.textContent = 'Gagal memuat hasil pencarian';
    emptyState.classList.remove('hidden');
  }
}

function createCard(item) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    ${item.posterImg ? `<img src="${escHtml(item.posterImg)}" alt="${escHtml(item.title)}" loading="lazy" />` : ''}
    <div class="card-top-badge">${item.type === 'series' ? 'Series' : 'Movie'}</div>
    <div class="card-play">▶</div>
    <div class="card-overlay">
      <div class="card-title">${escHtml(item.title)}</div>
      <div class="card-meta">
        ${item.type === 'series' ? `<span class="badge badge-type">Series</span>` : ''}
      </div>
    </div>
  `;
  div.addEventListener('click', () => {
    location.href = `/player/${item._id}/${item.type || 'movie'}`;
  });
  return div;
}

// drama dropdown
const dramaBtn  = document.getElementById('dramaBtn');
const dramaMenu = document.getElementById('dramaMenu');
if (dramaBtn && dramaMenu) {
  dramaBtn.addEventListener('click', e => { e.stopPropagation(); dramaMenu.classList.toggle('open'); });
  document.addEventListener('click', () => dramaMenu.classList.remove('open'));
}

// ── Search input — only on Enter ──
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) {
      history.pushState(null, '', `/search/${encodeURIComponent(q)}`);
      doSearch(q);
    }
  }
  if (e.key === 'Escape') { searchInput.value = ''; doSearch(''); }
});

// ── Modal (close only, cards go to player) ──
modalClose.addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) modalOverlay.classList.add('hidden'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') modalOverlay.classList.add('hidden'); });

// ── Init: read query from URL ──
const pathSegment = location.pathname.split('/').filter(Boolean)[1]; // /search/query
const initQuery = pathSegment ? decodeURIComponent(pathSegment) : (new URLSearchParams(location.search).get('q') || '');
if (initQuery) {
  searchInput.value = initQuery;
  doSearch(initQuery);
} else {
  hideLoader();
  emptyState.classList.remove('hidden');
}
