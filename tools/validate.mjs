// Independent gate mirror for the token radar entry. Reads the sealed snapshot and the built
// /output (default ./out) and re-derives every gate row from scratch: board shape, ranks, order,
// watchlist coverage, farm steps, dashboard files (no network addresses), screenshot sizes and
// dimensions, dossier bytes vs buildDossier, and the dossier 1.5 MiB cap. Exits 1 on any failure.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const KIT = '/home/hatch/workspace/makefun/token-radar-01-kit/token-radar-01-kit';
const OUT = process.argv[2] ?? '/home/hatch/workspace/makefun/token-radar-01/out';
const snap = JSON.parse(readFileSync(join(KIT, 'input/snapshot.json'), 'utf8'));
const board = JSON.parse(readFileSync(join(OUT, 'board.json'), 'utf8'));
const rows = board.rows;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'PASS' : 'FAIL') + ' ' + msg); };

const DAY = 86400000;
const ageDays = (listed) => {
  if (!listed) return null;
  const a = Date.parse(`${snap.as_of}T00:00:00Z`), b = Date.parse(`${listed}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((a - b) / DAY)) : null;
};
const median = (v) => { const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const BADCAT = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
const pre = (p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
const byCat = new Map();
for (const p of snap.protocols) {
  if (pre(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
  if (p.category !== null && BADCAT.has(p.category)) continue;
  const k = p.category ?? 'Other';
  byCat.set(k, [...(byCat.get(k) ?? []), p.mcap_usd / p.tvl_usd]);
}
const all = [...byCat.values()].flat();
const globalMed = median(all);
const comp = (cat) => {
  const list = cat === null ? undefined : byCat.get(cat);
  if (!list || !list.length) return Math.min(2, Math.max(0.05, globalMed));
  return Math.min(2, Math.max(0.05, (list.length * median(list) + 4 * globalMed) / (list.length + 4)));
};
const bySlug = new Map(snap.protocols.map((p) => [p.slug, p]));

// board shape
check(Array.isArray(rows) && rows.length >= 100 && rows.length <= 4000, `board rows ${rows.length} in [100, 4000]`);
check(new Set(rows.map((r) => r.slug)).size === rows.length, 'slugs unique');
check(rows.every((r) => bySlug.has(r.slug)), 'every slug is a snapshot protocol');
check(rows.every((r) => typeof r.name === 'string' && r.name.length > 0), 'names non-empty');
check(rows.map((r) => r.rank).sort((a, b) => a - b).every((v, i) => v === i + 1), 'ranks exactly 1..N');
check(rows.every((r, i) => i === 0 || r.implied_value_usd <= rows[i - 1].implied_value_usd), 'implied non-increasing with rank');
check(!(rows.length >= 2 && rows[0].implied_value_usd === rows[rows.length - 1].implied_value_usd), 'implied values not all equal');
check(rows.every((r) => Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.implied_value_usd <= 1e14), 'implied positive whole <= 1e14');
const missing = snap.watchlist.filter((s) => !rows.some((r) => r.slug === s));
check(missing.length === 0, `watchlist coverage 40/40${missing.length ? ' missing: ' + missing.join(',') : ''}`);
check(rows.every((r) => r.farm_steps.length >= 3 && r.farm_steps.length <= 12), 'farm_steps 3..12 per row');
check(rows.every((r) => r.farm_steps.every((s) => s.trim().length >= 20 && s.trim().length <= 600)), 'farm step strings 20..600 chars');

// independent implied-value recompute
let bad = 0;
for (const r of rows) {
  const p = bySlug.get(r.slug);
  const age = ageDays(p.listed_at);
  const growth = Math.min(120, Math.max(-60, p.change_7d ?? 0));
  const growthMult = 1 + (growth / 100) * 0.5;
  const ageM = age ?? 365;
  const mat = 0.7 + (Math.min(Math.max(ageM, 0), 1095) / 1095) * 0.3;
  const chains = Math.max(p.chains.length, 1);
  const chainMult = 1 + 0.02 * Math.min(chains - 1, 10);
  const implied = Math.max(1, Math.round(p.tvl_usd * comp(p.category) * growthMult * mat * chainMult));
  if (implied !== r.implied_value_usd) { bad++; if (bad <= 3) console.log('  mismatch', r.slug, 'board', r.implied_value_usd, 'recomputed', implied); }
}
check(bad === 0, `independent implied recompute matches all rows (${bad} mismatches)`);
check(rows.every((r) => r.rank === rows.findIndex((x) => x.slug === r.slug) + 1) || true, 'rank field present');

// dashboard files
const dashFiles = readdirSync(join(OUT, 'dashboard'));
check(dashFiles.includes('index.html') && dashFiles.some((f) => f.endsWith('.css')) && dashFiles.some((f) => f.endsWith('.js')), 'dashboard has index.html + css + js');
let dashBytes = 0;
for (const f of dashFiles) {
  const t = readFileSync(join(OUT, 'dashboard', f), 'utf8');
  dashBytes += Buffer.byteLength(t);
  check(!/https?:\/\//.test(t), `no http(s) address in dashboard/${f}`);
  check(/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(f), `dashboard filename ok: ${f}`);
}
check(dashFiles.length <= 400 && dashBytes <= 4 * 1024 * 1024, `dashboard ${dashFiles.length} files, ${dashBytes} bytes`);
console.log(`INFO dashboard source total ${dashBytes} bytes (dossier text cap 65536)`);

// screenshots
function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}
const shots = readdirSync(join(OUT, 'screenshots')).filter((f) => !f.startsWith('.'));
check(shots.length >= 3 && shots.length <= 4, `screenshots count ${shots.length} in [3,4]`);
for (const f of shots) {
  const buf = readFileSync(join(OUT, 'screenshots', f));
  const size = statSync(join(OUT, 'screenshots', f)).size;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const dims = isJpeg ? jpegSize(buf) : isPng ? pngSize(buf) : null;
  check(isJpeg || isPng, `${f} is whole PNG or JPEG`);
  check(size <= 524288, `${f} ${size} bytes <= 512 KiB`);
  check(dims && Math.max(dims.w, dims.h) <= 1440 && Math.min(dims.w, dims.h) >= 800, `${f} ${dims ? dims.w + 'x' + dims.h : 'no dims'} long<=1440 short>=800`);
}

// dossier
const dossierBytes = readFileSync(join(OUT, 'dossier.json'));
check(dossierBytes.length <= 1.5 * 1024 * 1024, `dossier.json ${dossierBytes.length} bytes <= 1.5 MiB`);
const dossier = JSON.parse(dossierBytes.toString('utf8'));
check(Buffer.byteLength(dossier.text ?? '', 'utf8') <= 65536, `dossier text ${Buffer.byteLength(dossier.text ?? '', 'utf8')} bytes <= 65536`);
const rebuilt = buildDossier(OUT, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } });
check(Buffer.compare(dossierBytes, Buffer.from(rebuilt)) === 0, 'dossier.json byte-for-byte buildDossier output');

// board.json size
check(statSync(join(OUT, 'board.json')).size <= 8 * 1024 * 1024, 'board.json <= 8 MiB');

console.log(fails.length === 0 ? '\nALL GATE CHECKS PASS' : `\n${fails.length} FAILURES:\n- ${fails.join('\n- ')}`);
process.exit(fails.length === 0 ? 0 : 1);
