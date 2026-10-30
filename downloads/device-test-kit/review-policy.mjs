const reviewRules = Object.freeze([
  ["instruction-override", /\b(ignore|disregard|override|forget|bypass)\b[\s\S]{0,80}\b(instructions?|rules?|polic(?:y|ies)|system|prompt|categor(?:y|ies)|request)\b/i],
  ["role-override", /\b(you are now|act as|pretend to be)\b/i],
  ["forced-answer", /\b(output|reply|respond|answer)\b[\s\S]{0,60}\b(only|exactly|maintenance|delivery|inspection|review)\b|\bprint\s+(?:only\s+)?(?:the\s+)?(?:word|label|category)\b/i],
  ["hidden-information", /\b(reveal|show|expose|print|give)\b[\s\S]{0,60}\b(system prompt|hidden config(?:uration)?|credentials?|api keys?|passwords?)\b/i],
  ["unsupported-content-generation", /\b(write|generate|create|compose|implement)\b[\s\S]{0,70}\b(program|javascript|python|html|sql|function|algorithm|poem|story|essay)\b/i],
  ["unsupported-weather-query", /\b(weather forecast|forecast the weather|what(?:'s| is) the weather|will it (?:rain|snow)|(?:weather|rain) (?:forecast|tomorrow))\b/i],
]);

export function reviewPolicyReason(input) {
  if (typeof input !== "string") throw new TypeError("Review policy requires text.");
  const normalized = input.normalize("NFKC");
  return reviewRules.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
}