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
  likedSongsOffset: 0,
  likedSongsTotal: 0,
  isLoadingMore: false,
  playlistTracksOffset: 0,
  playlistTracksTotal: 0,
  currentPlaylistId: null,
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
    history.replaceState({}, '', '/');
    renderLogin();
    setTimeout(() => UI.showToast('Authorization denied: ' + error, 'error'), 300);
    return;
  }

  if (code) {
    try {
      const { exchangeCode } = await import('./auth.js');
      await exchangeCode(code);
    } catch (e) {
      history.replaceState({}, '', '/');
      renderLogin();
      setTimeout(() => UI.showToast('Login failed. Please try again.', 'error'), 300);
      return;
    }
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
    bindKeyboard();
    bindContextMenu();
    bindMobileMenu();
    bindFullscreenNP();
    bindInfiniteScroll();
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

function applyPageTransition() {
  const mc = mainContent();
  mc.classList.remove('page-enter');
  void mc.offsetWidth; // force reflow
  mc.classList.add('page-enter');
}

async function showHome() {
  setActiveNav('home');
  mainContent().innerHTML = `<div class="page-header"><h1>Good ${greeting()}, ${state.user?.display_name?.split(' ')[0] || 'there'} 👋</h1></div>
    <div id="home-content">${UI.skeletonCards(8)}</div>`;
  applyPageTransition();

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

  const homeContent = document.getElementById('home-content');
  if (homeContent) {
    homeContent.innerHTML = html || '<p class="empty">No data yet. Start listening on Spotify!</p>';
    homeContent.classList.add('content-loaded');
  }
  bindCardClicks();
  // Highlight active track if playing
  if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
}

async function showSearch(query) {
  if (!query) {
    setActiveNav('search');
    mainContent().innerHTML = `
      <div class="page-header"><h1>Search</h1></div>
      ${UI.renderRecentSearches()}
      <div class="search-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <p>Find tracks, albums, and artists</p>
      </div>`;
    applyPageTransition();
    bindRecentSearchChips();
    return;
  }
  setActiveNav('search');
  mainContent().innerHTML = `<div class="page-header search-header"><h1>Results for "${query}"</h1></div><div id="search-results">${UI.skeletonCards(12)}</div>`;
  applyPageTransition();

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

    const results = document.getElementById('search-results');
    if (results) {
      results.innerHTML = html || '<p class="empty">No results found.</p>';
      results.classList.add('content-loaded');
    }
    UI.addRecentSearch(query);
    bindCardClicks();
    if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
  } catch (e) {
    UI.showToast('Search failed', 'error');
  }
}

async function showLibrary() {
  setActiveNav('library');
  mainContent().innerHTML = `<div class="page-header"><h1>Your Library</h1></div><div id="library-content">${UI.skeletonCards(8)}</div>`;
  applyPageTransition();

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

  const libraryContent = document.getElementById('library-content');
  if (libraryContent) {
    libraryContent.innerHTML = html;
    libraryContent.classList.add('content-loaded');
  }
  bindCardClicks();
  document.getElementById('go-liked')?.addEventListener('click', showLikedSongs);
}

async function showLikedSongs() {
  state.likedSongsOffset = 0;
  mainContent().innerHTML = `
    <div class="page-header liked-header">
      <div class="liked-hero">💜</div>
      <div><h1>Liked Songs</h1><p class="page-header__sub">Your saved tracks</p></div>
    </div>
    <div id="liked-tracks">${UI.skeletonCards(10)}</div>`;
  applyPageTransition();

  try {
    const data = await API.getLikedSongs(50);
    state.likedSongsTotal = data.total || 0;
    state.likedSongsOffset = data.items.length;
    const rows = data.items.map((item, i) => UI.renderTrackRow(item, i)).join('');
    const likedTracks = document.getElementById('liked-tracks');
    if (likedTracks) {
      likedTracks.innerHTML = `<div class="track-list" id="liked-track-list">${rows || '<p class="empty">No liked songs yet.</p>'}</div>`;
      likedTracks.classList.add('content-loaded');
    }
    bindTrackRowClicks();
    bindHeartButtons();
    if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
    state.view = 'liked';
  } catch (e) {
    UI.showToast('Failed to load liked songs', 'error');
  }
}

async function showPlaylist(id) {
  state.currentPlaylistId = id;
  state.playlistTracksOffset = 0;
  mainContent().innerHTML = `<div class="loader-center"><div class="spinner"></div></div>`;
  try {
    const [pl, tracks] = await Promise.all([
      API.getPlaylist(id),
      API.getPlaylistTracks(id, 100),
    ]);
    state.playlistTracksTotal = pl.tracks?.total || 0;
    state.playlistTracksOffset = tracks.items.length;
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
      <div class="track-list" id="playlist-track-list">
        ${tracks.items.map((item, i) => UI.renderTrackRow(item, i, pl.uri)).join('')}
      </div>`;
    applyPageTransition();
    bindTrackRowClicks(pl.uri);
    bindHeartButtons();
    document.querySelector('.play-all-btn')?.addEventListener('click', () => {
      if (tracks.items[0]?.track) Player.play(tracks.items[0].track.uri, pl.uri);
    });
    if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
    state.view = 'playlist';
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
          t.album = album;
          return UI.renderTrackRow({ track: t }, i, album.uri);
        }).join('')}
      </div>`;
    applyPageTransition();
    bindTrackRowClicks(album.uri);
    bindHeartButtons();
    document.querySelector('.play-all-btn')?.addEventListener('click', () => {
      if (album.tracks.items[0]) Player.play(album.tracks.items[0].uri, album.uri);
    });
    if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
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
    applyPageTransition();
    bindTrackRowClicks();
    bindCardClicks();
    bindHeartButtons();
    if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
  } catch (e) {
    UI.showToast('Failed to load artist', 'error');
  }
}

// ─── Playback ─────────────────────────────────────────────────────────────────
function handlePlaybackState(pbState) {
  if (!pbState) return;
  state.playbackState = pbState;
  UI.updateNowPlaying(pbState);
  startProgressTracking(pbState);
  updateShuffleRepeatUI();

  // Check if current track is saved
  const track = pbState.track_window?.current_track;
  if (track?.id) {
    API.isTrackSaved(track.id).then(saved => {
      const btn = document.getElementById('np-heart-btn');
      if (btn) {
        btn.classList.toggle('saved', saved);
        btn.innerHTML = saved ? UI.icons.heartFilled : UI.icons.heartOutline;
      }
    }).catch(() => {});
  }
}

function startProgressTracking(pbState) {
  clearInterval(window._progressInterval);
  if (pbState.paused) return;
  let pos = pbState.position;
  const dur = pbState.duration;
  window._progressInterval = setInterval(() => {
    pos += 500;
    if (pos >= dur) { clearInterval(window._progressInterval); return; }
    const pct = (pos / dur) * 100;
    const bar = document.getElementById('np-progress');
    const thumb = document.getElementById('np-thumb');
    const cur = document.getElementById('np-time-cur');
    if (bar) bar.style.width = `${pct}%`;
    if (thumb) thumb.style.left = `${pct}%`;
    if (cur) cur.textContent = UI.formatDuration(pos);
    // Update fullscreen NP if open
    const fsFill = document.querySelector('.fs-np__progress-fill');
    const fsCur = document.querySelector('.fs-np__time-cur');
    if (fsFill) fsFill.style.width = `${pct}%`;
    if (fsCur) fsCur.textContent = UI.formatDuration(pos);
  }, 500);
}

function updateShuffleRepeatUI() {
  const shuffleOn = Player.getShuffleState();
  const repeatMode = Player.getRepeatMode();

  const shuffleBtn = document.getElementById('np-shuffle-btn');
  const repeatBtn = document.getElementById('np-repeat-btn');
  const fsShuffleBtn = document.getElementById('fs-shuffle-btn');
  const fsRepeatBtn = document.getElementById('fs-repeat-btn');

  if (shuffleBtn) shuffleBtn.classList.toggle('active', shuffleOn);
  if (fsShuffleBtn) fsShuffleBtn.classList.toggle('active', shuffleOn);

  if (repeatBtn) {
    repeatBtn.classList.toggle('active', repeatMode !== 'off');
    if (repeatMode === 'track') {
      repeatBtn.title = 'Repeat: Track';
    } else if (repeatMode === 'context') {
      repeatBtn.title = 'Repeat: All';
    } else {
      repeatBtn.title = 'Repeat: Off';
    }
  }
  if (fsRepeatBtn) {
    fsRepeatBtn.classList.toggle('active', repeatMode !== 'off');
  }
}

// ─── Bindings ─────────────────────────────────────────────────────────────────
function bindNav() {
  document.getElementById('nav-home')?.addEventListener('click', e => { e.preventDefault(); showHome(); closeMobileMenu(); });
  document.getElementById('nav-search')?.addEventListener('click', e => {
    e.preventDefault();
    const input = document.getElementById('search-input');
    showSearch(input?.value.trim() || '');
    input?.focus();
    closeMobileMenu();
  });
  document.getElementById('nav-library')?.addEventListener('click', e => { e.preventDefault(); showLibrary(); closeMobileMenu(); });
  document.getElementById('nav-liked')?.addEventListener('click', e => { e.preventDefault(); showLikedSongs(); closeMobileMenu(); });
  document.getElementById('nav-logout')?.addEventListener('click', e => { e.preventDefault(); logout(); });
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

  // Shuffle & Repeat
  document.getElementById('np-shuffle-btn')?.addEventListener('click', async () => {
    await Player.toggleShuffle();
    updateShuffleRepeatUI();
    UI.showToast(Player.getShuffleState() ? 'Shuffle on' : 'Shuffle off', 'success');
  });
  document.getElementById('np-repeat-btn')?.addEventListener('click', async () => {
    await Player.cycleRepeat();
    updateShuffleRepeatUI();
    const mode = Player.getRepeatMode();
    UI.showToast(`Repeat: ${mode === 'off' ? 'Off' : mode === 'context' ? 'All' : 'Track'}`, 'success');
  });

  // Heart on NP bar
  document.getElementById('np-heart-btn')?.addEventListener('click', async () => {
    const trackId = window.__currentTrackId;
    if (!trackId) return;
    const btn = document.getElementById('np-heart-btn');
    const isSaved = btn?.classList.contains('saved');
    try {
      if (isSaved) {
        await API.removeTrack(trackId);
        btn.classList.remove('saved');
        btn.innerHTML = UI.icons.heartOutline;
        UI.showToast('Removed from Liked Songs', 'success');
      } else {
        await API.saveTrack(trackId);
        btn.classList.add('saved');
        btn.innerHTML = UI.icons.heartFilled;
        UI.showToast('Added to Liked Songs', 'success');
      }
    } catch (e) {
      UI.showToast('Failed to update', 'error');
    }
  });

  // Volume
  const vol = document.getElementById('np-volume');
  vol?.addEventListener('input', () => {
    Player.setVolume(vol.value / 100);
    UI.updateVolumeIcon(parseInt(vol.value));
  });
  // Init volume icon
  UI.updateVolumeIcon(70);

  // Drag-to-seek on progress bar
  bindProgressDrag();

  // Album art click → expand fullscreen NP
  document.getElementById('np-img')?.addEventListener('click', () => openFullscreenNP());
  document.getElementById('np-expand-btn')?.addEventListener('click', () => openFullscreenNP());
}

function bindProgressDrag() {
  const track = document.getElementById('np-track');
  if (!track) return;
  let isDragging = false;

  const seekToPosition = (e) => {
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    Player.getCurrentState().then(s => {
      if (s) Player.seekTo(pct * s.duration);
    });
    // Update visual immediately
    const bar = document.getElementById('np-progress');
    const thumb = document.getElementById('np-thumb');
    if (bar) bar.style.width = `${pct * 100}%`;
    if (thumb) thumb.style.left = `${pct * 100}%`;
  };

  track.addEventListener('mousedown', (e) => {
    isDragging = true;
    track.classList.add('dragging');
    seekToPosition(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const bar = document.getElementById('np-progress');
    const thumb = document.getElementById('np-thumb');
    if (bar) bar.style.width = `${pct * 100}%`;
    if (thumb) thumb.style.left = `${pct * 100}%`;
  });

  document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    track.classList.remove('dragging');
    seekToPosition(e);
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
      } else if (e.target.closest('.play-all-btn')) {
        return; // handled separately
      } else {
        showPlaylist(id);
      }
    });
  });

  document.querySelectorAll('[data-album-id]').forEach(el => {
    if (el.closest('.track-row')) return; // skip track rows with album-id
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
    if (el.closest('.track-row')) return;
    el.addEventListener('click', () => {
      showArtist(el.dataset.artistId);
    });
  });

  document.querySelectorAll('.card[data-uri]').forEach(el => {
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
    row.addEventListener('click', (e) => {
      // Don't play if clicking heart or artist link
      if (e.target.closest('.heart-btn') || e.target.closest('.artist-link')) return;
      const uri = row.dataset.uri;
      const ctx = row.dataset.ctx || contextUri || null;
      if (uri) Player.play(uri, ctx);
    });
  });
}

function bindHeartButtons() {
  document.querySelectorAll('.heart-btn:not(.np-heart-btn)').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const trackId = btn.dataset.trackId;
      if (!trackId) return;
      const isSaved = btn.classList.contains('saved');
      try {
        if (isSaved) {
          await API.removeTrack(trackId);
          btn.classList.remove('saved');
          btn.innerHTML = UI.icons.heartOutline;
          UI.showToast('Removed from Liked Songs', 'success');
        } else {
          await API.saveTrack(trackId);
          btn.classList.add('saved');
          btn.innerHTML = UI.icons.heartFilled;
          UI.showToast('Added to Liked Songs', 'success');
        }
      } catch (e) {
        UI.showToast('Failed to update', 'error');
      }
    });
  });
}

function bindRecentSearchChips() {
  document.querySelectorAll('.search-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.dataset.query;
      const input = document.getElementById('search-input');
      if (input) input.value = query;
      showSearch(query);
    });
  });
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Don't capture when typing in search
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        Player.togglePlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        Player.next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        Player.prev();
        break;
      case '/':
        e.preventDefault();
        document.getElementById('search-input')?.focus();
        break;
      case 'Escape':
        closeFullscreenNP();
        UI.removeContextMenu();
        break;
      case 'f':
        if (document.getElementById('fullscreen-np')?.classList.contains('active')) {
          closeFullscreenNP();
        } else {
          openFullscreenNP();
        }
        break;
    }
  });
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function bindContextMenu() {
  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.track-row');
    const card = e.target.closest('.card[data-uri]');
    const target = row || card;
    if (!target) {
      UI.removeContextMenu();
      return;
    }
    e.preventDefault();
    const trackData = {
      uri: target.dataset.uri,
      trackId: target.dataset.trackId,
      albumId: target.dataset.albumId,
      artistIds: target.dataset.artistIds,
    };
    const menu = UI.renderContextMenu(e.clientX, e.clientY, trackData);

    // Bind menu actions
    menu.querySelectorAll('.ctx-menu__item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        switch (action) {
          case 'queue':
            Player.addToQueue(item.dataset.uri).then(() => {
              UI.showToast('Added to queue', 'success');
            }).catch(() => {
              UI.showToast('Failed to add to queue', 'error');
            });
            break;
          case 'album':
            showAlbum(item.dataset.id);
            break;
          case 'artist':
            showArtist(item.dataset.id);
            break;
          case 'save':
            API.saveTrack(item.dataset.trackId).then(() => {
              UI.showToast('Saved to library', 'success');
            }).catch(() => {
              UI.showToast('Failed to save', 'error');
            });
            break;
        }
        UI.removeContextMenu();
      });
    });
  });

  // Close context menu on click outside
  document.addEventListener('click', () => UI.removeContextMenu());
}

// ─── Mobile Menu ──────────────────────────────────────────────────────────────
function bindMobileMenu() {
  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.toggle('mobile-open');
    overlay?.classList.toggle('active');
  });

  document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileMenu);
}

function closeMobileMenu() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// ─── Fullscreen Now Playing ───────────────────────────────────────────────────
function bindFullscreenNP() {
  document.getElementById('fs-np-close')?.addEventListener('click', closeFullscreenNP);
  document.getElementById('fs-play-btn')?.addEventListener('click', Player.togglePlay);
  document.getElementById('fs-prev-btn')?.addEventListener('click', Player.prev);
  document.getElementById('fs-next-btn')?.addEventListener('click', Player.next);
  document.getElementById('fs-shuffle-btn')?.addEventListener('click', async () => {
    await Player.toggleShuffle();
    updateShuffleRepeatUI();
  });
  document.getElementById('fs-repeat-btn')?.addEventListener('click', async () => {
    await Player.cycleRepeat();
    updateShuffleRepeatUI();
  });
}

function openFullscreenNP() {
  const overlay = document.getElementById('fullscreen-np');
  if (!overlay) return;
  overlay.classList.add('active');
  // Update with current state
  if (state.playbackState) {
    UI.updateFullscreenNP(state.playbackState);
    updateShuffleRepeatUI();
  }
}

function closeFullscreenNP() {
  document.getElementById('fullscreen-np')?.classList.remove('active');
}

// ─── Infinite Scroll ──────────────────────────────────────────────────────────
function bindInfiniteScroll() {
  const mc = mainContent();
  if (!mc) return;
  mc.addEventListener('scroll', async () => {
    if (state.isLoadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = mc;
    if (scrollTop + clientHeight < scrollHeight - 200) return; // not near bottom

    if (state.view === 'liked' && state.likedSongsOffset < state.likedSongsTotal) {
      await loadMoreLikedSongs();
    }
    if (state.view === 'playlist' && state.playlistTracksOffset < state.playlistTracksTotal) {
      await loadMorePlaylistTracks();
    }
  });
}

async function loadMoreLikedSongs() {
  state.isLoadingMore = true;
  const list = document.getElementById('liked-track-list');
  if (!list) { state.isLoadingMore = false; return; }

  // Add loading indicator
  const loader = document.createElement('div');
  loader.className = 'loading-more';
  loader.textContent = 'Loading more...';
  list.appendChild(loader);

  try {
    const data = await API.getLikedSongs(50, state.likedSongsOffset);
    const rows = data.items.map((item, i) => UI.renderTrackRow(item, i + state.likedSongsOffset)).join('');
    loader.remove();
    list.insertAdjacentHTML('beforeend', rows);
    state.likedSongsOffset += data.items.length;
    bindTrackRowClicks();
    bindHeartButtons();
    if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
  } catch (e) {
    loader.remove();
    UI.showToast('Failed to load more', 'error');
  }
  state.isLoadingMore = false;
}

async function loadMorePlaylistTracks() {
  state.isLoadingMore = true;
  const list = document.getElementById('playlist-track-list');
  if (!list || !state.currentPlaylistId) { state.isLoadingMore = false; return; }

  const loader = document.createElement('div');
  loader.className = 'loading-more';
  loader.textContent = 'Loading more...';
  list.appendChild(loader);

  try {
    const pl = await API.getPlaylist(state.currentPlaylistId);
    const data = await API.getPlaylistTracks(state.currentPlaylistId, 100, state.playlistTracksOffset);
    const rows = data.items.map((item, i) => UI.renderTrackRow(item, i + state.playlistTracksOffset, pl.uri)).join('');
    loader.remove();
    list.insertAdjacentHTML('beforeend', rows);
    state.playlistTracksOffset += data.items.length;
    bindTrackRowClicks(pl.uri);
    bindHeartButtons();
    if (window.__currentTrackUri) UI.highlightActiveTrack(window.__currentTrackUri);
  } catch (e) {
    loader.remove();
    UI.showToast('Failed to load more', 'error');
  }
  state.isLoadingMore = false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setActiveNav(id) {
  state.view = id;
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
