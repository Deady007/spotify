// Gearbox — Claude-powered Track Suggestions
// Claude API calls proxied through /api/suggest (Vercel serverless function).
// Set ANTHROPIC_API_KEY in Vercel project env vars — never exposed to the browser.
import * as API from './spotify.js';

const MODEL = 'claude-opus-4-8';

async function callClaude(prompt) {
  try {
    const res = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
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
    const artists = related?.artists?.slice(0, 5) || [];
    const results = await Promise.all(
      artists.map(a => API.getArtistTopTracks(a.id).then(d => d?.tracks?.[0]).catch(() => null))
    );
    return results.filter(Boolean);
  } catch {
    return [];
  }
}

// Returns full Spotify track objects for display in the queue panel.
// count: how many tracks to suggest (default 10).
export async function generateQueueSuggestions(track, artistId, count = 10) {
  const trackName = track.name;
  const artistName = track.artists?.[0]?.name || '';
  const genre = track.artists?.[0]?.genres?.[0] || '';

  const prompt = `I'm listening to "${trackName}" by ${artistName}${genre ? ` (${genre})` : ''}.
Build me a smart queue of ${count} songs that flow naturally after this track — mix similar vibes, same energy, and a few surprising-but-fitting picks.
Return ONLY a valid JSON array, no markdown or explanation:
[{"track":"Song Name","artist":"Artist Name"}]`;

  const suggestions = await callClaude(prompt);

  if (suggestions?.length) {
    const tracks = [];
    for (const s of suggestions.slice(0, count)) {
      try {
        const res = await API.search(`${s.track} ${s.artist}`, ['track'], 1);
        const t = res?.tracks?.items?.[0];
        if (t) tracks.push(t);
      } catch { /* skip */ }
    }
    if (tracks.length) return { source: 'claude', tracks };
  }

  // Fallback: related artists top tracks
  const tracks = await fallbackSuggest(artistId);
  return { source: 'fallback', tracks };
}

// Lightweight URI-only version used by gapless play (fires 10s before end).
export async function getNextTrackUris(track, artistId) {
  const result = await generateQueueSuggestions(track, artistId, 5);
  return result.tracks.map(t => t.uri).filter(Boolean);
}
