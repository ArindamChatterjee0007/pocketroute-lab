package dev.pocketroute.lab;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.EditText;
import android.widget.TextView;

import dev.pocketroute.runtime.InferenceClient;
import dev.pocketroute.runtime.ModelStore;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int IMPORT = 1;
    private static final int EXPORT = 2;
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private InferenceClient client;
    private TextView status;
    private TextView result;
    private EditText request;
    private boolean importing;
    private JSONObject lastResult;
    private String exportText;

    @Override
    public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        setContentView(R.layout.activity_main);
        status = findViewById(R.id.status);
        result = findViewById(R.id.result);
        request = findViewById(R.id.request);
        try {
            client = new InferenceClient(this, this::event);
        } catch (IOException | JSONException | IllegalArgumentException error) {
            failure(error);
        }
        findViewById(R.id.import_model).setOnClickListener(view -> {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            startActivityForResult(intent, IMPORT);
        });
        findViewById(R.id.load_model).setOnClickListener(view -> {
            lastResult = null;
            result.setText("");
            try {
                client.load();
            } catch (IllegalArgumentException | IllegalStateException error) {
                failure(error);
            }
            controls();
        });
        findViewById(R.id.classify).setOnClickListener(view -> {
            lastResult = null;
            result.setText("");
            try {
                client.classify(UUID.randomUUID().toString(), request.getText().toString(), 20000);
            } catch (IllegalArgumentException | IllegalStateException error) {
                failure(error);
            }
            controls();
        });
        findViewById(R.id.stop).setOnClickListener(view -> client.cancel());
        findViewById(R.id.export_result).setOnClickListener(view -> {
            if (lastResult == null) {
                failure(new IllegalStateException("No result is available to export."));
                return;
            }
            exportText = lastResult.toString();
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(Intent.EXTRA_TITLE, "pocketroute-native-result.json");
            startActivityForResult(intent, EXPORT);
        });
        controls();
    }

    private void event(JSONObject event) {
        if (isDestroyed()) return;
        try {
            switch (event.getString("status")) {
                case "loading" -> status.setText(R.string.loading);
                case "running" -> status.setText(R.string.running);
                case "ready" -> status.setText(R.string.ready);
                case "stopping" -> status.setText(R.string.stopping);
                case "cancelled" -> status.setText(event.isNull("workerTerminated") ? R.string.cancelled_before_start : R.string.stopped);
                case "suggested", "review-required" -> {
                    lastResult = event;
                    status.setText(R.string.ready);
                    result.setText(getString(R.string.result_template, event.getString("output"), event.getLong("elapsedMs"), event.getInt("requestTokens")));
                }
                case "error", "timeout" -> {
                    lastResult = event;
                    status.setText(event.getString("error"));
                    result.setText("");
                }
                default -> failure(new IllegalStateException("Unexpected inference event."));
            }
        } catch (JSONException error) {
            failure(error);
        }
        controls();
    }

    private void controls() {
        InferenceClient.State state = client == null ? InferenceClient.State.FAILED : client.state();
        boolean unloaded = state == InferenceClient.State.UNLOADED && !importing;
        findViewById(R.id.import_model).setEnabled(unloaded);
        findViewById(R.id.load_model).setEnabled(unloaded);
        findViewById(R.id.classify).setEnabled(state == InferenceClient.State.READY && !importing);
        findViewById(R.id.stop).setEnabled(state == InferenceClient.State.LOADING || state == InferenceClient.State.RUNNING || state == InferenceClient.State.READY);
        findViewById(R.id.export_result).setEnabled(lastResult != null && !importing);
    }

    private void failure(Exception error) {
        String message = error.getMessage();
        status.setText(getString(R.string.failure, error.getClass().getSimpleName(), message == null ? getString(R.string.no_diagnostic) : message));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null) {
            status.setText(requestCode == IMPORT ? R.string.no_selection : R.string.nothing_exported);
            exportText = null;
            return;
        }
        if (requestCode == IMPORT) {
            List<Uri> selected = new ArrayList<>();
            ClipData clip = data.getClipData();
            if (clip != null) {
                for (int index = 0; index < clip.getItemCount(); index++) selected.add(clip.getItemAt(index).getUri());
            } else if (data.getData() != null) selected.add(data.getData());
            if (selected.isEmpty() || selected.size() > 2) {
                failure(new IllegalArgumentException("Select one or both of the two pinned model files."));
                return;
            }
            importing = true;
            status.setText(R.string.importing);
            controls();
            files.execute(() -> {
                try {
                    for (Uri uri : selected) ModelStore.importFile(this, uri);
                    runOnUiThread(() -> status.setText(R.string.import_complete));
                } catch (IOException | JSONException | SecurityException error) {
                    runOnUiThread(() -> failure(error));
                } finally {
                    runOnUiThread(() -> { importing = false; if (!isDestroyed()) controls(); });
                }
            });
        } else if (requestCode == EXPORT) {
            Uri destination = data.getData();
            String text = exportText;
            exportText = null;
            if (destination == null || text == null) {
                failure(new IllegalStateException("The export destination or result is missing."));
                return;
            }
            files.execute(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                    if (output == null) throw new IOException("The export destination could not be opened.");
                    output.write(text.getBytes(StandardCharsets.UTF_8));
                    runOnUiThread(() -> status.setText(R.string.exported));
                } catch (IOException | SecurityException error) {
                    runOnUiThread(() -> failure(error));
                }
            });
        }
    }

    @Override
    protected void onStop() {
        if (client != null) client.cancel();
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (client != null) client.close();
        files.shutdownNow();
        super.onDestroy();
    }
}
