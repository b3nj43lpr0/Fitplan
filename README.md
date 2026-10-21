# FitPlan

App web para PC y teléfono: calorías consumidas y quemadas, base de alimentos con calorías y macros, sugerencias de qué comer, recetas y rutinas de ejercicio.

## Cómo abrirla en el PC

Haz doble clic en `index.html`. Se abre en tu navegador y funciona sin internet.
Tus datos se guardan en ese navegador (si cambias de navegador, empiezas de cero).

## Cómo usarla en el teléfono

El teléfono necesita abrir la app desde una dirección web. La forma más fácil y gratis:

1. Entra a https://app.netlify.com/drop
2. Arrastra la carpeta `APP FITIA` completa.
3. Abre en el teléfono el link que te da, y en el menú del navegador elige
   **"Agregar a pantalla de inicio"** (o "Instalar app"). Queda como una app más.

Para pasar tus datos del PC al teléfono: Perfil → **Exportar**, y en el otro dispositivo Perfil → **Importar**.

## Qué tiene

- **Perfil**: calcula metabolismo basal, gasto diario (TDEE), meta de calorías, macros, IMC y agua (fórmula Mifflin-St Jeor). Tipos de dieta: equilibrada, alta en proteína, baja en carbohidratos y vegetariana.
- **Hoy**: meta, consumidas, quemadas y restantes; macros; agua; gráfico de 7 días; lo que dice tu plan semanal para hoy.
- **Comidas**: 266 alimentos en español con calorías y macros (USDA) y porción típica. Escáner de código de barras con la cámara (Open Food Facts, necesita internet). Alimentos propios y registro rápido.
- **Ejercicio**: 22 actividades; calcula calorías quemadas según tu peso y minutos.
- **Recetas**: 32 recetas con calorías calculadas y botón de video en YouTube; sugerencias según lo que te queda del día; plan semanal automático (puedes cambiar cada comida) y lista de compras con casillas.
- **Rutinas**: rutina semanal según objetivo, nivel, días, minutos y lugar (casa sin equipo, casa con mancuernas o bandas, gimnasio). Biblioteca de 650 ejercicios con imágenes, músculos, técnica, consejos y video. Puedes cambiar cualquier ejercicio por otro parecido.
- **Progreso**: registro de peso con gráfico y promedio de 7 días, ritmo semanal, ajuste automático de la meta de calorías, medidas corporales y % de grasa estimado.

## Archivos

- `index.html`, `styles.css`, `app.js`: la app.
- `foods.js`: alimentos (USDA SR Legacy, dominio público).
- `exercises.js`: ejercicios (Exercise data by RepDB, repdb.co). Las imágenes se cargan de internet la primera vez y luego quedan guardadas si la app está instalada.
- `data.js`: actividades y recetas. Puedes editarlo para agregar más.
- `vendor/zxing.min.js`: lector de códigos de barras (licencia MIT).
- `manifest.json`, `sw.js`, `icon.svg`: para instalarla como app y usarla sin conexión.

## Notas

- La cámara para escanear funciona en Chrome o Edge en el PC. En el teléfono la página tiene que abrirse desde una dirección https (ver arriba).
- Las imágenes de ejercicios y el escáner necesitan internet; el resto funciona sin conexión.
