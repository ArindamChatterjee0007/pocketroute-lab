package dev.pocketroute.lab;

import android.app.ActivityManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import dev.pocketroute.runtime.InferenceClient;
import dev.pocketroute.runtime.ModelStore;
import dev.pocketroute.runtime.Protocol;
import dev.pocketroute.runtime.QwenTokenizer;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.FixMethodOrder;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.MethodSorters;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

@RunWith(AndroidJUnit4.class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public final class NativeVmTest {
    private final Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
    private final Context tests = InstrumentationRegistry.getInstrumentation().getContext();

    private JSONObject fixture(String name) throws Exception {
        return ModelStore.json(tests.getAssets().open(name), 8 * 1024 * 1024);
    }

    private static void main(Runnable action) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(action);
    }

    private final class Client implements AutoCloseable {
        final LinkedBlockingQueue<JSONObject> events = new LinkedBlockingQueue<>();
        InferenceClient value;

        Client() throws Exception {
            AtomicReference<Exception> failure = new AtomicReference<>();
            main(() -> {
                try {
                    value = new InferenceClient(target, events::add);
                } catch (java.io.IOException | org.json.JSONException error) {
                    failure.set(error);
                }
            });
            if (failure.get() != null) throw failure.get();
        }

        JSONObject terminal(int seconds) throws Exception {
            long deadline = SystemClock.elapsedRealtime() + seconds * 1000L;
            while (SystemClock.elapsedRealtime() < deadline) {
                JSONObject event = events.poll(Math.max(1, deadline - SystemClock.elapsedRealtime()), TimeUnit.MILLISECONDS);
                if (event == null) break;
                if (!List.of("loading", "running", "stopping").contains(event.getString("status"))) return event;
            }
            throw new AssertionError("No terminal worker event before the test deadline.");
        }

        JSONObject load() throws Exception {
            main(() -> value.load());
            JSONObject ready = terminal(185);
            assertEquals(ready.toString(), "ready", ready.getString("status"));
            assertEquals("onnxruntime-android", ready.getString("runtime"));
            assertEquals("1.31.1", ready.getString("runtimeVersion"));
            assertEquals(59, ready.getJSONArray("inputNames").length());
            return ready;
        }

        JSONObject classify(String id, String text, int timeout) throws Exception {
            main(() -> value.classify(id, text, timeout));
            return terminal(timeout / 1000 + 5);
        }

        @Override
        public void close() throws Exception {
            InferenceClient.State previous = value.state();
            main(() -> value.close());
            if (previous != InferenceClient.State.UNLOADED && previous != InferenceClient.State.CLOSED) {
                JSONObject stopped = terminal(5);
                assertTrue(stopped.toString(), stopped.getBoolean("workerTerminated"));
            }
        }
    }

    @Test
    public void aAndroidTokenizationAndInstalledPermissions() throws Exception {
        PackageInfo info = target.getPackageManager().getPackageInfo(target.getPackageName(), PackageManager.GET_PERMISSIONS);
        assertTrue("The installed app must have no requested permissions.", info.requestedPermissions == null || info.requestedPermissions.length == 0);
        Protocol protocol = ModelStore.protocol(target);
        ModelStore.verify(target, protocol);
        try (RandomAccessFile model = new RandomAccessFile(new File(ModelStore.directory(target), "model_q4.onnx"), "rw")) {
            int original = model.readUnsignedByte();
            try {
                model.seek(0);
                model.writeByte(original ^ 0xFF);
                model.getFD().sync();
                assertThrows(IOException.class, () -> ModelStore.verify(target, protocol));
            } finally {
                model.seek(0);
                model.writeByte(original);
                model.getFD().sync();
            }
        }
        ModelStore.verify(target, protocol);
        QwenTokenizer tokenizer = new QwenTokenizer(ModelStore.json(new FileInputStream(new File(ModelStore.directory(target), "tokenizer.json")), 8 * 1024 * 1024));
        JSONArray vectors = fixture("vectors.json").getJSONArray("vectors");
        for (int index = 0; index < vectors.length(); index++) {
            JSONObject vector = vectors.getJSONObject(index);
            String input = vector.getString("input");
            if (vector.getBoolean("rejected")) {
                assertThrows(IllegalArgumentException.class, () -> protocol.validate(input));
                continue;
            }
            String text = protocol.validate(input);
            assertEquals("Android JSON vector " + index, vector.getString("jsonRequest"), Protocol.requestJson(text));
            assertEquals("Android policy vector " + index, vector.isNull("policyReason") ? null : vector.getString("policyReason"), Protocol.reviewReason(text));
            assertArrayEquals("Android request vector " + index, tokens(vector.getJSONArray("requestTokens")), tokenizer.encode(text));
            assertEquals("Android prompt vector " + index, vector.getString("prompt"), protocol.prompt(text));
            assertArrayEquals("Android prompt tokens " + index, tokens(vector.getJSONArray("promptTokens")), tokenizer.encode(protocol.prompt(text)));
        }
        save("vm-contract.json", new JSONObject().put("status", "passed").put("goldenVectors", vectors.length())
                .put("requestedPermissions", 0).put("modelFilesHashVerified", true).put("tamperedModelRejected", true).put("executionKind", "simulator"));
    }

    @Test
    public void bActualModelFrozenRegression() throws Exception {
        JSONObject reference = fixture("reference.json");
        JSONArray requests = fixture("requests.json").getJSONArray("cases");
        assertEquals(96, requests.length());
        JSONObject report = new JSONObject().put("schemaVersion", 1).put("suiteId", reference.getString("suiteId"))
                .put("protocolSha256", reference.getString("protocolSha256")).put("datasetSha256", reference.getString("datasetSha256"))
                .put("modelRevision", reference.getString("modelRevision")).put("executionKind", "simulator").put("phase", "warm")
                .put("device", new JSONObject().put("class", "phone").put("model", Build.MODEL).put("os", "Android " + Build.VERSION.RELEASE)
                        .put("architecture", Build.SUPPORTED_ABIS[0]))
                .put("runtime", new JSONObject().put("name", "onnxruntime-android").put("version", "1.31.1").put("backend", "native-cpu"))
                .put("physicalDeviceValidated", false).put("energyJoules", JSONObject.NULL);
        JSONArray cases = new JSONArray();
        report.put("cases", cases);
        try (Client client = new Client()) {
            JSONObject ready = client.load();
            report.put("appSourceSha", ready.getString("appSourceSha")).put("load", ready);
            JSONObject warmup = client.classify("warmup", "The workshop pump stopped running. Please send someone to fix it.", 20000);
            assertTrue(warmup.toString(), warmup.getBoolean("modelExecuted"));
            report.put("warmup", warmup);
            save("vm-report.json", report);
            long suiteDeadline = SystemClock.elapsedRealtime() + 25 * 60 * 1000L;
            for (int index = 0; index < requests.length(); index++) {
                JSONObject request = requests.getJSONObject(index);
                long started = SystemClock.elapsedRealtime();
                JSONObject entry = new JSONObject().put("id", request.getString("id")).put("peakMemoryBytes", JSONObject.NULL);
                if (SystemClock.elapsedRealtime() >= suiteDeadline || client.value.state() != InferenceClient.State.READY) {
                    entry.put("outcome", "unavailable").put("output", JSONObject.NULL).put("elapsedMs", 0)
                            .put("reason", "The bounded suite budget or usable worker was exhausted; no inference was attempted.");
                } else {
                    JSONObject result = client.classify(request.getString("id"), request.getString("input"), 20000);
                    String status = result.getString("status");
                    boolean completed = status.equals("suggested") || status.equals("review-required");
                    entry.put("outcome", completed ? "completed" : status.equals("timeout") ? "timeout" : "error")
                            .put("output", completed ? result.getString("output") : JSONObject.NULL)
                            .put("elapsedMs", SystemClock.elapsedRealtime() - started).put("result", result);
                    if (completed) {
                        assertTrue(result.getBoolean("requiresHumanReview"));
                        assertTrue(result.isNull("confidence"));
                        assertFalse(result.getBoolean("productionReady"));
                        assertEquals(Protocol.reviewReason(Protocol.trim(request.getString("input"))) == null, result.getBoolean("modelExecuted"));
                    }
                }
                cases.put(entry);
                save("vm-report.json", report);
            }
        }
        assertEquals(96, cases.length());
        for (int index = 0; index < cases.length(); index++) assertEquals(cases.getJSONObject(index).toString(), "completed", cases.getJSONObject(index).getString("outcome"));
    }

    @Test
    public void cCancellationDeadlineAndConcurrencyStopRealWorkers() throws Exception {
        JSONObject receipt = new JSONObject().put("executionKind", "simulator");
        try (Client client = new Client()) {
            client.load();
            int pid = client.value.workerPid();
            main(() -> {
                client.value.classify("cancel-active", "The installed pump stopped and needs repair.", 20000);
                assertThrows(IllegalStateException.class, () -> client.value.classify("must-not-queue", "Inspect the gauge.", 20000));
            });
            SystemClock.sleep(250);
            long started = SystemClock.elapsedRealtime();
            main(() -> client.value.cancel());
            JSONObject cancelled = client.terminal(5);
            assertEquals(cancelled.toString(), "cancelled", cancelled.getString("status"));
            assertTrue(cancelled.getBoolean("workerTerminated"));
            assertTrue(SystemClock.elapsedRealtime() - started < 3000);
            assertWorkerGone(pid);
            receipt.put("activeCancellation", cancelled).put("concurrentRequestRejected", true);
            client.load();
            pid = client.value.workerPid();
            JSONObject timedOut = client.classify("deadline", "The installed pump stopped and needs repair.", 100);
            assertEquals(timedOut.toString(), "timeout", timedOut.getString("status"));
            assertTrue(timedOut.getBoolean("workerTerminated"));
            assertWorkerGone(pid);
            receipt.put("deadline", timedOut).put("workerTerminationConfirmed", true).put("status", "passed");
            save("vm-lifecycle.json", receipt);
        }
    }

    @Test
    public void dForegroundAppCompletesAnActualInferenceAndUnloads() throws Exception {
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            activity.onActivity(value -> value.findViewById(R.id.load_model).performClick());
            awaitText(activity, R.id.status, "Ready.", 185000);
            capture(activity, "vm-setup.png", R.id.status);
            activity.onActivity(value -> {
                ((EditText) value.findViewById(R.id.request)).setText("The workshop pump stopped running. Please send someone to fix it.");
                value.findViewById(R.id.classify).performClick();
            });
            awaitText(activity, R.id.result, "Suggestion:", 25000);
            capture(activity, "vm-result.png", R.id.result);
            activity.onActivity(value -> value.findViewById(R.id.stop).performClick());
            awaitText(activity, R.id.status, "Worker stopped", 5000);
            save("vm-ui.json", new JSONObject().put("status", "passed").put("actualModelRequest", true)
                    .put("explicitUnload", true).put("executionKind", "simulator"));
        }
    }

    private void capture(ActivityScenario<MainActivity> activity, String name, int focus) throws Exception {
        activity.onActivity(value -> {
            View view = value.findViewById(focus);
            Rect rectangle = new Rect();
            view.getDrawingRect(rectangle);
            view.requestRectangleOnScreen(rectangle, true);
        });
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(screenshot);
        try (FileOutputStream output = new FileOutputStream(new File(target.getFilesDir(), name))) {
            assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, output));
        } finally {
            screenshot.recycle();
        }
    }

    private static void awaitText(ActivityScenario<MainActivity> activity, int id, String expected, long timeout) {
        long deadline = SystemClock.elapsedRealtime() + timeout;
        AtomicReference<String> text = new AtomicReference<>("");
        while (SystemClock.elapsedRealtime() < deadline) {
            activity.onActivity(value -> text.set(((TextView) value.findViewById(id)).getText().toString()));
            if (text.get().startsWith(expected)) return;
            SystemClock.sleep(100);
        }
        fail("Expected " + expected + "; last UI value: " + text.get());
    }

    private void assertWorkerGone(int pid) {
        ActivityManager manager = target.getSystemService(ActivityManager.class);
        assertNotNull(manager);
        long deadline = SystemClock.elapsedRealtime() + 3000;
        while (SystemClock.elapsedRealtime() < deadline) {
            List<ActivityManager.RunningAppProcessInfo> processes = manager.getRunningAppProcesses();
            assertNotNull(processes);
            if (processes.stream().noneMatch(process -> process.pid == pid)) return;
            SystemClock.sleep(50);
        }
        fail("Cancelled worker is still present.");
    }

    private void save(String name, JSONObject value) throws Exception {
        try (FileOutputStream output = new FileOutputStream(new File(target.getFilesDir(), name))) {
            output.write(value.toString(2).getBytes(StandardCharsets.UTF_8));
            output.getFD().sync();
        }
    }

    private static long[] tokens(JSONArray values) throws Exception {
        long[] result = new long[values.length()];
        for (int index = 0; index < result.length; index++) result[index] = values.getLong(index);
        return result;
    }
}
