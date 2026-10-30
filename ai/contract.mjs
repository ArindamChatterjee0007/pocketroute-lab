export const serviceLabels = Object.freeze(["maintenance", "delivery", "inspection", "review"]);
export const requestCharacterLimit = 2000;
export const requestTokenLimit = 512;

export function validateServiceRequest(text) {
  if (typeof text !== "string" || !text.trim()) throw new TypeError("A service request is required.");
  if (text.length > requestCharacterLimit) throw new RangeError(`A service request must not exceed ${requestCharacterLimit} characters.`);
  return text.trim();
}

export function parseServiceLabel(output) {
  if (typeof output !== "string") return null;
  const label = output.trim().toLowerCase();
  return serviceLabels.includes(label) ? label : null;
}

export function summarizeClassification(cases) {
  if (!Array.isArray(cases) || !cases.length) throw new TypeError("A nonempty evaluated case set is required.");
  const seen = new Set();
  const labels = Object.fromEntries(serviceLabels.map(label => [label, { total: 0, correct: 0 }]));
  let correct = 0;
  let accepted = 0;
  let acceptedCorrect = 0;
  let unsafeAcceptances = 0;
  let invalidOutputs = 0;
  for (const entry of cases) {
    if (!entry || typeof entry.id !== "string" || seen.has(entry.id) || !serviceLabels.includes(entry.expected)) throw new TypeError("Invalid or duplicated evaluation case.");
    seen.add(entry.id);
    const prediction = parseServiceLabel(entry.output);
    labels[entry.expected].total += 1;
    if (prediction === entry.expected) { correct += 1; labels[entry.expected].correct += 1; }
    if (prediction === null) invalidOutputs += 1;
    if (prediction && prediction !== "review") {
      accepted += 1;
      if (prediction === entry.expected) acceptedCorrect += 1;
      if (entry.expected === "review") unsafeAcceptances += 1;
    }
  }
  const supported = cases.filter(entry => entry.expected !== "review").length;
  const supportedAccepted = cases.filter(entry => entry.expected !== "review" && ["maintenance", "delivery", "inspection"].includes(parseServiceLabel(entry.output))).length;
  return { total: cases.length, correct, accuracy: correct / cases.length, accepted, acceptedCorrect, acceptedPrecision: accepted ? acceptedCorrect / accepted : null, supported, supportedAccepted, supportedCoverage: supported ? supportedAccepted / supported : null, unsafeAcceptances, invalidOutputs, labels, phoneEnergyJoules: null };
}

export function pilotGate(metrics) {
  const reasons = [];
  if (!metrics || metrics.total < 48) reasons.push("At least 48 frozen synthetic test cases are required.");
  if (!metrics || serviceLabels.some(label => (metrics.labels?.[label]?.total || 0) < 12)) reasons.push("Each category needs at least 12 test cases.");
  if (!metrics || metrics.accuracy < 0.9) reasons.push("Exact-label accuracy is below 90%.");
  if (!metrics || metrics.acceptedPrecision === null || metrics.acceptedPrecision < 0.95) reasons.push("Precision of accepted service labels is below 95%.");
  if (!metrics || metrics.supportedCoverage === null || metrics.supportedCoverage < 0.8) reasons.push("Coverage of supported requests is below 80%.");
  if (!metrics || metrics.unsafeAcceptances > 0) reasons.push("At least one review-required request was assigned a service label.");
  return { passed: reasons.length === 0, reasons, scope: "synthetic-pilot-screen-only", productionReady: false, phoneValidated: false };
}