package dev.pocketroute.runtime;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import android.os.RemoteException;
import android.os.SystemClock;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.Closeable;
import java.io.IOException;
import java.util.UUID;

public final class InferenceClient implements Closeable {
    public enum State { UNLOADED, LOADING, READY, RUNNING, STOPPING, FAILED, CLOSED }
    public interface Listener { void onEvent(JSONObject event); }

    private final Context context;
    private final Listener listener;
    private final Protocol protocol;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Messenger replies = new Messenger(new Handler(Looper.getMainLooper(), this::receive));
    private State state = State.UNLOADED;
    private Messenger worker;
    private IBinder binder;
    private int workerPid;
    private boolean bound;
    private boolean closed;
    private int generation;
    private ServiceConnection connection;
    private String pendingId;
    private long requestStarted;
    private String stopKind;
    private String stopError;
    private final Runnable deadline = () -> stop("timeout", "The request deadline expired; its worker was stopped.");
    private final Runnable stopDeadline = () -> {
        if (state == State.STOPPING) {
            state = State.FAILED;
            emit("error", pendingId, "Worker termination was not confirmed within three seconds.", false, workerPid);
        }
    };
    private ServiceConnection connection(int attempt) {
        return new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder connected) {
            if (attempt != generation || state != State.LOADING) return;
            binder = connected;
            worker = new Messenger(connected);
            try {
                connected.linkToDeath(() -> handler.post(() -> died(connected)), 0);
                send("hello", null);
            } catch (RemoteException error) {
                stop("error", "The native worker disconnected during startup.");
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            if (attempt == generation && binder != null) {
                if (binder.isBinderAlive()) stop("error", "The native service disconnected.");
                else died(binder);
            }
        }

        @Override
        public void onBindingDied(ComponentName name) {
            if (attempt == generation) stop("error", "The native worker binding died.");
        }

        @Override
        public void onNullBinding(ComponentName name) {
            if (attempt == generation) stop("error", "The native service returned no worker binding.");
        }
        };
    }

    public InferenceClient(Context context, Listener listener) throws IOException, JSONException {
        requireMainThread();
        this.context = context.getApplicationContext();
        this.listener = listener;
        this.protocol = ModelStore.protocol(context);
    }

    public State state() {
        return state;
    }

    public int workerPid() {
        return workerPid;
    }

    public void load() {
        load(protocol.initializationMs);
    }

    public void load(int timeoutMs) {
        requireMainThread();
        if (closed || state != State.UNLOADED) throw new IllegalStateException("Unload the previous worker before loading.");
        if (timeoutMs < 1000 || timeoutMs > protocol.initializationMs) throw new IllegalArgumentException("Invalid initialization deadline.");
        pendingId = "load-" + UUID.randomUUID();
        requestStarted = SystemClock.elapsedRealtime();
        state = State.LOADING;
        handler.postDelayed(deadline, timeoutMs);
        connection = connection(++generation);
        bound = context.bindService(new Intent(context, InferenceService.class), connection, Context.BIND_AUTO_CREATE);
        if (!bound) stop("error", "The native service could not be bound.");
        else emit("loading", pendingId, null, null, 0);
    }

    public void classify(String requestId, String text, int timeoutMs) {
        requireMainThread();
        if (closed || state != State.READY) throw new IllegalStateException("The classifier is not ready; concurrent requests are not queued.");
        if (requestId == null || requestId.isEmpty() || requestId.length() > 96) throw new IllegalArgumentException("A bounded request ID is required.");
        protocol.validate(text);
        if (timeoutMs < 100 || timeoutMs > 60000) throw new IllegalArgumentException("Deadline must be between 100 and 60,000 milliseconds.");
        pendingId = requestId;
        requestStarted = SystemClock.elapsedRealtime();
        state = State.RUNNING;
        handler.postDelayed(deadline, timeoutMs);
        try {
            send("classify", text);
            emit("running", pendingId, null, null, workerPid);
        } catch (RemoteException error) {
            stop("error", "The native worker transport failed.");
        }
    }

    private void send(String action, String text) throws RemoteException {
        Message message = Message.obtain();
        Bundle data = new Bundle();
        data.putString("action", action);
        data.putString("id", pendingId);
        if (text != null) data.putString("text", text);
        message.setData(data);
        message.replyTo = replies;
        worker.send(message);
    }

    private boolean receive(Message message) {
        if (state == State.STOPPING || state == State.FAILED || pendingId == null) return true;
        Bundle data = message.getData();
        if (!pendingId.equals(data.getString("id"))) return true;
        String raw = data.getString("result");
        try {
            if (raw == null || raw.length() > 65536) throw new IOException("Invalid worker response size.");
            JSONObject result = new JSONObject(raw);
            String status = result.getString("status");
            if (status.equals("connected")) {
                if (state != State.LOADING || workerPid != 0) throw new IOException("Unexpected worker handshake.");
                int pid = result.getInt("workerPid");
                if (pid <= 0 || pid == Process.myPid()) throw new IOException("Inference must use a separate process.");
                workerPid = pid;
                send("load", null);
                return true;
            }
            if (status.equals("error") && state == State.LOADING) {
                stop("error", result.getString("error"));
                return true;
            }
            boolean loadingResult = status.equals("ready") && state == State.LOADING;
            boolean requestResult = state == State.RUNNING && (status.equals("suggested") || status.equals("review-required") || status.equals("error"));
            if (!loadingResult && !requestResult) throw new IOException("Unexpected worker result state.");
            handler.removeCallbacks(deadline);
            result.put("requestId", pendingId).put("roundTripMs", SystemClock.elapsedRealtime() - requestStarted);
            pendingId = null;
            state = State.READY;
            listener.onEvent(result);
        } catch (IOException | JSONException | RemoteException error) {
            stop("error", "The native worker response failed: " + error.getClass().getSimpleName());
        }
        return true;
    }

    public void cancel() {
        requireMainThread();
        if (state == State.UNLOADED || state == State.CLOSED) {
            emit("cancelled", null, null, null, 0);
            return;
        }
        if (state != State.STOPPING && state != State.FAILED) stop("cancelled", null);
    }

    private void stop(String kind, String error) {
        if (state == State.STOPPING || state == State.FAILED) return;
        handler.removeCallbacks(deadline);
        stopKind = kind;
        stopError = error;
        state = State.STOPPING;
        emit("stopping", pendingId, error, null, workerPid);
        releaseBinding();
        context.stopService(new Intent(context, InferenceService.class));
        if (binder == null) {
            finish(null);
            return;
        }
        handler.postDelayed(stopDeadline, 3000);
        if (!binder.isBinderAlive()) {
            died(binder);
        } else if (workerPid > 0 && workerPid != Process.myPid()) {
            Process.killProcess(workerPid);
        }
    }

    private void died(IBinder dead) {
        if (binder != dead) return;
        if (state != State.STOPPING && state != State.FAILED) {
            stopKind = "error";
            stopError = "The native worker exited before it was explicitly unloaded.";
        }
        finish(true);
    }

    private void finish(Boolean terminated) {
        handler.removeCallbacks(deadline);
        handler.removeCallbacks(stopDeadline);
        releaseBinding();
        String id = pendingId;
        int pid = workerPid;
        pendingId = null;
        workerPid = 0;
        binder = null;
        worker = null;
        state = closed ? State.CLOSED : State.UNLOADED;
        emit(stopKind, id, stopError, terminated, pid);
    }

    private void releaseBinding() {
        if (bound) {
            bound = false;
            context.unbindService(connection);
        }
    }

    private void emit(String status, String id, String error, Boolean terminated, int pid) {
        try {
            JSONObject event = new JSONObject().put("status", status).put("requestId", id == null ? JSONObject.NULL : id)
                    .put("workerPid", pid).put("workerTerminated", terminated == null ? JSONObject.NULL : terminated)
                    .put("productionReady", false);
            if (error != null) event.put("error", error);
            listener.onEvent(event);
        } catch (JSONException failure) {
            throw new IllegalStateException("Client event serialization failed.", failure);
        }
    }

    private static void requireMainThread() {
        if (Looper.myLooper() != Looper.getMainLooper()) throw new IllegalStateException("Use the inference client on the main thread.");
    }

    @Override
    public void close() {
        requireMainThread();
        closed = true;
        if (state == State.UNLOADED) state = State.CLOSED;
        else cancel();
    }
}
