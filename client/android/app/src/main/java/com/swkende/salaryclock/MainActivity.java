package com.swkende.salaryclock;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // targetSdk 36 在安卓 15/16 上强制 edge-to-edge，WebView 会画到状态栏与手势条底下；
        // 而 Capacitor 不把 WindowInsets 传给 WebView，CSS 的 env(safe-area-inset-*) 恒为 0，
        // 于是页面顶部的时钟与系统时间叠字。这里把系统栏 insets 转成 WebView 的 padding，
        // 让 web 内容整体落在系统栏之间，留白色由 capacitor.config 的 android.backgroundColor 决定。
        View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
    }
}
