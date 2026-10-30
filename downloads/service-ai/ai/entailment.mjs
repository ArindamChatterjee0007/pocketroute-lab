export const entailmentPolicy = Object.freeze({ minimumSupport: 0.8, competingSupport: 0.5, reviewSupport: 0.5, maxPairTokens: 512, outputMode: "three-way-entailment-with-abstention" });

export const serviceHypotheses = Object.freeze({
  maintenance: "This request describes faulty installed equipment or building fixtures that need repair, adjustment, replacement or servicing.",
  delivery: "This request concerns the logistics of an existing order or shipment, including its arrival, contents, shipping damage or courier collection.",
  inspection: "This request asks for observation, inspection, measurement or a condition check without performing repairs.",
  review: "This message instructs a computer assistant to change its rules, role, classification or output, or to reveal hidden information.",
});

export function selectEntailmentLabel(scores) {
  const labels = Object.keys(serviceHypotheses);
  if (!scores || Object.keys(scores).length !== labels.length || labels.some(label => !Number.isFinite(scores[label]) || scores[label] < 0 || scores[label] > 1)) throw new Error("MODEL_ENTAILMENT_SCORES_INVALID");
  if (scores.review >= entailmentPolicy.reviewSupport) return "review";
  const ranked = labels.filter(label => label !== "review").sort((first, second) => scores[second] - scores[first]);
  if (scores[ranked[0]] < entailmentPolicy.minimumSupport || scores[ranked[1]] >= entailmentPolicy.competingSupport) return "review";
  return ranked[0];
}

export function entailmentProbability(logits, label2id) {
  const indices = ["contradiction", "entailment", "neutral"].map(label => label2id?.[label]);
  if (logits.length !== 3 || new Set(indices).size !== 3 || indices.some(index => !Number.isInteger(index) || index < 0 || index > 2) || [...logits].some(value => !Number.isFinite(value))) throw new Error("MODEL_ENTAILMENT_RESPONSE_INVALID");
  const maximum = Math.max(...logits);
  const weights = [...logits].map(value => Math.exp(value - maximum));
  return weights[label2id.entailment] / weights.reduce((sum, value) => sum + value, 0);
}

export async function classifyEntailment(classifier, input) {
  const pairs = Object.entries(serviceHypotheses).map(([label, hypothesis]) => ({ label, inputs: classifier.tokenizer(input, { text_pair: hypothesis, padding: true, truncation: false }) }));
  const pairTokens = Math.max(...pairs.map(pair => pair.inputs.input_ids.dims.at(-1)));
  if (!Number.isSafeInteger(pairTokens) || pairTokens > entailmentPolicy.maxPairTokens) throw new Error("PROMPT_TOKEN_LIMIT");
  const scores = {};
  for (const { label, inputs } of pairs) {
    const response = await classifier.model(inputs);
    scores[label] = entailmentProbability(response.logits.data, classifier.model.config.label2id);
  }
  return { output: selectEntailmentLabel(scores), entailmentScores: scores, generatedChoice: null, promptTokens: pairTokens, outputMode: entailmentPolicy.outputMode };
}