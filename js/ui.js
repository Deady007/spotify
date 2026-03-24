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

// --- Cards ---
export function renderTrackCard(track, contextUri = null) {
  const img = getImg(track.album?.images);
  const artists = artistNames(track.artists);
  return `
    <div class="card card--track" data-uri="${track.uri}" data-ctx="${contextUri || ''}" 
         title="${track.name}">
      <div class="card__img-wrap">
        <img src="${img}" alt="${track.name}" loading="lazy">
        <button class="card__play-btn" data-uri="${track.uri}" data-ctx="${contextUri || ''}">
          <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
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
          <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
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
          <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
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
          <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
      </div>
      <div class="card__body">
        <p class="card__title">${pl.name}</p>
        <p class="card__sub">${pl.owner?.display_name || ''}</p>
        <p class="card__meta">${pl.tracks?.total || ''} tracks</p>
      </div>
    </div>`;
}

// --- Track Row (for playlist/album detail view) ---
export function renderTrackRow(item, index, contextUri = null) {
  const track = item.track || item;
  if (!track || !track.name) return '';
  const img = getImg(track.album?.images || []);
  return `
    <div class="track-row" data-uri="${track.uri}" data-ctx="${contextUri || ''}">
      <span class="track-row__num">${index + 1}</span>
      <img class="track-row__img" src="${img}" alt="">
      <div class="track-row__info">
        <span class="track-row__name">${track.name}</span>
        <span class="track-row__artist">${artistNames(track.artists)}</span>
      </div>
      <span class="track-row__album">${track.album?.name || ''}</span>
      <span class="track-row__duration">${formatDuration(track.duration_ms)}</span>
      <button class="track-row__play" data-uri="${track.uri}" data-ctx="${contextUri || ''}">
        <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
    </div>`;
}

// --- Section ---
export function renderSection(title, contentHtml, extraClass = '') {
  return `
    <section class="section ${extraClass}">
      <h2 class="section__title">${title}</h2>
      <div class="cards-grid">${contentHtml}</div>
    </section>`;
}

// --- Now Playing Bar ---
export function updateNowPlaying(state) {
  if (!state) {
    document.getElementById('np-bar').classList.remove('active');
    return;
  }
  const track = state.track_window?.current_track;
  if (!track) return;

  document.getElementById('np-bar').classList.add('active');
  document.getElementById('np-img').src = track.album?.images?.[0]?.url || '';
  document.getElementById('np-title').textContent = track.name;
  document.getElementById('np-artist').textContent = track.artists?.map(a => a.name).join(', ');
  document.getElementById('np-play-icon').innerHTML = state.paused
    ? `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

  const pos = state.position;
  const dur = state.duration;
  const pct = dur ? (pos / dur) * 100 : 0;
  document.getElementById('np-progress').style.width = `${pct}%`;
  document.getElementById('np-time-cur').textContent = formatDuration(pos);
  document.getElementById('np-time-dur').textContent = formatDuration(dur);

  // Ambient glow from album art
  const color = track.album?.images?.[0]?.url;
  if (color) {
    document.documentElement.style.setProperty('--np-glow-img', `url('${color}')`);
  }
}

// --- Loading skeleton ---
export function skeletonCards(n = 8) {
  return Array.from({ length: n }, () => `
    <div class="card card--skeleton">
      <div class="skeleton skeleton--img"></div>
      <div class="skeleton skeleton--line"></div>
      <div class="skeleton skeleton--line skeleton--line-short"></div>
    </div>`).join('');
}

// --- Toast ---
export function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} visible`;
  setTimeout(() => t.classList.remove('visible'), 3500);
}
