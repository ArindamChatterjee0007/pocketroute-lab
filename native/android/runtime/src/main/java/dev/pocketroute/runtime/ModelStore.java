package dev.pocketroute.runtime;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.storage.StorageManager;
import android.provider.OpenableColumns;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InterruptedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.UUID;

public final class ModelStore {
    private ModelStore() {}

    public static JSONObject json(InputStream stream, int limit) throws IOException, JSONException {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[32768];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > limit) throw new IOException("JSON input exceeds its size limit.");
                output.write(buffer, 0, count);
            }
            return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
        }
    }

    public static Protocol protocol(Context context) throws IOException, JSONException {
        return new Protocol(json(context.getAssets().open("protocol.json"), 65536));
    }

    public static File directory(Context context) throws IOException {
        File directory = new File(context.getFilesDir(), "model");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Model storage could not be created.");
        return directory;
    }

    private static JSONObject specification(Protocol protocol, String name) throws JSONException, IOException {
        if (!name.equals("model_q4.onnx") && !name.equals("tokenizer.json")) throw new IOException("Select model_q4.onnx or tokenizer.json.");
        JSONArray files = protocol.manifest.getJSONArray("files");
        for (int index = 0; index < files.length(); index++) {
            JSONObject file = files.getJSONObject(index);
            if (file.getString("name").equals(name)) {
                if (!file.getString("sha256").matches("[a-f0-9]{64}") || file.getLong("bytes") < 1) throw new IOException("Invalid pinned file manifest.");
                return file;
            }
        }
        throw new IOException("The required file is not in the pinned manifest.");
    }

    public static void verify(Context context, Protocol protocol) throws IOException, JSONException {
        for (String name : new String[]{"model_q4.onnx", "tokenizer.json"}) {
            JSONObject expected = specification(protocol, name);
            File file = new File(directory(context), name);
            if (!file.isFile() || file.length() != expected.getLong("bytes")) throw new IOException("Missing or incomplete model file: " + name);
            try (InputStream input = new FileInputStream(file)) {
                if (!digest(input, null, expected.getLong("bytes")).equals(expected.getString("sha256"))) throw new IOException("Model hash mismatch: " + name);
            }
        }
    }

    public static void importFile(Context context, Uri uri) throws IOException, JSONException {
        String name;
        try (Cursor cursor = context.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) throw new IOException("The selected document has no readable name.");
            name = cursor.getString(0);
        }
        if (name == null) throw new IOException("The selected document has no name.");
        JSONObject expected = specification(protocol(context), name);
        File directory = directory(context);
        StorageManager storage = context.getSystemService(StorageManager.class);
        if (storage == null) throw new IOException("Android storage allocation is unavailable.");
        UUID volume = storage.getUuidForPath(directory);
        if (storage.getAllocatableBytes(volume) < expected.getLong("bytes") + 16 * 1024 * 1024) throw new IOException("Insufficient allocatable storage for an atomic model import.");
        File temporary = new File(directory, name + ".partial");
        try {
            InputStream selected = context.getContentResolver().openInputStream(uri);
            if (selected == null) throw new IOException("The selected document could not be opened.");
            try (InputStream input = selected; FileOutputStream output = new FileOutputStream(temporary)) {
                storage.allocateBytes(output.getFD(), expected.getLong("bytes"));
                if (!digest(input, output, expected.getLong("bytes")).equals(expected.getString("sha256"))) throw new IOException("Selected file does not match the pinned model hash: " + name);
                output.getFD().sync();
            }
            Files.move(temporary.toPath(), new File(directory, name).toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(temporary.toPath());
        }
    }

    private static String digest(InputStream input, FileOutputStream output, long expectedBytes) throws IOException {
        MessageDigest hash;
        try {
            hash = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is required by this runtime.", error);
        }
        byte[] buffer = new byte[262144];
        long total = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("Model import was interrupted.");
            total += count;
            if (total > expectedBytes) throw new IOException("Model file exceeds the pinned size.");
            hash.update(buffer, 0, count);
            if (output != null) output.write(buffer, 0, count);
        }
        if (total != expectedBytes) throw new IOException("Model file is incomplete.");
        StringBuilder result = new StringBuilder();
        for (byte value : hash.digest()) result.append(String.format(Locale.ROOT, "%02x", value & 0xFF));
        return result.toString();
    }
}
