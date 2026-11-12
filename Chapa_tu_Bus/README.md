# Chapa tu Bus — prototipo editable (v2: voz y accesibilidad)

App web para móvil y laptop. Solo frontend (HTML/CSS/JS), sin compilación.

## Ejecutar en tu laptop
```sh
python -m http.server 8000 --directory dist      # Windows: py -m http.server 8000 --directory dist
```
Abre http://localhost:8000. `localhost` cuenta como conexión segura, así que micrófono y GPS funcionan.
Para el celular del profesor necesitas **HTTPS** (ver AWS abajo): sin HTTPS el navegador bloquea micrófono y ubicación.

## Pruebas (Node.js)
```sh
node tests/transit.cjs && node tests/journey.cjs && node tests/voice.cjs
```

## Qué se agregó
- **Comandos de voz** (`dist/a11y.js`): botón del micrófono (amarillo, abajo a la derecha). Ejemplos: «Chapa tu Bus, ¿cómo llego a la Estación Central?», «cómo llego de Naranjal a Angamos a las 8», «¿cuál es mi próxima estación?», «lee los avisos», «horario del Regular B», «¿a qué hora salgo para llegar a las 8?», «inicia el viaje», «lee la pantalla», «repite», «para». También hay campo de texto como alternativa (Firefox no trae reconocimiento de voz).
- **Manos libres** (ajustes): escucha «Chapa tu Bus…» mientras la app esté abierta y en primer plano. Un navegador no puede escuchar con la pantalla apagada.
- **Lectura en voz alta**: botón del altavoz lee la pantalla actual, opciones de ruta, horarios, avisos y estado del viaje.
- **Avisos de estación**: durante el viaje, «Tu estación de destino es la siguiente». Por defecto sigue la simulación (los avisos dicen «Simulación»). Con el botón «Avisos por ubicación (GPS)» usa la ubicación real solo si la precisión es ≤ 60 m y hay dos lecturas seguidas cerca de la estación; si la señal es mala, lo dice y no avisa.
- **Lectores de pantalla** (TalkBack / VoiceOver): enlace «Saltar al contenido», foco al encabezado al cambiar de pantalla, foco restaurado tras cada actualización, `aria-pressed`, `aria-current`, etiquetas asociadas a campos, barra de progreso, diálogos con título y retorno de foco, región `aria-live`.
- **Ajustes**: velocidad de voz, vibración, texto grande, alto contraste, reducir movimiento.
- **Hora de salida** («¿A qué hora debes llegar?»): resta tiempo de viaje de referencia + caminata + colchón elegido. Es una estimación, no un dato en vivo.
- Marca y colores del logo; instalable en el celular (`manifest.webmanifest`).

## Límites honestos
- No hay llegadas, ocupación ni tráfico en tiempo real; los tiempos de viaje son de referencia/simulados. Eso requiere datos de la ATU/operador o reportes de usuarios (backend).
- La voz usa `SpeechRecognition` / `speechSynthesis` del navegador: Chrome/Edge/Android y Safari (iOS) funcionan; la calidad depende del dispositivo. El reconocimiento de Chrome envía el audio a un servicio de Google.
- La vibración no existe en iPhone. Los puntos de las estaciones son de referencia (OSM), no las entradas.
- Saldo, cobros y buses en movimiento siguen siendo demostración.

## Desplegar en AWS (estático, con HTTPS)
1. S3: crea un bucket privado y sube el contenido de `dist/` (no la carpeta).
2. CloudFront: crea una distribución con ese bucket (Origin Access Control), *Default root object* = `index.html`, redirigir HTTP→HTTPS. Su URL `https://xxxx.cloudfront.net` es la que abres en laptop y celular.
3. (Opcional) Amplify Hosting hace los pasos 1–2 solo con arrastrar la carpeta `dist`.
4. Al actualizar: sube de nuevo y crea una invalidación `/*` en CloudFront.
Siguiente paso con backend (lo que cierra la brecha de datos en vivo): API Gateway + Lambda + DynamoDB para reportes de ocupación/espera de la comunidad, y Cognito para cuentas.

Datos de rutas/horarios: de referencia; verifícalos con la ATU antes de uso operativo. Mapa © OpenStreetMap contributors.
