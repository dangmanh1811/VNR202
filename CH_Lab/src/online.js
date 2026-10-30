import { createLanClient } from './lan.js';
import { createSupabaseOnlineClient } from './supabase-online.js';

export function createOnlineClient(onMessage, onStatus) {
  if (__HCM_ONLINE_BACKEND__ === 'lan') return createLanClient(onMessage, onStatus);
  if (!__HCM_SUPABASE_URL__ || !__HCM_SUPABASE_KEY__) {
    queueMicrotask(() => onMessage({ type: 'error', message: 'Thiếu VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY.' }));
    return { connect() { onStatus('offline'); }, send() {}, stop() {} };
  }
  return createSupabaseOnlineClient(__HCM_SUPABASE_URL__, __HCM_SUPABASE_KEY__, onMessage, onStatus);
}
