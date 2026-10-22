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

## Publicar gratis y sincronizar (PC + teléfono)

Todo es gratuito y no pide tarjeta.

**1. Publicar con GitHub Pages**
1. En GitHub: Settings → Pages → Source: **GitHub Actions**.
2. Cada vez que se suba código a `main`, la app se publica en `https://<tu-usuario>.github.io/<repo>/`.
3. Abre ese link en el teléfono y elige "Agregar a pantalla de inicio".

**2. Sincronizar con Firebase (plan Spark, sin tarjeta)**
1. Entra a https://console.firebase.google.com y crea un proyecto. No actives ningún plan de pago.
2. Authentication → Sign-in method → activa **Google**. En Settings → Authorized domains agrega `<tu-usuario>.github.io`.
3. Firestore Database → Crear base de datos (modo producción) → pestaña Reglas → pega el contenido de `firestore.rules` → Publicar. Si ya tenías reglas de antes, reemplázalas por las nuevas: ahora los datos se guardan en un documento por mes.
4. Project settings → Tus apps → Web (`</>`) → copia el bloque `firebaseConfig` y pégalo en `firebase-config.js`.
5. Sube el cambio. En Perfil → Sincronización, inicia sesión con Google en cada dispositivo.

Los datos se guardan en tu cuenta de Firebase y se actualizan en todos tus dispositivos. La clave de `firebaseConfig` es pública por diseño: la protección son las reglas de `firestore.rules`.

## Qué tiene

- **Perfil**: calcula metabolismo basal, gasto diario (TDEE), meta de calorías, macros, IMC y agua (fórmula Mifflin-St Jeor). Tipos de dieta: equilibrada, alta en proteína, baja en carbohidratos y vegetariana.
- **Hoy**: meta, consumidas, quemadas y restantes; macros; agua; gráfico de 7 días; lo que dice tu plan semanal para hoy.
- **Comidas**: 362 alimentos en español con calorías, macros y porción típica (USDA, más platos chilenos y latinos con valores aproximados). Favoritas, recientes y agregado con un toque. Escáner de código de barras con la cámara (Open Food Facts, necesita internet). Alimentos propios y registro rápido.
- **Recetas**: 60 recetas con calorías calculadas, recetas propias con calculadora de ingredientes y botón de video en YouTube; sugerencias según lo que te queda del día; plan semanal automático (puedes cambiar cada comida) y lista de compras con casillas para copiar o compartir por WhatsApp.
- **Entrenar**: registro de actividades (44, con calorías según tu peso y minutos), rutina semanal según objetivo, nivel, días, minutos y lugar (casa sin equipo, casa con mancuernas o bandas, gimnasio). Biblioteca de 650 ejercicios con imágenes, músculos, técnica, consejos y video. Puedes cambiar cualquier ejercicio por otro parecido. Modo entrenamiento con registro de series, peso y temporizador de descanso. Tipos de rutina: recomendada, empuje/tirón/pierna, torso/pierna, cuerpo completo, un grupo por día, glúteos y piernas, fuerza 5×5 y circuito quema grasa. Historial de cada ejercicio dentro del modo entrenamiento, semana de descarga automática cada 4 semanas de carga y cronómetro de cardio con distancia y ritmo. Entrenamientos sueltos de un día (pecho y tríceps, piernas, glúteos, core, HIIT y más) que no cambian tu rutina.
- **Progreso**: registro de peso con gráfico y promedio de 7 días, ritmo semanal, ajuste automático de la meta de calorías, medidas corporales, % de grasa estimado e historial de fuerza (1RM estimado y récords). Resumen de 7 y 30 días con gráfico de macros, rachas, 15 logros y fotos de progreso con comparación de antes y después (las fotos quedan solo en el dispositivo).

- **Diseño**: tema claro, oscuro o automático y 5 colores a elección (Perfil → Apariencia), animaciones, confeti en logros y entrenamientos, y deslizar el dedo en Hoy, Comidas o Ejercicio para cambiar de día.
- **Recordatorios**: avisos en Hoy según la hora (comidas sin registrar, agua, entrenamiento pendiente) con botón de acción directa.

## Déficit calórico y motivación

- **Ritmo para perder**: suave (−300 kcal), moderado (−500) o rápido (−750), en Perfil o en Progreso → Déficit.
- **Balance**: Hoy muestra el déficit de ayer y de los últimos 7 días con la grasa estimada (7.700 kcal ≈ 1 kg). Progreso → Déficit tiene el gráfico de 14 días, el acumulado de 30 días, lo estimado contra lo que dice la balanza y cuándo llegarías a tu peso meta.
- **Avisos** si el déficit es muy agresivo, si comes bajo tu metabolismo basal, si bajas más de 1 % por semana o si falta proteína. Después de 8 semanas en déficit sugiere una semana en mantención.
- **Comida**: combos (guarda una comida de varios alimentos y agrégala con un toque), ayuno intermitente con contador (Perfil → Ayuno) y lectura de la etiqueta nutricional con la cámara (Comidas → 🏷️ Etiqueta / crear).
- **Resumen semanal** automático el primer día que abres la app en la semana, con una sugerencia concreta.
- **Desafíos de 30 días**: proteína, agua, registro, déficit, entrenamientos, pasos, sin bebidas azucaradas y sueño.

## Coach con IA (gratis)

Toca 💬 en Hoy (o Progreso → Resumen) para preguntarle cosas como "¿qué hice bien esta semana?" o "¿qué ceno con lo que me queda?". Usa Gemini (gemini-3.8-flash) mediante Firebase AI Logic en su nivel gratuito (plan Spark, sin tarjeta) y en cada pregunta le pasa un resumen de tus números (metas, últimos 7 días, peso, entrenamientos y desafíos), sin tu nombre ni tu correo. En el nivel gratuito Google puede usar esas conversaciones para mejorar sus modelos.

Para activarlo: Firebase → Compilación → **AI Logic** → Comenzar → elige **Gemini Developer API** (la opción sin costo) → Activar. Si App Check está aplicado para AI Logic, desactívalo en Seguridad → App Check → APIs → Firebase AI Logic → Dejar de aplicar (la app no usa App Check; el coach exige sesión iniciada). Luego inicia sesión con Google en Perfil → Sincronización: el coach con IA solo funciona con sesión iniciada. Sin conexión, sin sesión o si se acaba la cuota gratis, responde un coach básico que analiza tus números sin IA.

## Registrar ejercicios del gimnasio

En Entrenar → Actividad → **🏋️ Registrar ejercicios del gym**:
- Eliges los ejercicios por músculo (pecho, espalda, hombros, bíceps, tríceps, antebrazo, cuádriceps, femoral, glúteos, pantorrillas, abdomen, cuerpo completo), por equipo (máquina, barra, mancuernas, polea, peso corporal) o buscando con los nombres del gimnasio ("press francés", "cruce de poleas", "jalón", "prensa 45", "femoral"…). Primero salen los que ya hiciste y los más comunes.
- La biblioteca tiene más de 700 ejercicios: los de RepDB más 60 de máquinas y variantes comunes en gimnasios (`EXTRA_EXERCISES` en `data.js`).
- Por cada ejercicio anotas las series con kg × repeticiones (parte con lo que hiciste la última vez). Te avisa si una serie es récord.
- Calcula las calorías con tu peso, el tipo de ejercicios, la duración y la intensidad. Se guarda como actividad del día (suma a tu presupuesto de calorías) y como entrenamiento con series (récords y gráficos de fuerza).
- Si cierras sin guardar, queda como borrador. Con ✏️ editas una sesión guardada y con ✕ la borras (con deshacer).

### Más funciones con la misma IA

- **Foto del plato** (Comidas → 📸): la IA reconoce los alimentos y estima cantidades y calorías.
- **Escribe o dicta lo que comiste** (Comidas → 💬): "2 huevos revueltos y una marraqueta con palta" se separa en alimentos. Si un alimento coincide con uno de la base, se usan los valores de la base. Antes de guardar puedes cambiar los gramos, quitar alimentos y elegir la comida.
- **Escribe o dicta lo que entrenaste** (Entrenar → Actividad → 💬): "press banca 3x10 con 60 kg y 20 min de trote" queda registrado como entrenamiento con series (cuenta para tus récords) y como actividad con calorías. Si un ejercicio no calza, lo cambias en la lista o se crea como nuevo.
- **Armar una comida** (Recetas → 🤖 Con IA): propone un plato con las calorías y proteína que te quedan, con lo que tengas en la casa. Lo agregas al día o lo guardas como combo.
- **Revisión semanal**: el resumen del lunes trae el análisis del coach (qué hiciste bien, qué falló y una meta). Se pide una sola vez por semana y queda también en el chat del coach.
- **Récords**: aviso en vivo cuando una serie supera tu mejor marca; en Progreso → Fuerza ves los récords del mes y, por ejercicio, 1RM, peso máximo, más repeticiones y mejor volumen con su gráfico.

## Varias personas en el mismo teléfono

Toca tu inicial en Hoy (o Perfil → Personas en este teléfono) para agregar a alguien o cambiar de persona. Cada una tiene sus propias comidas, rutina, progreso, entrenamiento en curso y fotos. Con la sincronización, cada perfil se guarda en su propio espacio dentro de la misma cuenta de Google.

## Sin señal y accesos directos

- La app abre sin internet y, si la señal es mala, no espera más de 3 segundos antes de usar lo guardado.
- Al generar una rutina, sus imágenes se guardan solas para entrenar sin señal. En Entrenar → Ejercicios puedes descargar la biblioteca completa (≈22 MB).
- Al mantener presionado el ícono de la app instalada aparecen accesos directos: tomar agua, registrar comida, entrenar y anotar peso.

## Pruebas automáticas

Cada cambio corre `npm test` en GitHub (pruebas de la app en un navegador con tamaño de teléfono y una simulación de sincronización entre dos dispositivos). Si algo falla, la app publicada no cambia. Para correrlas en tu PC: `npm install`, `npx playwright install chromium` y `npm test`.

## Archivos

- `index.html`, `styles.css`: la página y el diseño.
- `js/`: el código, un archivo por parte (`core.js` con estado, cálculos y navegación; `hoy.js`, `comidas.js`, `actividad.js`, `recetas.js`, `entrenar.js`, `progreso.js`, `perfil.js`, `gym.js` para registrar el gimnasio, `coach.js` e `ia.js` con las funciones de IA; `main.js` arranca la app).
- `sync.js`, `firebase-config.js`, `firestore.rules`: sincronización con Firebase.
- `tests/`: pruebas automáticas.
- `foods.js`: alimentos (USDA SR Legacy, dominio público).
- `exercises.js`: ejercicios (Exercise data by RepDB, repdb.co). Las imágenes se cargan de internet la primera vez y luego quedan guardadas si la app está instalada.
- `data.js`: actividades y recetas. Puedes editarlo para agregar más.
- `vendor/zxing.min.js`: lector de códigos de barras (licencia MIT).
- `vendor/tesseract/`: lector de texto para las etiquetas nutricionales (tesseract.js, Apache-2.0). Se descarga solo la primera vez que se usa (≈6 MB) y funciona dentro del teléfono.
- `manifest.json`, `sw.js`, `icon.svg`: para instalarla como app y usarla sin conexión.

## Notas

- La cámara para escanear funciona en Chrome o Edge en el PC. En el teléfono la página tiene que abrirse desde una dirección https (ver arriba).
- Las imágenes de ejercicios y el escáner necesitan internet; el resto funciona sin conexión.
