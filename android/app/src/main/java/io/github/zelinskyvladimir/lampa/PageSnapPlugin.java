package io.github.zelinskyvladimir.lampa;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.PixelCopy;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;

@CapacitorPlugin(name = "PageSnap")
public class PageSnapPlugin extends Plugin {
    @PluginMethod
    public void capture(PluginCall call) {
        double x = call.getDouble("x", 0.0);
        double y = call.getDouble("y", 0.0);
        double w = call.getDouble("width", 0.0);
        double h = call.getDouble("height", 0.0);
        getActivity().runOnUiThread(() -> {
            View web = getBridge().getWebView();
            float k = getContext().getResources().getDisplayMetrics().density;
            int[] loc = new int[2];
            web.getLocationInWindow(loc);
            int left = (int) Math.round(x * k);
            int top = (int) Math.round(y * k);
            int width = Math.min((int) Math.round(w * k), web.getWidth() - left);
            int height = Math.min((int) Math.round(h * k), web.getHeight() - top);
            if (width <= 0 || height <= 0) {
                resolve(call, null);
                return;
            }
            Bitmap bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Rect src = new Rect(loc[0] + left, loc[1] + top, loc[0] + left + width, loc[1] + top + height);
                PixelCopy.request(getActivity().getWindow(), src, bmp, (result) -> {
                    resolve(call, result == PixelCopy.SUCCESS ? bmp : null);
                }, new Handler(Looper.getMainLooper()));
            } else {
                Canvas canvas = new Canvas(bmp);
                canvas.translate(-left, -top);
                web.draw(canvas);
                resolve(call, bmp);
            }
        });
    }

    private void resolve(PluginCall call, Bitmap bmp) {
        JSObject ret = new JSObject();
        if (bmp == null) {
            ret.put("data", "");
            call.resolve(ret);
            return;
        }
        new Thread(() -> {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 90, out);
            bmp.recycle();
            ret.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            call.resolve(ret);
        }).start();
    }
}
