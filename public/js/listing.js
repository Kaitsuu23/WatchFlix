const API = '';
let _endpoint = '';
let _page = 1;

async function apiFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function startListing(endpoint, title) {
  _endpoint = endpoint;
  _page = Number(new URLSearchParams(location.search).get('page')) || 1;

  const movieGrid  = document.getElementById('movieGrid');
  const loader     = document.getElementById('loader');
  const emptyState = document.getElementById('emptyState');
  const prevBtn    = document.getElementById('prevBtn');
  const nextBtn    = document.getElementById('nextBtn');
  const pageInfo   = document.getElementById('pageInfo');
  const fpPageInfo = document.getElementById('fpPageInfo');

  // drama dropdown
  const dramaBtn  = document.getElementById('dramaBtn');
  const dramaMenu = document.getElementById('dramaMenu');
  dramaBtn.addEventListener('click', e => { e.stopPropagation(); dramaMenu.classList.toggle('open'); });
  document.addEventListener('click', () => dramaMenu.classList.remove('open'));

  async function load() {
    loader.classList.remove('hidden');
    movieGrid.innerHTML = '';
    emptyState.classList.add('hidden');
    history.replaceState(null, '', _page > 1 ? `?page=${_page}` : location.pathname);
    try {
      const data = await apiFetch(`${_endpoint}${_page > 1 ? `?page=${_page}` : ''}`);
      const items = Array.isArray(data) ? data : (data.results || []);
      const totalPages = data.totalPages || null;
      loader.classList.add('hidden');
      pageInfo.textContent = `Halaman ${_page}`;
      if (fpPageInfo) fpPageInfo.textContent = totalPages ? `Halaman ${_page} dari ${totalPages}` : '';
      prevBtn.disabled = _page <= 1;
      nextBtn.disabled = totalPages ? _page >= totalPages : false;
      if (!items.length) { emptyState.classList.remove('hidden'); return; }
      items.forEach(item => movieGrid.appendChild(createCard(item)));
    } catch {
      loader.classList.add('hidden');
      emptyState.classList.remove('hidden');
    }
  }

  prevBtn.addEventListener('click', () => { if (_page > 1) { _page--; load(); scrollTo({top:0,behavior:'smooth'}); } });
  nextBtn.addEventListener('click', () => { _page++; load(); scrollTo({top:0,behavior:'smooth'}); });

  load();
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
    ${poster ? `<img src="${esc(poster)}" alt="${esc(title)}" loading="lazy" />` : ''}
    <div class="card-overlay">
      <div class="card-play">▶</div>
      <div class="card-title">${esc(title)}</div>
      <div class="card-meta">
        ${year   ? `<span class="badge badge-quality">${year}</span>` : ''}
        ${rating ? `<span class="badge badge-rating">⭐ ${rating}</span>` : ''}
        ${type   ? `<span class="badge badge-type">${esc(type)}</span>` : ''}
      </div>
    </div>`;
  card.addEventListener('click', () => {
    const id = item._id || item.id || item.slug || '';
    location.href = `/player/${encodeURIComponent(id)}/${item.type || 'movie'}`;
  });
  return card;
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
