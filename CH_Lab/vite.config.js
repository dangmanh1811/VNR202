import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      __HCM_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''),
      __HCM_SUPABASE_KEY__: JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''),
      __HCM_ONLINE_BACKEND__: JSON.stringify(env.VITE_ONLINE_BACKEND || 'lan'),
      __VNR_CLASS_URLS__: JSON.stringify(env.VITE_CLASS_URLS || ''),
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(root, 'index.html'),
          chuong: resolve(root, 'chuong.html'),
        },
      },
    },
    server: {
      allowedHosts: true,
      proxy: {
        '/ws': {
          target: `ws://127.0.0.1:${env.LAN_PORT || env.VITE_LAN_PORT || 5174}`,
          ws: true,
        },
      },
    },
    preview: { allowedHosts: true },
  };
});
