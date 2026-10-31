package dev.pocketroute.runtime;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class Protocol {
    private static final String START = "(?<![A-Za-z0-9_])";
    private static final String END = "(?![A-Za-z0-9_])";
    static final String SPACE_BODY = "\\x{09}-\\x{0D}\\x{20}\\x{A0}\\x{1680}\\x{2000}-\\x{200A}\\x{2028}\\x{2029}\\x{202F}\\x{205F}\\x{3000}\\x{FEFF}";
    private static final String SPACE = "[" + SPACE_BODY + "]";
    private static final Pattern OVERRIDE = words("ignore|disregard|override|forget|bypass");
    private static final Pattern RULES = words("instructions?|rules?|polic(?:y|ies)|system|prompt|categor(?:y|ies)|request");
    private static final Pattern ROLE = words("you are now|act as|pretend to be");
    private static final Pattern ANSWER = words("output|reply|respond|answer");
    private static final Pattern LABEL = words("only|exactly|maintenance|delivery|inspection|review");
    private static final Pattern PRINT = Pattern.compile(START + "print" + SPACE + "+(?:only" + SPACE + "+)?(?:the" + SPACE + "+)?(?:word|label|category)" + END, Pattern.CASE_INSENSITIVE);
    private static final Pattern REVEAL = words("reveal|show|expose|print|give");
    private static final Pattern SECRET = words("system prompt|hidden config(?:uration)?|credentials?|api keys?|passwords?");
    private static final Pattern WRITE = words("write|generate|create|compose|implement");
    private static final Pattern CONTENT = words("program|javascript|python|html|sql|function|algorithm|poem|story|essay");
    private static final Pattern WEATHER = words("weather forecast|forecast the weather|what(?:'s| is) the weather|will it (?:rain|snow)|(?:weather|rain) (?:forecast|tomorrow)");

    public final JSONObject manifest;
    public final int characterLimit;
    public final int requestTokenLimit;
    public final int promptTokenLimit;
    public final int initializationMs;
    public final int generationMs;
    public final int[] choiceIds = new int[4];
    public final String[] choices = new String[4];
    public final String[] labels = new String[4];
    public final double repetitionPenalty;
    private final String prefix;

    public Protocol(JSONObject manifest) throws JSONException {
        this.manifest = manifest;
        if (manifest.getInt("schemaVersion") != 1) throw new IllegalArgumentException("Unsupported protocol.");
        JSONObject limits = manifest.getJSONObject("limits");
        characterLimit = limits.getInt("characters");
        requestTokenLimit = limits.getInt("requestTokens");
        promptTokenLimit = limits.getInt("promptTokens");
        initializationMs = limits.getInt("initializationMs");
        generationMs = limits.getInt("generationMs");
        repetitionPenalty = manifest.getDouble("repetitionPenalty");
        if (characterLimit != 2000 || requestTokenLimit != 512 || promptTokenLimit != 2048 || initializationMs != 180000 || generationMs != 20000 || repetitionPenalty != 1.1) {
            throw new IllegalArgumentException("The frozen request contract changed.");
        }
        JSONArray configuredChoices = manifest.getJSONArray("choices");
        String[] expectedLabels = {"maintenance", "delivery", "inspection", "review"};
        Set<Integer> ids = new HashSet<>();
        if (configuredChoices.length() != 4) throw new IllegalArgumentException("Four choices are required.");
        for (int index = 0; index < 4; index++) {
            JSONObject choice = configuredChoices.getJSONObject(index);
            choices[index] = choice.getString("choice");
            labels[index] = choice.getString("label");
            choiceIds[index] = choice.getInt("tokenId");
            if (!choices[index].equals(String.valueOf((char) ('A' + index))) || !labels[index].equals(expectedLabels[index]) || choiceIds[index] < 0 || !ids.add(choiceIds[index])) {
                throw new IllegalArgumentException("Invalid choice mapping.");
            }
        }
        StringBuilder messages = new StringBuilder();
        appendMessage(messages, "system", manifest.getString("systemPrompt"));
        JSONArray examples = manifest.getJSONArray("examples");
        if (examples.length() != 16) throw new IllegalArgumentException("The frozen examples are required.");
        for (int index = 0; index < examples.length(); index++) {
            JSONObject example = examples.getJSONObject(index);
            appendMessage(messages, "user", requestJson(example.getString("input")));
            appendMessage(messages, "assistant", example.getString("choice"));
        }
        prefix = messages.toString();
    }

    public String validate(String input) {
        if (input == null || trim(input).isEmpty()) throw new IllegalArgumentException("A service request is required.");
        if (input.length() > characterLimit) throw new IllegalArgumentException("A service request must not exceed 2,000 characters.");
        return trim(input);
    }

    public String prompt(String text) {
        StringBuilder value = new StringBuilder(prefix);
        appendMessage(value, "user", requestJson(text));
        return value.append("<|im_start|>assistant\n").toString();
    }

    private static void appendMessage(StringBuilder value, String role, String content) {
        value.append("<|im_start|>").append(role).append('\n').append(content).append("<|im_end|>\n");
    }

    public static String requestJson(String text) {
        StringBuilder value = new StringBuilder("{\"request\":\"");
        for (int index = 0; index < text.length(); index++) {
            char character = text.charAt(index);
            switch (character) {
                case '"' -> value.append("\\\"");
                case '\\' -> value.append("\\\\");
                case '\b' -> value.append("\\b");
                case '\f' -> value.append("\\f");
                case '\n' -> value.append("\\n");
                case '\r' -> value.append("\\r");
                case '\t' -> value.append("\\t");
                default -> {
                    boolean unmatched = Character.isHighSurrogate(character)
                            ? index + 1 == text.length() || !Character.isLowSurrogate(text.charAt(index + 1))
                            : Character.isLowSurrogate(character) && (index == 0 || !Character.isHighSurrogate(text.charAt(index - 1)));
                    if (character < 0x20 || unmatched) value.append(String.format(Locale.ROOT, "\\u%04x", (int) character));
                    else value.append(character);
                }
            }
        }
        return value.append("\"}").toString();
    }

    public static String trim(String input) {
        int start = 0;
        int end = input.length();
        while (start < end && whitespace(input.charAt(start))) start++;
        while (end > start && whitespace(input.charAt(end - 1))) end--;
        return input.substring(start, end);
    }

    private static boolean whitespace(char value) {
        return value >= 0x09 && value <= 0x0D || value == 0x20 || value == 0xA0 || value == 0x1680
                || value >= 0x2000 && value <= 0x200A || value == 0x2028 || value == 0x2029
                || value == 0x202F || value == 0x205F || value == 0x3000 || value == 0xFEFF;
    }

    private static Pattern words(String value) {
        return Pattern.compile(START + "(?:" + value + ")" + END, Pattern.CASE_INSENSITIVE);
    }

    private static boolean boundedPair(String text, Pattern first, Pattern second, int limit) {
        // JavaScript's policy windows count UTF-16 units, not regex code points.
        Matcher left = first.matcher(text);
        while (left.find()) {
            Matcher right = second.matcher(text);
            if (right.find(left.end()) && right.start() - left.end() <= limit) return true;
        }
        return false;
    }

    public static String reviewReason(String input) {
        String text = Normalizer.normalize(input, Normalizer.Form.NFKC);
        if (boundedPair(text, OVERRIDE, RULES, 80)) return "instruction-override";
        if (ROLE.matcher(text).find()) return "role-override";
        if (boundedPair(text, ANSWER, LABEL, 60) || PRINT.matcher(text).find()) return "forced-answer";
        if (boundedPair(text, REVEAL, SECRET, 60)) return "hidden-information";
        if (boundedPair(text, WRITE, CONTENT, 70)) return "unsupported-content-generation";
        if (WEATHER.matcher(text).find()) return "unsupported-weather-query";
        return null;
    }
}
