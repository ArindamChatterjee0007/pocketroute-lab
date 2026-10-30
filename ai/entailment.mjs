export const entailmentPolicy = Object.freeze({ minimumSupport: 0.8, competingSupport: 0.5, reviewSupport: 0.5, maxPairTokens: 512, outputMode: "independent-entailment-with-abstention" });

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

export async function classifyEntailment(classifier, input, requestTokens) {
  const hypotheses = Object.values(serviceHypotheses);
  const pairTokens = requestTokens + Math.max(...hypotheses.map(value => classifier.tokenizer.encode(value, { add_special_tokens: false }).length)) + 4;
  if (pairTokens > entailmentPolicy.maxPairTokens) throw new Error("PROMPT_TOKEN_LIMIT");
  const response = await classifier(input, hypotheses, { multi_label: true, hypothesis_template: "{}" });
  if (!Array.isArray(response.labels) || !Array.isArray(response.scores) || response.labels.length !== hypotheses.length || response.scores.length !== hypotheses.length || new Set(response.labels).size !== hypotheses.length) throw new Error("MODEL_ENTAILMENT_RESPONSE_INVALID");
  const scores = {};
  for (const [index, hypothesis] of response.labels.entries()) {
    const label = Object.keys(serviceHypotheses).find(value => serviceHypotheses[value] === hypothesis);
    if (!label) throw new Error("MODEL_ENTAILMENT_RESPONSE_INVALID");
    scores[label] = response.scores[index];
  }
  return { output: selectEntailmentLabel(scores), entailmentScores: scores, generatedChoice: null, promptTokens: pairTokens, outputMode: entailmentPolicy.outputMode };
}