package cl.fitplan.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Recibe desde la web (FitPlanWidget.update) las kcal, la proteína y los pasos del día y redibuja el widget
@CapacitorPlugin(name = "FitPlanWidget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences.Editor e = ctx.getSharedPreferences(FitPlanWidget.PREFS, Context.MODE_PRIVATE).edit();
        e.putString("day", call.getString("day", ""));
        e.putInt("left", call.getInt("left", 0));
        e.putInt("eaten", call.getInt("eaten", 0));
        e.putInt("goal", call.getInt("goal", 0));
        e.putInt("prot", call.getInt("prot", 0));
        e.putInt("protGoal", call.getInt("protGoal", 0));
        e.putInt("steps", call.getInt("steps", -1));
        e.putInt("water", call.getInt("water", 0));
        e.putInt("waterGoal", call.getInt("waterGoal", 0));
        e.putBoolean("over", Boolean.TRUE.equals(call.getBoolean("over", false)));
        e.apply();
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, FitPlanWidget.class));
        for (int id : ids) FitPlanWidget.draw(ctx, mgr, id);
        call.resolve();
    }
}
