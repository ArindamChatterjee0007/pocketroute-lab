# PocketRoute Android Lab And Runtime

An experimental native Android reference port, with an app and a reusable AAR. Check the accompanying build/VM receipts before describing a particular artifact as tested. Source implementation alone is not a passed test.

The port retains the pinned Qwen2.5 1.5B q4 graph, request limits, system message, 16 examples, reject-only policy and four-choice decoding. The existing synthetic reference failed its quality gate at 73/96. Native backend results are a separate, fingerprinted regression arm, not a new independent quality evaluation.

## Folder Map

```text
native/android/
  app/                       Native UI and emulator instrumentation tests
  runtime/                   Reusable Java API, tokenizer and C++ ONNX bridge
    src/main/java/           Protocol, imports, worker and foreground client
    src/main/cpp/            Native prefill and four-score extraction
    src/test/                Cross-runtime golden-vector checks
  gradle/                    Wrapper and generated dependency verification
  tools/
    prepare.mjs              Pinned artifact verification and golden fixtures
    run-vm.mjs               Explicit emulator selection, execution and receipts
    package.mjs              APK signing, weight exclusion and artifact hashes
  out/                       Cloud-generated handover; never model weights
```

The build generates protocol assets and test vectors from the frozen reference. Test-only expected/reference labels never enter the runtime prompt or app assets. Third-party model files stay in the GitHub runner's temporary model directory, outside the source tree and upload allowlist.

## Build And Verify On GitHub

Use the existing **PocketRoute cloud build and experiment** workflow:

1. `android-prepare` bootstraps the Gradle wrapper, SHA-256 verification metadata and dependency locks, and runs JVM contract checks, lint and APK/AAR builds. This mode does not execute Android inference.
2. Review and commit the generated wrapper/verification/lock files without adding model files or a debug keystore.
3. `android` replays dependency verification strictly, then runs the Android API 36 x86_64 emulator with 8 GiB configured RAM and two cores. No cache, paid runner, device lab or local build is required or authorized.
4. Inspect the actual run conclusion and all native receipts. A green bootstrap is not a green VM run. A completed VM run is not physical-device qualification.

The native job is read-only with respect to repository contents. It does not publish the website, overwrite the frozen Node model receipt or submit an external post. GitHub artifact retention is seven days; copy the approved handover into the maintained delivery folder before those temporary downloads expire.

JDK 17, Gradle 9.6.0, AGP 9.4.1, SDK 36, build tools 36.0.0, NDK 28.2.13676358, CMake 3.22.1 and ONNX Runtime Android 1.31.1 are pinned. API 36 is the verified available platform/emulator baseline; AGP's documented maximum API 37 was not an available SDK package in the attempted runner setup. The failed attempt remains archived. The ONNX AAR supplies its native headers and libraries. Both x86_64 and arm64-v8a binaries are built; only the emulator ABI is exercised by this workflow.

## Install And Import Model Files

Use only an authorized test device/emulator. Verify the APK hash and debug certificate against `build-manifest.json` and `SHA256SUMS` before installation.

The app has **no Internet permission** and never downloads a model. Select **Import model files** and import exactly these two files from the pinned revision:

- [model_q4.onnx](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct/resolve/d54957e3af1be04546436e874a60fe386041b244/onnx/model_q4.onnx), approximately 1.79 GB.
- [tokenizer.json](https://huggingface.co/onnx-community/Qwen2.5-1.5B-Instruct/resolve/d54957e3af1be04546436e874a60fe386041b244/tokenizer.json), approximately 7 MB.

The manifest records exact byte counts and SHA-256 hashes. Imports use private application storage, a temporary file, digest verification and atomic replacement. Android's storage manager reserves space and may reclaim clearable cached data during an explicit import. Loading re-verifies both files; unknown names, incomplete files and mismatched hashes fail explicitly. Space for the temporary import is required. Base-model licensing and conversion-artifact rights remain separate; no weights are redistributed with the APK/AAR.

Tap **Load verified model**, enter one service request, then **Suggest category**. A suggestion never authorizes an action. **Stop and unload**, leaving the foreground, timeout or client closure terminates the separate inference process; termination is confirmed through Binder death. There is no background inference service or wake lock.

Debug certificates can differ between cloud builds. A later APK may not upgrade an earlier installation in place. Preserve any exports before a separately authorized reinstall. Never automatically uninstall an app, wipe a device or distribute the debug keystore.

## Reuse The AAR

The AAR requires Android API 26 or later and a built ABI; this is a build requirement, not a supported-phone claim. Include the complete AAR, including its native libraries, protocol asset, private service manifest and license notices.

Use one `InferenceClient` owner in the foreground:

```java
InferenceClient client = new InferenceClient(context, event -> {
    // Render the explicit status; suggestions still require human review.
});
client.load();
// After the "ready" event, on the main thread:
client.classify(requestId, text, 20000);
// On foreground exit:
client.cancel();
// When the owner is destroyed:
client.close();
```

`load`, `classify`, `cancel` and `close` run on the main thread; actual import, tokenization and ONNX work run off it. Busy/unloaded clients reject calls rather than queue work. Listen for terminal events and confirmed worker termination; never treat a timeout or a `stopping` event as a completed model response.

The C++ bridge reads four final-position logits directly rather than copying the entire vocabulary tensor into the Java heap. The Java tokenizer, exact JSON/chat formatting and policy must match every generated Transformers.js golden vector on both the JVM and Android. This is a checked port, not a generic tokenizer/model adapter. Unsupported graph inputs, shapes, dtypes or tokenizer settings fail closed.

## Read The Evidence

| File | Meaning |
| --- | --- |
| `build-manifest.json` | Tested source, toolchain, artifact hashes, signing and build-only/VM distinction |
| `preparation.json` | Model artifact fingerprints and tokenizer fixture provenance |
| `vm-contract.json` | Android golden vectors, file hashes and installed permission check |
| `vm-report.json` | Every frozen case, including failed/unavailable attempts; warm phase only |
| `vm-assessment.json` | Parity, non-regression and the separate synthetic quality screen |
| `vm-lifecycle.json` | Actual worker cancellation, timeout and concurrency evidence |
| `vm-ui.json` | Foreground app interaction and explicit unload |
| `android-verification.json` | Consolidated VM software outcome, not production approval |

No latency is a phone benchmark. Worker peak RSS is not aggregate app/process-tree peak memory. Aggregate peak memory, cold-phase qualification and whole-device energy remain unmeasured. The VM's 8 GiB configuration does not waive the original phone memory/latency budgets. New generalization claims require permitted human-labelled data and a fresh untouched confirmation set.

## Screenshots And Posting

Keep only final, readable, cloud-captured screenshots in the current handover. Label each as **Android emulator / synthetic request** and include the source/run reference. Do not use an emulator image as a photograph or proof of a physical phone, and do not show customer notes or private planning.

A technical update may describe the implemented native port, exact passing software checks and failed/open qualification gates. Keep older screenshots and negative-run receipts in the evidence archive rather than promoting them as current. External event/social submissions require a selected destination and approved final content; the private paper strategy and opportunity guide are not part of this public SDK.
