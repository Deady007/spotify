// Gearbox — Track Suggestions
// Calls Claude API if key is set in localStorage, otherwise falls back
// to Spotify related-artists top tracks.
import * as API from './spotify.js';

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

export function getAnthropicKey() {
  return localStorage.getItem('anthropic_api_key') || '';
}

export function setAnthropicKey(key) {
  localStorage.setItem('anthropic_api_key', key.trim());
}

async function claudeSuggest(trackName, artistName) {
  const key = getAnthropicKey();
  if (!key) return null;

  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `I'm listening to "${trackName}" by ${artistName}. Suggest 5 similar songs. Return ONLY valid JSON array, no markdown: [{"track":"Song Name","artist":"Artist Name"}]`,
      }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']') + 1;
    return JSON.parse(text.slice(start, end));
  } catch {
    return null;
  }
}

async function fallbackSuggest(artistId) {
  try {
    const related = await API.getRelatedArtists(artistId);
    const artists = related?.artists?.slice(0, 3) || [];
    const results = await Promise.all(
      artists.map(a => API.getArtistTopTracks(a.id).then(d => d?.tracks?.[0]).catch(() => null))
    );
    return results.filter(Boolean);
  } catch {
    return [];
  }
}

// Returns up to 5 Spotify track URIs to queue after the current track.
export async function getNextTrackUris(track, artistId) {
  const suggestions = await claudeSuggest(track.name, track.artists?.[0]?.name || '');

  if (suggestions?.length) {
    const uris = [];
    for (const s of suggestions.slice(0, 5)) {
      try {
        const res = await API.search(`${s.track} ${s.artist}`, ['track'], 1);
        const uri = res?.tracks?.items?.[0]?.uri;
        if (uri) uris.push(uri);
      } catch { /* skip */ }
    }
    if (uris.length) return uris;
  }

  // Fallback: related artist top tracks
  const tracks = await fallbackSuggest(artistId);
  return tracks.map(t => t.uri).filter(Boolean);
}
