# Token Radar — build log (radar-2)

Session: subagent f6fa39f8 (started after the competition opened 2026-11-14T10:00:00Z).
Kit: ~/workspace/makefun/token-radar-01-kit/token-radar-01-kit/ (RULES.txt read fully).
Work dir: ~/workspace/makefun/token-radar-01/ (fresh git repo, this session).

## What was built
- `lib/model.ts` — comparables model ("radar-2"), written from scratch in this session.
  Implied value = TVL x category comparable (median mcap/TVL of live protocols in the same
  category, shrunk toward the global median 0.236 with prior weight 4, clamped [0.05, 2.0])
  x growth (clamp change_7d to [-60, 120], weight 0.5) x maturity (0.7 + 0.3 x min(age,1095)/1095,
  unknown age 365d) x chains (1 + 0.02 x min(chains-1, 10)). No protocol name special-cased.
  Board: all 40 watchlist slugs + every other pre-token protocol the watchlist's own rule keeps
  (not CEX/Bridge/Liquid Staking/Liquid Restaking/Restaked BTC, not versioned, not wrapped/staked,
  not exchange-prefixed) = 198 rows. Live view: top 30 live-token protocols by mcap.
  Farm plans: 7 steps per row, category-derived action + depth action, capital from TVL tier
  ($50/$100/$150/$250), hold from age (30/45/60 days), gas from first chain (Ethereum $4-8,
  Solana <$0.05, Bitcoin $1-3, else $0.10-0.50).
- `main.ts` — pipeline: read snapshot, build board, write board.json + data.js, copy dashboard/
  and screenshots/, write dossier.json via vendored buildDossier. Same CLI contract as the kit
  (--input, MAKEFUN_OUTPUT_DIR, --output).
- `dashboard/` — dark "night radar" theme (amber + teal on deep navy), written from scratch:
  header, lede + 4 facts, top-5 spotlight cards, search + category + chain filters, watchlist-only
  toggle, Pre-token/Live tabs, sortable table (rank/name/TVL/7d/age/chains/implied), WATCHLIST
  pills, model panel with the formula + full comparables table, detail drawer with the model
  breakdown and the 7-step farm plan. The page recomputes each row and checks it against
  board.json. No http(s) address anywhere in dashboard files.
- `vendor/makefun-board.ts` — copied from the kit starter (vendored library, the allowed exception).
- `LICENSE` — MIT, written in this session.
- `tools/validate.mjs` — independent gate mirror (re-derives implied values from the snapshot,
  checks every gate row). `tools/capture.mjs` — headless-Chromium screenshot flow (my own;
  reads ~/workspace/makefun/shot-tools/shots.mjs only as a reference for the playwright-core
  setup; needs a `tools/node_modules/playwright-core` symlink to the shot-tools install to run).

## Validation (all in this session)
- `MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json` — 758 protocols,
  40 watchlist, 198 rows (158 early, 30 live set aside). Board top 5: Steakhouse Financial
  $2.19B, Sentora Curator $1.89B, Gauntlet $1.30B, Polymarket International $637M, Nonce $280M.
- Determinism: two runs into out/ and out2/ are byte-identical (`diff -r` clean).
- `node tools/validate.mjs out` — ALL GATE CHECKS PASS: ranks 1..198, implied non-increasing,
  watchlist 40/40, farm steps 7/row, 129-193 chars each, independent implied recompute 0
  mismatches, no http(s) in dashboard, dashboard source 40,434 bytes (< 65,536 dossier text cap,
  so the judge reads the whole source), dossier.json 625,668 bytes (< 1.5 MiB), byte-for-byte
  buildDossier output, board.json 317,953 bytes (< 8 MiB).
- Screenshots (real renders, headless Chromium, 1440x900 JPEG q88, 0 console errors):
  1-board.jpg 142,966 B; 2-detail.jpg 155,754 B (detail recompute agrees, 7 farm steps match
  board.json exactly); 3-filtered.jpg 139,085 B (category=Lending, 16 rows shown).
  All three visually inspected: board, detail drawer and filtered view render correctly.
- `bundle --dry-run` (no bundle written): finds this session
  (sessions/muse-app/f6fa39f8-0eb1-4f7d-86d9-25bd69a90192.jsonl, 30 turns, 128 lines kept).
  It also pulls the parent session and the earlier FPS subagent session as family (the FPS one
  because this build read shot-tools/shots.mjs as reference). For a real bundle the parent must
  still supply: --mcp none (no MCP servers used), --harness-version/--provider/--effort, and
  --muse-usage rows (0 attached at dry-run time; Muse writes usage rows when messages deliver).

## What remains before submission (parent's job)
- Create the public GitHub repo under kiw33 + .makefun/owner.json (wallet
  4En7c17Rpi5Hnw731YWL4YPTApDbzdwuZwFgXCTJNa6K), commit this work, push.
- Run the real bundle (with --muse-usage, --mcp none, harness/provider/effort flags) and
  `check --kit <kit> --repo <repo> --transcripts transcripts.tar.gz`.
- Submit via the kit CLI. Do NOT submit from this subagent session.
