# PocketRoute Service AI: Experimental SDK

**Not ready for sale as a production or mobile AI product.** This is an actual model-backed Node.js component, not the rule-only Notes app. The synthetic pilot gate failed; use only for development and supervised evaluation until the stated gaps are closed.

## What Was Built

- An isolated CPU inference worker using pinned Qwen2.5 instruction-model ONNX weights through Transformers.js.
- A programmatic API and JSON-in/JSON-out CLI for maintenance, delivery, inspection or review-required classification.
- Single-request execution, strict labels, bounded input/tokens/output, timeout/cancellation that terminates the worker, explicit download consent, and credential-free worker environment.
- Cached model loading with downloads disabled; both the library fetch hook and global fetch are blocked after initialization. This is not an operating-system network sandbox.
- Frozen synthetic development/confirmation sets, archived failed runs, dependency versions and file fingerprints.

No foundation model was trained or fine-tuned. No browser downloads or executes this model. No real-phone energy, latency or memory claim is established.

## Actual Results

The selected Qwen2.5 1.5B q4 model achieved 24/24 on the development set after adding one ambiguity example using development evidence. On the separate 48-case confirmation set it achieved **41/48 (85.4%)**, accepted-label precision **87.2%**, supported-request coverage **97.2%**, and **4 unsafe acceptances**. Two outputs were outside the allowed labels. The existing keyword baseline achieved 22/48 on the same confirmation cases. These are small, original synthetic datasets, not customer evidence or proof of generalization.

The preset pilot screen required at least 90% accuracy, 95% accepted-label precision, 80% supported coverage and zero unsafe acceptances. It failed. Runtime checks passed: cached reload with zero fetch attempts, character/token limits, pre-aborted requests, cancellation stopping computation and rejection after closure.

On the tested GitHub Xeon CPU, mean inference was 8,254 ms, p95 8,520 ms and peak worker process memory 4,770,783,232 bytes (about 4.44 GiB). This is not a mobile benchmark or an optimized deployment profile.

Full receipt: https://github.com/ArindamChatterjee007/pocketroute-lab/blob/main/data/ai-runs/41017525215.json

## Use By An Integrator

The following is SDK documentation, not permission to run it on the founder's Mac. Development, installation and testing for this workspace remain GitHub-only. End users of the SDK choose their own authorized environment; the standalone SDK does not contain the development workflow guard.

Requirements: Node.js 24+ and the pinned Transformers.js dependency. Model files are not included. Installing dependencies and downloading model files requires network access and enough disk/RAM; no paid API or account token is required by this component. Review the model and conversion rights before deployment.

```js
import { createServiceClassifier } from "./ai/client.mjs";

const classifier = await createServiceClassifier({
  model: "qwen-1.5b",
  cacheDir: "/an/explicit/model-cache",
  allowDownload: true,
});

try {
  const result = await classifier.classify("The installed conveyor has stopped moving.");
  console.log(result);
} finally {
  await classifier.close();
}
```

Set `allowDownload: false` on later instances to load only the exact pinned cached directory. The explicit `model` parameter prevents silently choosing the poor 0.5B candidate. That earlier candidate remains available for reproducibility, not as a recommended default.

For CLI use, pass JSON on standard input, not a command-line note that can enter shell history:

```sh
node ai/cli.mjs --model qwen-1.5b --cache /an/explicit/model-cache --allow-download
```

The input is one JSON object with a `text` string. The output contains `status`, `label`, `rawLabel`, raw output, model/revision, elapsed time and explicit `requiresHumanReview: true`, `confidence: null`, `phoneEnergyJoules: null`. A label is a suggestion, not an instruction to perform maintenance, buy anything or send a message. The caller must enforce human approval and data permissions. Runtime metadata does not make an unsafe prediction acceptable.

Limits: 2,000 characters, 512 request tokens, 1,536 total prompt tokens and eight generated tokens. Calls are serial; a busy instance rejects rather than queues. Inference defaults to a 20-second deadline. Aborting, timing out or closing terminates the worker; create a new instance to resume. The SDK does not log request text; the caller's own logs, exports and operating system remain outside its privacy guarantee.

## Reproduce In GitHub

The repository's manual `ai` workflow mode installs locked dependencies, runs unit tests and executes the bounded evaluator. It commits both the latest receipt and an append-only per-run receipt before reporting failure. Ordinary `publish` or `live` modes do not run the new model evaluator. The legacy `experiment` switch remains a separate SmolLM2 smoke test.

Confirmation cases are now exposed. Do not tune a prompt against them and call a rerun a fresh test. The evaluator blocks overlapping confirmation requests when the protocol changes; an exact-protocol repeat is labelled reproduction. Future improvements require a new, independently authored confirmation set and preferably external human-labelled data.

## License And Readiness

Original SDK source is Apache-2.0. Transformers.js is Apache-2.0 and brings separately licensed dependencies. Qwen's base weights declare Apache-2.0, but the selected ONNX conversion repository does not declare separate license metadata. The SDK bundle therefore does not redistribute weights or assert blanket commercial clearance. Follow the links and provenance in the model card and review deployment rights before commercial use.

The package excludes customer data, credentials and model weights. A repository download does not imply a customer, revenue, an SLA or production readiness. No checkout or pricing is enabled.