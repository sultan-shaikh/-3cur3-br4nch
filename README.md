# Cisco Secure Branch Architect

Meraki (MX, MS/Catalyst, MR, MV, MT) + Cisco Secure Access / Secure Connect design and BoM tool.
AI writes the design narrative and proposes Secure Access SKUs. **Every price comes from your CSV price book.** AI-proposed SKUs not in the book are excluded and flagged.

## Deploy (GitHub web upload → Netlify)
1. Create a new GitHub repo. Upload the **contents of this folder**, keeping the folders: `public/`, `netlify/`, `netlify.toml`, `package.json`. (Drag the unzipped files and folders onto the repo's "Upload files" page.)
2. In Netlify: Add new site → Import from GitHub → pick the repo. Leave build command empty. Publish dir and functions dir come from `netlify.toml`.
3. Site configuration → Environment variables → add:
   - `GEMINI_API_KEY` = your Gemini key
   - `ACCESS_CODE` = a passphrase you choose (users type this to unlock the tool)
   - optional `UPSTREAM_TIMEOUT_MS` (default 25000)
4. Deploys → Trigger deploy → Clear cache and deploy site.
If either variable is missing the function refuses to run.

## Price book
CSV: `SKU, Description, HardwarePrice, Price_1Y, Price_3Y, Price_5Y`. Licence SKUs with term suffixes (`-1YR`, `-3Y`, `-5YR`…) are merged into one product. Term prices are total contract prices.
3Y/5Y prices are derived (30% / 50% off) only if you tick the estimate box, and are marked `*`.

## Tuning
Matching patterns, sizing and MX thresholds live at the top of `public/assets/js/core.js` (`CATALOGUE`, `CONFIG`). If your Cisco SKUs are named differently, lines appear in the "no matching SKU" box; adjust the patterns there.

## Tests
`node tests/core.test.js`, `node tests/proxy.test.js`, `node tests/e2e.js` (needs Playwright).
