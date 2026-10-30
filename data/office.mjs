export const project = {
  name: "PocketRoute",
  repository: "https://github.com/ArindamChatterjee0007/pocketroute-lab",
  workflow: "https://github.com/ArindamChatterjee0007/pocketroute-lab/actions/workflows/cloud.yml",
  date: "2026-10-30",
  scope: "Public research snapshot",
};

export const units = [
  { id: "b01", number: "01", name: "Astrology Lab", category: "Consumer experience", status: "Operating", tone: "amber", icon: "sparkles", detail: "Free web experience with founder-reviewed fulfilment.", href: "https://astrology-lab-readings.pages.dev/" },
  { id: "b02", number: "02", name: "Services Studio", category: "Direct-client services", status: "Discovery", tone: "cyan", icon: "briefcase-business", detail: "Scoped software delivery and public synthetic case studies.", href: "https://arindamchatterjee007.github.io/business-02-demos/" },
  { id: "b03", number: "03", name: "PocketRoute", category: "Mobile AI research", status: "Prototyping", tone: "mint", icon: "network", detail: "Offline task intelligence. Evidence before efficiency claims.", href: "#lab" },
];

export const tasks = [
  { id: "B03-001", unit: "b03", title: "Frame the mobile AI thesis", phase: "Inception", owner: "Coordinator", status: "done", priority: "P1", acceptance: "Bounded tasks, alternatives and a falsifiable efficiency hypothesis recorded.", dependency: "None", evidence: "Research charter" },
  { id: "B03-002", unit: "b03", title: "Challenge the architecture", phase: "Inception", owner: "Research", status: "done", priority: "P1", acceptance: "Primary-source research and separate technical/commercial reviews returned.", dependency: "B03-001", evidence: "19-source research ledger" },
  { id: "B03-003", unit: "b03", title: "Define the benchmark protocol", phase: "Inception", owner: "Evaluation", status: "done", priority: "P1", acceptance: "Quality, aggregate memory, whole-device energy and stop rules specified. Not experimental proof.", dependency: "B03-002", evidence: "Protocol draft 0.1" },
  { id: "B03-004", unit: "b03", title: "Verify device and release readiness", phase: "Construction", owner: "Founder", status: "blocked", priority: "P0", acceptance: "Actual phone, energy instrumentation, model artifact rights and publication scope recorded.", dependency: "Physical device and instrumentation", evidence: "Phone energy remains unmeasured" },
  { id: "B03-005", unit: "b03", title: "Prepare the evaluation corpus", phase: "Construction", owner: "Evaluation", status: "ready", priority: "P1", acceptance: "Disjoint original synthetic cases and human-scoring rubric; a smoke fixture is not the full corpus.", dependency: "Protocol draft", evidence: "360 development cases proposed" },
  { id: "B03-006", unit: "b03", title: "Establish the native baseline", phase: "Construction", owner: "Mobile runtime", status: "blocked", priority: "P1", acceptance: "A useful single-model baseline measured on a real phone at the fixed quality bar.", dependency: "B03-004, B03-005", evidence: "Not executed on a phone" },
  { id: "B03-007", unit: "b03", title: "Measure specialist switching", phase: "Construction", owner: "Research", status: "blocked", priority: "P1", acceptance: "Worker quality frontier and model-loading costs measured, including negative results.", dependency: "B03-006", evidence: "Awaiting native baseline" },
  { id: "B03-008", unit: "b03", title: "Compare routing strategies", phase: "Verification", owner: "Implementation + QA", status: "blocked", priority: "P1", acceptance: "Classifier and coordinator use the same workers; held-out correctness and resources reported.", dependency: "B03-007", evidence: "Cloud smoke is a separate early probe" },
  { id: "B03-009", unit: "b03", title: "Reproduce on a second device", phase: "Verification", owner: "Independent reviewer", status: "blocked", priority: "P1", acceptance: "Second Android SoC and independent reproduction of one configuration.", dependency: "B03-008 and reviewer availability", evidence: "No reviewer assignment implied" },
  { id: "B03-010", unit: "b03", title: "Prepare design-partner discovery", phase: "Operations", owner: "Commercial", status: "ready", priority: "P2", acceptance: "An opt-in interview brief and qualified workflow hypothesis; no unsolicited campaign.", dependency: "Customer research preparation", evidence: "No buyer interviews recorded" },
  { id: "B03-011", unit: "b03", title: "Release a verified mobile SDK", phase: "Operations", owner: "Release", status: "blocked", priority: "P2", acceptance: "Rights-cleared native release, independent evidence, notices and rollback. This dashboard is not that SDK.", dependency: "B03-009 and release rights", evidence: "Research dashboard is a separate release" },
  { id: "B03-012", unit: "b03", title: "Deliver the first funded pilot", phase: "Operations", owner: "Founder + delivery", status: "blocked", priority: "P2", acceptance: "Agreed scope, data permission, funding, acceptance and cash recorded separately.", dependency: "Buyer agreement", evidence: "No paid pilot established" },
];

export const sessions = [
  { id: "B03-R01", title: "Mobile architecture review", kind: "Research", status: "Returned", date: "2026-10-30", detail: "Routing overhead, shared-base adapters, cold/warm costs and quality-matched experiments.", model: "GPT-6 Astra requested; runtime unattested", outcome: "Compare simpler baselines before a coordinator SLM." },
  { id: "B03-R02", title: "Open-source business review", kind: "Commercial", status: "Returned", date: "2026-10-30", detail: "Code versus weight licenses, integration economics and buyer-validation gates.", model: "Claude Fable 5.1 requested; runtime unattested", outcome: "Earn through scoped delivery and support; acquisition is not the plan." },
  { id: "B03-R03", title: "Protocol consistency review", kind: "Verification", status: "Returned", date: "2026-10-30", detail: "Three protocol findings: whole-device measurement, aggregate memory and accepted-task counting.", model: "GPT-6 Astra requested; runtime unattested", outcome: "All three documented gaps corrected. No experimental reproduction claimed." },
];

export const modelCandidates = [
  { id: "smollm", name: "SmolLM2", size: "135M", role: "Cloud smoke probe", license: "Apache-2.0", status: "Cloud experiment", color: "mint", href: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct", detail: "Existing pretrained model. CPU inference on GitHub; not a new foundation model or a phone benchmark." },
  { id: "qwen-small", name: "Qwen3.5", size: "0.8B", role: "Coordinator candidate", license: "Apache-2.0 card", status: "Not tested", color: "cyan", href: "https://huggingface.co/Qwen/Qwen3.5-0.8B", detail: "Research candidate. Text-only conversion, quantized artifact and mobile runtime remain unverified." },
  { id: "qwen-base", name: "Qwen3.5", size: "2B", role: "Generalist candidate", license: "Apache-2.0 card", status: "Not tested", color: "amber", href: "https://huggingface.co/Qwen/Qwen3.5-2B", detail: "Single-model baseline or shared-adapter base after artifact and deployment qualification." },
  { id: "gemma", name: "Gemma 4", size: "E2B", role: "Mobile-oriented comparator", license: "Apache-2.0", status: "Not tested", color: "rose", href: "https://developers.google.com/edge/litert-lm/models/gemma-4", detail: "Documented LiteRT-LM path. Effective parameter names and download size do not establish peak RAM." },
];

export const sources = [
  ["S01", "Gemma 3n architecture", "Google", "Selective computation", "https://ai.google.dev/gemma/docs/gemma-3n"],
  ["S02", "Gemma release history", "Google", "Model freshness", "https://ai.google.dev/gemma/docs/releases"],
  ["S03", "Gemma 4 mobile deployment", "Google AI Edge", "Runtime", "https://developers.google.com/edge/litert-lm/models/gemma-4"],
  ["S04", "Gemma 4 license", "Google", "License", "https://ai.google.dev/gemma/apache_2"],
  ["S05", "Apple on-device models", "Apple ML Research", "Architecture", "https://machinelearning.apple.com/research/apple-foundation-models-2025-updates"],
  ["S06", "Foundation Models framework", "Apple Developer", "Runtime", "https://developer.apple.com/documentation/FoundationModels"],
  ["S07", "Gemini Nano", "Android Developers", "Platform alternative", "https://developer.android.com/ai/gemini-nano"],
  ["S08", "Qwen3.5 0.8B model card", "Qwen", "Model", "https://huggingface.co/Qwen/Qwen3.5-0.8B"],
  ["S09", "Qwen3.5 2B model card", "Qwen", "Model", "https://huggingface.co/Qwen/Qwen3.5-2B"],
  ["S10", "Qwen3 0.6B GGUF reference", "Qwen", "Earlier reference", "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF"],
  ["S11", "llama.cpp", "ggml-org", "Runtime", "https://github.com/ggml-org/llama.cpp"],
  ["S12", "Power Profiler", "Android Developers", "Measurement", "https://developer.android.com/studio/profile/power-profiler"],
  ["S13", "Macrobenchmark PowerMetric", "Android Developers", "Measurement", "https://developer.android.com/topic/performance/benchmarking/macrobenchmark-metrics#power"],
  ["S14", "Battery Historian limitations", "Android Developers", "Measurement", "https://developer.android.com/topic/performance/power/setup-battery-historian"],
  ["S15", "RouteLLM original paper", "Research paper", "Routing prior art", "https://arxiv.org/html/2406.18665v1"],
  ["S16", "Phi-3 technical report", "Microsoft Research", "Phone inference prior art", "https://arxiv.org/html/2404.14219v1"],
  ["S17", "Open Source AI Definition", "OSI", "Licensing standard", "https://opensource.org/ai/open-source-ai-definition"],
  ["S18", "Earlier Gemma terms", "Google", "License distinction", "https://ai.google.dev/gemma/terms"],
  ["S19", "LiteRT-LM", "Google AI Edge", "Runtime", "https://developers.google.com/edge/litert-lm"],
].map(([id, title, publisher, category, href]) => ({ id, title, publisher, category, href }));

export const milestones = [
  { title: "Frame the question", days: "01-07", state: "current", gate: "G0", detail: "Rights, actual devices, a disjoint corpus and valid measurement." },
  { title: "Establish the baseline", days: "08-21", state: "pending", gate: "G1 / G2", detail: "One useful small model, worker quality and an optimistic specialization bound." },
  { title: "Test the architecture", days: "22-35", state: "pending", gate: "G3-G5", detail: "Real loading costs, quality-qualified routing and sustained device behavior." },
  { title: "Reproduce the evidence", days: "36-60", state: "pending", gate: "G6", detail: "Independent reproduction, a second SoC and a rights-cleared release candidate." },
  { title: "Validate willingness to pay", days: "61-90", state: "pending", gate: "G7", detail: "One funded, bounded pilot with acceptance and payment tracked separately." },
];

export const samples = [
  { task: "extract", title: "Visit note", input: "Extract structured fields from this note: Site North-17. Inspection on 2026-10-29. Two filters need replacement." },
  { task: "classify", title: "Service request", input: "Classify this request: The delivery arrived with a damaged replacement part." },
  { task: "summarize", title: "Shift handover", input: "Summarize these notes: The team inspected three sites. Two visits were completed. The third visit needs a replacement sensor." },
];