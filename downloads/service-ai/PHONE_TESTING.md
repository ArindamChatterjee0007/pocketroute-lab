# Physical-Phone Test Plan

## What You Can Test Today

Open https://arindamchatterjee007.github.io/pocketroute-lab/ on a phone to inspect the dashboard. The separate Notes app can exercise its offline, rule-based workflow. Neither page runs the service SLM. Browser emulation and GitHub CPU results are not physical-phone inference evidence.

**No Android APK, iOS test app or validated phone result exists yet.** The current SDK uses Node child processes and cannot be installed directly as a native mobile app. The steps below describe the next qualification stage, not a released phone product.

## Before Installing Anything

1. Record an available, owned or explicitly authorized test phone's model, SoC, RAM, free storage, OS version and battery/thermal state. Do not record serial numbers or account identifiers. No hardware purchase is assumed.
2. Build an Android-first test harness on the existing free GitHub-hosted Linux workflow. Keep builds, dependency installation, automated checks and report processing off the founder's Mac. Actual on-device inference must, by definition, run on the phone.
3. Use a proven native inference runtime such as ONNX Runtime Mobile. Verify this exact pinned model's operators, quantization, tokenizer, chat template, context handling and constrained decoder on the chosen backend. General ONNX Mobile support is not proof that the current artifact works. A changed conversion/backend is a separately fingerprinted experimental arm.
4. Preserve explicit model-download consent, bounded requests, one active inference, cancellation, human review and no automatic external actions. Keep expected labels outside the model input. Expose measured backend, artifact hashes and errors; never silently fall back to a cloud API.
5. Publish the APK's source SHA, build receipt, SHA-256 and signing-certificate fingerprint. Review model/conversion/dependency rights before redistributing any weights. The existing SDK deliberately excludes weights. No new billing, paid runners or credential export is authorized.

This engineering prerequisite is still open. Do not download an unrelated APK or disable device security to substitute for it.

## Phone Steps Once The Harness Exists

1. Download the identified test APK from the personal project's verified GitHub release. Compare its published hash and signer using a trusted verification method. Install only through the phone's normal authorized test-install flow; do not root it or bypass warnings. Undo any temporary installer permission afterward.
2. On Wi-Fi, explicitly approve the pinned model download. Verify the app's completed artifact checks, available memory and readiness status. Stop on incompatibility or memory pressure rather than selecting an unrecorded fallback.
3. Enable airplane mode and explicitly switch off Wi-Fi and mobile data. Restart the app and submit a synthetic ticket. Capture the predicted label and runtime receipt. Offline success establishes an offline path, not proof of no egress when connectivity is later restored; inspect the harness's network policy/traces separately.
4. Run the frozen synthetic suite with the same model, prompt, tokenizer and decoding policy as the cloud receipt. Count every attempted case, abstention, invalid output, crash and timeout. Compare exact labels with cloud predictions. Once exposed, these cases measure reproduction/parity, not a fresh independent accuracy estimate. Do not submit private customer notes.
5. Measure cold and warm runs separately. Cold means a fresh process/model load with the declared filesystem-cache state; warm means the model is already resident. Record total p50/p95 completion time, load time, peak app memory plus non-overlapping accelerator allocations, and all failed attempts. Do not call a warm filesystem cache a fully cold boot.
6. Check cancel, repeated requests, background/resume, offline restart, bounded input and a 15-minute sustained session. Record throttling, thermal state, OS pressure, crashes and process kills. Do not keep inference running in the background solely to finish a test.
7. Export the synthetic-only JSON receipt and any authorized traces for processing on GitHub. Repeat on a second available SoC before making portability claims. Keep results for each phone/backend separate.

## Acceptance And Battery Claims

The original research gates remain unchanged:

- Classification target: strictly above 90% on the declared fresh synthetic confirmation set; accepted precision at least 95%, supported coverage at least 80%, and zero unsafe acceptances. Synthetic success does not establish customer or population accuracy.
- Starting mobile budget: aggregate peak resident memory at most 1.5 GiB, including the app, resident router/workers and non-overlapping accelerator allocations. Shared buffers count once; document the accounting method and OS pressure limits.
- Classification/extraction p95: at most 5 seconds warm and 10 seconds cold. Declare separate hard deadlines before testing; a p95 threshold is not a request timeout.
- No OOM/crash in the declared repeated suite; bounded cancellation and no unauthorized actions or content egress. Report missing instrumentation as blocked/inconclusive, not passing.
- Battery-saving gate: the lower 95% confidence bound of validated whole-device session-energy savings per accepted task must be at least 20% against the best eligible simpler baseline, with quality and coverage intact. Include loading, switching, failed attempts and declared idle intervals. Freeze the measurement protocol before confirmation.

Android Power Profiler/ODPM is available on supported Pixel 6 and later Pixel devices. It observes system-wide power rails, not isolated app energy; available rails may omit or overlap parts of whole-device consumption. Rail diagnostics alone cannot pass the whole-device gate. On other devices, use a validated device energy counter or authorized calibrated measurement setup. Battery percentage, CPU utilization, emulator timings and a USB charging meter alone do not prove energy savings. No measurement equipment has been obtained.

The current cloud memory result must not be used to waive the mobile budget. Native optimization and real measurements remain required.

## iPhone Is A Separate Gate

iOS needs a compatible native harness, an approved signing/distribution route and an authorized physical device. No iOS artifact, Apple membership, TestFlight access or paid subscription is assumed. Establish those prerequisites separately; do not claim Android results validate iPhone performance. Any future build environment must be separately authorized and remain off the founder's Mac.

## Official References

- ONNX Runtime Mobile and its operator/build references: https://onnxruntime.ai/docs/get-started/with-mobile.html
- Android Power Profiler, supported devices and measurement scope: https://developer.android.com/studio/profile/power-profiler
- Android Macrobenchmark PowerMetric: https://developer.android.com/topic/performance/benchmarking/macrobenchmark-metrics#power

Sources reviewed October 30, 2026. Runtime/device compatibility still requires an actual recorded test.