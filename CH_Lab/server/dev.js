import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createLanServer } from './lan.js';

const lanPort = Number(process.env.LAN_PORT) || 5174;
const webPort = Number(process.env.WEB_PORT) || 5173;
const vitePath = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));

function lanUrls(port) {
  const urls = [];
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      if ((address.family === 'IPv4' || address.family === 4) && !address.internal) {
        urls.push(`http://${address.address}:${port}`);
      }
    }
  }
  return urls;
}

const classUrls = lanUrls(webPort);
const lan = createLanServer({ port: lanPort });
const vite = spawn(process.execPath, [vitePath, '--host', '0.0.0.0', '--port', String(webPort), '--strictPort'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_LAN_PORT: String(lanPort),
    VITE_ONLINE_BACKEND: 'lan',
    VITE_CLASS_URLS: classUrls.join(','),
  },
});

lan.on('listening', () => {
  console.log('');
  console.log('==============================================');
  console.log('  VNR202 · Di cư 1954 · Rung chuông vàng');
  console.log('  Người chơi (chọn nhóm):');
  if (classUrls.length) classUrls.forEach(url => console.log(`    ${url}`));
  else console.log(`    http://127.0.0.1:${webPort}/`);
  console.log('  Host (máy chiếu):');
  if (classUrls.length) classUrls.forEach(url => console.log(`    ${url.replace(/\/$/, '')}/?host=1`));
  else console.log(`    http://127.0.0.1:${webPort}/?host=1`);
  console.log(`  Máy chủ: cổng ${lanPort}`);
  console.log('==============================================');
  console.log('');
});
lan.on('error', error => { console.error(`Không mở được cổng LAN ${lanPort}:`, error.message); vite.kill(); process.exitCode = 1; });
vite.on('exit', code => { lan.close(); process.exitCode = code || process.exitCode || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { vite.kill(signal); lan.close(); });
}
