const API = 'http://localhost:8080';

// ── Watch History ──
const HISTORY_KEY = 'watchflix_history';
const MAX_HISTORY = 30;

function saveHistory(item) {
  const list = getHistory().filter(h => h._id !== item._id);
  list.unshift({ ...item, watchedAt: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

// ── Parse URL params ──
const segments = location.pathname.split('/').filter(Boolean); // ['player', 'slug', 'type']

// Detect clean episode URL: /slug-season-1-episode-1-2023
const episodeSlug = location.pathname.match(/^\/(.+-season-(\d+)-episode-(\d+)-.+)$/);

let itemId, itemType, currentSeason, currentEpisode;

if (episodeSlug) {
  // e.g. /one-piece-season-1-episode-1-2023
  const fullSlug = episodeSlug[1]; // one-piece-season-1-episode-1-2023
  currentSeason  = Number(episodeSlug[2]);
  currentEpisode = Number(episodeSlug[3]);
  // strip -season-N-episode-N from slug to get series id: one-piece-2023
  const yearMatch = fullSlug.match(/-(\d{4})$/);
  const year = yearMatch ? yearMatch[1] : '';
  itemId   = fullSlug.replace(/-season-\d+-episode-\d+/, ''); // one-piece-2023
  itemType = 'series';
} else {
  itemId   = segments[1] || new URLSearchParams(location.search).get('id');
  itemType = segments[2] || new URLSearchParams(location.search).get('type') || 'movie';
  currentSeason  = Number(new URLSearchParams(location.search).get('season'))  || 1;
  currentEpisode = Number(new URLSearchParams(location.search).get('episode')) || 1;
}
let currentStreamUrl = '';
let trailerUrl = '';
let itemDetail = null;

// ── DOM ──
const playerThumbnail = document.getElementById('playerThumbnail');
const playerIframe    = document.getElementById('playerIframe');
const thumbnailImg    = document.getElementById('thumbnailImg');
const playBtnBig      = document.getElementById('playBtnBig');
const serverList      = document.getElementById('serverList');
const relatedList     = document.getElementById('relatedList');
const movieInfoSection= document.getElementById('movieInfoSection');
const episodeSection  = document.getElementById('episodeSection');
const episodeGrid     = document.getElementById('episodeGrid');
const seasonSelect    = document.getElementById('seasonSelect');
const breadcrumbTitle = document.getElementById('breadcrumbTitle');
const breadcrumbType  = document.getElementById('breadcrumbType');
const trailerModal    = document.getElementById('trailerModal');
const trailerIframe   = document.getElementById('trailerIframe');

// ── Init ──
async function init() {
  if (!itemId) { location.href = '/'; return; }
  breadcrumbType.textContent = itemType === 'series' ? 'Series' : 'Movie';

  await Promise.all([loadDetail(), loadStreams()]);
  loadRelated();
}

// ── Fetch helpers ──
async function apiFetch(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Load detail ──
async function loadDetail() {
  try {
    const endpoint = itemType === 'series' ? `/series/${itemId}` : `/movies/${itemId}`;
    itemDetail = await apiFetch(endpoint);
    renderInfo(itemDetail);
    if (itemDetail.posterImg) thumbnailImg.src = itemDetail.posterImg;
    breadcrumbTitle.textContent = itemDetail.title || itemId;
    document.title = `${itemDetail.title || itemId} — WatchFlix`;
    trailerUrl = itemDetail.trailerUrl || '';

    if (itemType === 'series' && itemDetail.seasons?.length) {
      renderSeasons(itemDetail.seasons);
      // auto-update URL to current episode on load
      const seasonData = itemDetail.seasons.find(s => s.season === currentSeason);
      const epData = seasonData?.episodes?.find(e => e.ep === currentEpisode);
      if (epData?.slug) history.replaceState(null, '', `/${epData.slug}`);
    }

    // save to watch history
    const seasonData = itemDetail.seasons?.find(s => s.season === currentSeason);
    saveHistory({
      _id: itemId,
      title: itemDetail.title || itemId,
      type: itemType,
      posterImg: itemDetail.posterImg || '',
      season: currentSeason,
      episode: currentEpisode,
      totalEpisodes: seasonData?.totalEpisodes || 0,
      totalSeasons: itemDetail.seasons?.length || 1,
      episodeSlug: location.pathname.startsWith('/player') ? null : location.pathname.slice(1),
    });
  } catch (e) {
    console.error('detail error', e);
    breadcrumbTitle.textContent = itemId;
    movieInfoSection.innerHTML = `<p style="color:var(--text-muted);padding:1rem">Gagal memuat info.</p>`;
  }
}

// ── Load streams ──
async function loadStreams() {
  try {
    let endpoint;
    if (itemType === 'series') {
      endpoint = `/series/${itemId}/streams?season=${currentSeason}&episode=${currentEpisode}`;
    } else {
      endpoint = `/movies/${itemId}/streams`;
    }
    const streams = await apiFetch(endpoint);
    renderServers(streams);
  } catch (e) {
    console.error('streams error', e);
    serverList.innerHTML = `<span style="font-size:.8rem;color:var(--text-muted)">Tidak ada server tersedia</span>`;
  }
}

// ── Render servers ──
function renderServers(streams) {
  serverList.innerHTML = '';
  if (!streams || !streams.length) {
    serverList.innerHTML = `<span style="font-size:.8rem;color:var(--text-muted)">Tidak ada server</span>`;
    return;
  }
  streams.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'server-btn' + (i === 0 ? ' active' : '');
    btn.textContent = s.provider || `Server ${i + 1}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadPlayer(s.url);
    });
    serverList.appendChild(btn);
    if (i === 0) currentStreamUrl = s.url;
  });
}

// ── Load player ──
// Route stream URL through backend proxy to strip CSP frame-ancestors header
// Domains that can be embedded directly without proxy
const DIRECT_DOMAINS = ['vidsrc.to', '2embed.cc', 'multiembed.mov', 'vidsrc.me', 'vidsrc.xyz', 'vsembed.ru'];

function loadPlayer(url) {
  if (!url) return;
  currentStreamUrl = url;
  playerThumbnail.classList.add('hidden');
  playerIframe.classList.remove('hidden');

  try {
    const hostname = new URL(url).hostname;
    const isDirect = DIRECT_DOMAINS.some(d => hostname.endsWith(d));
    playerIframe.src = isDirect ? url : `${API}/proxy?url=${encodeURIComponent(url)}`;
  } catch (_) {
    playerIframe.src = `${API}/proxy?url=${encodeURIComponent(url)}`;
  }
}

// ── Play button ──
playBtnBig.addEventListener('click', () => {
  if (currentStreamUrl) loadPlayer(currentStreamUrl);
});

// ── Render movie info ──
function renderInfo(d) {
  const genres = (d.genres || []).map(g =>
    `<span class="chip" style="pointer-events:none;font-size:.7rem">${esc(g)}</span>`
  ).join('');

  const qualityBadge = d.quality
    ? `<span class="badge badge-quality">${esc(d.quality)}</span>` : '';
  const typeBadge = itemType === 'series'
    ? `<span class="badge badge-type">Series</span>`
    : `<span class="badge badge-quality">Movie</span>`;

  movieInfoSection.innerHTML = `
    <div class="movie-info-title">${esc(d.title || itemId)}</div>
    <div class="movie-info-tags">${genres}${qualityBadge}${typeBadge}</div>
    <div class="movie-info-meta">
      ${d.rating ? `<span>⭐ <strong>${esc(d.rating)}</strong></span>` : ''}
      ${d.releaseDate ? `<span>📅 <strong>${esc(d.releaseDate)}</strong></span>` : ''}
      ${d.duration ? `<span>⏱ <strong>${esc(d.duration)}</strong></span>` : ''}
      ${d.status ? `<span>📺 <strong>${esc(d.status)}</strong></span>` : ''}
    </div>
    ${d.synopsis ? `<p class="movie-info-synopsis">${esc(d.synopsis)}</p>` : ''}
    <div class="movie-info-detail-grid">
      ${d.directors?.length ? `<div class="detail-row"><label>Sutradara</label><span>${esc(d.directors.join(', '))}</span></div>` : ''}
      ${d.countries?.length ? `<div class="detail-row"><label>Negara</label><span>${esc(d.countries.join(', '))}</span></div>` : ''}
      ${d.casts?.length ? `<div class="detail-row" style="grid-column:1/-1"><label>Bintang Film</label><span>${esc(d.casts.slice(0,6).join(', '))}</span></div>` : ''}
    </div>
  `;
}

// ── Seasons & Episodes ──
function renderSeasons(seasons) {
  episodeSection.classList.remove('hidden');
  seasonSelect.innerHTML = '';
  seasons.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.season;
    opt.textContent = `Season ${s.season}`;
    if (s.season === currentSeason) opt.selected = true;
    seasonSelect.appendChild(opt);
  });
  renderEpisodes(currentSeason);

  seasonSelect.addEventListener('change', () => {
    currentSeason = Number(seasonSelect.value);
    currentEpisode = 1;
    renderEpisodes(currentSeason);
    // update URL to ep1 of new season
    const newSeasonData = itemDetail?.seasons?.find(s => s.season === currentSeason);
    const ep1 = newSeasonData?.episodes?.find(e => e.ep === 1);
    if (ep1?.slug) history.replaceState(null, '', `/${ep1.slug}`);
    loadStreams();
  });
}

function renderEpisodes(season) {
  episodeGrid.innerHTML = '';
  const seasonData = itemDetail?.seasons?.find(s => s.season === season);
  const episodes = seasonData?.episodes || [];
  const total = seasonData?.totalEpisodes || episodes.length || 1;

  for (let ep = 1; ep <= total; ep++) {
    const epData = episodes.find(e => e.ep === ep);
    const btn = document.createElement('button');
    btn.className = 'ep-btn' + (ep === currentEpisode ? ' active' : '');
    btn.textContent = ep;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEpisode = ep;
      if (epData?.slug) {
        history.replaceState(null, '', `/${epData.slug}`);
        // update continue watching
        saveHistory({
          _id: itemId,
          title: itemDetail?.title || itemId,
          type: 'series',
          posterImg: itemDetail?.posterImg || '',
          season: currentSeason,
          episode: ep,
          totalEpisodes: seasonData?.totalEpisodes || 0,
          totalSeasons: itemDetail?.seasons?.length || 1,
          episodeSlug: epData.slug,
        });
      }
      playerIframe.src = '';
      playerIframe.classList.add('hidden');
      playerThumbnail.classList.remove('hidden');
      loadStreams();
    });
    episodeGrid.appendChild(btn);
  }
}

// ── Load related ──
async function loadRelated() {
  try {
    const genre = itemDetail?.genres?.[0] || '';
    const endpoint = genre
      ? `/genres/${genre}`
      : (itemType === 'series' ? '/series' : '/movies');
    const data = await apiFetch(endpoint);
    const items = Array.isArray(data) ? data : (data.results || []);
    renderRelated(items.filter(i => i._id !== itemId).slice(0, 12));
  } catch (e) {
    relatedList.innerHTML = `<p style="font-size:.8rem;color:var(--text-muted)">Gagal memuat.</p>`;
  }
}

function renderRelated(items) {
  relatedList.innerHTML = '';
  if (!items.length) {
    relatedList.innerHTML = `<p style="font-size:.8rem;color:var(--text-muted)">Tidak ada.</p>`;
    return;
  }
  items.forEach(item => {
    const a = document.createElement('a');
    a.className = 'related-item';
    a.href = `/player/${item._id}/${item.type || 'movie'}`;
    a.innerHTML = `
      <div class="related-thumb">
        <img src="${item.posterImg || ''}" alt="${esc(item.title)}" loading="lazy"
             onerror="this.src='https://via.placeholder.com/80x52/1a1a2e/6c63ff?text=N/A'" />
      </div>
      <div class="related-info">
        <div class="related-title">${esc(item.title)}</div>
        <div style="display:flex;gap:.4rem;align-items:center">
          ${item.rating ? `<span class="related-rating">⭐ ${item.rating}</span>` : ''}
          ${item.qualityResolution ? `<span class="related-year">${item.qualityResolution}</span>` : ''}
        </div>
      </div>
    `;
    relatedList.appendChild(a);
  });
}

// ── Download ──
const downloadSection = document.getElementById('downloadSection');
const downloadList    = document.getElementById('downloadList');
let downloadsLoaded   = false;

document.getElementById('btnDownload').addEventListener('click', async () => {
  if (downloadSection.classList.contains('hidden')) {
    downloadSection.classList.remove('hidden');
    downloadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (!downloadsLoaded) await loadDownloads();
  } else {
    downloadSection.classList.add('hidden');
  }
});

async function loadDownloads() {
  downloadsLoaded = true;
  downloadList.innerHTML = '<div class="spinner" style="margin:1rem auto"></div>';
  try {
    let endpoint;
    if (itemType === 'series') {
      endpoint = `/series/${itemId}/downloads?season=${currentSeason}&episode=${currentEpisode}`;
    } else {
      endpoint = `/movies/${itemId}/download`;
    }
    const data = await apiFetch(endpoint);

    // new API returns { url } — open download page directly
    if (data && data.url) {
      downloadList.innerHTML = `
        <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem">
          Halaman download akan dibuka di tab baru. Pilih kualitas yang diinginkan di sana.
        </p>
        <a class="download-btn" href="${data.url}" target="_blank" rel="noopener noreferrer"
           style="width:fit-content">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Buka Halaman Download
        </a>
      `;
      return;
    }

    renderDownloads(Array.isArray(data) ? data : []);
  } catch (e) {
    downloadList.innerHTML = `<p class="download-empty">Gagal memuat link download.</p>`;
  }
}

function renderDownloads(items) {
  downloadList.innerHTML = '';
  if (!items || !items.length) {
    downloadList.innerHTML = `<p class="download-empty">Tidak ada link download tersedia.</p>`;
    return;
  }
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'download-item';
    div.innerHTML = `
      <div class="download-item-left">
        <span class="download-server">${esc(item.server || 'Server')}</span>
        ${item.quality ? `<span class="download-quality">${esc(item.quality)}</span>` : ''}
      </div>
      <a class="download-btn" href="${item.link || '#'}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      </a>
    `;
    downloadList.appendChild(div);
  });
}

// ── Action buttons ──
document.getElementById('btnFullscreen').addEventListener('click', () => {
  const el = playerIframe.classList.contains('hidden')
    ? document.getElementById('playerBox')
    : playerIframe;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
});

document.getElementById('btnTrailer').addEventListener('click', () => {
  if (!trailerUrl) return alert('Trailer tidak tersedia');
  // convert youtube watch url to embed
  const embedUrl = trailerUrl
    .replace('watch?v=', 'embed/')
    .replace('youtu.be/', 'www.youtube.com/embed/');
  trailerIframe.src = embedUrl + '?autoplay=1';
  trailerModal.classList.remove('hidden');
});

document.getElementById('btnPopup').addEventListener('click', () => {
  if (!currentStreamUrl) return;
  const proxyUrl = `${API}/proxy?url=${encodeURIComponent(currentStreamUrl)}`;
  const w = window.open(proxyUrl, '_blank', 'width=960,height=540,resizable=yes');
  if (!w) alert('Popup diblokir browser. Izinkan popup untuk situs ini.');
});

function closeTrailer() {
  trailerModal.classList.add('hidden');
  trailerIframe.src = '';
}
trailerModal.addEventListener('click', e => { if (e.target === trailerModal) closeTrailer(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTrailer(); });

// ── Search ──
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) location.href = `/search/${encodeURIComponent(q)}`;
  }
});

// ── Utils ──
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Start ──
init();
