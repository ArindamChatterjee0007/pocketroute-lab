# PocketRoute Service Classifier Model Card

Status: experimental, greater-than-90% target and pilot-quality gate failed. Evaluation date: October 30, 2026; authoritative timestamps are UTC in the receipts.

## Identity And Intended Use

Wrapper around pretrained `onnx-community/Qwen2.5-1.5B-Instruct`, revision `d54957e3af1be04546436e874a60fe386041b244`, q4 CPU inference. Base model `Qwen/Qwen2.5-1.5B-Instruct`, revision `989aa7980e4cf806f80c7fef2b1adb7bc71aa306`, 1,543,714,304 parameters. No training or fine-tuning by this project.

Intended use is supervised developer evaluation of English service-request classification. Out of scope: autonomous actions, safety-critical dispatch, payments/account changes, regulated decisions, general assistance, mobile-efficiency claims or unsupervised production routing.

## Latest Hybrid Evaluation

Revision 7 combines the pinned Qwen model, 16 development-only examples, model-selected single-token A/B/C/D decoding, and a deterministic reject-only policy. Policy rules never assign maintenance, delivery or inspection. This is system accuracy, not a pure-model accuracy claim. The model is loaded even for policy rejections; no avoided-load or energy benefit is established.

| Metric | Complete 96-Case Result | Requirement |
| --- | --- | --- |
| Exact-label accuracy | 73/96, 76.0% | Strictly above 90% requested; not met |
| Accepted-label precision | 53/66, 80.3% | At least 95%; failed |
| Supported-request coverage | 62/72, 86.1% | At least 80%; passed |
| Unsafe acceptances | 4 | Zero; failed |
| Invalid output labels | 0 | Reported, not substituted for accuracy |
| Model calls / policy rejections | 94 / 2 | Hybrid scope disclosed |
| Same-case keyword baseline | 25/96, 26.0% | Comparator only |

The 96 English cases (24 per category) were independently authored by a separate AI agent and frozen before execution. They are not human-labelled, external field or customer data. Integrity checks cover unique IDs/families/inputs, bounded inputs, balance and exact disjointness from old datasets and prompt examples; they do not prove semantic independence or population accuracy. The exposed old 48 cases scored 46/48 in development. The separate 96-case score shows that development fit did not generalize. Do not compare it as a same-test change from the earlier 41/48.

The first confirmation attempt, [41040367529](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41040367529), exhausted the overall 20-minute budget after 86 cases. No post-exposure classifier tuning occurred. [41043171464](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41043171464), source `8defea6bb3e20a60e97dd7a3c313177ad328cb1c`, repeated all 96 under the identical hashed classifier/data/runtime, reusing only complete qualifying regression evidence. It is labelled exact-protocol reproduction after interruption; partial outputs were not merged or filtered. The [full receipt](https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/ai-runs/41043171464.json) records every prediction, hashes, dependency versions and the failed gate. All 96 cases are now exposed.

Cloud request mean/p50/p95: 11,988 / 12,153 / 12,559 ms. Peak worker RSS: 5,820,387,328 bytes (5.42 GiB). The mean includes policy-only requests. Cached reload, input/token bounds, pre-abort, active cancellation, awaited closure and closed-worker rejection passed. These measurements do not meet or waive native-device budgets.

Additional archived development-only experiments: [41033163428](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41033163428), letter choices, 43/48 and three unsafe acceptances; [41038253532](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41038253532), category words, 39/48 and four unsafe; [41039941000](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41039941000), compact NLI, 15/48; [41040157531](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41040157531), neutral-aware NLI, 16/48. Each withheld confirmation. The NLI option is not a recommended replacement.

## Earlier Evaluation Record

| Run | Result |
| --- | --- |
| [41016401990](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41016401990) | Initial development: 0.5B q8 3/24; 1.5B q4 23/24 with one unsafe acceptance. Confirmation withheld; runtime boundary check failed. |
| [41017074929](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41017074929) | Added a vague-request prompt example using development evidence only. 1.5B development 24/24. Cached tokenizer failed before any confirmation output; no test result claimed. |
| [41017525215](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41017525215) | Repaired pinned-directory loading without changing model/prompt/test inputs. Development 24/24, confirmation 41/48, full runtime checks completed. Pilot gate failed. |

Earlier evaluated source: `9f98ca794a7b00bf8268fdbb2399ce31f1aeeb95`. The complete [per-run receipt](https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/ai-runs/41017525215.json) includes raw outputs, exact model/tokenizer file hashes, dataset and prompt hashes, versions and failures. Execution completion is not model-quality acceptance.

## Earlier Data And Metrics

Nine prompt examples, 24 development requests and 48 separate confirmation requests, with 12 confirmation cases per label: maintenance, delivery, inspection and review. All are original synthetic English text. Exact duplicate and shared-content-trigram checks pass; this is not proof of semantic independence, absence of pretraining overlap or external human labelling. Confirmation examples were never included in the inference prompt or used for candidate selection.

| Confirmation metric | Result | Preset requirement |
| --- | --- | --- |
| Exact-label accuracy | 41/48, 85.4% | At least 90% |
| Accepted-label precision | 34/39, 87.2% | At least 95% |
| Supported-request coverage | 35/36, 97.2% | At least 80% |
| Unsafe acceptance of review-required requests | 4 | 0 |
| Invalid output labels | 2 | Reported, not silently mapped to success |
| Existing keyword baseline accuracy | 22/48, 45.8% | Comparator, not evidence that the SLM is ready |

Errors included a physical fault labelled inspection, a wrong-delivery request labelled outside the schema, multi-category requests incorrectly accepted, and instruction-manipulation requests incorrectly accepted. All output suggestions require human review. Confidence values are not calibrated and are returned as null.

The sample is too small and artificial for a population-performance claim. No customer study, human acceptance trial, calibrated abstention guarantee or production safety certification was performed.

## Earlier Runtime Evidence

GitHub-hosted Linux, Intel Xeon Platinum 8370C, Node v24.22.1, Transformers.js 4.3.2, ONNX Runtime Node 1.30.0, two inference threads. Mean inference 8,254 ms; p50 8,226 ms; p95 8,520 ms; peak worker RSS 4,770,783,232 bytes. Fixed few-shot prompts, greedy decoding and at most eight output tokens. Context budgets are documented in the SDK.

Cached pinned-directory reload and fixed-text tokenizer readiness passed without fetch attempts. Oversized input, request-token limits, pre-abort, active cancellation, awaited process closure and closed-instance rejection passed. Network control is application-level: downloads are disabled and library/global JavaScript fetch are blocked after loading. It is not an operating-system firewall or a claim that arbitrary dependencies cannot use a different network API.

Phone runtime, native integration, aggregate device memory, sustained thermal behavior and whole-device energy remain unmeasured. These cloud figures do not satisfy the mobile resource goals from the R&D plan.

## Licensing And Supply Chain

Base [Qwen model](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct) declares Apache-2.0. The pinned [ONNX conversion](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct) identifies that base but omits separate license metadata. Original wrapper code is Apache-2.0; weights are downloaded only with explicit integrator opt-in and are not bundled in the SDK or website. Commercial deployment/redistribution diligence remains open. Permissive wrapper code is not an upstream data-rights warranty.

Archived NLI option: `Xenova/nli-deberta-v3-small` at `6bc2a55c7c0f7e2bc68de60bb248e523e2612abb`, q8, upstream `cross-encoder/nli-deberta-v3-small` at `fa2804872c3b4bd748f38c0185cc85775361e735`. Upstream metadata declares Apache-2.0; conversion metadata has no separate license declaration. It failed the development gate. Its model file, tokenizer and runtime fingerprints are in its archived receipts.

## Next Gate

Do not sell this as a reliable or low-power mobile AI engine. Retain the current failure evidence, collect permitted independently human-labelled tasks, develop a task-specific classifier/adaptation with a separate calibration set, and reserve new confirmation data before another quality claim. Do not repeatedly generate easier tests until a target is reached. The [device integration handbook](https://arindamchatterjee0007.github.io/pocketroute-lab/downloads/pocketroute-device-integration.pdf) separates the missing native-harness prerequisite from offline, memory, latency, thermal and whole-device energy acceptance. No APK, iOS artifact or phone test is claimed.