# Sentinel Architect
Estimator for Microsoft Sentinel (SIEM) + SOAR consumption cost and managed-service design.

## Deploy
1. Push this folder to GitHub, connect the repo to Netlify (publish `public`, functions `netlify/functions` - set in netlify.toml).
2. Environment variables: `GEMINI_API_KEY`, `ACCESS_CODE`.
3. Open the site, enter the access code.

## Before quoting
- Rates are PLACEHOLDERS (GBP). Import your Microsoft/CSP rate card in Internal view > step 4 (CSV round-trips).
- Per-source log volumes are industry estimates blended with Microsoft's published allowances (E5 5MB/user/day, Defender for Servers P2 500MB/server/day, free sources). Calibrate with a Log Analytics Usage CSV in step 3.
- Customer view hides rate card, margins and internal assumptions; the PPTX is always customer-safe.

## Tests
`node tests/core.test.js`; `NODE_PATH=$(npm root -g) node tests/e2e.js` (Playwright, mock Gemini).

## v2: managed-service quoting
- Starting point: greenfield, or migrating from Splunk/QRadar/XSIAM/etc. (GB/day or EPS). Take as-is, or override sources in step 3 and the rest rebalances to the same total.
- Commercials: 1/3/5-year term; PAYG or commitment tier; true-up or budget cap (overage billed or absorbed); service priced as package, per GB, per source, or package + usage.
- Price book: one CSV (Item,Description,Unit,Price_GBP) covering Microsoft rates, packages, onboarding, term discounts. Download the template in step 4 (Internal view), fill it in, import it. Rows tagged PLACEHOLDER are not real prices.
- Output: branded budgetary quote (Budgetary quote button -> Save as PDF) and customer deck. The quote shows a DRAFT banner until a price book is imported.
- Quote branding (name, logo, colour, contact) is saved in the browser, set in step 4.
