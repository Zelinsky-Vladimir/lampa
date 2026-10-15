package io.github.zelinskyvladimir.lampa;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {
    private static final Set<String> EXTS = new HashSet<>(Arrays.asList("fb2", "epub", "txt", "zip", "pdf", "mobi", "azw", "azw3", "djvu", "rtf", "doc", "docx"));
    private static final int LIMIT = 2000;

    @PluginMethod
    public void pick(PluginCall call) {
        startActivityForResult(call, new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject empty = new JSObject();
            empty.put("files", new JSArray());
            call.resolve(empty);
            return;
        }
        Uri tree = data.getData();
        new Thread(() -> {
            DocumentFile root = DocumentFile.fromTreeUri(getContext(), tree);
            File tmp = new File(getContext().getCacheDir(), "lampa-import-" + System.currentTimeMillis());
            JSArray files = new JSArray();
            if (root != null) walk(root, tmp, files, 0);
            JSObject out = new JSObject();
            out.put("name", root != null && root.getName() != null ? root.getName() : "");
            out.put("files", files);
            call.resolve(out);
        }).start();
    }

    private void walk(DocumentFile dir, File tmp, JSArray out, int depth) {
        DocumentFile[] items = dir.listFiles();
        Arrays.sort(items, (a, b) -> String.valueOf(a.getName()).compareToIgnoreCase(String.valueOf(b.getName())));
        for (DocumentFile f : items) {
            if (out.length() >= LIMIT) return;
            String name = f.getName();
            if (name == null || name.startsWith(".")) continue;
            if (f.isDirectory()) {
                if (depth < 12) walk(f, tmp, out, depth + 1);
                continue;
            }
            int dot = name.lastIndexOf('.');
            String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
            if (!EXTS.contains(ext)) continue;
            File slot = new File(tmp, String.valueOf(out.length()));
            File dest = new File(slot, name);
            try {
                slot.mkdirs();
                try (InputStream in = getContext().getContentResolver().openInputStream(f.getUri()); OutputStream os = new FileOutputStream(dest)) {
                    if (in == null) continue;
                    byte[] buf = new byte[65536];
                    for (int n; (n = in.read(buf)) > 0; ) os.write(buf, 0, n);
                }
                out.put(Uri.fromFile(dest).toString());
            } catch (Exception e) {
                dest.delete();
            }
        }
    }
}
