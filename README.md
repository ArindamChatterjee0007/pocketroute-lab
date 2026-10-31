# PocketRoute Notes And Research Lab

An open-source local-first field-note product, reusable JavaScript core and research dashboard. This is an experimental software release, not a secure vault, newly trained language model or qualified native mobile SDK.

## Engineering Manuals

Source: [ArindamChatterjee0007/pocketroute-lab](https://github.com/ArindamChatterjee0007/pocketroute-lab). The dashboard presents tools, implementation work, technical documentation and reproducible evaluation evidence.

- [Device Integration & Test Handbook (PDF)](https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-device-integration.pdf)
- [SDK & Evidence Reference (PDF)](https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-sdk-reference.pdf)
- [Current dashboard](https://arindamchatterjee0007.github.io/pocketroute-lab/)

Reader-facing engineering manuals are PDF-first, with clickable contents, embedded fonts, code panels and actual-PDF validation. Duplicate Markdown manuals are excluded from the SDK and regression-kit bundles; editable technical source and historical model-failure receipts remain for reproducibility. Only technical work belongs in this publication.

The current [publication manifest](https://arindamchatterjee0007.github.io/pocketroute-lab/publication.json) and [live verification receipt](https://github.com/ArindamChatterjee0007/pocketroute-lab/blob/main/data/live-verification.json) identify the exact tested source and downloadable files. Builds inspect served text, PDF text and ZIP contents before publication. All rendering/testing runs on GitHub; a document release does not change model or native-device results. Earlier technical checkpoints below are historical.

## Device Integration Delivery

The [multi-device manual](ai/DEVICE_INTEGRATION.md) and [portable regression kit](https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-device-test-kit-0.1.0.zip) are available for integrators/testers. Profiles and native adapter interfaces are specified, not implemented mobile/MCU runtimes. The kit separates 96 exposed inputs from expected/reference labels and scores complete recorded reports without inference; parity with the failing reference is not release acceptance.

Publication source `96da4a02f99f647c2195ba47465efadaf5007994`, static revision `c998b1fed6737860418b17ba0af247eda85cfe75`: [run 41058560519](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41058560519) passed 41 unit checks, 162 browser results and 12 final snapshots. Cloud-rendered desktop/mobile captures were reviewed. [Live verification 41059650241](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41059650241) verified 65 hosted-file hashes, the 20-entry experimental SDK and 11-entry regression kit, including rejection of an unfinished template and scorer execution on an explicitly labelled cloud fixture. Four browser configurations preserved the app flows with no page errors or outside requests.

Two earlier live attempts stopped on HTTP 503 responses. A tested, bounded GET retry policy now records transient 502/503/504 responses while still requiring final HTTP 200, byte count and SHA-256 for every file. The passing receipt records one retry; this is not an availability guarantee. No local builds/tests/rendering, model rerun or physical-device inference occurred. The model remains at its failed 73/96 confirmation result. Earlier delivery checkpoints below are historical.

## Actual AI Component

The original model-backed work is implemented as an **experimental service-classification SDK and CLI**, separate from the rule-only Notes product. It uses pinned Qwen2.5 ONNX weights in an isolated CPU worker, with strict output labels, bounded input/context, explicit model-download consent, cached inference and cancellation that stops the worker. **It is not qualified as a production or low-power mobile AI engine.**

- [Service AI evidence](https://arindamchatterjee0007.github.io/pocketroute-lab/#service)
- [Experimental SDK download](https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-service-ai-0.1.0-experimental.zip)
- [SDK/API instructions](ai/README.md)
- [Model card and failure analysis](ai/MODEL_CARD.md)
- [Device integration, build and regression manual](ai/DEVICE_INTEGRATION.md)
- [Portable device regression kit](https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-device-test-kit-0.1.0.zip)

The integration manual now covers phones, watches, Linux boards and MCU/RTOS targets through device-specific adapters and explicit budgets. The downloadable kit contains frozen synthetic inputs, separate expected/reference outputs, protocol/artifact fingerprints and a dependency-free report validator. It tests parity/regression without executing a model. Native adapters, APK/firmware, physical qualification and production accuracy remain unimplemented/unverified; the current Qwen model is not an MCU candidate. Matching its failing reference is not release acceptance.

### Latest 96-Case Result

The requested **greater-than-90% target remains unmet**. [Run 41043171464](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41043171464) completed the frozen hybrid system (Qwen plus a reject-only policy): **73/96, 76.0% accuracy**, **80.3% accepted-label precision**, **86.1% supported coverage**, **four unsafe acceptances**, zero invalid labels. There were 94 model calls and two policy rejections; this is not pure-model accuracy. The same-case keyword baseline was 25/96.

The separate AI-authored synthetic set was not used for prompt/policy design and is not human/customer validation. Exposed development cases scored 46/48 (95.8%) but did not generalize. An initial run reached 86 cases before the 20-minute overall budget; the completed run repeated all 96 with unchanged model/prompt/policy/data/runtime and reused only hash-verified qualifying regression. Both receipts remain archived, and the repeat is labelled explicitly. No tuning followed confirmation exposure.

Mean/p95 cloud request time was 11,988/12,559 ms; peak worker RSS was 5,820,387,328 bytes (5.42 GiB). Runtime controls passed, but quality and mobile readiness did not. The 96 cases are now exposed. Further accuracy claims need permitted human-labelled development/calibration data and a new untouched confirmation set, not threshold relaxation or repeated easier synthetic tests. The phone plan requires a GitHub-built native harness before real offline, memory, latency and energy tests; no APK or phone result exists yet.

Current publication source `e83496411eaa949f74dbe37ab303619b44357ec7`, static revision `f6b9dca5d93b8d74256eca27bed5e11535337e8d`: [distribution run 41046055531](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41046055531) passed 37 unit checks, 162 browser results and 12 final snapshot checks. GitHub-rendered desktop/phone evidence was visually reviewed. [Live acceptance 41046509450](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41046509450) verified 53 hosted-file hashes, the 19-entry weight-free SDK with all imported modules and the phone guide, and eight views plus Notes offline/backup/deletion across Chromium 1440/390/320 and WebKit 390. No page errors or outside requests were observed. Software publication passed; the accuracy/safety gate did not. No local builds/tests/rendering/inference or model rerun occurred during publication.

### Earlier 48-Case Checkpoint

The completed [model evaluation 41017525215](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41017525215) recorded 24/24 development labels but **41/48 confirmation labels (85.4%)**, **87.2% accepted-label precision** and **four unsafe acceptances**. Preset gates required 90%, 95% and zero respectively; they failed. The keyword baseline scored 22/48 on the same confirmation cases. These are small original synthetic sets, not external customer validation.

Cloud runtime: 8,254 ms mean, 8,520 ms p95, 4,770,783,232-byte peak worker process memory (about 4.44 GiB). Cached reload with zero fetch attempts, input/token limits, cancellation and closed-worker rejection passed. These figures are GitHub CPU measurements, not phone or energy results. No foundation model was trained or fine-tuned.

Earlier failed runs are preserved, not replaced by a success narrative. The selected base weights declare Apache-2.0; the ONNX conversion repository does not declare separate license metadata. The SDK ships original source, locked dependencies and a model card, **not model weights or blanket commercial clearance**.

[Distribution/UI run 41019186198](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41019186198) passed 30 unit checks, 162 browser test-configuration results and 12 final snapshot checks at source `05de46a706279220fd234f97de15fd02f291ebf0`. [Live acceptance 41019522606](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41019522606) verified 42 hosted-file hashes, the 14-entry weight-free AI SDK ZIP and eight views across four browser configurations, preserving Notes offline/backup/deletion behavior. Passing software tests does not clear the failed model-quality gate. The original model protocol and all raw predictions are in the [per-run receipt](https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/ai-runs/41017525215.json). No inference runs in the public dashboard.

Next technical decision: use this failure analysis as development evidence for a lighter or task-adapted model, reserve a new independently labelled confirmation set, establish safe rejection behavior and validate actual target devices.

**Use Notes:** https://arindamchatterjee0007.github.io/pocketroute-lab/notes/

**Product bundle:** https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-notes-0.2.0.zip

**Standalone core:** https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-core.mjs

**Live dashboard:** https://arindamchatterjee0007.github.io/pocketroute-lab/

**Source:** https://github.com/ArindamChatterjee0007/pocketroute-lab

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

The [publication manifest](https://arindamchatterjee0007.github.io/pocketroute-lab/publication.json) and [saved live receipt](https://github.com/ArindamChatterjee0007/pocketroute-lab/blob/main/data/live-verification.json) are authoritative. Test records and screenshots are synthetic, not customer work. No model was trained or rerun for this product release, and no phone energy measurement was made.

## Initial Dashboard Evidence

The following records describe the earlier dashboard release. The product evidence above supersedes its site revision and acceptance counts.

Application source `8c4bcd5d66b00ac24e57c6bb9064ccb48591d61f` passed [GitHub run 40959960119](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40959960119): 15 unit checks, 90 browser test-configuration results and 6 final screenshot checks. The browser matrix covers Chromium at 1440/1920/390/320 and WebKit at 1440/390 CSS pixels. Screenshots, fonts, bitmap assets and the build were generated on GitHub, not the founder's Mac. The hosted [publication manifest](https://arindamchatterjee0007.github.io/pocketroute-lab/publication.json) records hashes and provenance.

The existing pretrained SmolLM2 135M probe produced **1/8 exact route labels**, versus **8/8 for a simple rule baseline on the same eight synthetic development cases**. All mismatches are retained. The model step completed in run 40958691635, which later failed on an unrelated icon import; subsequent passing UI builds preserved the model data rather than rerunning inference. This is a negative coordinator result, not a trained new SLM, held-out quality certification or a phone benchmark. [Raw model receipt](https://arindamchatterjee0007.github.io/pocketroute-lab/data/slm-results.json).

The separate `live` workflow mode verifies a supplied exact source SHA against the hosted manifest, hashes the application assets, and exercises the public URL on GitHub-hosted Chromium and WebKit. [Live run 40960824135](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/40960824135) passed: 13 hosted files matched SHA-256, with all six views and policy/cloud-evidence interactions verified in Chromium at 1440/390/320 and WebKit at 390, with no page errors or outside requests. The [saved live receipt](https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/live-verification.json) records the exact source and execution time. No local build, dependency install, model execution, browser test, renderer or dev server was used.

## Execution Boundary

All dependency installation, builds, automated tests, image generation and model inference run in this repository's standard GitHub-hosted Linux workflow. The entry points reject local execution. No self-hosted runner, GPU rental, paid API, persistent service, scheduled job, model weight publication or Actions cache is configured.

Use the **PocketRoute cloud build and experiment** workflow. `unit` mode runs the dependency audit and focused pure-logic checks. Explicit `ai` mode runs the frozen service-classification evaluator and archives its result, including failures; it is not run by an ordinary UI build. `publish` mode installs locked dependencies, runs unit and responsive browser checks, optionally runs the separate legacy SmolLM2 smoke probe, and publishes verified static output to `gh-pages`. `live` mode requires `expected_source` and checks the actual hosted release and SDK package without rerunning a model. Pages uses `gh-pages` at the repository root with HTTPS enforced. No local development server is needed or authorized for this project.

Cloud-generated package locks and model/live receipts on GitHub are authoritative. Source uploads must preserve them; never overwrite a measured receipt with an older local seed. The custom build workflow is manual-only; GitHub's built-in Pages deployment serves the published branch. No nightly schedule is enabled. Run links require the owner's normal GitHub authorization and do not silently enqueue work from the public dashboard.

The dashboard performs ordinary interface interactions and a tiny deterministic routing preview. It never downloads model weights or runs SLM inference in the browser. Cloud outputs are dated snapshots, not a live inference API. A button linking to GitHub Actions opens the authenticated workflow UI; it does not pretend to enqueue work by itself.

## Evidence Boundaries

- The SmolLM2 probe uses existing pretrained `HuggingFaceTB/SmolLM2-135M-Instruct` weights under their separate Apache-2.0 license. No new foundation model or fine-tuning is claimed.
- Synthetic route-label cases are a development smoke test, not the full held-out evaluation corpus or evidence of useful task-completion quality.
- GitHub CPU latency is not phone latency. Energy, battery savings and mobile hardware compatibility remain unmeasured.
- Public content is limited to technical project records, source, synthetic evaluation evidence and engineering manuals. Private operational records and planning documents are excluded from publication.
- Research targets and measured execution receipts are distinct; an unfinished device qualification is never presented as a completed result.

## Views

The Notes product is linked from the dashboard. The research views remain overview, execution board, model lab, sessions, evidence library and roadmap. Product records, browser preferences and personal notes stay local to that browser and are never synchronized as shared research execution evidence.

## License

Original project source is licensed under Apache-2.0. The full license is generated from the Apache Software Foundation's canonical license text during the first successful cloud publication. Third-party fonts, icons, inference software and weights retain their own licenses and notices, included with the hosted build where distributed.

PocketRoute is an experimental working name. No trademark registration or unmeasured benchmark advantage is implied.