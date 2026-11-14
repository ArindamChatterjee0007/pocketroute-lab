# PocketRoute R&D And Test Report

Date: November 14, 2026. Prepared for Arindam Chatterjee and Ayush Khamrui.

## Executive Status

The bounded R&D implementations and recorded tests below are complete. **The overall model-quality, production and physical-phone qualification work is not complete.** No current candidate passes every required gate. No customer deployment, autonomous dispatch, paid engagement or external acceptance is claimed.

The latest comparison is the strongest supported next direction: a frozen MiniLM encoder plus a trained linear routing head reached 62/64 correct on the exposed development set. It still incorrectly accepted two review-required cases. TF-IDF made no unsafe acceptances but rejected enough supported requests to miss the accuracy requirement. Neither result is independent generalization evidence.

Technical source checkpoint before this consolidated report: [`0497663ecb4d884f3886338614ee602f8c1b5684`](https://github.com/ArindamChatterjee0007/pocketroute-lab/tree/0497663ecb4d884f3886338614ee602f8c1b5684). [Project dashboard](https://arindamchatterjee0007.github.io/pocketroute-lab/). [Open release blocker](https://github.com/ArindamChatterjee0007/pocketroute-lab/issues/1).

## Scope And Quality Contract

Two different tasks appear in the history and must not be treated as the same benchmark:

- **Service classification:** maintenance, delivery, inspection or review. The historical Qwen2.5 1.5B reference and Android port use this task.
- **Specialist routing:** Python implementation, infrastructure configuration, architecture/design or review. The Qwen2.5 0.5B adapters and TF-IDF/MiniLM comparison use this task.

The latest routing screen requires accuracy strictly above 90%, accepted-label precision at least 95%, supported-request coverage at least 80%, zero observed unsafe acceptances, zero invalid/failed outputs and at least 64 cases with 16 per class. Earlier historical gates are recorded in their own receipts; they are not retroactively redefined here.

Accepted precision is correctness among non-review predictions. Supported coverage counts supported inputs receiving a specialist label, including potentially wrong specialist labels. An unsafe acceptance means a review-required test input received a non-review label. It is not evidence of a real-world action: **all suggestions require human review, and the prototype does not execute repair, deployment or other real-world work.**

## Model Results

| Experiment | Data scope | Correct / total | Accepted precision | Supported coverage | Unsafe | Interpretation |
| --- | --- | --- | --- | --- | --- | --- |
| Historical service reference: Qwen2.5 1.5B q4 plus reject-only policy | 96 synthetic service cases, now exposed | 73/96, 76.04% | 53/66, 80.30% | 62/72, 86.11% | 4 | Quality failed; frozen reference retained |
| Qwen2.5 0.5B adapter smoke | Eight synthetic development probes | 3/8, 37.5%; base 2/8 | 37.5% | 100% | 2 | Real weight-update/reload smoke passed; no quality qualification |
| I2 routing adapter | 64 development rows from 16 families | 47/64, 73.44%; base 13/64 | 39/52, 75% | 44/48, 91.67% | 8 | Quality failed; independent confirmation withheld |
| I3 routing adapter | Same 64 exposed development rows | 57/64, 89.06%; base 13/64 | 42/47, 89.36% | 46/48, 95.83% | 1 | Quality failed; independent confirmation withheld |
| TF-IDF plus logistic regression | Same 64 exposed routing development rows | 56/64, 87.5% | 40/40, 100% | 40/48, 83.33% | 0 | Failed accuracy requirement |
| Frozen MiniLM plus logistic regression | Same 64 exposed routing development rows | 62/64, 96.875% | 48/50, 96% | 48/48, 100% | 2 | Failed zero-unsafe requirement |

All rows reported zero invalid labels/outputs, but that did not establish correct classification. Results across different tasks, datasets and protocols are not an apples-to-apples improvement curve.

### Remaining Error Patterns

- I3: three Python generator-cleanup variants routed to infrastructure, two architecture requests deferred, one architecture request routed to infrastructure and one mixed design/implementation request accepted as architecture.
- TF-IDF: eight supported infrastructure requests, covering Compose volume and Helm annotation families, incorrectly deferred to review.
- MiniLM: all 48 supported development requests classified correctly, but two framings of the mixed design/implementation family accepted as architecture instead of review.
- The 64 development rows contain 16 underlying families with four framing variants. Their scores are development-tuned and correlated; they are not 64 independent field observations.
- The separately authored 64-case synthetic confirmation remains reserved. I2/I3 withheld it after validation failure. The two-router comparison did not consume or rebind it. Structural integrity checks are not model evaluation.

## Execution And Test Evidence

| Evidence | Source / run | Verified outcome |
| --- | --- | --- |
| Historical service evaluation | [41043171464](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/41043171464), source `8defea6bb3e20a60e97dd7a3c313177ad328cb1c` | All 96 cases repeated under unchanged protocol after an earlier 86-case budget interruption; quality failed |
| Android native VM verification | [41203062823](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/41203062823), source `ea48bb38df3197d5012f24f7a6a8394e6ee8a11f` | Three JVM tests, 160 cross-runtime vectors, all 96 reference outputs matched, integrity and worker-termination checks passed; still only 73/96 correct |
| Initial adapter contract checks | [43505439413](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43505439413) | 11 tests passed; model steps skipped |
| Actual adapter smoke | [43505603555](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43505603555), source `84d1cfbe795bb12b9948e3e3cbd2e1f998bd6e79` | Eight optimizer updates, 270,336 trainable LoRA parameters, unchanged base, changed adapter and saved/reloaded output parity |
| I2 preflight / model run | [43581356206](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43581356206) / [43581419911](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43581419911) | 23 preflight tests passed; 256 updates completed; model job intentionally failed its quality screen |
| I3 preflight / model run | [43586663075](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43586663075) / [43586761036](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43586761036) | 24 preflight tests passed; 432 updates and reload checks completed; model quality failed |
| Initial two-router comparison | [43617679681](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43617679681) | Both prediction sets produced, but MiniLM classifier export probability parity failed; failed receipt preserved |
| Corrected comparison preflight | [43618045254](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43618045254) | 35 tests passed with model steps skipped |
| Corrected comparison | [43618145866](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43618145866), source `71733da56bfe6c67b1c82fc216ccf099450ab864` | Both arms completed, numeric export parity repaired, all predictions unchanged from the first attempt; neither full quality gate passed |

Test counts belong to their stated suite and revision; do not sum 11, 23, 24 and 35 as unique tests. A successful comparison job means execution and export checks completed, not that the model-quality gate passed.

All application installs, builds, tests and model workloads ran on GitHub-hosted Linux. The Mac was used only for editor work, cloud/browser controls and transfer/integrity inspection of completed artifacts. No paid GPU/API was activated. No job or agent daemon is running as part of this handoff.

## What Changed Technically

- Qwen adapter training now records real optimizer updates, finite losses/gradients, immutable base identity, changed adapter tensors, failure receipts and save/reload evidence.
- I2 aligned the objective with the four-choice routing decision; I3 added review-intent coverage and reduced learning rate. These changes were evaluated on development data, not presented as independent field improvement.
- Grouped folds keep related training variants together. TF-IDF vocabulary/IDF fitting happens within training folds, and C is selected only from training out-of-fold log loss.
- The comparison uses a fixed C grid of 0.1, 1 and 10, with no development threshold tuning. Both selected C=10, the edge of the grid rather than a proven global optimum.
- MiniLM weights are frozen at revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`; attention-mask mean pooling and L2 normalization are explicit. Inputs are not silently truncated.
- The export defect was numeric dtype loss during JSON serialization/reconstruction. The fix preserves dtypes and records precision-appropriate tolerances. TF-IDF feature/head parity had a maximum probability difference of 2.22e-16; MiniLM head-only parity had zero difference in float32. Routed decisions also matched.
- MiniLM parity reused in-memory encoder vectors. Full tokenizer/encoder reload, quantized execution and physical-device parity were not tested.

## Artifacts And Reproduction

Permanent evidence is available in the repository; workflow artifacts have short retention and are not the only record.

- [Original service receipts](../../data/ai-runs/).
- [Adapter and comparison receipts](../../data/adapter-runs/), including [I3](../../data/adapter-runs/43586761036.json), [failed comparison](../../data/adapter-runs/comparison-43617679681.json) and [completed comparison](../../data/adapter-runs/comparison-43618145866.json).
- [Training/comparison implementation and detailed protocol](README.md), [manual workflow](../../.github/workflows/training.yml).
- [Experimental Android VM release](https://github.com/ArindamChatterjee0007/pocketroute-lab/releases/tag/android-vm-0.1.0), containing the APK/AAR and device-integration documentation. ARM64 was built, not executed on a physical phone.

| Retained artifact | SHA-256 | Important scope |
| --- | --- | --- |
| I3 receipt | `c912f4c26906da528c8f223775000616ab77e023f1d9aa1db1510f5a2a9d60a1` | Exact cloud receipt, not rewritten after failure |
| I3 adapter safetensors, 2,175,168 bytes | `8f1a2701bc515a6bd2b40aba0f7c4b46ac1ab3601cb8b2234f6dab801352b212` | Requires separately pinned Qwen base; not a complete 2 MB model |
| Completed comparison receipt | `63150c0f3dc82dc68e13bec43ea51267403207f5f8a67ec64f23968ff32c55e0` | Exact source/protocol, selection and prediction evidence |
| TF-IDF JSON export, 388,326 bytes | `0d779425fa24ef863384223e05844c31663215718401b3b1f327c1e8d8878915` | Vocabulary, IDF and classifier; target-runtime implementation still required |
| MiniLM head/reference JSON, 33,813 bytes | `704ccfdd512f7d8f63785a99b9c8ee13ca33084d0266ed32b6a8642d12e0784f` | Excludes the 90,868,376-byte encoder and inference runtime |
| Completed comparison archive | `0c8a652c8fe6eda562da06a5af6e49ce7d362429cb309f26782ed7a5ea99574b` | Hash verified against GitHub before extraction |

The original archives, adapters and JSON exports are retained in the project's local artifact archive. Use the receipts and pinned revisions to reproduce an experiment; do not treat a rescored receipt as fresh inference or rerun exposed tests as independent confirmation. Neither model weights nor private signing keys are bundled with this report.

## Resource Measurements

| Measurement | Recorded environment | Result | Not established |
| --- | --- | --- | --- |
| Historical service request latency / memory | Node on GitHub CPU | Mean 11,988 ms; peak worker RSS 5,820,387,328 bytes | Phone latency, app-wide phone memory, OOM event or battery use |
| Android warm inference | API 36 x86_64 emulator, 8 GiB configured RAM | p50 13,081 ms; p95 13,704 ms | Physical Samsung/iPhone performance |
| I3 model stage | GitHub CPU training process | 681,528 ms; peak RSS 4,652,834,816 bytes | Inference footprint or energy on a handset |
| Two-router comparison process | GitHub CPU, both arms and setup | 5,341 ms; peak RSS 595,415,040 bytes | Per-request phone latency or comparative energy |

Arm timings contain different setup/download work. Do not advertise the aggregate comparison time as latency for a single request. No physical-phone thermal or whole-device energy result is available.

## AI-DLC Review And Next Actions

The coordinator owned implementation and integration. Requested GPT-6 Astra research and Claude Fable 5.1 review roles cross-checked design, code and actual results. Supported findings were fixed and rechecked; the original failed attempts remain visible. Provider-resolved model identities were not independently exposed, so the requested selections are recorded rather than asserted as runtime attestations. Agent agreement is not a quality certificate.

Priority next work:

1. Freeze a training-family-only nested rejection-calibration experiment for MiniLM; keep TF-IDF as a conservative control. Do not choose a cutoff from the two exposed development errors.
2. Obtain permitted, independently human-authored and labelled non-templated requests, with adjudication of ambiguous boundaries. Preserve separate training, calibration and final evaluation groups.
3. Keep multi-role planning separate from classification. The current router intentionally defers multi-role requests; completing a project requires a separately tested bounded planner and qualified worker contracts.
4. Validate Python outputs with specification-derived tests, infrastructure artifacts with isolated build/schema/policy checks, and architecture outputs with requirements/interface review. No live cluster execution is authorized by a routing label.
5. Only after task quality passes, verify complete export/runtime parity, quantization and named physical Samsung/iPhone models with measured latency, full-app memory, thermal behavior and energy.

The alternative wider training-only regularization grid for TF-IDF remains a documented hypothesis, not a performed experiment. Python/infrastructure/architect specialist models, teacher distillation, end-to-end project generation and general LLM-equivalent capability are not delivered by the current routing work.

For Ayush's review: please check the task boundaries, data-collection design and proposed calibration protocol. No delivery deadline, deployment approval, ownership reassignment or new work commitment is implied by this handoff.