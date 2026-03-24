// Gearbox — UI Rendering
import { play } from './player.js';

export function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function artistNames(artists = []) {
  return artists.map(a => `<span class="artist-link" data-id="${a.id}">${a.name}</span>`).join(', ');
}

export function getImg(images = [], fallback = 'assets/placeholder.png') {
  return images?.[0]?.url || images?.[1]?.url || fallback;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const icons = {
  play: '<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  heartOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  heartFilled: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
  repeatOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  repeatOne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="14" text-anchor="middle" font-size="8" fill="currentColor" stroke="none">1</text></svg>',
  volumeHigh: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  volumeLow: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  volumeMute: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="12" x2="17" y2="12"/><line x1="3" y1="18" x2="10" y2="18"/><polyline points="14 16 18 20 22 16" fill="none"/></svg>',
  album: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
  artist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
};

export { icons };

// ─── Cards ────────────────────────────────────────────────────────────────────
export function renderTrackCard(track, contextUri = null) {
  const img = getImg(track.album?.images);
  const artists = artistNames(track.artists);
  return `
    <div class="card card--track" data-uri="${track.uri}" data-ctx="${contextUri || ''}" 
         data-track-id="${track.id}" title="${track.name}">
      <div class="card__img-wrap">
        <img src="${img}" alt="${track.name}" loading="lazy">
        <button class="card__play-btn" data-uri="${track.uri}" data-ctx="${contextUri || ''}">
          ${icons.play}
        </button>
      </div>
      <div class="card__body">
        <p class="card__title">${track.name}</p>
        <p class="card__sub">${artists}</p>
        <p class="card__meta">${formatDuration(track.duration_ms)}</p>
      </div>
    </div>`;
}

export function renderAlbumCard(album) {
  const img = getImg(album.images);
  const year = album.release_date?.slice(0, 4) || '';
  return `
    <div class="card card--album" data-album-id="${album.id}" title="${album.name}">
      <div class="card__img-wrap">
        <img src="${img}" alt="${album.name}" loading="lazy">
        <button class="card__play-btn" data-album-id="${album.id}">
          ${icons.play}
        </button>
      </div>
      <div class="card__body">
        <p class="card__title">${album.name}</p>
        <p class="card__sub">${artistNames(album.artists)}</p>
        <p class="card__meta">${year} · ${album.total_tracks || ''} tracks</p>
      </div>
    </div>`;
}

export function renderArtistCard(artist) {
  const img = getImg(artist.images);
  return `
    <div class="card card--artist" data-artist-id="${artist.id}" title="${artist.name}">
      <div class="card__img-wrap card__img-wrap--round">
        <img src="${img}" alt="${artist.name}" loading="lazy">
        <button class="card__play-btn" data-artist-id="${artist.id}">
          ${icons.play}
        </button>
      </div>
      <div class="card__body">
        <p class="card__title">${artist.name}</p>
        <p class="card__sub">${formatNumber(artist.followers?.total)} followers</p>
        <p class="card__meta">${(artist.genres || []).slice(0, 2).join(', ')}</p>
      </div>
    </div>`;
}

export function renderPlaylistCard(pl) {
  const img = getImg(pl.images);
  return `
    <div class="card card--playlist" data-playlist-id="${pl.id}" title="${pl.name}">
      <div class="card__img-wrap">
        <img src="${img}" alt="${pl.name}" loading="lazy" onerror="this.src='assets/placeholder.png'">
        <button class="card__play-btn" data-playlist-id="${pl.id}">
          ${icons.play}
        </button>
      </div>
      <div class="card__body">
        <p class="card__title">${pl.name}</p>
        <p class="card__sub">${pl.owner?.display_name || ''}</p>
        <p class="card__meta">${pl.tracks?.total || ''} tracks</p>
      </div>
    </div>`;
}

// ─── Track Row (for playlist/album detail view) ───────────────────────────────
export function renderTrackRow(item, index, contextUri = null) {
  const track = item.track || item;
  if (!track || !track.name) return '';
  const img = getImg(track.album?.images || []);
  return `
    <div class="track-row" data-uri="${track.uri}" data-ctx="${contextUri || ''}" data-track-id="${track.id}"
         data-album-id="${track.album?.id || ''}" data-artist-ids="${(track.artists || []).map(a => a.id).join(',')}">
      <span class="track-row__num">${index + 1}</span>
      <img class="track-row__img" src="${img}" alt="">
      <div class="track-row__info">
        <span class="track-row__name">${track.name}</span>
        <span class="track-row__artist">${artistNames(track.artists)}</span>
      </div>
      <span class="track-row__album">${track.album?.name || ''}</span>
      <span class="track-row__duration">${formatDuration(track.duration_ms)}</span>
      <button class="heart-btn btn-icon" data-track-id="${track.id}" title="Save">
        ${icons.heartOutline}
      </button>
      <button class="track-row__play" data-uri="${track.uri}" data-ctx="${contextUri || ''}">
        ${icons.play}
      </button>
    </div>`;
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function renderSection(title, contentHtml, extraClass = '') {
  return `
    <section class="section ${extraClass}">
      <h2 class="section__title">${title}</h2>
      <div class="cards-grid">${contentHtml}</div>
    </section>`;
}

// ─── Recently Searched Chips ──────────────────────────────────────────────────
export function renderRecentSearches() {
  const searches = getRecentSearches();
  if (!searches.length) return '';
  const chips = searches.map(q => `<button class="search-chip" data-query="${q}">${q}</button>`).join('');
  return `<div class="recent-searches"><span class="recent-searches__label">Recent</span>${chips}</div>`;
}

export function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem('recent_searches') || '[]');
  } catch { return []; }
}

export function addRecentSearch(query) {
  if (!query || query.length < 2) return;
  let searches = getRecentSearches();
  searches = searches.filter(q => q !== query);
  searches.unshift(query);
  searches = searches.slice(0, 5);
  localStorage.setItem('recent_searches', JSON.stringify(searches));
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
export function renderContextMenu(x, y, trackData) {
  removeContextMenu();
  const items = [];
  if (trackData.uri) items.push(`<div class="ctx-menu__item" data-action="queue" data-uri="${trackData.uri}">${icons.queue} Add to Queue</div>`);
  if (trackData.albumId) items.push(`<div class="ctx-menu__item" data-action="album" data-id="${trackData.albumId}">${icons.album} Go to Album</div>`);
  if (trackData.artistIds) {
    trackData.artistIds.split(',').forEach((id, i) => {
      items.push(`<div class="ctx-menu__item" data-action="artist" data-id="${id}">${icons.artist} Go to Artist</div>`);
    });
  }
  items.push(`<div class="ctx-menu__item" data-action="save" data-track-id="${trackData.trackId}">${icons.heartOutline} Save to Library</div>`);

  const menu = document.createElement('div');
  menu.className = 'ctx-menu glass';
  menu.innerHTML = items.join('');

  // Position: keep within viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  menu.style.left = `${Math.min(x, vw - 200)}px`;
  menu.style.top = `${Math.min(y, vh - 240)}px`;

  document.body.appendChild(menu);
  requestAnimationFrame(() => menu.classList.add('ctx-menu--visible'));
  return menu;
}

export function removeContextMenu() {
  document.querySelector('.ctx-menu')?.remove();
}

// ─── Now Playing Bar ──────────────────────────────────────────────────────────
export function updateNowPlaying(state) {
  if (!state) {
    document.getElementById('np-bar')?.classList.remove('active');
    return;
  }
  const track = state.track_window?.current_track;
  if (!track) return;

  document.getElementById('np-bar')?.classList.add('active');
  const npImg = document.getElementById('np-img');
  if (npImg) npImg.src = track.album?.images?.[0]?.url || '';
  const npTitle = document.getElementById('np-title');
  if (npTitle) npTitle.textContent = track.name;
  const npArtist = document.getElementById('np-artist');
  if (npArtist) npArtist.textContent = track.artists?.map(a => a.name).join(', ');

  const playIcon = document.getElementById('np-play-icon');
  if (playIcon) playIcon.innerHTML = state.paused ? icons.play : icons.pause;

  const pos = state.position;
  const dur = state.duration;
  const pct = dur ? (pos / dur) * 100 : 0;
  const progress = document.getElementById('np-progress');
  if (progress) progress.style.width = `${pct}%`;
  const timeCur = document.getElementById('np-time-cur');
  if (timeCur) timeCur.textContent = formatDuration(pos);
  const timeDur = document.getElementById('np-time-dur');
  if (timeDur) timeDur.textContent = formatDuration(dur);

  // Ambient glow from album art
  const artUrl = track.album?.images?.[0]?.url;
  if (artUrl) {
    document.documentElement.style.setProperty('--np-glow-img', `url('${artUrl}')`);
  }

  // Store current track URI for active highlighting
  window.__currentTrackUri = track.uri;
  window.__currentTrackId = track.id;
  highlightActiveTrack(track.uri);

  // Update fullscreen NP if open
  updateFullscreenNP(state);
}

// ─── Active Track Highlighting ────────────────────────────────────────────────
export function highlightActiveTrack(uri) {
  document.querySelectorAll('.track-row--active').forEach(el => el.classList.remove('track-row--active'));
  document.querySelectorAll('.card--playing').forEach(el => el.classList.remove('card--playing'));
  if (uri) {
    document.querySelectorAll(`.track-row[data-uri="${uri}"]`).forEach(el => el.classList.add('track-row--active'));
    document.querySelectorAll(`.card[data-uri="${uri}"]`).forEach(el => el.classList.add('card--playing'));
  }
}

// ─── Volume Icon ──────────────────────────────────────────────────────────────
export function updateVolumeIcon(value) {
  const el = document.getElementById('np-volume-icon');
  if (!el) return;
  if (value <= 0) el.innerHTML = icons.volumeMute;
  else if (value <= 40) el.innerHTML = icons.volumeLow;
  else el.innerHTML = icons.volumeHigh;
}

// ─── Fullscreen Now Playing ───────────────────────────────────────────────────
export function updateFullscreenNP(state) {
  const overlay = document.getElementById('fullscreen-np');
  if (!overlay || !overlay.classList.contains('active')) return;
  const track = state.track_window?.current_track;
  if (!track) return;

  const img = overlay.querySelector('.fs-np__img');
  if (img) img.src = track.album?.images?.[0]?.url || '';
  const title = overlay.querySelector('.fs-np__title');
  if (title) title.textContent = track.name;
  const artist = overlay.querySelector('.fs-np__artist');
  if (artist) artist.textContent = track.artists?.map(a => a.name).join(', ');
  const playBtn = overlay.querySelector('.fs-np__play-icon');
  if (playBtn) playBtn.innerHTML = state.paused ? icons.play : icons.pause;

  const pos = state.position;
  const dur = state.duration;
  const pct = dur ? (pos / dur) * 100 : 0;
  const progress = overlay.querySelector('.fs-np__progress-fill');
  if (progress) progress.style.width = `${pct}%`;
  const timeCur = overlay.querySelector('.fs-np__time-cur');
  if (timeCur) timeCur.textContent = formatDuration(pos);
  const timeDur = overlay.querySelector('.fs-np__time-dur');
  if (timeDur) timeDur.textContent = formatDuration(dur);
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => `
    <div class="card card--skeleton">
      <div class="skeleton skeleton--img"></div>
      <div class="skeleton skeleton--line"></div>
      <div class="skeleton skeleton--line skeleton--line-short"></div>
    </div>`).join('');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
export function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} visible`;
  setTimeout(() => t.classList.remove('visible'), 3500);
}
