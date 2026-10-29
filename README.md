# PocketRoute Notes And Research Lab

An open-source local-first field-note product, reusable JavaScript core and research dashboard. This is an early product release, not a paid SaaS service, secure vault, newly trained language model or native mobile SDK.

**Use Notes:** https://arindamchatterjee007.github.io/pocketroute-lab/notes/

**Product bundle:** https://arindamchatterjee007.github.io/pocketroute-lab/downloads/pocketroute-notes-0.2.0.zip

**Standalone core:** https://arindamchatterjee007.github.io/pocketroute-lab/downloads/pocketroute-core.mjs

**Live dashboard:** https://arindamchatterjee007.github.io/pocketroute-lab/

**Source:** https://github.com/ArindamChatterjee007/pocketroute-lab

## Notes 0.2 Alpha

Capture a note, prepare conservative labelled fields and an extractive summary, review/edit, save locally, search records, and export JSON or spreadsheet-safe CSV. The product includes offline caching, version-checked edits/deletion, add-only backup import with conflict reporting, multipart backups and raw recovery for unsupported local records. The standalone Apache-2.0 core has no model, cloud or framework dependency.

**It uses rules and verbatim source excerpts, not an SLM.** Unknown or conflicting fields remain empty; category suggestions and summaries require review. The previous pretrained SLM's weak routing result is retained in the research lab rather than promoted into the product.

Records are unencrypted in the browser's IndexedDB. Browser cleanup can erase them, and same-origin scripts/profile users may access them. Keep private backups and use an isolated trusted origin for sensitive deployments. No note content is sent to a server by this application. See [notes/README.md](notes/README.md) for SDK usage, self-hosting, privacy and limits.

## Current Product Evidence

| Gate | Verified result |
| --- | --- |
| Application source | `86383dfb74e1c6ce09c805b3672a4770d13ac7a4` |
| Static publication | `c450c179311481487187571f1cdf70e514b8138f` |
| [Prepublication run 40970044604](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40970044604) | 23 unit checks, 144 browser test-configuration results, 12 final screenshot checks |
| Browsers and viewports | Chromium 1440/1920/390/320; WebKit 1440/390 CSS pixels |
| [Live run 40970654399](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40970654399) | 25 hosted files matched SHA-256; 18-entry ZIP passed integrity/required-content checks |
| Live product acceptance | Four Chromium/WebKit configurations passed reviewed save, offline reload, backup, confirmed deletion and standalone browser SDK import; no page errors or outside requests |
| Visual review | Cloud-generated desktop and phone captures inspected; unfocused skip-link painting corrected and retested |
| Local installs/builds/tests/rendering/model runs | None; all execution occurred on standard GitHub-hosted Linux runners |

The [publication manifest](https://arindamchatterjee007.github.io/pocketroute-lab/publication.json) and [saved live receipt](https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/live-verification.json) are authoritative. Test records and screenshots are synthetic, not customer work. No model was trained or rerun for this product release, and no phone energy measurement was made.

## Selling Decision

Build and validate first. No checkout, subscription, binding price, sales outreach, support SLA or customer contract has been created. The existing price examples in the research dashboard are hypothetical, not live offers. A possible future business is paid integration/customization/support around a useful open core; an external pilot and reliable support capacity are required before a production-ready sales claim.

## Initial Dashboard Evidence

The following records describe the earlier dashboard release. The product evidence above supersedes its site revision and acceptance counts.

Application source `8c4bcd5d66b00ac24e57c6bb9064ccb48591d61f` passed [GitHub run 40959960119](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40959960119): 15 unit checks, 90 browser test-configuration results and 6 final screenshot checks. The browser matrix covers Chromium at 1440/1920/390/320 and WebKit at 1440/390 CSS pixels. Screenshots, fonts, bitmap assets and the build were generated on GitHub, not the founder's Mac. The hosted [publication manifest](https://arindamchatterjee007.github.io/pocketroute-lab/publication.json) records hashes and provenance.

The existing pretrained SmolLM2 135M probe produced **1/8 exact route labels**, versus **8/8 for a simple rule baseline on the same eight synthetic development cases**. All mismatches are retained. The model step completed in run 40958691635, which later failed on an unrelated icon import; subsequent passing UI runs preserved the model data rather than rerunning inference. This is a negative coordinator result, not a trained new SLM, held-out quality certification or a phone benchmark. [Raw model receipt](https://arindamchatterjee007.github.io/pocketroute-lab/data/slm-results.json).

The separate `live` workflow mode verifies a supplied exact source SHA against the hosted manifest, hashes the application assets, and exercises the public URL on GitHub-hosted Chromium and WebKit. [Live run 40960824135](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40960824135) passed: 13 hosted files matched SHA-256, with all six views and policy/cloud-evidence interactions verified in Chromium at 1440/390/320 and WebKit at 390, with no page errors or outside requests. The [saved live receipt](https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/live-verification.json) records the exact source and execution time. No local build, dependency install, model execution, browser test, renderer or dev server was used.

## Execution Boundary

All dependency installation, builds, automated tests, image generation and model inference run in this repository's standard GitHub-hosted Linux workflow. The entry points reject local execution. No self-hosted runner, GPU rental, paid API, persistent service, scheduled job, model weight publication or Actions cache is configured.

Use the **PocketRoute cloud build and experiment** workflow. `unit` mode runs the dependency audit and focused pure-logic checks. `publish` mode installs locked dependencies, runs unit and responsive browser checks, optionally runs the bounded pretrained SmolLM2 probe, and publishes verified static output to `gh-pages`. `live` mode requires `expected_source` and checks the actual hosted release without rerunning the model. Pages uses `gh-pages` at the repository root with HTTPS enforced. No local development server is needed or authorized for this project.

Cloud-generated package locks and model/live receipts on GitHub are authoritative. Source uploads must preserve them; never overwrite a measured receipt with an older local seed. The custom build workflow is manual-only; GitHub's built-in Pages deployment serves the published branch. No nightly schedule is enabled. Run links require the owner's normal GitHub authorization and do not silently enqueue work from the public dashboard.

The dashboard performs ordinary interface interactions and a tiny deterministic routing preview. It never downloads model weights or runs SLM inference in the browser. Cloud outputs are dated snapshots, not a live inference API. A button linking to GitHub Actions opens the authenticated workflow UI; it does not pretend to enqueue work by itself.

## Evidence Boundaries

- The SmolLM2 probe uses existing pretrained `HuggingFaceTB/SmolLM2-135M-Instruct` weights under their separate Apache-2.0 license. No new foundation model or fine-tuning is claimed.
- Synthetic route-label cases are a development smoke test, not the full held-out evaluation corpus or evidence of useful task-completion quality.
- GitHub CPU latency is not phone latency. Energy, battery savings and mobile hardware compatibility remain unmeasured.
- The public portfolio includes selected product summaries only. Customer data, credentials, private financial ledgers, resumes, palm images and correspondence are excluded.
- Planning targets, scenario calculations and real execution receipts are distinct. All prices are hypotheses, not offers or revenue.

## Views

The Notes product is linked from the dashboard. The research views remain overview, execution board, model lab, sessions, evidence library and roadmap. Product records, browser preferences and personal notes stay local to that browser and are never synchronized as shared research execution evidence.

## License

Original project source is licensed under Apache-2.0. The full license is generated from the Apache Software Foundation's canonical license text during the first successful cloud publication. Third-party fonts, icons, inference software and weights retain their own licenses and notices, included with the hosted build where distributed.

PocketRoute is an experimental working name. No trademark registration, benchmark advantage, customer, funding or acquisition offer is implied.