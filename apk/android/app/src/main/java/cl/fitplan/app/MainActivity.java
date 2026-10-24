package cl.fitplan.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: la web le pasa los números del día al widget de la pantalla de inicio
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
