import { createClient } from '@supabase/supabase-js';
import { normalizeAvatarProfile } from './avatar-options.js';
import { SPAWN_POSITION } from './classroom-config.js';

function friendlyError(error) {
  const message = error?.message || String(error);
  if (/anonymous|signup|signups|disabled/i.test(message)) return 'Supabase chưa bật Anonymous Sign-Ins trong Auth Settings.';
  if (/hcm_join_profile|hcm_reset_exam/i.test(message)) return 'Supabase chưa có danh sách avatar hoặc chức năng reset. Hãy chạy lại migration 20261006_avatar_profiles.sql.';
  if (/hcm_join_room/i.test(message)) return 'Supabase chưa có cơ chế chọn phòng. Hãy chạy migration 20261005_room_selection.sql.';
  if (/Could not find the function|schema cache|404|hcm_join/i.test(message)) return 'Chưa cài migration SQL cho lớp học trên Supabase.';
  return message;
}

export function createSupabaseOnlineClient(url, key, onMessage, onStatus) {
  const supabase = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  let desiredName = '';
  let desiredRoom = null;
  let desiredGender = 'male';
  let desiredAvatar = 'male-classic';
  let userId = null;
  let roomNo = null;
  let roomChannel = null;
  let globalChannel = null;
  let latestState = null;
  let peers = new Map();
  let presenceReady = false;
  let currentPose = { ...SPAWN_POSITION, vx: 0, vz: 0 };
  let lastPose = null;
  let lastPoseAt = 0;
  let lastChatAt = 0;
  let poseSequence = 0;
  let heartbeatTimer = null;
  let pollTimer = null;
  let retryTimer = null;
  let refreshing = false;
  let joining = false;
  let stopped = false;
  let connected = false;
  let resettingChannels = false;
  let lastPresenceAt = 0;
  let reportedResultRound = null;
  let seatActionPending = false;

  const safeVelocity = value => Number.isFinite(value) ? Math.max(-5, Math.min(5, value)) : 0;

  async function rpc(functionName, args = {}) {
    const { data, error } = await supabase.rpc(functionName, args);
    if (error) throw error;
    return data;
  }

  function report(error) { onMessage({ type: 'error', message: friendlyError(error) }); }

  function roomPlayers() {
    if (!presenceReady) return latestState?.players || [];
    const databasePlayers = new Map((latestState?.players || []).map(player => [player.id, player]));
    const list = [...peers.values()].map(player => {
      const saved = databasePlayers.get(player.id);
      if (!saved) return player;
      if (player.id === userId || saved.seatId !== player.seatId) return saved;
      return { ...saved, x: player.x, z: player.z, rotation: player.rotation,
        vx: player.vx ?? 0, vz: player.vz ?? 0 };
    });
    if (latestState?.me && !list.some(player => player.id === userId)) {
      const own = latestState.players.find(player => player.id === userId);
      if (own) list.push(own);
    }
    return list;
  }

  function emitPlayers() { onMessage({ type: 'players', players: roomPlayers() }); }

  function syncPresence() {
    if (!roomChannel) return;
    const next = new Map();
    for (const [id, metas] of Object.entries(roomChannel.presenceState())) {
      const meta = metas.at(-1);
      if (!meta || !meta.id) continue;
      const old = peers.get(id);
      const profile = normalizeAvatarProfile(meta.gender, meta.avatar);
      next.set(id, {
        id: meta.id, name: meta.name, role: meta.role,
        gender: profile.gender, avatar: profile.avatar,
        seatId: meta.seatId ?? null,
        x: old && old.seatId === (meta.seatId ?? null) ? old.x : meta.x ?? SPAWN_POSITION.x,
        z: old && old.seatId === (meta.seatId ?? null) ? old.z : meta.z ?? SPAWN_POSITION.z,
        rotation: old && old.seatId === (meta.seatId ?? null) ? old.rotation : meta.rotation ?? SPAWN_POSITION.rotation,
        vx: old && old.seatId === (meta.seatId ?? null) ? old.vx ?? 0 : meta.vx ?? 0,
        vz: old && old.seatId === (meta.seatId ?? null) ? old.vz ?? 0 : meta.vz ?? 0,
      });
    }
    peers = next;
    presenceReady = true;
    if (connected) emitPlayers();
  }

  async function trackPresence() {
    if (!roomChannel || !latestState?.me || !connected) return;
    const me = latestState.me;
    const own = latestState.players.find(player => player.id === userId);
    if (own?.seatId !== null && own?.seatId !== undefined) currentPose = { x: own.x, z: own.z, rotation: own.rotation, vx: 0, vz: 0 };
    await roomChannel.track({
      id: userId, name: me.name, role: me.role, gender: me.gender, avatar: me.avatar, seatId: me.seatId,
      x: currentPose.x, z: currentPose.z, rotation: currentPose.rotation,
      vx: currentPose.vx, vz: currentPose.vz,
    });
    lastPresenceAt = Date.now();
  }

  function consumeState(data, previousExam = latestState?.exam) {
    if (!data?.me || !data?.exam) return;
    if (latestState?.serverNow && data.serverNow < latestState.serverNow) return;
    latestState = data;
    onMessage({ ...data, type: 'state', players: roomPlayers() });
    if (data.exam.phase === 'active' && data.me.eligible && !data.me.submitted && data.questions?.length) {
      onMessage({ type: 'exam_open', round: data.exam.round, serverNow: data.serverNow,
        startedAt: data.exam.startedAt, endsAt: data.exam.endsAt, questions: data.questions });
    }
    if (data.me.submitted && reportedResultRound !== data.exam.round) {
      reportedResultRound = data.exam.round;
      onMessage({ type: 'exam_result', round: data.exam.round,
        row: data.exam.rankings.find(row => row.id === userId) });
    }
    if (previousExam?.phase === 'active' && data.exam.phase === 'finished') {
      onMessage({ type: 'exam_finished', round: data.exam.round, rankings: data.exam.rankings });
    }
    if (previousExam && previousExam.phase !== 'idle' && data.exam.phase === 'idle') {
      onMessage({ type: 'exam_reset', round: data.exam.round });
    }
  }

  async function refresh() {
    if (refreshing || !userId || stopped) return;
    refreshing = true;
    try { consumeState(await rpc('hcm_state')); }
    catch (error) {
      if (/hết hạn|vào lại/i.test(error.message || '')) scheduleRetry(1000);
      else report(error);
    } finally { refreshing = false; }
  }

  function broadcastGlobal() {
    globalChannel?.send({ type: 'broadcast', event: 'state-changed', payload: { at: Date.now() } });
  }

  function scheduleRetry(delay = 5000) {
    if (retryTimer || stopped) return;
    connected = false;
    onStatus('offline');
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect(desiredName, desiredRoom, { gender: desiredGender, avatar: desiredAvatar });
    }, delay);
  }

  function subscribe(channel) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => { if (!settled) { settled = true; reject(new Error('Kết nối Realtime quá thời gian chờ.')); } }, 12000);
      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED' && !settled) { settled = true; clearTimeout(timer); resolve(); }
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          if (!settled) { settled = true; clearTimeout(timer); reject(error || new Error('Kênh Realtime bị ngắt.')); }
          else if (!resettingChannels) scheduleRetry();
        }
      });
    });
  }

  async function ensureChannels(nextRoomNo) {
    if (roomNo !== nextRoomNo && roomChannel) {
      await supabase.removeChannel(roomChannel);
      roomChannel = null; peers = new Map(); presenceReady = false;
    }
    roomNo = nextRoomNo;
    if (!globalChannel) {
      globalChannel = supabase.channel('hcm-global', { config: { private: true } })
        .on('broadcast', { event: 'state-changed' }, () => refresh());
      await subscribe(globalChannel);
    }
    if (!roomChannel) {
      roomChannel = supabase.channel(`hcm-room-${roomNo}`, {
        config: { private: true, presence: { key: userId }, broadcast: { self: false } },
      })
        .on('presence', { event: 'sync' }, syncPresence)
        .on('broadcast', { event: 'pose' }, ({ payload }) => {
          const peer = peers.get(payload?.id);
          if (!peer || peer.seatId !== null || payload.id === userId || ![payload.x, payload.z, payload.rotation].every(Number.isFinite)) return;
          peer.x = payload.x; peer.z = payload.z; peer.rotation = payload.rotation;
          peer.vx = safeVelocity(payload.vx);
          peer.vz = safeVelocity(payload.vz);
          onMessage({ type: 'pose', id: payload.id, x: payload.x, z: payload.z, rotation: payload.rotation,
            vx: peer.vx, vz: peer.vz, seq: payload.seq });
        })
        .on('broadcast', { event: 'chat' }, ({ payload }) => {
          const sender = peers.get(payload?.id) || latestState?.players?.find(player => player.id === payload?.id);
          const text = typeof payload?.text === 'string' ? payload.text.trim().slice(0, 200) : '';
          if (!sender || sender.id === userId || !text) return;
          onMessage({ type: 'chat', id: sender.id, name: sender.name, text,
            sentAt: Number.isFinite(payload.sentAt) ? payload.sentAt : Date.now(), messageId: payload.messageId });
        })
        .on('broadcast', { event: 'seat-changed' }, () => refresh());
      await subscribe(roomChannel);
    }
  }

  async function resetChannels() {
    resettingChannels = true;
    const channels = [roomChannel, globalChannel].filter(Boolean);
    roomChannel = null; globalChannel = null; peers = new Map(); presenceReady = false;
    try { await Promise.allSettled(channels.map(channel => supabase.removeChannel(channel))); }
    finally { resettingChannels = false; }
  }

  function startIntervals() {
    clearInterval(heartbeatTimer); clearInterval(pollTimer);
    heartbeatTimer = window.setInterval(async () => {
      if (!userId || stopped) return;
      try {
        await rpc('hcm_touch', { p_x: currentPose.x, p_z: currentPose.z, p_rotation: currentPose.rotation });
        if (Date.now() - lastPresenceAt > 45000) await trackPresence();
      } catch (error) { report(error); scheduleRetry(); }
    }, 15000);
    pollTimer = window.setInterval(refresh, 4000);
  }

  async function connect(nextName, nextRoomNo = null, profile = {}) {
    const previousProfile = latestState?.me
      ? { gender: latestState.me.gender, avatar: latestState.me.avatar }
      : { gender: desiredGender, avatar: desiredAvatar };
    desiredName = nextName.trim();
    desiredRoom = Number.isInteger(nextRoomNo) && nextRoomNo >= 1 && nextRoomNo <= 9999 ? nextRoomNo : null;
    ({ gender: desiredGender, avatar: desiredAvatar } = normalizeAvatarProfile(profile.gender, profile.avatar));
    if (!desiredName || joining || stopped) return;
    const wasConnected = connected;
    let joinedRoom = false;
    clearTimeout(retryTimer); retryTimer = null;
    joining = true;
    onStatus('connecting');
    try {
      if (!connected && (roomChannel || globalChannel)) await resetChannels();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      let user = sessionData.session?.user;
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        user = data.user;
      }
      userId = user.id;
      const state = await rpc('hcm_join_profile', {
        p_name: desiredName, p_room: desiredRoom, p_gender: desiredGender, p_avatar: desiredAvatar,
      });
      joinedRoom = true;
      const previousExam = latestState?.exam;
      latestState = state;
      const own = state.players.find(player => player.id === userId);
      currentPose = own
        ? { x: own.x, z: own.z, rotation: own.rotation, vx: 0, vz: 0 }
        : { ...SPAWN_POSITION, vx: 0, vz: 0 };
      lastPose = null;
      await ensureChannels(state.me.roomNo);
      connected = true;
      await trackPresence();
      onStatus('online');
      onMessage({ type: 'welcome', id: userId, role: state.me.role, name: state.me.name,
        gender: state.me.gender, avatar: state.me.avatar,
        roomNo: state.me.roomNo, serverNow: state.serverNow, examMinutes: 15 });
      consumeState(state, previousExam);
      startIntervals();
      broadcastGlobal();
    } catch (error) {
      report(error);
      if (wasConnected && !joinedRoom && roomChannel && globalChannel) {
        desiredRoom = roomNo;
        ({ gender: desiredGender, avatar: desiredAvatar } = normalizeAvatarProfile(previousProfile.gender, previousProfile.avatar));
        connected = true;
        onStatus('online');
      } else {
        connected = false;
        await resetChannels();
        if (!/đủ 10 người|Số phòng|nhập tên|Giảng viên đã đăng nhập/i.test(error?.message || '')) scheduleRetry();
        else onStatus('offline');
      }
    } finally { joining = false; }
  }

  async function performAction(message) {
    const seatAction = message.type === 'sit' || message.type === 'stand';
    if (seatAction && seatActionPending) return;
    if (seatAction) seatActionPending = true;
    try {
      if (seatAction) {
        // The database pose is refreshed every 15 seconds. Validate a seat against
        // the position at the moment the player asks to sit.
        if (message.type === 'sit' && latestState?.me?.seatId == null) {
          const pose = { ...currentPose };
          await rpc('hcm_touch', { p_x: pose.x, p_z: pose.z, p_rotation: pose.rotation });
        }
        const data = await rpc(message.type === 'sit' ? 'hcm_sit' : 'hcm_stand', message.type === 'sit' ? { p_seat: message.seatId } : {});
        const own = data.players.find(player => player.id === userId);
        if (own) currentPose = { x: own.x, z: own.z, rotation: own.rotation, vx: 0, vz: 0 };
        consumeState(data);
        await trackPresence();
        roomChannel?.send({ type: 'broadcast', event: 'seat-changed', payload: {} });
        broadcastGlobal();
      } else if (message.type === 'start_exam' || message.type === 'finish_exam' || message.type === 'reset_exam') {
        const functionName = message.type === 'start_exam'
          ? 'hcm_start_exam'
          : message.type === 'finish_exam' ? 'hcm_finish_exam' : 'hcm_reset_exam';
        consumeState(await rpc(functionName));
        broadcastGlobal();
      } else if (message.type === 'submit_exam') {
        consumeState(await rpc('hcm_submit_exam', { p_answers: message.answers }));
        broadcastGlobal();
      }
    } catch (error) { report(error); }
    finally { if (seatAction) seatActionPending = false; }
  }

  function send(message) {
    if (message.type === 'pose') {
      if (![message.x, message.z, message.rotation].every(Number.isFinite)) return;
      currentPose = {
        x: message.x, z: message.z, rotation: message.rotation,
        vx: safeVelocity(message.vx),
        vz: safeVelocity(message.vz),
      };
      const now = performance.now();
      const poseInterval = 100;
      if (!connected || !roomChannel || now - lastPoseAt < poseInterval) return;
      if (lastPose && Math.hypot(message.x - lastPose.x, message.z - lastPose.z) < .025 &&
          Math.abs(message.rotation - lastPose.rotation) < .04 &&
          Math.hypot(currentPose.vx - lastPose.vx, currentPose.vz - lastPose.vz) < .08) return;
      lastPose = currentPose; lastPoseAt = now;
      roomChannel.send({ type: 'broadcast', event: 'pose', payload: { id: userId, seq: ++poseSequence, ...currentPose } });
    } else if (message.type === 'chat') {
      const text = typeof message.text === 'string' ? message.text.trim().slice(0, 200) : '';
      if (!connected || !roomChannel || !latestState?.me || !text) return;
      const sentAt = Date.now();
      if (sentAt - lastChatAt < 300) return;
      lastChatAt = sentAt;
      const payload = { id: userId, text, sentAt,
        messageId: crypto.randomUUID?.() || `${userId}:${sentAt}` };
      onMessage({ type: 'chat', ...payload, name: latestState.me.name });
      roomChannel.send({ type: 'broadcast', event: 'chat', payload });
    } else if (userId) performAction(message);
  }

  function stop() {
    stopped = true;
    connected = false;
    clearInterval(heartbeatTimer); clearInterval(pollTimer); clearTimeout(retryTimer);
    if (roomChannel) supabase.removeChannel(roomChannel);
    if (globalChannel) supabase.removeChannel(globalChannel);
    if (userId) supabase.rpc('hcm_leave');
  }

  return { connect, send, stop };
}
