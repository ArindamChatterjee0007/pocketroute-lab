export const choiceLabels = Object.freeze({ maintenance: "maintenance", delivery: "delivery", inspection: "inspection", review: "review" });

export function decodeChoice(output) {
  if (typeof output !== "string") return null;
  const choice = output.trim();
  return Object.hasOwn(choiceLabels, choice) ? choiceLabels[choice] : null;
}

export function validateChoiceTokenIds(encodedChoices) {
  const ids = Object.keys(choiceLabels).map(choice => {
    const encoded = encodedChoices[choice];
    if (!Array.isArray(encoded) || encoded.length !== 1 || !Number.isSafeInteger(encoded[0]) || encoded[0] < 0) throw new Error("Each output choice must map to exactly one valid tokenizer token.");
    return encoded[0];
  });
  if (new Set(ids).size !== ids.length) throw new Error("Output choices must use distinct tokenizer tokens.");
  return ids;
}