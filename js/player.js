// Gearbox — Web Playback SDK + Controls
import * as API from './spotify.js';

let player = null;
let deviceId = null;
let onStateChange = null;
let shuffleState = false;
let repeatMode = 'off'; // off → context → track

export function setStateChangeCallback(fn) {
  onStateChange = fn;
}

export function getDeviceId() { return deviceId; }
export function getShuffleState() { return shuffleState; }
export function getRepeatMode() { return repeatMode; }

export function syncShuffleState(val) {
  shuffleState = !!val;
}

export function syncRepeatMode(val) {
  const modes = ['off', 'context', 'track'];
  repeatMode = modes[val] ?? 'off';
}

export function initPlayer(token) {
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      player = new Spotify.Player({
        name: 'Gearbox',
        getOAuthToken: async cb => {
          const { getAccessToken } = await import('./auth.js');
          cb(await getAccessToken());
        },
        volume: 0.7,
      });

      player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        API.transferPlayback(device_id);
        resolve(device_id);
      });

      player.addListener('not_ready', () => { deviceId = null; });

      player.addListener('player_state_changed', state => {
        if (onStateChange) onStateChange(state);
      });

      player.addListener('authentication_error', () => {
        console.error('Spotify SDK auth error');
      });

      player.addListener('account_error', () => {
        console.warn('Spotify Premium required for playback');
        showToast('Spotify Premium required for playback', 'warning');
      });

      player.connect();
    };

    // Load SDK script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(script);
  });
}

export async function play(uri, contextUri = null) {
  return API.playTrack(uri, contextUri, deviceId);
}

export async function togglePlay() {
  if (!player) return;
  await player.togglePlay();
}

export async function next() {
  if (!player) return;
  await player.nextTrack();
}

export async function prev() {
  if (!player) return;
  await player.previousTrack();
}

export async function setVolume(val) {
  if (!player) return;
  await player.setVolume(val);
  await API.setVolume(val * 100);
}

export async function seekTo(ms) {
  if (!player) return;
  await player.seek(ms);
}

export async function getCurrentState() {
  if (!player) return null;
  return player.getCurrentState();
}

export async function toggleShuffle() {
  shuffleState = !shuffleState;
  await API.toggleShuffle(shuffleState);
  return shuffleState;
}

export async function cycleRepeat() {
  const modes = ['off', 'context', 'track'];
  const idx = (modes.indexOf(repeatMode) + 1) % modes.length;
  repeatMode = modes[idx];
  await API.toggleRepeat(repeatMode);
  return repeatMode;
}

export async function addToQueue(uri) {
  return API.addToQueue(uri);
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast--${type} visible`;
  setTimeout(() => t.classList.remove('visible'), 3500);
}
