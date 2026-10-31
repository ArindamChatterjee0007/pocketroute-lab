package dev.pocketroute.runtime;

import android.app.Service;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.Process;
import android.os.RemoteException;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class InferenceService extends Service {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean();
    private final Messenger messenger = new Messenger(new Handler(Looper.getMainLooper(), this::receive));
    private IBinder owner;
    private NativeEngine engine;

    @Override
    public IBinder onBind(Intent intent) {
        return messenger.getBinder();
    }

    private boolean receive(Message message) {
        if (message.replyTo == null) return true;
        Bundle request = message.getData();
        String action = request.getString("action", "");
        String id = request.getString("id", "");
        int generation = request.getInt("generation", -1);
        Messenger reply = message.replyTo;
        if (action.equals("hello")) {
            if (owner != null && !owner.equals(reply.getBinder())) {
                send(reply, id, generation, event("error", "Another client owns the inference worker."));
                return true;
            }
            owner = reply.getBinder();
            send(reply, id, generation, event("connected", null));
            return true;
        }
        if (owner == null || !owner.equals(reply.getBinder())) {
            send(reply, id, generation, event("error", "The client does not own this worker."));
            return true;
        }
        if (!action.equals("load") && !action.equals("classify")) {
            send(reply, id, generation, event("error", "Unsupported worker operation."));
            return true;
        }
        if (!busy.compareAndSet(false, true)) {
            send(reply, id, generation, event("error", "The classifier is busy; requests are not queued."));
            return true;
        }
        String text = request.getString("text");
        executor.execute(() -> {
            try {
                JSONObject result;
                if (action.equals("load")) {
                    if (engine != null) throw new IllegalStateException("The model is already loaded.");
                    engine = new NativeEngine(this);
                    result = engine.metadata();
                } else {
                    if (engine == null) throw new IllegalStateException("The model is not loaded.");
                    result = engine.classify(id, text);
                }
                busy.set(false);
                send(reply, id, generation, result);
            } catch (IOException | JSONException | IllegalArgumentException | IllegalStateException error) {
                busy.set(false);
                send(reply, id, generation, event("error", error.getClass().getSimpleName() + ": " + safeMessage(error.getMessage())));
            } catch (LinkageError error) {
                busy.set(false);
                send(reply, id, generation, event("error", "The native runtime is unavailable for this ABI: " + error.getClass().getSimpleName()));
            }
        });
        return true;
    }

    private static String safeMessage(String value) {
        if (value == null) return "No diagnostic message was supplied.";
        String text = value.replaceAll("/[^\\s]+", "[path]");
        return text.substring(0, Math.min(text.length(), 400));
    }

    private static JSONObject event(String status, String error) {
        try {
            JSONObject result = new JSONObject().put("status", status).put("workerPid", Process.myPid())
                    .put("appSourceSha", BuildConfig.SOURCE_SHA).put("productionReady", false);
            if (error != null) result.put("error", error);
            return result;
        } catch (JSONException failure) {
            throw new IllegalStateException("Worker event serialization failed.", failure);
        }
    }

    private static void send(Messenger recipient, String id, int generation, JSONObject result) {
        Message response = Message.obtain();
        Bundle data = new Bundle();
        data.putString("id", id);
        data.putInt("generation", generation);
        data.putString("result", result.toString());
        response.setData(data);
        try {
            recipient.send(response);
        } catch (RemoteException error) {
            Log.e("PocketRoute", "The inference client disconnected; stopping its worker.", error);
            Process.killProcess(Process.myPid());
        }
    }

    @Override
    public boolean onUnbind(Intent intent) {
        stopSelf();
        return false;
    }

    @Override
    public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
        Process.killProcess(Process.myPid());
    }
}
