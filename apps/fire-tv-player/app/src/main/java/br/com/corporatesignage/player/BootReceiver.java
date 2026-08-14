package br.com.corporatesignage.player;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public final class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "SignageBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }

        try {
            Intent playerIntent = new Intent(context, MainActivity.class);
            playerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(playerIntent);
        } catch (RuntimeException exception) {
            // Algumas versões do Fire OS bloqueiam Activities iniciadas em segundo plano.
            // Nelas, o aplicativo continuará disponível no launcher e na linha "Recentes".
            Log.w(TAG, "O Fire OS bloqueou a abertura automática do Player", exception);
        }
    }
}
