# PocketRoute Service Classifier Model Card

Status: experimental, pilot-quality gate failed. Evaluation date: October 30, 2026 (India); authoritative timestamps are UTC in the receipts.

## Identity And Intended Use

Wrapper around pretrained `onnx-community/Qwen2.5-1.5B-Instruct`, revision `d54957e3af1be04546436e874a60fe386041b244`, q4 CPU inference. Base model `Qwen/Qwen2.5-1.5B-Instruct`, revision `989aa7980e4cf806f80c7fef2b1adb7bc71aa306`, 1,543,714,304 parameters. No training or fine-tuning by this project.

Intended use is supervised developer evaluation of English service-request classification. Out of scope: autonomous actions, safety-critical dispatch, payments/account changes, regulated decisions, general assistance, mobile-efficiency claims or unsupervised production routing.

## Evaluation Record

| Run | Result |
| --- | --- |
| [41016401990](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41016401990) | Initial development: 0.5B q8 3/24; 1.5B q4 23/24 with one unsafe acceptance. Confirmation withheld; runtime boundary check failed. |
| [41017074929](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41017074929) | Added a vague-request prompt example using development evidence only. 1.5B development 24/24. Cached tokenizer failed before any confirmation output; no test result claimed. |
| [41017525215](https://github.com/ArindamChatterjee007/pocketroute-lab/actions/runs/41017525215) | Repaired pinned-directory loading without changing model/prompt/test inputs. Development 24/24, confirmation 41/48, full runtime checks completed. Pilot gate failed. |

Final evaluated source: `9f98ca794a7b00bf8268fdbb2399ce31f1aeeb95`. The complete [per-run receipt](https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/ai-runs/41017525215.json) includes raw outputs, exact model/tokenizer file hashes, dataset and prompt hashes, versions and failures. Execution completion is not model-quality acceptance.

## Data And Metrics

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

## Runtime Evidence

GitHub-hosted Linux, Intel Xeon Platinum 8370C, Node v24.22.1, Transformers.js 4.3.2, ONNX Runtime Node 1.30.0, two inference threads. Mean inference 8,254 ms; p50 8,226 ms; p95 8,520 ms; peak worker RSS 4,770,783,232 bytes. Fixed few-shot prompts, greedy decoding and at most eight output tokens. Context budgets are documented in the SDK.

Cached pinned-directory reload and fixed-text tokenizer readiness passed without fetch attempts. Oversized input, request-token limits, pre-abort, active cancellation, awaited process closure and closed-instance rejection passed. Network control is application-level: downloads are disabled and library/global JavaScript fetch are blocked after loading. It is not an operating-system firewall or a claim that arbitrary dependencies cannot use a different network API.

Phone runtime, native integration, aggregate device memory, sustained thermal behavior and whole-device energy remain unmeasured. These cloud figures do not satisfy the mobile resource goals from the R&D plan.

## Licensing And Supply Chain

Base [Qwen model](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct) declares Apache-2.0. The pinned [ONNX conversion](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct) identifies that base but omits separate license metadata. Original wrapper code is Apache-2.0; weights are downloaded only with explicit integrator opt-in and are not bundled in the SDK or website. Commercial deployment/redistribution diligence remains open. Permissive wrapper code is not an upstream data-rights warranty.

## Next Gate

Do not sell this as a reliable or low-power mobile AI engine. Retain the current failure evidence, collect permitted independently labelled tasks, develop a lighter classifier or task-specific adaptation, and reserve fresh confirmation data before another quality claim. Any subsequent optimized runtime must be tested separately on actual target devices.