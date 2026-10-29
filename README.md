# PocketRoute Lab

An open-source research dashboard for a three-unit AI office, with a bounded small-language-model experiment. This is a public project demonstration, not a private customer office, paid SaaS service or native mobile SDK.

## Execution Boundary

All dependency installation, builds, automated tests, image generation and model inference run in this repository's standard GitHub-hosted Linux workflow. The entry points reject local execution. No self-hosted runner, GPU rental, paid API, persistent service, scheduled job, model weight publication or Actions cache is configured.

Use the **PocketRoute cloud build and experiment** workflow. `unit` mode runs the focused pure-logic checks. `publish` mode installs pinned dependencies, records a generated lockfile, runs unit and responsive browser checks, optionally runs the bounded pretrained SmolLM2 probe, and publishes verified static output to `gh-pages`. Pages must use that branch. No local development server is needed or authorized for this project.

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