# PocketRoute Notes 0.2 Alpha

A local-first, open-source field-note product. Capture text, prepare conservative source-grounded fields and an extractive summary, review/edit, save locally, search records, and export or import portable backups. No language model runs in this product.

## Verified Release

Live product: https://arindamchatterjee007.github.io/pocketroute-lab/notes/

Source `86383dfb74e1c6ce09c805b3672a4770d13ac7a4` passed [GitHub run 40970044604](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40970044604): 23 unit checks, 144 browser test-configuration results and 12 final snapshots across the product and dashboard. [Live acceptance 40970654399](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40970654399) verified 25 hosted file hashes, ZIP integrity/content, standalone browser SDK use, review/save, offline reload, backup and confirmed deletion across four browser configurations. All execution and screenshot generation occurred on GitHub, not the founder's Mac. Desktop and phone captures were inspected.

This establishes an early usable web product, not customer demand, native-device battery savings, production certification or independent human acceptance. No model was trained or rerun for this release. Source and runtime downloads are public under their stated licenses; user records are not included in the repository or published test data. The local-storage privacy limitations below still apply.

## Use The Product

The hosted app lives at https://arindamchatterjee007.github.io/pocketroute-lab/notes/ and remains separate from the research dashboard. Records belong to the browser profile, not to the public repository.

- Site/date/reference extraction requires explicit labelled lines. Unsupported, conflicting or invalid fields are not invented.
- Category suggestions use keywords. Ambiguous categories fall back to General and need review.
- The initial summary is up to three verbatim non-metadata source lines, not a comprehensive generated summary.
- Every create or edit requires review confirmation. Cross-tab writes use record versions inside an atomic IndexedDB transaction.
- JSON backups preserve values. Oversized exports are split into separately downloadable, independently importable files within the 8 MiB limit; retain and restore every part. Add-only import reports conflicts rather than overwriting. CSV export escapes spreadsheet-formula-like values; spreadsheets may still infer types.
- Unsupported stored rows are retained with a separate raw recovery export. No data-recovery guarantee is made.

Limits: 100 records, 12,000 characters per source/summary, 160-character title/site/reference, 8 MiB JSON backup import. English-labelled parsing; original text may contain Unicode.

## Privacy And Security

No account, backend, analytics, cloud sync or model download is involved. Records are unencrypted in IndexedDB, accessible to the browser profile and same-origin scripts. GitHub Pages project sites share an origin. Use an isolated, trusted origin for sensitive workflows; this alpha is not a vault, regulated-data system or permission to process someone else's data.

Browser clearing/eviction/private sessions may lose data. Backups and recovery exports contain potentially private plaintext. Erasing local records cannot erase exported copies. The service worker caches public assets only and is scoped to the Notes path; it does not cache private note payloads or clear unrelated app caches.

Report security issues privately through GitHub's repository security advisory route if available; otherwise contact the maintainer without including customer notes, credentials or sensitive backups in public issues. No response-time SLA is promised.

## Reusable Core

The standalone Apache-2.0 module has no browser APIs, model dependency or framework requirement. Use it without the dashboard or a cloud provider:

```js
import { analyzeNote, createRecord, createBackup, parseBackup } from "./pocketroute-core.mjs";

const analysis = analyzeNote("Site: North-17\nDate: 2026-10-29\nTwo filters need replacement.");
const draft = {
  source: analysis.source,
  title: "North-17 visit",
  ...analysis.fields,
  category: analysis.category,
  summary: analysis.summary,
  reviewed: true,
};
const timestamp = new Date().toISOString();
const record = createRecord(draft, {
  id: "example-visit-001",
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const backup = createBackup([record]);
const restored = parseBackup(JSON.stringify(backup));
```

Only set `reviewed: true` after actual human review. The module validates a review flag, not the identity or actions of the caller. Extraction evidence contains original labelled lines; supplied data is not independently verified. `normalizeRecord` preserves recorded engine/summary provenance while stripping unsupported fields. `planImport` identifies additions, identical records and conflicts without applying writes.

## Build, Test And Distribute

This development workspace executes installs, builds, tests and packaging only through the repository's existing standard GitHub-hosted Linux workflow. No local execution was authorized on the founder's Mac. Fork owners should change the explicit repository guard and retain equivalent CI protections for their own fork.

The cloud build produces the static app, offline shell, standalone core and `pocketroute-notes-0.2.0.zip`, including Apache and third-party notices. Static self-hosting requires HTTPS or localhost for service workers and Web Crypto. Open `/notes/`; no database server, API key, npm installation or model download is needed by the end user. Core SDK use does not depend on the CI guard.

All release evidence must state the actual source revision. Unit and browser tests include storage conflicts, review gating, malicious text/CSV handling, backup/recovery, offline reload and responsive layouts. A web-browser test is not a real-phone energy benchmark.

## Commercial Decision

Build and validate first. Do not turn the research plan's example prices into live offers. Potential later revenue is scoped integration and support, not exclusive ownership of permissively licensed code. A sellable production claim requires external users, measured utility, support capacity, clean data/IP rights and acceptance criteria; none follows automatically from this alpha.