package io.github.zelinskyvladimir.lampa;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LampaWindow")
public class LampaWindowPlugin extends Plugin {
    @PluginMethod
    public void setBackground(PluginCall call) {
        String color = call.getString("color", "#f8f5ee");
        int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException e) {
            call.reject("BAD_COLOR");
            return;
        }
        getActivity().runOnUiThread(() -> {
            getActivity().getWindow().getDecorView().setBackgroundColor(parsed);
            getBridge().getWebView().setBackgroundColor(parsed);
            call.resolve();
        });
    }
}
