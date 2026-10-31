package dev.pocketroute.runtime;

import android.content.Context;
import android.os.Process;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.Closeable;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Arrays;

public final class NativeEngine implements Closeable {
    static {
        System.loadLibrary("onnxruntime");
        System.loadLibrary("pocketroute_native");
    }

    private final Protocol protocol;
    private final QwenTokenizer tokenizer;
    private final long loadMs;
    private long handle;

    public NativeEngine(Context context) throws IOException, JSONException {
        long started = SystemClock.elapsedRealtime();
        protocol = ModelStore.protocol(context);
        ModelStore.verify(context, protocol);
        File directory = ModelStore.directory(context);
        tokenizer = new QwenTokenizer(ModelStore.json(new FileInputStream(new File(directory, "tokenizer.json")), 8 * 1024 * 1024));
        for (int index = 0; index < protocol.choices.length; index++) {
            long[] tokens = tokenizer.encode(protocol.choices[index]);
            if (tokens.length != 1 || tokens[0] != protocol.choiceIds[index]) throw new IOException("Choice tokenization does not match the frozen protocol.");
        }
        JSONObject geometry = protocol.manifest.getJSONObject("geometry");
        handle = nativeOpen(new File(directory, "model_q4.onnx").getAbsolutePath(), geometry.getInt("layers"),
                geometry.getInt("kvHeads"), geometry.getInt("headDimension"), geometry.getInt("vocabulary"));
        if (handle == 0) throw new IOException("The native model did not initialize.");
        loadMs = SystemClock.elapsedRealtime() - started;
    }

    public synchronized JSONObject metadata() throws IOException, JSONException {
        requireOpen();
        return base().put("status", "ready").put("loadMs", loadMs).put("inputNames", new JSONArray(Arrays.asList(nativeInputs(handle))));
    }

    public synchronized JSONObject classify(String requestId, String input) throws IOException, JSONException {
        requireOpen();
        if (requestId == null || requestId.isEmpty() || requestId.length() > 96) throw new IllegalArgumentException("A bounded request ID is required.");
        long started = SystemClock.elapsedRealtime();
        String text = protocol.validate(input);
        long[] requestTokens = tokenizer.encode(text);
        if (requestTokens.length > protocol.requestTokenLimit) throw new IllegalArgumentException("The request exceeds 512 tokens.");
        String reason = Protocol.reviewReason(text);
        if (reason != null) {
            return base().put("requestId", requestId).put("status", "review-required").put("label", JSONObject.NULL)
                    .put("rawLabel", "review").put("output", "review").put("generatedChoice", JSONObject.NULL)
                    .put("decisionPath", "policy-review").put("policyReason", reason).put("modelExecuted", false)
                    .put("requestTokens", requestTokens.length).put("promptTokens", 0)
                    .put("elapsedMs", SystemClock.elapsedRealtime() - started);
        }
        long[] prompt = tokenizer.encode(protocol.prompt(text));
        if (prompt.length > protocol.promptTokenLimit) throw new IllegalArgumentException("The prompt exceeds 2,048 tokens.");
        float[] scores = nativeClassify(handle, prompt, protocol.choiceIds);
        if (scores == null || scores.length != 4) throw new IOException("The native model returned no valid choice scores.");
        int best = 0;
        for (int index = 0; index < scores.length; index++) {
            if (!Float.isFinite(scores[index])) throw new IOException("The native model returned a non-finite score.");
            boolean present = false;
            for (long token : prompt) if (token == protocol.choiceIds[index]) { present = true; break; }
            if (present) scores[index] = (float) (scores[index] < 0 ? scores[index] * protocol.repetitionPenalty : scores[index] / protocol.repetitionPenalty);
            if (index > 0 && (scores[index] > scores[best] || scores[index] == scores[best] && protocol.choiceIds[index] < protocol.choiceIds[best])) best = index;
        }
        String label = protocol.labels[best];
        return base().put("requestId", requestId).put("status", label.equals("review") ? "review-required" : "suggested")
                .put("label", label.equals("review") ? JSONObject.NULL : label).put("rawLabel", label).put("output", label)
                .put("generatedChoice", protocol.choices[best]).put("decisionPath", "native-model").put("modelExecuted", true)
                .put("requestTokens", requestTokens.length).put("promptTokens", prompt.length)
                .put("elapsedMs", SystemClock.elapsedRealtime() - started);
    }

    private JSONObject base() throws JSONException {
        long rss = nativePeakRss();
        return new JSONObject().put("schemaVersion", 1).put("model", protocol.manifest.getString("model"))
                .put("modelRevision", protocol.manifest.getString("modelRevision")).put("appSourceSha", BuildConfig.SOURCE_SHA)
                .put("runtime", "onnxruntime-android").put("runtimeVersion", nativeVersion()).put("backend", "native-cpu")
                .put("workerPid", Process.myPid()).put("workerPeakRssBytes", rss >= 0 ? rss : JSONObject.NULL)
                .put("aggregatePeakMemoryBytes", JSONObject.NULL).put("requiresHumanReview", true)
                .put("confidenceCalibrated", false).put("confidence", JSONObject.NULL)
                .put("phoneEnergyJoules", JSONObject.NULL).put("productionReady", false);
    }

    private void requireOpen() throws IOException {
        if (handle == 0) throw new IOException("The native model is closed.");
    }

    @Override
    public synchronized void close() {
        if (handle != 0) {
            nativeClose(handle);
            handle = 0;
        }
    }

    private static native long nativeOpen(String path, int layers, int heads, int dimension, int vocabulary) throws IOException;
    private static native float[] nativeClassify(long handle, long[] input, int[] choices) throws IOException;
    private static native String[] nativeInputs(long handle);
    private static native String nativeVersion();
    private static native long nativePeakRss();
    private static native void nativeClose(long handle);
}
