# Bounded Qwen Adapter Experiment

For the consolidated work status, test results, artifact checksums and collaborator handoff, read the [November 14 R&D and test report](REPORT.md). Completed software checks do not clear the remaining model-quality or physical-phone gates.

## Two-Router Comparison: Completed

[Run 43618145866](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43618145866), source `71733da56bfe6c67b1c82fc216ccf099450ab864`, completed the exploratory TF-IDF versus frozen MiniLM comparison. [Preflight 43618045254](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43618045254) passed 35 contract tests. The [immutable comparison receipt](../../data/adapter-runs/comparison-43618145866.json) records both arms, four family-grouped training folds, all C candidates, predictions, exports and limitations.

| Arm | Development accuracy | Accepted precision | Supported coverage | Unsafe acceptances | Full gate |
| --- | --- | --- | --- | --- | --- |
| Word/character TF-IDF + logistic regression | 56/64, 87.5% | 40/40, 100% | 40/48, 83.33% | 0 | Failed accuracy |
| Frozen MiniLM + logistic regression | 62/64, 96.875% | 48/50, 96% | 48/48, 100% | 2 | Failed zero-unsafe requirement |

This is an execution/export pass, not a model-quality pass. The 64 development rows are exposed and contain only 16 underlying families. MiniLM corrected the eight infrastructure false rejections of TF-IDF, but accepted two framings of one mixed design/implementation request as architecture. Neither arm is independently qualified. The reserved confirmation set was not used or rebound, and no threshold was tuned on development.

Both arms selected C=10 from the fixed {0.1, 1, 10} grid by training-only out-of-fold log loss. C=10 is the edge of this grid, not proof of a globally optimal setting. TF-IDF vocabularies/IDFs were fitted inside training folds. The encoder remained frozen at `sentence-transformers/all-MiniLM-L6-v2`, revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`, with pinned weight SHA-256 `53aa51172d142c89d9012cce15ae4d6cc0ca6895895114379cacb4fab128d9db` and 90,868,376 weight-file bytes. Masked mean pooling and L2 normalization were used; no input was silently truncated.

An initial [attempt 43617679681](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43617679681) completed predictions but failed MiniLM's JSON probability round-trip because export lost numeric dtype. The [failed receipt](../../data/adapter-runs/comparison-43617679681.json) is retained. The reproduction changed only serialization precision handling; all predictions are identical. TF-IDF feature/head parity passed with maximum probability difference 2.22e-16. MiniLM classifier-head parity passed with maximum difference zero in float32, but reused in-memory embeddings: it is not full encoder/tokenizer or device reload evidence. Routed decisions, including exact-tie review behavior, also matched on balanced training probes.

JSON exports avoid pickle. The TF-IDF feature/head export is 388,326 bytes, SHA-256 `0d779425fa24ef863384223e05844c31663215718401b3b1f327c1e8d8878915`. The MiniLM head/reference export is 33,813 bytes, SHA-256 `704ccfdd512f7d8f63785a99b9c8ee13ca33084d0266ed32b6a8642d12e0784f`, excluding the required encoder and runtime. The comparison process recorded 5,341 ms and peak RSS 595,415,040 bytes; these are aggregate GitHub CPU development measurements, not per-request phone latency or energy. Arm timings include different setup/download work and must not be compared as inference benchmarks.

The artifact archive was verified before extraction with SHA-256 `0c8a652c8fe6eda562da06a5af6e49ce7d362429cb309f26782ed7a5ea99574b`; the receipt has SHA-256 `63150c0f3dc82dc68e13bec43ea51267403207f5f8a67ec64f23968ff32c55e0`. Research and review roles cross-reviewed design, implementation and results. Their requested GPT-6 Astra/Claude Fable 5.1 identities remain provider-unverified. No model weights, Qwen test binding, private data, production deployment or background service were changed.

Next options remain experiments, not fixes already delivered: training-only nested rejection calibration for MiniLM, or a separately frozen wider regularization check for the conservative TF-IDF arm. Do not choose a cutoff from these development errors or claim that a rule/agent consensus clears safety. Independent human-authored data, untouched confirmation, full runtime export and physical-device qualification remain necessary before readiness claims.

## Latest Result: Quality Still Blocked

[I3 run 43586761036](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43586761036), source `ae92339036b6c2815d13c1997b79e511a3390950`, completed all 432 updates and the base-integrity/zero-adapter/reload checks, but failed the unchanged quality screen. The [immutable receipt](../../data/adapter-runs/43586761036.json) records **57/64 correct (89.0625%)**, **42/47 accepted-label precision (89.36%)**, **46/48 supported coverage (95.83%)**, **one unsafe acceptance** and no invalid outputs. The base scored 13/64; I2 scored 47/64 on the same development screen. This is development-tuned evidence, not an independent generalization estimate.

Confirmation was withheld again; its cases and labels remain unchanged and unreviewed by the trainer author. The rule baseline's 64/64 is development-fitted and does not establish independent readiness. No specialist worker, physical phone, end-to-end generated project or production system is qualified by these results.

The I3 adapter is 2,175,168 bytes with SHA-256 `8f1a2701bc515a6bd2b40aba0f7c4b46ac1ab3601cb8b2234f6dab801352b212`, excluding its required base weights. Model-stage wall time was 681,528 ms and peak CPU training-process RSS was 4,652,834,816 bytes. Archive and adapter hashes were verified after download; the receipt has SHA-256 `c912f4c26906da528c8f223775000616ab77e023f1d9aa1db1510f5a2a9d60a1`. These are not phone inference or battery measurements.

All 24 contract checks passed before I3, including reserved-test binding and overlap validation without inference. The model step intentionally returned failure because quality failed. No thresholds were relaxed, no failed case was removed and no independent confirmation prediction was used for tuning. All model jobs are complete; no further training loop is scheduled.

## Routing Task Contract

Apply these boundaries to the requested work, not merely the technology words in the text:

| Route | Included work | Boundary |
| --- | --- | --- |
| A: Python | Implement, debug, refactor or test Python code | Implementation plus its own tests is one A deliverable; merely mentioning Python in a configuration/design request does not make it A |
| B: Infrastructure | Draft or change Docker, Compose, Kubernetes or Helm configuration artifacts | Configuration for a Python service is B; applying it to a live environment or executing operations is not allowed |
| C: Architecture | Requirements-to-design discussion, interfaces, component boundaries and design tradeoffs | No implementation or configuration artifact is requested; the presence of code or infrastructure terminology alone does not change the route |
| D: Review | Insufficient information, unsupported work, separate multi-role deliverables, actual operational execution, routing overrides or hidden-information requests | Do not collapse independent deliverables into a single specialist label; clarify or return unsupported |

Instruction overrides and operational-execution requests take precedence over an otherwise supported subject. Every route remains a suggestion requiring human review. A routing label is never permission to execute generated code, deploy infrastructure, access another application's data or take a real-world action.

Next evidence gate: a permitted, independently human-authored and labelled, non-templated evaluation set with adjudicated boundaries. Keep authors blind to these development examples and model predictions; include a separately assessed subset with two independent labels and record disagreements. A proposed first collection is at least 64 requests with at least 32 review-required requests, covering ordinary paraphrases and realistic unsupported/multi-deliverable cases. That collection is for task-contract validation and must not silently replace the existing balanced 64-case screening gate. Freeze its own sampling and acceptance protocol before scoring. No such human data, label agreement or user acceptance is currently available.

## I3 Development Recipe

I2 completed its updates but failed its quality gate. One bounded follow-up adds four original review families, lowers the learning rate to 0.0001 and trains a fresh rank-eight adapter for 432 updates over 144 texts (three shuffled epochs). No quality threshold, base model or runtime limit changes. Validation was used for error analysis and is development-tuned; it is not independent evidence.

The independent confirmation cases remain unused and unchanged. Only their protocol binding is updated, with explicit prior-binding provenance. The current protocol hash is `7a8011dfb4866ae907717ee6a1a2fc8c6848d7157097f392b02bd724d74de09f`; the unchanged case-array hash is `4733a27c5a70cdd371ccd3daf89fb4c98b96dde9cdd7ef30e5c9a4485cc17b9a`. The runtime still withholds confirmation unless validation passes. No success, phone readiness or specialist capability is claimed before the actual result.

## Routing Quality Cycle I2

The next candidate uses the same pinned Qwen2.5 0.5B base, with a fresh rank-eight q/v LoRA adapter, alpha 16, learning rate 0.0003 and 256 updates in two seeded shuffled epochs. The supervised loss is cross-entropy among the four final-position choice logits, matching the constrained inference decision rather than spending loss on assistant terminators. The documented `logits_to_keep=1` API avoids computing unused vocabulary logits at every prompt position. Input length is capped at 192 tokens without silent truncation.

The [I2 development corpus](https://github.com/ArindamChatterjee0007/pocketroute-lab/blob/bccd3a0b840e50099c0ac2aede7ebce214644b7d/ai/training/quality-data.json) expands 32 training families to 128 texts and 16 different validation families to 64 texts. Four framing variants per family are correlated; pairwise summaries use family means and remain descriptive. The [original confirmation binding](https://github.com/ArindamChatterjee0007/pocketroute-lab/blob/bccd3a0b840e50099c0ac2aede7ebce214644b7d/ai/training/quality-confirmation.json) contains 64 unique cases from 64 declared families, exactly 16 per class, and binds the frozen protocol hash `5aa1d5e83322a4f0251c7f5ba4ec0406f02a9bcec3423960abed6d13097ce9ac`. It was authored after candidate commit `4b283a8c788a33d25ae0815804cd18f126bf3272`, without implementation or model-output access. Independent AI authorship is not independent human or field validation.

The taxonomy follows the requested deliverable: Python implementation/debugging/tests, infrastructure configuration, architecture/design, or review. Incidental technology mentions are not additional tasks. Operational execution, unsupported requests, unclear context, separate multi-role deliverables and routing overrides require review. Every result still requires human confirmation and authorizes no tool execution.

The unchanged screen requires accuracy above 90%, accepted-label precision at least 95%, supported coverage at least 80%, zero observed unsafe acceptances, zero failed/invalid outputs and at least 16 cases per class. Rules, the untouched base and the trained adapter are scored separately. Both always-route and always-review fail. If adapter validation fails, confirmation inference is withheld. If it passes, the frozen independent cases are evaluated once; their results must not be used to tune this candidate. A failed screen produces a failed job with a preserved receipt and adapter, not a false success.

Reload and zero-adapter parity use eight deterministic probes from distinct families, two per class. This does not reduce the 64-case quality evaluations. The model-stage deadline remains 900 seconds and the standard-CPU job cap is 25 minutes; neither is a promise that arbitrary larger workloads fit. No local model execution, paid GPU/API, website deployment or automatic promotion is part of this cycle.

[Pre-training check 43581356206](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43581356206) passed 23 tests at workflow source `bccd3a0b840e50099c0ac2aede7ebce214644b7d`, with model steps skipped. [Quality run 43581419911](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43581419911) completed 256 updates and reload checks but failed validation: **47/64 correct**, **75% accepted precision**, **91.67% supported coverage**, **eight unsafe acceptances**. The untouched base scored 13/64; the development-fitted rules scored 64/64 and must not be called independently qualified. Confirmation was withheld. See the unchanged [I2 receipt](../../data/adapter-runs/43581419911.json).

The I2 model stage used 435,443 ms and peak process RSS 3,898,920,960 bytes on GitHub CPU, not a phone. The 2,175,168-byte adapter has SHA-256 `b632bf7e5a2d15ff8c1efe7b503f0c66bd281789936aebded6dc311944631d3b`. All 540,672 trainable adapter parameters were eligible for updates; frozen base hashes remained unchanged. The failed job and preserved artifact are the intended outcome when quality does not pass. The older smoke below remains distinct evidence.

## Original Adaptation Smoke

Status: one CPU adaptation smoke completed on November 13 UTC / November 14 IST. [Validation run 43505439413](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43505439413) passed eleven contract tests. [Training run 43505603555](https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/runs/43505603555), source `84d1cfbe795bb12b9948e3e3cbd2e1f998bd6e79`, performed eight real optimizer updates and passed zero-adapter and saved/reloaded choice-output checks. This is separate from the released Qwen2.5 1.5B service classifier and its failed 73/96 quality gate.

The immutable [cloud receipt](../../data/adapter-runs/43505603555.json) records 270,336 trainable adapter parameters, changed adapter tensors and unchanged frozen base tensors. The eight exposed development cases scored **2/8 before and 3/8 after training**, with **two unsafe acceptances in both** and no `review` predictions. This does not qualify the router or establish a statistically meaningful improvement. Supported coverage of 100% is not success: both systems assigned a service route to every request, including both review-required cases. Per-step losses concern different examples and must not be presented as a training-loss trend.

Model-stage wall time was 37,771 ms; peak process RSS was 4,576,899,072 bytes on the GitHub CPU training process, not phone inference. The adapter safetensors is 1,093,728 bytes with SHA-256 `054fcbf4d40a12fd8bab1c7efe3c8a79d678193219b8f7d5643e514f492cf6da`. Adapter size excludes the required base model. The archive digest was verified before extraction, and downloaded adapter file hashes match the receipt.

The original artifact's PEFT-generated README contains a runner-local base path and unfilled template text; its adapter configuration has the correct Hub ID and revision. Preserve that original artifact as evidence. The source now writes an explicit portable experimental card for future exports, with a focused regression test; it does not alter or rerun the recorded training. Frozen-base tensor digests are within-run parameter-name/content checks, not the upstream safetensors file hash.

The manual `PocketRoute adapter smoke` workflow uses a standard GitHub-hosted Linux CPU, a 25-minute job limit and a 900-second model-stage limit. It does not publish the website, overwrite old receipts, run on the Mac or start a recurring job. A successful smoke proves adapter updates and reload consistency, not useful specialization, model compression, distillation, general coding ability or phone suitability.

## Fixed Protocol

- Official `Qwen/Qwen2.5-0.5B-Instruct`, revision `7ae557604adf67be50417f59c2c2f167def9a775`, Apache-2.0; original safetensors, no remote model code or pickle weights.
- CPU FP32, batch one, eight AdamW updates, seed 42, rank-four LoRA on `q_proj`/`v_proj`, alpha eight, no dropout, learning rate 0.0002, 128-token cap and no truncation.
- Eight original AI-assisted training fixtures and eight exposed development fixtures. Declared families and exact normalized inputs are disjoint, but this is not semantic-independence or human-label evidence. Both splits were authored in the same process and cannot qualify a specialist.
- All prompt tokens are masked from loss. The supervised assistant completion is checked against independently computed shifted cross-entropy.
- Finite loss, nonzero finite gradients, changed adapter tensors, unchanged frozen base tensors, zero-adapter parity, and saved-versus-reloaded prediction/logit parity are required.
- The four constrained choices route to Python, infrastructure, architect or review. No worker specialist is invoked and generated code is never executed in this phase. Every suggestion requires human review.
- Compare the same eight development cases with the base and trained adapter; retain errors and every denominator. Accuracy improvements are descriptive only. No test-dependent training loop or automatic promotion exists.

## Evidence And Limitations

The one-day workflow artifact contains a receipt, original fixture, adapter safetensors/configuration, base license and resolved dependency list. Base weights are not republished. Receipts include source, fixture and model hashes, dependency versions, update losses, predictions, memory and elapsed time. Failures are retained. The model-stage memory check is a sampled stop rule, not an operating-system memory guarantee.

LoRA updates a small parameter subset. It does not reduce the base model's inference footprint. Merging and mobile quantization require separate regression checks and backend support; sharing a base between adapters is not assumed to work in the existing Android runtime. No physical Samsung or iPhone has been tested by this experiment.

Broader Python, Docker/Kubernetes and architecture training requires licensed task data and separate executable or human review criteria. Project context must be permission-scoped, not automatically incorporated into weights. Generated artifacts require a separate no-credentials, network-restricted sandbox; no real cluster deployment is authorized here.

## Sources Checked November 14, 2026

- [Official model metadata](https://huggingface.co/api/models/Qwen/Qwen2.5-0.5B-Instruct/revision/7ae557604adf67be50417f59c2c2f167def9a775) and [pinned model files](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/tree/7ae557604adf67be50417f59c2c2f167def9a775).
- [GitHub AI feature terms](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#j-ai-features-training-and-your-data): GitHub does not claim ownership of input/output; third-party rights and review remain the user's responsibility. This is not a blanket right to distill another provider's service. No bulk teacher API is used.
- Current PyPI metadata for [Transformers](https://pypi.org/pypi/transformers/5.23.0/json), [PEFT](https://pypi.org/pypi/peft/0.21.3/json), [Accelerate](https://pypi.org/pypi/accelerate/1.15.0/json), [Safetensors](https://pypi.org/pypi/safetensors/0.8.0/json) and [PyTorch](https://pypi.org/pypi/torch/2.15.0/json). No advisories were listed for these exact latest versions when checked; this is not a security guarantee or a substitute for dependency resolution evidence.

Research and review were requested through `GPT-6 Astra (copilot)` and `Claude Fable 5.1 (copilot)`. Both returned bounded reports. Provider-resolved runtime identities remain unverified. Neither report is a trained teacher/student model or device test.