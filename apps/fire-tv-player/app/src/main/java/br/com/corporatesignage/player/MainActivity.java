package br.com.corporatesignage.player;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.List;
import java.util.Set;

public final class MainActivity extends Activity {
    private static final long RETRY_DELAY_MS = 10_000L;
    private static final String PREFERENCES = "signage-settings";
    private static final String KEY_PLAYER_URL = "player-url";
    private static final String KEY_API_URL = "api-url";
    private static final String KEY_LOCATION = "device-location";

    private WebView webView;
    private TextView statusView;
    private SharedPreferences preferences;
    private boolean pageAvailable;
    private boolean loadFailed;
    private boolean settingsVisible;
    private final Runnable retryRunnable = this::openPlayer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        configureFullscreen();
        createInterface();
        configureWebView();
        openPlayer();
    }

    private void configureFullscreen() {
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    private void createInterface() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        statusView = new TextView(this);
        statusView.setText(R.string.connecting);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(22f);
        statusView.setGravity(Gravity.CENTER);
        statusView.setBackgroundColor(Color.rgb(8, 15, 29));
        statusView.setFocusable(true);
        statusView.setClickable(true);
        statusView.setOnClickListener(view -> openPlayer());
        statusView.setOnLongClickListener(view -> {
            showSettings();
            return true;
        });
        root.addView(statusView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUserAgentString(settings.getUserAgentString() + " CorporateSignageFireTV/1.1");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            settings.setOffscreenPreRaster(true);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.setBackgroundColor(Color.BLACK);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new SignageWebViewClient());
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
    }

    private String configuredPlayerUrl() {
        return preferences.getString(KEY_PLAYER_URL, BuildConfig.PLAYER_URL);
    }

    private String configuredApiUrl() {
        return preferences.getString(KEY_API_URL, BuildConfig.API_URL);
    }

    private String resolvedPlayerUrl() {
        Uri base = Uri.parse(configuredPlayerUrl());
        Uri.Builder builder = base.buildUpon().clearQuery();
        Set<String> names = base.getQueryParameterNames();
        for (String name : names) {
            if ("source".equals(name) || "apiUrl".equals(name)
                    || "socketUrl".equals(name) || "location".equals(name)) continue;
            List<String> values = base.getQueryParameters(name);
            for (String value : values) builder.appendQueryParameter(name, value);
        }
        String apiUrl = configuredApiUrl();
        builder.appendQueryParameter("source", "fire-tv");
        builder.appendQueryParameter("apiUrl", apiUrl);
        builder.appendQueryParameter("socketUrl", socketFromApi(apiUrl));
        String location = preferences.getString(KEY_LOCATION, "").trim();
        if (!location.isEmpty()) builder.appendQueryParameter("location", location);
        return builder.build().toString();
    }

    private String socketFromApi(String rawApiUrl) {
        Uri api = Uri.parse(rawApiUrl);
        String path = api.getPath() == null ? "" : api.getPath().replaceFirst("/api/?$", "");
        return api.buildUpon().path(path).clearQuery().fragment(null).build().toString().replaceAll("/$", "");
    }

    private String normalizeUrl(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (!value.matches("^[a-zA-Z][a-zA-Z0-9+.-]*://.*$")) {
            boolean localAddress = value.matches("^(localhost|127\\.0\\.0\\.1|10\\..*|192\\.168\\..*|172\\.(1[6-9]|2[0-9]|3[01])\\..*)");
            value = (localAddress ? "http://" : "https://") + value;
        }
        Uri uri = Uri.parse(value);
        String scheme = uri.getScheme();
        if (uri.getHost() == null || !("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException(getString(R.string.invalid_address));
        }
        return value.replaceAll("/+$", "");
    }

    private void openPlayer() {
        if (settingsVisible) return;
        pageAvailable = false;
        loadFailed = false;
        statusView.setText(R.string.connecting);
        statusView.setVisibility(View.VISIBLE);
        webView.removeCallbacks(retryRunnable);
        webView.loadUrl(resolvedPlayerUrl());
    }

    private void showConnectionError() {
        pageAvailable = false;
        loadFailed = true;
        statusView.setText(getString(R.string.connection_error, configuredPlayerUrl()));
        statusView.setVisibility(View.VISIBLE);
        statusView.requestFocus();
        webView.removeCallbacks(retryRunnable);
        webView.postDelayed(retryRunnable, RETRY_DELAY_MS);
    }

    private EditText settingsField(String hint, String value) {
        EditText field = new EditText(this);
        field.setHint(hint);
        field.setText(value);
        field.setSingleLine(true);
        field.setSelectAllOnFocus(false);
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        field.setPadding(dp(12), dp(10), dp(12), dp(10));
        return field;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showSettings() {
        if (settingsVisible) return;
        settingsVisible = true;
        webView.removeCallbacks(retryRunnable);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(28), dp(10), dp(28), 0);

        TextView help = new TextView(this);
        help.setText(R.string.settings_help);
        help.setTextColor(Color.DKGRAY);
        help.setPadding(0, 0, 0, dp(12));
        content.addView(help);

        EditText playerUrl = settingsField(getString(R.string.player_url_hint), configuredPlayerUrl());
        EditText apiUrl = settingsField(getString(R.string.api_url_hint), configuredApiUrl());
        EditText location = settingsField(getString(R.string.location_hint), preferences.getString(KEY_LOCATION, ""));
        location.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        content.addView(playerUrl);
        content.addView(apiUrl);
        content.addView(location);

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(R.string.settings_title)
                .setView(content)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.save_and_connect, null)
                .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            String normalizedPlayer;
            String normalizedApi;
            try {
                normalizedPlayer = normalizeUrl(playerUrl.getText().toString());
            } catch (IllegalArgumentException error) {
                playerUrl.setError(error.getMessage());
                playerUrl.requestFocus();
                return;
            }
            try {
                normalizedApi = normalizeUrl(apiUrl.getText().toString());
            } catch (IllegalArgumentException error) {
                apiUrl.setError(error.getMessage());
                apiUrl.requestFocus();
                return;
            }
            Uri api = Uri.parse(normalizedApi);
            String apiPath = api.getPath() == null ? "" : api.getPath();
            if (!apiPath.matches(".*/api/?$")) normalizedApi = api.buildUpon().path(apiPath.replaceAll("/$", "") + "/api").build().toString();
            preferences.edit()
                    .putString(KEY_PLAYER_URL, normalizedPlayer)
                    .putString(KEY_API_URL, normalizedApi)
                    .putString(KEY_LOCATION, location.getText().toString().trim())
                    .apply();
            pageAvailable = false;
            dialog.dismiss();
        }));
        dialog.setOnDismissListener(ignored -> {
            settingsVisible = false;
            configureFullscreen();
            if (!pageAvailable) openPlayer();
        });
        dialog.show();
    }

    private final class SignageWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(view, request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(view, Uri.parse(url));
        }

        private boolean handleNavigation(WebView view, Uri uri) {
            String scheme = uri.getScheme();
            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) view.loadUrl(uri.toString());
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (loadFailed) return;
            pageAvailable = true;
            statusView.setVisibility(View.GONE);
            view.removeCallbacks(retryRunnable);
            configureFullscreen();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) showConnectionError();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400) showConnectionError();
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) showConnectionError();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        configureFullscreen();
        webView.onResume();
        webView.resumeTimers();
        if (!pageAvailable && !settingsVisible) openPlayer();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.removeCallbacks(retryRunnable);
        webView.loadUrl("about:blank");
        webView.destroy();
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.getRepeatCount() == 0) event.startTracking();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            showSettings();
            return true;
        }
        return super.onKeyLongPress(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            configureFullscreen();
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_UP && event.getKeyCode() == KeyEvent.KEYCODE_MENU) {
            showSettings();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }
}
