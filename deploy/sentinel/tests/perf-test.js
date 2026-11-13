// Load/latency test through nginx (TLS) on the local server. Usage: node perf-test.js [label] [seconds]
// Hits real pages via https://127.0.0.1 with Host: ogenplay.com (so nginx, limits, logging and WAF rules are all included).
const https = require('https');
const label = process.argv[2] || 'run';
const secs = Number(process.argv[3] || 8);
const agent = new https.Agent({ keepAlive: true, maxSockets: 256, rejectUnauthorized: false, servername: 'ogenplay.com' });

function hit(path, ua) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const req = https.get({ host: '127.0.0.1', port: 443, path, agent, headers: { Host: 'ogenplay.com', 'accept-encoding': 'identity', 'user-agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0 Safari/537.36' } }, (res) => {
      let n = 0; res.on('data', (c) => (n += c.length));
      res.on('end', () => resolve({ ms: Number(process.hrtime.bigint() - t0) / 1e6, status: res.statusCode, bytes: n }));
    });
    req.on('error', () => resolve({ ms: 9999, status: 0, bytes: 0 }));
    req.setTimeout(20000, () => { req.destroy(); });
  });
}
async function run(path, conc) {
  const end = Date.now() + secs * 1000; const lat = []; const codes = {}; 
  await Promise.all(Array.from({ length: conc }, async () => {
    while (Date.now() < end) { const r = await hit(path); lat.push(r.ms); codes[r.status] = (codes[r.status] || 0) + 1; }
  }));
  lat.sort((a, b) => a - b);
  const q = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))].toFixed(1);
  console.log(`${label} | ${path.padEnd(26)} c=${String(conc).padStart(2)} rps=${(lat.length / secs).toFixed(0).padStart(5)} p50=${q(0.5).padStart(6)} p95=${q(0.95).padStart(6)} p99=${q(0.99).padStart(6)} codes=${JSON.stringify(codes)}`);
}
(async () => {
  const pages = ['/', '/forum', '/users', '/about', '/api/apps/search?q=waze'];
  for (const p of pages) { await run(p, 1); }
  for (const p of ['/', '/forum', '/api/apps/search?q=waze']) { await run(p, 16); await run(p, 48); }
})();
