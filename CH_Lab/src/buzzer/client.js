import { lanSocketUrl } from '../ws-url.js';

function createToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function tokenKey(identity) {
  return identity.role === 'host' ? 'vnr202-buzzer-host' : `vnr202-buzzer-group-${identity.groupId}`;
}

function tokenFor(identity) {
  const key = tokenKey(identity);
  const token = sessionStorage.getItem(key) || createToken();
  sessionStorage.setItem(key, token);
  return token;
}

export function createBuzzerClient(onMessage, onStatus) {
  const url = lanSocketUrl();
  let socket = null;
  let identity = { role: 'host', groupId: null, name: '' };
  let reconnectTimer = null;
  let closed = false;

  function send(payload) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ client: 'buzzer', ...payload }));
  }

  function hello() {
    send({ type: 'hello', ...identity, token: tokenFor(identity) });
  }

  function connect(next) {
    identity = next;
    closed = false;
    if (socket?.readyState === WebSocket.OPEN) {
      hello();
      return;
    }
    if (socket?.readyState === WebSocket.CONNECTING) return;
    clearTimeout(reconnectTimer);
    onStatus('connecting');
    socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      onStatus('online');
      hello();
    });
    socket.addEventListener('message', event => {
      try { onMessage(JSON.parse(event.data)); } catch { /* ignore */ }
    });
    socket.addEventListener('close', () => {
      socket = null;
      onStatus('offline');
      if (!closed) reconnectTimer = window.setTimeout(() => connect(identity), 1200);
    });
    socket.addEventListener('error', () => onStatus('offline'));
  }

  function stop() {
    closed = true;
    clearTimeout(reconnectTimer);
    socket?.close();
  }

  return { connect, send, stop };
}
