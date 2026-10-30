import { normalizeAvatarProfile } from './avatar-options.js';
import { lanSocketUrl } from './ws-url.js';

function createToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createLanClient(onMessage, onStatus) {
  const token = sessionStorage.getItem('vnr202-lan-token') || createToken();
  sessionStorage.setItem('vnr202-lan-token', token);
  const url = lanSocketUrl();
  let socket = null;
  let name = '';
  let roomNo = null;
  let gender = 'male';
  let avatar = 'male-classic';
  let reconnectTimer = null;
  let closed = false;
  let poseSequence = 0;

  function send(payload) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload.type === 'pose' ? { ...payload, seq: ++poseSequence } : payload));
    }
  }

  function connect(nextName, nextRoomNo = null, profile = {}) {
    name = nextName.trim();
    roomNo = Number.isInteger(nextRoomNo) && nextRoomNo >= 1 && nextRoomNo <= 9999 ? nextRoomNo : null;
    ({ gender, avatar } = normalizeAvatarProfile(profile.gender, profile.avatar));
    if (!name) return;
    closed = false;
    if (socket?.readyState === WebSocket.OPEN) { send({ type: 'hello', token, name, roomNo, gender, avatar }); return; }
    if (socket?.readyState === WebSocket.CONNECTING) return;
    clearTimeout(reconnectTimer);
    onStatus('connecting');
    socket = new WebSocket(url);
    socket.addEventListener('open', () => { onStatus('online'); send({ type: 'hello', token, name, roomNo, gender, avatar }); });
    socket.addEventListener('message', event => {
      try { onMessage(JSON.parse(event.data)); } catch { /* Ignore malformed messages. */ }
    });
    socket.addEventListener('close', () => {
      socket = null;
      onStatus('offline');
      if (!closed) reconnectTimer = window.setTimeout(() => connect(name, roomNo, { gender, avatar }), 3000);
    });
    socket.addEventListener('error', () => { onStatus('offline'); });
  }

  function stop() {
    closed = true;
    clearTimeout(reconnectTimer);
    socket?.close();
  }

  return { connect, send, stop };
}
