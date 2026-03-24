// Gearbox — Spotify Auth (PKCE)
const CLIENT_ID = '0445b9a6e9b74a1aaabafc77c991efba';
const REDIRECT_URI = 'http://localhost:5500/';
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
].join(' ');

function generateRandomString(len) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => charset[b % charset.length]).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePKCE() {
  const verifier = generateRandomString(128);
  const hashed = await sha256(verifier);
  const challenge = base64urlencode(hashed);
  return { verifier, challenge };
}

export async function login() {
  const { verifier, challenge } = await generatePKCE();
  localStorage.setItem('pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    show_dialog: 'true',
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(code) {
  const verifier = localStorage.getItem('pkce_verifier');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new Error('Token exchange failed');
  const data = await res.json();
  storeTokens(data);
  return data;
}

export async function refreshToken() {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) { logout(); return null; }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });
  if (!res.ok) { logout(); return null; }
  const data = await res.json();
  storeTokens(data);
  return data.access_token;
}

function storeTokens(data) {
  localStorage.setItem('access_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
  const expiresAt = Date.now() + data.expires_in * 1000;
  localStorage.setItem('expires_at', expiresAt);
}

export async function getAccessToken() {
  const expiresAt = parseInt(localStorage.getItem('expires_at') || '0');
  if (Date.now() > expiresAt - 60000) {
    return await refreshToken();
  }
  return localStorage.getItem('access_token');
}

export function isLoggedIn() {
  return !!localStorage.getItem('access_token') && !!localStorage.getItem('refresh_token');
}

export function logout() {
  localStorage.clear();
  window.location.reload();
}
