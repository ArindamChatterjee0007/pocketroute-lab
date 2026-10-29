# PocketRoute Lab

An open-source research dashboard for a three-unit AI office, with a bounded small-language-model experiment. This is a public project demonstration, not a private customer office, paid SaaS service or native mobile SDK.

**Live dashboard:** https://arindamchatterjee007.github.io/pocketroute-lab/

**Source:** https://github.com/ArindamChatterjee007/pocketroute-lab

## Delivery Evidence

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

Overview, execution board, model lab, research sessions, evidence library and roadmap. Filters, details, scenario controls, downloads and source links are functional. Browser preferences and personal notes, when enabled, are local to that browser and are never synchronized as shared execution evidence.

## License

Original project source is licensed under Apache-2.0. The full license is generated from the Apache Software Foundation's canonical license text during the first successful cloud publication. Third-party fonts, icons, inference software and weights retain their own licenses and notices, included with the hosted build where distributed.

PocketRoute is an experimental working name. No trademark registration, benchmark advantage, customer, funding or acquisition offer is implied.