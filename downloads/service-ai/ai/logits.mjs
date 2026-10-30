import { LogitsProcessor } from "@huggingface/transformers";
import { validateChoiceTokenIds } from "./labels.mjs";

export class ServiceChoiceLogitsProcessor extends LogitsProcessor {
  constructor(encodedChoices) {
    super();
    this.tokenIds = validateChoiceTokenIds(encodedChoices);
  }

  _call(inputIds, logits) {
    for (let batch = 0; batch < inputIds.length; batch += 1) {
      const scores = logits[batch].data;
      const retained = this.tokenIds.map(id => scores[id]);
      if (retained.some(value => !Number.isFinite(value))) throw new Error("MODEL_CHOICE_SCORES_INVALID");
      scores.fill(-Infinity);
      this.tokenIds.forEach((id, index) => { scores[id] = retained[index]; });
    }
    return logits;
  }
}