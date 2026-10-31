package dev.pocketroute.runtime;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.BeforeClass;
import org.junit.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public final class ProtocolTest {
    private static Protocol protocol;
    private static QwenTokenizer tokenizer;
    private static JSONArray vectors;

    private static JSONObject resource(String name) throws Exception {
        try (InputStream stream = ProtocolTest.class.getClassLoader().getResourceAsStream(name)) {
            assertNotNull(name, stream);
            return new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    @BeforeClass
    public static void prepare() throws Exception {
        protocol = new Protocol(resource("protocol.json"));
        tokenizer = new QwenTokenizer(resource("tokenizer.json"));
        vectors = resource("vectors.json").getJSONArray("vectors");
        assertTrue("The complete frozen corpus and boundary fixtures are required.", vectors.length() > 96);
    }

    @Test
    public void everyGoldenRequestMatchesTheFrozenJavaScriptContract() throws Exception {
        for (int index = 0; index < vectors.length(); index++) {
            JSONObject vector = vectors.getJSONObject(index);
            String input = vector.getString("input");
            String label = "vector " + index;
            if (vector.getBoolean("rejected")) {
                assertThrows(label, IllegalArgumentException.class, () -> protocol.validate(input));
                continue;
            }
            String text = protocol.validate(input);
            assertEquals(label, vector.getString("text"), text);
            assertEquals(label, vector.getString("jsonRequest"), Protocol.requestJson(text));
            assertEquals(label, vector.isNull("policyReason") ? null : vector.getString("policyReason"), Protocol.reviewReason(text));
            long[] request = tokenizer.encode(text);
            assertArrayEquals(label + " request", tokens(vector.getJSONArray("requestTokens")), request);
            assertEquals(label, vector.getBoolean("requestTokenLimitExceeded"), request.length > protocol.requestTokenLimit);
            String prompt = protocol.prompt(text);
            assertEquals(label + " prompt bytes", vector.getString("prompt"), prompt);
            assertArrayEquals(label + " prompt tokens", tokens(vector.getJSONArray("promptTokens")), tokenizer.encode(prompt));
        }
    }

    @Test
    public void eachChoiceIsOneDistinctPinnedToken() {
        Set<Long> ids = new HashSet<>();
        for (int index = 0; index < 4; index++) {
            long[] choice = tokenizer.encode(protocol.choices[index]);
            assertArrayEquals(new long[]{protocol.choiceIds[index]}, choice);
            assertTrue(ids.add(choice[0]));
        }
    }

    @Test
    public void malformedTokenizerSettingsCannotSilentlyChangeThePort() throws Exception {
        JSONObject changed = resource("tokenizer.json");
        changed.getJSONObject("model").put("byte_fallback", true);
        assertThrows(IllegalArgumentException.class, () -> new QwenTokenizer(changed));
    }

    private static long[] tokens(JSONArray values) throws Exception {
        long[] result = new long[values.length()];
        for (int index = 0; index < values.length(); index++) result[index] = values.getLong(index);
        return result;
    }
}
