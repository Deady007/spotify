// Gearbox — Main App Router & State
import { isLoggedIn, login, getAccessToken, logout } from './auth.js';
import * as API from './spotify.js';
import * as Player from './player.js';
import * as UI from './ui.js';

// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  user: null,
  view: 'home',
  playbackState: null,
  progressInterval: null,
};

// ─── Elements ─────────────────────────────────────────────────────────────────
const mainContent = () => document.getElementById('main-content');
const npBar = () => document.getElementById('np-bar');

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  // Handle OAuth callback — Spotify redirects back here with ?code=...
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    // User denied authorization
    history.replaceState({}, '', '/');
    renderLogin();
    setTimeout(() => UI.showToast('Authorization denied: ' + error, 'error'), 300);
    return;
  }

  if (code) {
    // Exchange auth code for tokens
    try {
      const { exchangeCode } = await import('./auth.js');
      await exchangeCode(code);
    } catch (e) {
      history.replaceState({}, '', '/');
      renderLogin();
      setTimeout(() => UI.showToast('Login failed. Please try again.', 'error'), 300);
      return;
    }
    // Clean the URL so code doesn't persist on refresh
    history.replaceState({}, '', '/');
  }

  if (!isLoggedIn()) {
    renderLogin();
    return;
  }
  showSkeleton();
  try {
    state.user = await API.getMe();
    renderUserInfo(state.user);
    const token = await getAccessToken();
    await Player.initPlayer(token).catch(() => console.warn('Player SDK init failed'));
    Player.setStateChangeCallback(handlePlaybackState);
    await showHome();
    bindNav();
    bindSearch();
    bindNowPlaying();
  } catch (e) {
    console.error(e);
    UI.showToast('Failed to load. Please try again.', 'error');
  }
}

// ─── Views ────────────────────────────────────────────────────────────────────
function renderLogin() {
  document.getElementById('app').style.display = 'block';
  document.getElementById('app').innerHTML = `
    <div class="login-screen">
      <div class="login-card glass">
        <div class="login-logo">
          <svg class="logo-icon" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="30" fill="url(#lg)"/>
            <path d="M20 38 Q30 22 40 38" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M17 32 Q30 14 43 32" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M14 26 Q30 6 46 26" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="60" y2="60" gradientUnits="userSpaceOnUse">
                <stop stop-color="#1db954"/>
                <stop offset="1" stop-color="#1565c0"/>
              </linearGradient>
            </defs>
          </svg>
          <span class="logo-text">Gearbox</span>
        </div>
        <h1>Your personal music universe</h1>
        <p>Connect your Spotify account to get started</p>
        <button id="login-btn" class="btn-primary">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <circle cx="12" cy="12" r="12" fill="#1db954"/>
            <path d="M8 16.5 Q12 11 16 16.5" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M7 13 Q12 7 17 13" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
            <path d="M6 9.5 Q12 3 18 9.5" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
          Connect with Spotify
        </button>
      </div>
    </div>`;
  document.getElementById('login-btn').addEventListener('click', login);
}

async function showHome() {
  setActiveNav('home');
  mainContent().innerHTML = `<div class="page-header"><h1>Good ${greeting()}, ${state.user?.display_name?.split(' ')[0] || 'there'} 👋</h1></div>
    <div id="home-content">${UI.skeletonCards(8)}</div>`;

  const [recent, topTracks, topArtists, playlists] = await Promise.allSettled([
    API.getRecentlyPlayed(10),
    API.getTopItems('tracks', 12),
    API.getTopItems('artists', 8),
    API.getMyPlaylists(8),
  ]);

  let html = '';

  if (recent.status === 'fulfilled' && recent.value?.items?.length) {
    const tracks = recent.value.items.map(i => UI.renderTrackCard(i.track)).join('');
    html += UI.renderSection('Recently Played', tracks);
  }
  if (topTracks.status === 'fulfilled' && topTracks.value?.items?.length) {
    const cards = topTracks.value.items.map(t => UI.renderTrackCard(t)).join('');
    html += UI.renderSection('Your Top Tracks', cards);
  }
  if (topArtists.status === 'fulfilled' && topArtists.value?.items?.length) {
    const cards = topArtists.value.items.map(a => UI.renderArtistCard(a)).join('');
    html += UI.renderSection('Your Top Artists', cards);
  }
  if (playlists.status === 'fulfilled' && playlists.value?.items?.length) {
    const cards = playlists.value.items.map(p => UI.renderPlaylistCard(p)).join('');
    html += UI.renderSection('Your Playlists', cards);
  }

  document.getElementById('home-content').innerHTML = html || '<p class="empty">No data yet. Start listening on Spotify!</p>';
  bindCardClicks();
}

async function showSearch(query) {
  if (!query) {
    mainContent().innerHTML = `
      <div class="page-header"><h1>Search</h1></div>
      <div class="search-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>Find tracks, albums, and artists</p>
      </div>`;
    return;
  }
  setActiveNav('search');
  mainContent().innerHTML = `<div class="page-header search-header"><h1>Results for "${query}"</h1></div><div id="search-results">${UI.skeletonCards(12)}</div>`;

  try {
    const data = await API.search(query, ['track', 'album', 'artist'], 12);
    let html = '';

    if (data.tracks?.items?.length) {
      const cards = data.tracks.items.map(t => UI.renderTrackCard(t)).join('');
      html += UI.renderSection('Tracks', cards);
    }
    if (data.albums?.items?.length) {
      const cards = data.albums.items.map(a => UI.renderAlbumCard(a)).join('');
      html += UI.renderSection('Albums', cards);
    }
    if (data.artists?.items?.length) {
      const cards = data.artists.items.filter(a => a.images?.length).map(a => UI.renderArtistCard(a)).join('');
      html += UI.renderSection('Artists', cards);
    }

    document.getElementById('search-results').innerHTML = html || '<p class="empty">No results found.</p>';
    bindCardClicks();
  } catch (e) {
    UI.showToast('Search failed', 'error');
  }
}

async function showLibrary() {
  setActiveNav('library');
  mainContent().innerHTML = `<div class="page-header"><h1>Your Library</h1></div><div id="library-content">${UI.skeletonCards(8)}</div>`;

  const [playlists, liked] = await Promise.allSettled([
    API.getMyPlaylists(50),
    API.getLikedSongs(6),
  ]);

  let html = '';
  if (playlists.status === 'fulfilled' && playlists.value?.items?.length) {
    const cards = playlists.value.items.map(p => UI.renderPlaylistCard(p)).join('');
    html += UI.renderSection('Playlists', cards);
  }
  // Liked songs as featured card
  if (liked.status === 'fulfilled') {
    const total = liked.value?.total || 0;
    html = `
      <section class="section">
        <h2 class="section__title">Liked Songs</h2>
        <div class="liked-songs-card glass" id="go-liked">
          <div class="liked-songs-card__bg">💜</div>
          <div class="liked-songs-card__info">
            <p class="liked-songs-card__title">Liked Songs</p>
            <p class="liked-songs-card__count">${total} songs</p>
          </div>
          <button class="btn-icon liked-songs-card__play">
            <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
        </div>
      </section>` + html;
  }

  document.getElementById('library-content').innerHTML = html;
  bindCardClicks();
  document.getElementById('go-liked')?.addEventListener('click', showLikedSongs);
}

async function showLikedSongs() {
  mainContent().innerHTML = `
    <div class="page-header liked-header">
      <div class="liked-hero">💜</div>
      <div><h1>Liked Songs</h1><p class="page-header__sub">Your saved tracks</p></div>
    </div>
    <div id="liked-tracks">${UI.skeletonCards(10)}</div>`;

  try {
    const data = await API.getLikedSongs(50);
    const rows = data.items.map((item, i) => UI.renderTrackRow(item, i)).join('');
    document.getElementById('liked-tracks').innerHTML = `<div class="track-list">${rows || '<p class="empty">No liked songs yet.</p>'}</div>`;
    bindTrackRowClicks();
  } catch (e) {
    UI.showToast('Failed to load liked songs', 'error');
  }
}

async function showPlaylist(id) {
  mainContent().innerHTML = `<div class="loader-center"><div class="spinner"></div></div>`;
  try {
    const [pl, tracks] = await Promise.all([
      API.getPlaylist(id),
      API.getPlaylistTracks(id, 100),
    ]);
    const img = UI.getImg(pl.images);
    mainContent().innerHTML = `
      <div class="detail-header glass">
        <img class="detail-header__img" src="${img}" alt="${pl.name}">
        <div class="detail-header__info">
          <span class="detail-header__type">Playlist</span>
          <h1>${pl.name}</h1>
          <p class="detail-header__sub">${pl.description || ''}</p>
          <p class="detail-header__meta">${pl.tracks?.total || 0} tracks · by ${pl.owner?.display_name}</p>
          <button class="btn-primary play-all-btn" data-playlist-id="${id}">
            <svg viewBox="0 0 24 24" width="18" height="18"><polygon points="5,3 19,12 5,21"/></svg>
            Play All
          </button>
        </div>
      </div>
      <div class="track-list">
        ${tracks.items.map((item, i) => UI.renderTrackRow(item, i, pl.uri)).join('')}
      </div>`;
    bindTrackRowClicks(pl.uri);
    document.querySelector('.play-all-btn')?.addEventListener('click', () => {
      if (tracks.items[0]?.track) Player.play(tracks.items[0].track.uri, pl.uri);
    });
  } catch (e) {
    UI.showToast('Failed to load playlist', 'error');
  }
}

async function showAlbum(id) {
  mainContent().innerHTML = `<div class="loader-center"><div class="spinner"></div></div>`;
  try {
    const album = await API.getAlbum(id);
    const img = UI.getImg(album.images);
    const year = album.release_date?.slice(0, 4);
    mainContent().innerHTML = `
      <div class="detail-header glass">
        <img class="detail-header__img" src="${img}" alt="${album.name}">
        <div class="detail-header__info">
          <span class="detail-header__type">Album</span>
          <h1>${album.name}</h1>
          <p class="detail-header__sub">${album.artists?.map(a => a.name).join(', ')}</p>
          <p class="detail-header__meta">${year} · ${album.total_tracks} tracks</p>
          <button class="btn-primary play-all-btn" data-album-uri="${album.uri}">
            <svg viewBox="0 0 24 24" width="18" height="18"><polygon points="5,3 19,12 5,21"/></svg>
            Play All
          </button>
        </div>
      </div>
      <div class="track-list">
        ${album.tracks.items.map((t, i) => {
          t.album = album; // inject for row renderer
          return UI.renderTrackRow({ track: t }, i, album.uri);
        }).join('')}
      </div>`;
    bindTrackRowClicks(album.uri);
    document.querySelector('.play-all-btn')?.addEventListener('click', () => {
      if (album.tracks.items[0]) Player.play(album.tracks.items[0].uri, album.uri);
    });
  } catch (e) {
    UI.showToast('Failed to load album', 'error');
  }
}

async function showArtist(id) {
  mainContent().innerHTML = `<div class="loader-center"><div class="spinner"></div></div>`;
  try {
    const [artist, topTracks, albums] = await Promise.all([
      API.getArtist(id),
      API.getArtistTopTracks(id),
      API.getArtistAlbums(id),
    ]);
    const img = UI.getImg(artist.images);
    mainContent().innerHTML = `
      <div class="artist-hero" style="--hero-img: url('${img}')">
        <div class="artist-hero__overlay">
          <h1>${artist.name}</h1>
          <p>${UI.formatNumber(artist.followers?.total)} followers</p>
        </div>
      </div>
      <div id="artist-content">
        ${UI.renderSection('Top Tracks', topTracks.tracks?.slice(0, 8).map((t, i) => UI.renderTrackRow({ track: t }, i)).join('') || '', 'section--list')}
        ${UI.renderSection('Albums', albums.items?.map(a => UI.renderAlbumCard(a)).join('') || '')}
      </div>`;
    bindTrackRowClicks();
    bindCardClicks();
  } catch (e) {
    UI.showToast('Failed to load artist', 'error');
  }
}

// ─── Playback ─────────────────────────────────────────────────────────────────
function handlePlaybackState(state) {
  if (!state) return;
  state.playbackState = state;
  UI.updateNowPlaying(state);
  startProgressTracking(state);
}

function startProgressTracking(state) {
  clearInterval(window._progressInterval);
  if (state.paused) return;
  let pos = state.position;
  const dur = state.duration;
  window._progressInterval = setInterval(() => {
    pos += 500;
    if (pos >= dur) { clearInterval(window._progressInterval); return; }
    const pct = (pos / dur) * 100;
    const bar = document.getElementById('np-progress');
    const cur = document.getElementById('np-time-cur');
    if (bar) bar.style.width = `${pct}%`;
    if (cur) cur.textContent = UI.formatDuration(pos);
  }, 500);
}

// ─── Bindings ─────────────────────────────────────────────────────────────────
function bindNav() {
  document.getElementById('nav-home')?.addEventListener('click', showHome);
  document.getElementById('nav-search')?.addEventListener('click', () => {
    const input = document.getElementById('search-input');
    showSearch(input?.value.trim() || '');
    input?.focus();
  });
  document.getElementById('nav-library')?.addEventListener('click', showLibrary);
  document.getElementById('nav-liked')?.addEventListener('click', showLikedSongs);
  document.getElementById('nav-logout')?.addEventListener('click', logout);
}

function bindSearch() {
  let debounce;
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(debounce);
      showSearch(input.value.trim());
    }
  });
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    if (!input.value.trim()) {
      showSearch('');
      return;
    }
    debounce = setTimeout(() => showSearch(input.value.trim()), 600);
  });
  document.getElementById('search-btn')?.addEventListener('click', () => showSearch(input.value.trim()));
}

function bindNowPlaying() {
  document.getElementById('np-play-btn')?.addEventListener('click', Player.togglePlay);
  document.getElementById('np-next-btn')?.addEventListener('click', Player.next);
  document.getElementById('np-prev-btn')?.addEventListener('click', Player.prev);

  const vol = document.getElementById('np-volume');
  vol?.addEventListener('input', () => Player.setVolume(vol.value / 100));

  const track = document.getElementById('np-track');
  track?.addEventListener('click', e => {
    const rect = track.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    Player.getCurrentState().then(s => { if (s) Player.seekTo(pct * s.duration); });
  });
}

function bindCardClicks() {
  document.querySelectorAll('[data-playlist-id]').forEach(el => {
    el.addEventListener('click', e => {
      const id = el.dataset.playlistId;
      if (e.target.closest('.card__play-btn')) {
        API.getPlaylistTracks(id).then(data => {
          if (data.items[0]?.track) Player.play(data.items[0].track.uri, `spotify:playlist:${id}`);
        });
      } else {
        showPlaylist(id);
      }
    });
  });

  document.querySelectorAll('[data-album-id]').forEach(el => {
    el.addEventListener('click', e => {
      const id = el.dataset.albumId;
      if (e.target.closest('.card__play-btn')) {
        API.getAlbum(id).then(album => {
          if (album.tracks.items[0]) Player.play(album.tracks.items[0].uri, album.uri);
        });
      } else {
        showAlbum(id);
      }
    });
  });

  document.querySelectorAll('[data-artist-id]').forEach(el => {
    el.addEventListener('click', e => {
      const id = el.dataset.artistId;
      showArtist(id);
    });
  });

  document.querySelectorAll('[data-uri]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.card__play-btn') || e.target.closest('.card')) {
        const uri = el.dataset.uri;
        const ctx = el.dataset.ctx || null;
        if (uri) Player.play(uri, ctx || null);
      }
    });
  });

  document.querySelectorAll('.artist-link').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      showArtist(el.dataset.id);
    });
  });
}

function bindTrackRowClicks(contextUri = null) {
  document.querySelectorAll('.track-row').forEach(row => {
    row.addEventListener('click', () => {
      const uri = row.dataset.uri;
      const ctx = row.dataset.ctx || contextUri || null;
      if (uri) Player.play(uri, ctx);
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setActiveNav(id) {
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${id}`)?.classList.add('active');
}

function renderUserInfo(user) {
  const img = user?.images?.[0]?.url;
  const avatar = document.getElementById('user-avatar');
  const name = document.getElementById('user-name');
  if (avatar && img) avatar.src = img;
  if (name) name.textContent = user?.display_name || 'You';
}

function showSkeleton() {
  mainContent().innerHTML = `<div class="page-header"><div class="skeleton skeleton--title"></div></div><div class="cards-grid">${UI.skeletonCards(12)}</div>`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
