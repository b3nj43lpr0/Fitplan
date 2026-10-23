# FitPlan para Android

La app Android es la misma FitPlan de la web. Además puede:

- leer tu reloj solo, desde Health Connect (lo llena Mi Fitness);
- iniciar sesión con la cuenta de Google del teléfono.

Es gratis: GitHub la compila y se instala sin la Play Store.

- **Descarga:** https://github.com/b3nj43lpr0/Fitplan/releases/download/android/FitPlan.apk
- **Actualizaciones:** la app abre la web publicada, así que las mejoras le llegan solas. Solo hay que bajar una APK nueva si cambia algo de la carpeta `apk/`, y eso se avisa.

## 1. Firebase: permitir el inicio de sesión en la app (una sola vez, en el PC)

1. Entra a https://console.firebase.google.com y abre el proyecto **fitplan-43d9a**.
2. Arriba a la izquierda, toca el engranaje ⚙️ → **Configuración del proyecto**.
3. En **Tus apps**, toca **Agregar app** → el ícono de **Android**.
4. Llena:
   - **Nombre del paquete de Android:** `cl.fitplan.app`
   - **Sobrenombre:** FitPlan Android
   - **SHA-1:** `A0:DB:18:BA:85:8F:C8:C7:08:A4:A6:7A:CA:DD:01:C6:C2:C8:6A:20`
5. Toca **Registrar app** y descarga **google-services.json**.
6. Sigue con **Siguiente** hasta terminar. Lo demás no hace falta.
7. Pásale el archivo `google-services.json` a Claude, o súbelo al repositorio como `apk/google-services.json`. GitHub vuelve a compilar la APK sola, ya con el inicio de sesión.

> El archivo no es secreto: solo identifica la app. Tus datos los protegen las reglas de Firestore y tu cuenta de Google.

## 2. Instalar la app en el teléfono

1. En el teléfono, abre el enlace de descarga de arriba con Chrome.
2. Si Chrome avisa que el archivo puede ser dañino, toca **Descargar de todas formas**.
3. Abre **FitPlan.apk** desde la notificación o desde **Archivos → Descargas**.
4. Android pedirá permiso para **instalar apps desconocidas** desde Chrome: toca **Configuración** → activa **Permitir de esta fuente** → vuelve atrás.
5. Toca **Instalar**.
6. Si aparece **Play Protect** ("app no reconocida"), toca **Más detalles → Instalar de todas formas**. Es normal en apps que no vienen de la Play Store.
7. Abre **FitPlan**, ve a **Perfil** (tu inicial arriba) → **Iniciar sesión con Google** y elige tu cuenta. Tus datos aparecen igual que en el PC.

## 3. Conectar el reloj

1. **Mi Fitness:** Perfil → **Health Connect** (o "Compartir datos" → Health Connect) → actívalo y permite todos los datos.
2. **Health Connect:** en Android 12 es una app aparte. Si no la tienes, instálala desde la Play Store ("Health Connect by Android").
3. En **FitPlan → Hoy**, en la tarjeta **⌚ Tu reloj**, toca **Conectar reloj** → **Permitir todo** → **Permitir**.
4. Listo. Cada vez que abras FitPlan, lee el reloj de hoy y de ayer:
   - pasos y distancia;
   - calorías activas;
   - pulso promedio, mínimo y máximo;
   - sueño con sus fases;
   - oxígeno en la sangre;
   - entrenamientos.

   Los entrenamientos se suman solos a **Ejercicio**. Si borras uno, no vuelve a aparecer.

En **Perfil → Reloj** puedes leer los últimos 7 días, cambiar los permisos, desconectar el reloj o elegir no sumar los entrenamientos.

## Preguntas

- **¿Se borra la app web?** No. Puedes seguir usando la web en el PC y en el teléfono. Todo se sincroniza con la misma cuenta.
- **¿Gasta batería?** No queda nada corriendo de fondo: solo lee cuando abres la app.
- **¿Mi Fitness tarda en pasar los datos?** Mi Fitness manda los datos a Health Connect cada cierto tiempo. Abre Mi Fitness un momento, sincroniza el reloj y luego abre FitPlan.
