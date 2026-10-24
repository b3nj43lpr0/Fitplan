package cl.fitplan.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

// Widget de la pantalla de inicio: kcal restantes, proteína, pasos y agua de hoy. Tocarlo abre FitPlan.
public class FitPlanWidget extends AppWidgetProvider {
    static final String PREFS = "fitplan_widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) draw(ctx, mgr, id);
    }

    static void draw(Context ctx, AppWidgetManager mgr, int id) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean fresh = today.equals(p.getString("day", ""));
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_fitplan);
        int goal = p.getInt("goal", 0);
        if (!fresh || goal <= 0) {
            // Día nuevo y la app aún no se abre: se muestra la meta completa
            v.setTextViewText(R.id.w_big, goal > 0 ? String.valueOf(goal) : "—");
            v.setTextViewText(R.id.w_big_label, "kcal para hoy");
            v.setProgressBar(R.id.w_bar, 100, 0, false);
            v.setTextViewText(R.id.w_prot, "Proteína 0 g");
            v.setTextViewText(R.id.w_steps, "Abre FitPlan para actualizar");
            v.setTextViewText(R.id.w_water, "");
        } else {
            boolean over = p.getBoolean("over", false);
            int left = p.getInt("left", 0), eaten = p.getInt("eaten", 0);
            v.setTextViewText(R.id.w_big, String.valueOf(Math.abs(left)));
            v.setTextViewText(R.id.w_big_label, over ? "kcal de más" : "kcal restantes");
            v.setProgressBar(R.id.w_bar, 100, Math.min(100, Math.round(eaten * 100f / goal)), false);
            v.setTextViewText(R.id.w_prot, "Proteína " + p.getInt("prot", 0) + " / " + p.getInt("protGoal", 0) + " g");
            int steps = p.getInt("steps", -1);
            v.setTextViewText(R.id.w_steps, steps >= 0 ? String.format(Locale.US, "%,d pasos", steps).replace(',', '.') : "Comiste " + eaten + " de " + goal + " kcal");
            v.setTextViewText(R.id.w_water, "Agua " + p.getInt("water", 0) + " / " + p.getInt("waterGoal", 0));
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        mgr.updateAppWidget(id, v);
    }
}
