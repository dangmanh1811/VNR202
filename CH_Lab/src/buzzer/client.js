import { createClient } from '@supabase/supabase-js';

export function createBuzzerClient(onState, onStatus, onError) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const supabase = url && key ? createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) : null;
  let identity = null;
  let latest = null;
  let channel = null;
  let heartbeat = null;
  let refreshing = null;
  let refreshAgain = false;

  function receive(next) {
    if (latest && next.revision < latest.revision) return;
    latest = next;
    onStatus('online');
    onState(next);
  }

  async function rpc(name, args) {
    if (!supabase) throw new Error('Chưa cấu hình Supabase. Cần VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY.');
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }

  function refresh() {
    if (!identity) return Promise.resolve();
    if (refreshing) { refreshAgain = true; return refreshing; }
    refreshing = rpc('vnr202_state', { p_token: identity.token })
      .then(receive)
      .catch(error => {
        onStatus('offline');
        if (/Phiên đã hết/.test(error.message)) {
          stop();
          sessionStorage.removeItem('vnr202-session');
          onError(error.message, true);
        }
      })
      .finally(() => {
        refreshing = null;
        if (refreshAgain) { refreshAgain = false; refresh(); }
      });
    return refreshing;
  }

  function listen() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = window.setInterval(refresh, 5000);
    if (!channel) {
      channel = supabase.channel('vnr202-game')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vnr202_events' }, refresh)
        .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    }
  }

  async function connect(next) {
    onStatus('connecting');
    const tokenKey = next.role === 'host' ? 'vnr202-host-token' : `vnr202-group-${next.groupId}-token`;
    const token = sessionStorage.getItem(tokenKey) || crypto.randomUUID();
    const data = await rpc('vnr202_join', {
      p_token: token, p_role: next.role, p_group_id: next.groupId || null,
      p_name: next.name || '', p_host_key: next.hostKey || '',
    });
    identity = { token, role: next.role, groupId: next.groupId || null };
    sessionStorage.setItem(tokenKey, token);
    sessionStorage.setItem('vnr202-session', JSON.stringify(identity));
    receive(data);
    listen();
  }

  async function resume() {
    try {
      const saved = JSON.parse(sessionStorage.getItem('vnr202-session') || 'null');
      if (!saved || !['host', 'group'].includes(saved.role)) return false;
      // An explicit link to another role/group should still show its join screen.
      const params = new URLSearchParams(location.search);
      if (params.has('host') && saved.role !== 'host') return false;
      if (params.has('nhom') && Number(params.get('nhom')) !== saved.groupId) return false;
      const data = await rpc('vnr202_state', { p_token: saved.token });
      identity = saved;
      receive(data);
      listen();
      return true;
    } catch {
      sessionStorage.removeItem('vnr202-session');
      return false;
    }
  }

  async function send(action, round, activeGroup) {
    if (!identity) throw new Error('Hãy chọn nhóm trước khi bấm chuông.');
    const data = await rpc('vnr202_action', {
      p_token: identity.token, p_action: action, p_round: round, p_active_group: activeGroup,
    });
    receive(data);
  }

  function stop() {
    clearInterval(heartbeat);
    heartbeat = null;
    if (channel) supabase.removeChannel(channel);
    channel = null;
    identity = null;
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  return { connect, resume, send, stop, refresh };
}
