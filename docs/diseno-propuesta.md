# Propuesta de rediseño visual de FitPlan

Guardada el 23 de octubre de 2026. Todavía no se aplica a la app.
Regla: **no se quita ninguna función**, solo cambia cómo se ve.

## Diagnóstico de la interfaz actual
- 11 tamaños de letra distintos (de 11 a 22 px).
- 6 a 7 curvaturas de bordes distintas.
- Muchos emojis mezclados con el texto. Por eso se siente "cargada".

## Inspiración: Fitia
Fitia es más simple a la vista, gira en torno al plan del día y tiene un "+" por comida.

Ideas a tomar:
- Número grande de las kcal que te quedan.
- Barras finas de macros.
- El plan de hoy en Hoy, con "✓ Comí esto" y "↻ Cambiar".
- Un solo botón "+" para registrar.
- Tarjetas chicas que se pueden plegar.

## 1. Colores (elegir una dirección)
| | A · Fresco (estilo Fitia) | B · Energía | C · Premium oscuro |
|---|---|---|---|
| Color principal | Verde menta `#12B886` | Coral `#FF5A4E` | Lima `#C6F432` |
| Fondo | `#F6F7F9` | `#FBF8F5` | `#0B0B0F` |
| Tarjetas | Blanco | Blanco | `#16161C` |
| Sensación | Limpio, saludable | Deportivo, motivador | Elegante, tipo Whoop/Oura |

Macros con colores fijos en las tres:
- Proteína: rosa-coral.
- Carbos: ámbar.
- Grasas: azul-violeta.
- Agua: celeste.

Todas las direcciones tienen modo claro y oscuro (la C es oscura por defecto).

## 2. Tipografía (6 tamaños en total)
| Uso | Tamaño | Peso |
|---|---|---|
| Número gigante (kcal que te quedan) | 40 px | 800 |
| Título de pantalla | 26 px | 700 |
| Título de tarjeta | 18 px | 600 |
| Texto normal | 16 px | 400 |
| Texto secundario | 14 px | 400, gris |
| Etiquetas y cápsulas | 12 px | 600 |

Fuente: Inter (la actual) o Plus Jakarta Sans (más redondeada).

## 3. Cápsulas, botones y bordes (3 curvaturas)
- Tarjetas: 20 px.
- Campos y botones medianos: 14 px.
- Cápsulas: completamente redondas, 32 px de alto.
  - Elegida: color principal relleno.
  - Sin elegir: gris suave.
- Botones:
  - Principal: 52 px de alto, ancho completo.
  - Secundario: con contorno.
  - De texto: solo la palabra en color.

## 4. Espacios
- Múltiplos de 4: 8, 12, 16, 24 y 32.
- 16 px de margen a los lados y 16 px entre tarjetas.

## 5. Íconos
- Íconos de línea (Lucide) en la navegación y los botones.
- Se mantienen los emojis de comida.

## 6. Componentes clave
- **Hoy:**
  - Número grande de kcal que te quedan, con un anillo delgado.
  - Tres barras finas de macros.
  - Las comidas del día con un "+" redondo.
  - Consejo, agua, reloj y ayuno en tarjetas chicas que se pliegan.
- **Barra inferior:** 5 íconos de línea; la sección activa va en una cápsula de color con su nombre.
- **Botón flotante "+":** abre foto, voz, buscar y escanear.
- **Sombras:** muy suaves en modo claro; en modo oscuro no hay sombras, solo bordes sutiles.

## Pendiente
- El usuario elige la dirección, o manda referencias propias.
- Armar una página de muestra con la pantalla Hoy en A, B y C antes de tocar la app.
- Después del rediseño, la versión Android con Health Connect (Mi Fitness) ya está aprobada. El plan está en la conversación.
