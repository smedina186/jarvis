# Fase 2: conversación por voz — preparada, sin publicar

Base: producción `5292370`, rama `prep/private-personal-assistant`.
No cambia Gemini, Render, OAuth, claves, facturación o límites económicos.
El diseño morado, ojo y perro 186 permanecen. No hay dependencias nuevas.

## Archivos y funcionamiento

- `useBrowserVoice.ts`: reconocimiento y síntesis nativos del navegador, sin
  servicios de pago, SDK, grabaciones o almacenamiento de audio.
- `GeminiConversation.tsx`: Modo voz, consentimiento, transcripción editable,
  selección de voz, reproducción/silencio/parada y dictado del teclado.
- `PrivateDashboard.tsx` / `private.css`: ojo en espera, escucha, procesamiento
  y reproducción. El estado de habla empieza solo con el evento real `start`
  del sintetizador; no cuando se encola una voz que Safari pudiera bloquear.
- `next.config.ts`: permite micrófono únicamente al propio origen (`self`);
  cámara y geolocalización siguen prohibidas. El navegador conserva el control
  de permiso y no se solicita acceso al abrir la página.

Se investigó react-speech-recognition y la documentación Web Speech de MDN;
se eligieron las APIs nativas por el alcance pequeño, sin polyfills que envíen
voz a un nuevo proveedor ni suscripciones adicionales.

## Recorrido desde el iPad, tras autorizar publicación

1. Abrir JARVIS en Safari HTTPS y comprobar la conexión habitual.
2. Activar **Modo voz**. Esto no abre el micrófono.
3. Leer y marcar el consentimiento para reconocimiento del navegador.
4. Pulsar **Iniciar dictado** y aceptar el permiso de Safari.
5. Decir «Jarvis, buenos días. ¿Cómo estás?» y pulsar **Finalizar dictado**.
6. Revisar/corregir el texto y pulsar **Enviar mensaje a Gemini** una vez.
7. JARVIS leerá el texto real devuelto si Modo voz sigue activado, no está
   silenciado y el navegador permite la reproducción. Nunca se envía al terminar
   de hablar sin revisión/envío explícito.

La síntesis utiliza únicamente las voces disponibles en el navegador. Prioriza
español y, si existen, nombres conocidos de voces masculinas; la API no expone un
campo de género ni garantiza una voz concreta o calidad natural. Hay selector
manual y preferencia por voces del dispositivo. No descarga ni compra voces.
Las voces marcadas como servicio del navegador pueden procesar texto externamente.

**Silenciar** cancela lo que se está leyendo y evita lectura automática de nuevas
respuestas. **Reproducir respuesta** lee la última respuesta real recibida;
**Detener voz** cancela su cola. Apagar Modo voz, salir de Chat, ocultar la pestaña,
cerrar sesión o desmontar el panel cancela escucha y lectura; no se reinician solas.
El reconocimiento se cancela antes de leer y la reproducción antes de escuchar.
No hay escucha permanente, palabra de activación ni grabación con MediaRecorder.

## Límites reales de Safari y alternativas

Se detecta `SpeechRecognition` o `webkitSpeechRecognition`. Que la clase exista
no garantiza acceso al servicio: puede requerir ajustes de Siri/Dictado, permisos,
conectividad, idioma o disponibilidad del sistema. Safari controla el diálogo de
permiso; la aplicación no puede forzarlo ni eludir una denegación.

Si no se ofrece o falla el reconocimiento, **Usar dictado del teclado** enfoca
el mensaje. Toca el micrófono del teclado de iPadOS. Si no aparece, revisa
**Ajustes → General → Teclado → Activar dictado** y el teclado en español.
La web no puede activar ese dictado del sistema por código. También se puede
escribir normalmente y enviar con el mismo chat. No hay conversión simulada.

Safari puede bloquear la lectura automática porque la respuesta llega después
de una petición de red, fuera del gesto inicial. Si no empieza en 3 segundos,
se cancela la cola y se muestra **Pulsa Reproducir respuesta**; tocarlo proporciona
el gesto de usuario. No se reproduce un sonido/voz vacía para forzar permisos.
Se dividen respuestas largas en fragmentos cortos para reducir interrupciones.
Si no hay síntesis, la respuesta de Gemini sigue visible por escrito.

El brillo del ojo durante habla es aproximado: eventos `boundary` cuando están
disponibles y pulsación suave durante `start`/`end`. No se mide amplitud de audio.
Con movimiento reducido se eliminan animaciones y cambios rápidos de brillo.
La escucha está limitada a 45 segundos; se muestran fallos de permisos, red,
ausencia de voz y motor bloqueado. No se reintenta ni envía automáticamente.

## Privacidad y costo

El reconocimiento del navegador puede enviar audio a Apple/Google u otro servicio
del navegador. Se informa antes del consentimiento; no se afirma que sea local.
El dictado del teclado tiene las condiciones de iPadOS. JARVIS no graba ni conserva
audio ni usa una API de transcripción de pago. Solo el texto revisado y enviado
por el usuario llega al backend/Gemini bajo los controles existentes de $0.
Micrófono y Modo voz se inicializan apagados en cada carga; no se persiste permiso
en localStorage ni se crean conexiones de tiempo real con Render.

## Pruebas y alcance

Las pruebas de voz usan motores de navegador y respuestas declarados como fixtures;
no activan micrófonos reales, servicios de voz ni Gemini. Se verifica consentimiento,
transcripción editable, errores, cancelaciones, temporizador, voz española,
reproducción/silencio y prevención de peticiones duplicadas. El recorrido integrado
comprueba dos envíos intencionales (escrito y dictado), una respuesta hablada y los
estados del ojo en tamaños de escritorio/iPhone/iPad usando Chromium.

El intento de iniciar WebKit en este entorno falló por bibliotecas del sistema
faltantes: GTK4, Graphene, Harfbuzz ICU, Manette, Hyphen, WOFF2 y GLESv2. No se
certifica Safari real ni captura/reproducción física. El motor descargado que no
podía ejecutarse se retiró del caché para liberar disco; el código no depende de él.
La primera compilación encontró ENOSPC del entorno, no un error de TypeScript;
se liberaron únicamente cachés de herramientas/compilación. No se borró código,
credenciales ni datos del usuario. La compilación posterior pasó.

Antes de considerar certificada la experiencia, verificar en el iPad real tras
aprobar la publicación: permiso, micrófono/dictado, voz disponible, reproducción
manual si Safari bloquea la automática y que una pulsación de Enviar produzca
una respuesta. Esa prueba real no se hizo desde este entorno.

No se modificó backend: se conservan sus pruebas anteriores (333 aprobadas,
5 omitidas), sin repetirlas innecesariamente. No se sube, fusiona ni despliega
esta fase hasta autorización. Para publicarla basta actualizar el frontend
Netlify; no requiere nuevas variables de Render, claves ni facturación.

Referencias:
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/speak
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService

Resultado final: 54 pruebas unitarias del frontend aprobadas (incluidas 10 nuevas
de voz e integración), 9 recorridos Playwright aprobados, compilación Next.js y
ESLint de archivos afectados aprobados. Se mantuvieron las pruebas originales
más las nuevas sin llamadas reales a Gemini ni servicios de voz. El chat escrito,
rechazo de usuarios ajenos, salida de sesión y tamaño iPad/iPhone fueron verificados.
