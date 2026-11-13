# Bounded Qwen Adapter Experiment

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