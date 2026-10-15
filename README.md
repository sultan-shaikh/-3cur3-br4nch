# Cisco Secure Branch Architect (v2)

All-inclusive Meraki (LAN, WAN/SD-WAN, security, WiFi, camera, IoT) + Cisco Secure Access / Secure Connect design, BoM, TCO and proposal tool.
AI scans diagrams, writes the design narrative and proposes Secure Access SKUs. **Every price comes from your CSV price book.** Unmatched lines are excluded and flagged, never priced by the AI.

## Deploy (GitHub web upload → Netlify)
1. Unzip first. Create a new GitHub repo and upload the **contents of the unzipped folder**, keeping the folders: `public/`, `netlify/`, `tests/`, plus `netlify.toml`, `package.json`, `README.md`.
2. Netlify: Add new site → Import from GitHub → pick the repo. Leave build command empty.
3. Site configuration → Environment variables: `GEMINI_API_KEY` (your key) and `ACCESS_CODE` (passphrase users type to unlock the tool). Optional: `UPSTREAM_TIMEOUT_MS` (default 25000).
4. Deploys → Trigger deploy → Clear cache and deploy site.

## Price book
CSV: `SKU, Description, HardwarePrice, Price_1Y, Price_3Y, Price_5Y`. Licence SKUs with -1Y/-1YR/-3YR/-5YR suffixes are merged. Term prices are total contract prices. 3Y/5Y are estimated (30%/50% off) only if the box is ticked and are marked `*`.

## Tuning
Sizing rules, MX thresholds and default models are editable in the UI (step 3b). Licence-matching patterns live in `public/assets/js/core.js` (`CATALOGUE`). If lines appear in the "no matching SKU" box, adjust the model names/patterns.

## Tests
`node tests/core.test.js`, `node tests/proxy.test.js`, `node tests/e2e.js` (Playwright).
