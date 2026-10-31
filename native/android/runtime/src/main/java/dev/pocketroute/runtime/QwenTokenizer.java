package dev.pocketroute.runtime;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class QwenTokenizer {
    private final Map<String, Integer> vocabulary = new HashMap<>();
    private final Map<String, Integer> ranks = new HashMap<>();
    private final Map<String, Integer> added = new LinkedHashMap<>();
    private final Map<String, int[]> cache = new LinkedHashMap<String, int[]>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, int[]> entry) {
            return size() > 2048;
        }
    };
    private final char[] bytes = new char[256];
    private final Pattern split;

    public QwenTokenizer(JSONObject tokenizer) throws JSONException {
        if (!tokenizer.getJSONObject("normalizer").getString("type").equals("NFC")) throw new IllegalArgumentException("Unsupported tokenizer normalization.");
        JSONObject model = tokenizer.getJSONObject("model");
        if (!model.getString("type").equals("BPE") || model.optBoolean("byte_fallback", false)
                || model.optBoolean("ignore_merges", false) || !model.isNull("dropout")) {
            throw new IllegalArgumentException("Unsupported BPE configuration.");
        }
        JSONObject pre = tokenizer.getJSONObject("pre_tokenizer");
        if (!pre.getString("type").equals("Sequence")) throw new IllegalArgumentException("Unsupported pre-tokenizer.");
        JSONArray stages = pre.getJSONArray("pretokenizers");
        if (stages.length() != 2) throw new IllegalArgumentException("Unexpected pre-tokenizer stages.");
        JSONObject separator = stages.getJSONObject(0);
        JSONObject byteLevel = stages.getJSONObject(1);
        if (!separator.getString("type").equals("Split") || !separator.getString("behavior").equals("Isolated")
                || separator.getBoolean("invert") || !byteLevel.getString("type").equals("ByteLevel")
                || byteLevel.getBoolean("add_prefix_space") || byteLevel.getBoolean("use_regex")) {
            throw new IllegalArgumentException("Unsupported byte-level tokenization.");
        }
        String pattern = separator.getJSONObject("pattern").getString("Regex");
        pattern = pattern.replace("[^\\s", "[^" + Protocol.SPACE_BODY).replace("\\s", "[" + Protocol.SPACE_BODY + "]");
        split = Pattern.compile(pattern);
        JSONObject vocab = model.getJSONObject("vocab");
        for (Iterator<String> keys = vocab.keys(); keys.hasNext();) {
            String key = keys.next();
            vocabulary.put(key, vocab.getInt(key));
        }
        JSONArray merges = model.getJSONArray("merges");
        for (int index = 0; index < merges.length(); index++) {
            Object merge = merges.get(index);
            String first;
            String second;
            if (merge instanceof JSONArray) {
                JSONArray pair = (JSONArray) merge;
                if (pair.length() != 2) throw new IllegalArgumentException("Invalid BPE merge.");
                first = pair.getString(0);
                second = pair.getString(1);
            } else if (merge instanceof String) {
                String pair = (String) merge;
                int boundary = pair.indexOf(' ');
                if (boundary < 1) throw new IllegalArgumentException("Invalid BPE merge.");
                first = pair.substring(0, boundary);
                second = pair.substring(boundary + 1);
            } else throw new IllegalArgumentException("Invalid BPE merge type.");
            if (ranks.put(first + '\0' + second, index) != null) throw new IllegalArgumentException("Duplicate BPE merge.");
        }
        JSONArray extra = tokenizer.getJSONArray("added_tokens");
        for (int index = 0; index < extra.length(); index++) {
            JSONObject token = extra.getJSONObject(index);
            if (token.getBoolean("normalized") || token.getBoolean("single_word") || token.getBoolean("lstrip") || token.getBoolean("rstrip")) {
                throw new IllegalArgumentException("Unsupported added-token matching.");
            }
            String content = token.getString("content");
            if (content.isEmpty() || added.put(content, token.getInt("id")) != null) throw new IllegalArgumentException("Invalid added token.");
        }
        int extraByte = 256;
        for (int value = 0; value < 256; value++) {
            boolean visible = value >= 33 && value <= 126 || value >= 161 && value <= 172 || value >= 174;
            bytes[value] = (char) (visible ? value : extraByte++);
        }
    }

    public long[] encode(String input) {
        List<Integer> result = new ArrayList<>();
        int cursor = 0;
        while (cursor < input.length()) {
            String selected = null;
            int position = input.length();
            for (String token : added.keySet()) {
                int found = input.indexOf(token, cursor);
                if (found >= 0 && (found < position || found == position && (selected == null || token.length() > selected.length()))) {
                    selected = token;
                    position = found;
                }
            }
            ordinary(input.substring(cursor, position), result);
            if (selected == null) break;
            result.add(added.get(selected));
            cursor = position + selected.length();
        }
        long[] tokens = new long[result.size()];
        for (int index = 0; index < tokens.length; index++) tokens[index] = result.get(index);
        return tokens;
    }

    private void ordinary(String text, List<Integer> output) {
        text = Normalizer.normalize(text, Normalizer.Form.NFC);
        Matcher matcher = split.matcher(text);
        int cursor = 0;
        while (matcher.find()) {
            if (matcher.start() > cursor) appendPiece(text.substring(cursor, matcher.start()), output);
            appendPiece(matcher.group(), output);
            cursor = matcher.end();
        }
        if (cursor < text.length()) appendPiece(text.substring(cursor), output);
    }

    private void appendPiece(String text, List<Integer> output) {
        if (text.isEmpty()) return;
        int[] known = cache.get(text);
        if (known == null) {
            StringBuilder wellFormed = new StringBuilder();
            for (int index = 0; index < text.length(); index++) {
                char character = text.charAt(index);
                if (Character.isHighSurrogate(character)) {
                    if (index + 1 < text.length() && Character.isLowSurrogate(text.charAt(index + 1))) {
                        wellFormed.append(character).append(text.charAt(++index));
                    } else wellFormed.append('\uFFFD');
                } else wellFormed.append(Character.isLowSurrogate(character) ? '\uFFFD' : character);
            }
            List<String> parts = new ArrayList<>();
            for (byte value : wellFormed.toString().getBytes(StandardCharsets.UTF_8)) parts.add(String.valueOf(bytes[value & 0xFF]));
            while (parts.size() > 1) {
                int best = -1;
                int rank = Integer.MAX_VALUE;
                for (int index = 0; index + 1 < parts.size(); index++) {
                    Integer candidate = ranks.get(parts.get(index) + '\0' + parts.get(index + 1));
                    if (candidate != null && candidate < rank) {
                        best = index;
                        rank = candidate;
                    }
                }
                if (best < 0) break;
                parts.set(best, parts.get(best) + parts.remove(best + 1));
            }
            known = new int[parts.size()];
            for (int index = 0; index < known.length; index++) {
                Integer token = vocabulary.get(parts.get(index));
                if (token == null) throw new IllegalArgumentException("The tokenizer cannot encode a byte sequence.");
                known[index] = token;
            }
            cache.put(text, known);
        }
        for (int token : known) output.add(token);
    }
}
