// Gearbox — Spotify Web API wrapper
import { getAccessToken, logout } from './auth.js';

const BASE = 'https://api.spotify.com/v1';

async function apiFetch(path, opts = {}) {
  const token = await getAccessToken();
  if (!token) { logout(); return null; }

  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  if (res.status === 401) { logout(); return null; }
  if (res.status === 204 || res.status === 202) return null;
  if (res.status === 403) {
    console.warn(`Forbidden: ${path} — check Spotify Developer Dashboard whitelist`);
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.warn(`API error ${res.status}: ${err?.error?.message || 'Unknown'}`);
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  return res.json();
}

export async function getMe() {
  return apiFetch('/me');
}

export async function search(query, types = ['track', 'album', 'artist'], limit = 20) {
  // Guard against short queries that Spotify rejects with 400
  if (!query || query.length < 2) return { tracks: { items: [] }, albums: { items: [] }, artists: { items: [] } };
  const params = new URLSearchParams({ q: query, type: types.join(','), limit });
  return apiFetch(`/search?${params}`);
}

export async function getMyPlaylists(limit = 50) {
  return apiFetch(`/me/playlists?limit=${limit}`);
}

export async function getLikedSongs(limit = 50, offset = 0) {
  return apiFetch(`/me/tracks?limit=${limit}&offset=${offset}`);
}

export async function getPlaylistTracks(id, limit = 100, offset = 0) {
  return apiFetch(`/playlists/${id}/tracks?limit=${limit}&offset=${offset}`);
}

export async function getPlaylist(id) {
  return apiFetch(`/playlists/${id}`);
}

export async function getAlbum(id) {
  return apiFetch(`/albums/${id}`);
}

export async function getAlbumTracks(id) {
  return apiFetch(`/albums/${id}/tracks?limit=50`);
}

export async function getArtist(id) {
  return apiFetch(`/artists/${id}`);
}

export async function getArtistTopTracks(id) {
  return apiFetch(`/artists/${id}/top-tracks?market=from_token`);
}

export async function getArtistAlbums(id) {
  return apiFetch(`/artists/${id}/albums?include_groups=album,single&limit=20`);
}

export async function getRecentlyPlayed(limit = 20) {
  return apiFetch(`/me/player/recently-played?limit=${limit}`);
}

export async function getTopItems(type = 'tracks', limit = 20, time_range = 'medium_term') {
  return apiFetch(`/me/top/${type}?limit=${limit}&time_range=${time_range}`);
}

export async function getCurrentPlayback() {
  return apiFetch('/me/player');
}

export async function playTrack(uri, contextUri = null, deviceId = null) {
  const body = contextUri
    ? { context_uri: contextUri, offset: { uri } }
    : { uris: [uri] };
  const qs = deviceId ? `?device_id=${deviceId}` : '';
  return apiFetch(`/me/player/play${qs}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function transferPlayback(deviceId) {
  return apiFetch('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

export async function skipNext() {
  return apiFetch('/me/player/next', { method: 'POST' });
}

export async function skipPrev() {
  return apiFetch('/me/player/previous', { method: 'POST' });
}

export async function setVolume(pct) {
  return apiFetch(`/me/player/volume?volume_percent=${Math.round(pct)}`, { method: 'PUT' });
}

export async function seek(ms) {
  return apiFetch(`/me/player/seek?position_ms=${Math.round(ms)}`, { method: 'PUT' });
}

export async function toggleShuffle(state) {
  return apiFetch(`/me/player/shuffle?state=${state}`, { method: 'PUT' });
}

export async function toggleRepeat(state) {
  return apiFetch(`/me/player/repeat?state=${state}`, { method: 'PUT' });
}

export async function isTrackSaved(id) {
  const data = await apiFetch(`/me/tracks/contains?ids=${id}`);
  return data ? data[0] : false;
}

export async function saveTrack(id) {
  return apiFetch(`/me/tracks?ids=${id}`, { method: 'PUT' });
}

export async function removeTrack(id) {
  return apiFetch(`/me/tracks?ids=${id}`, { method: 'DELETE' });
}

export async function addToQueue(uri) {
  return apiFetch(`/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: 'POST' });
}
