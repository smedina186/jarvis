# Conversación de voz r5

Corrección de la captura de frases cortadas y recuperación del audio, 22-11-2026.
Se mantiene Next.js/Netlify, Render, GitHub OAuth, Gemini y memoria existentes.
No hay nuevas dependencias, variables, claves, servicios de voz o facturación.

## Causas corregidas

- El reconocimiento pedía un solo resultado final (`continuous=false`) y trataba
  `end` como final de la petición. WebKit puede emitirlo tras «hola», aunque el
  usuario continúe. Además, `speechend` cerraba el turno a los 500 milisegundos.
- Ahora se pide reconocimiento continuo, se reconstruyen los resultados finales
  e intermedios sin concatenar hipótesis repetidas y se espera una pausa de 2,8 s.
  Si el motor sigue indicando habla, se permite un margen de estabilidad de 6 s.
- Una desconexión corta con texto permite como máximo dos reinicios dentro del
  mismo turno explícitamente autorizado. Se acumulan los segmentos; no se hace
  una consulta a Gemini por segmento. El límite global sigue siendo 45 segundos.
- No se reinicia por permisos denegados, error de red, captura vacía, cancelación,
  pérdida de consentimiento o página oculta. Un error conserva lo transcrito y
  no lo envía automáticamente. Los callbacks de sesiones antiguas se invalidan.
- El cierre automático aborta la captura antes de entregar el mensaje. El fin
  manual deja hasta un segundo para recibir correcciones finales del motor.
- Una voz enumerada no garantiza que sus datos estén descargados o reproducibles.
  Si falla antes de empezar con `voice-unavailable`, `language-unavailable` o
  `synthesis-failed`, se intenta una vez la voz española predeterminada. Nunca se
  repite una lectura ya iniciada ni se reintenta automáticamente `not-allowed`.
- El botón visible **Reactivar voz** reproduce el texto recibido con un nuevo
  gesto del usuario; no llama otra vez a Gemini. También existe antes de la
  primera respuesta para recuperar un saludo bloqueado. La cola de voz se puede
  detener aunque el motor todavía no haya emitido `start`.

## Uso en el iPad

Cuando la barra lateral muestre **Audio r5**, pulsa el ojo o **Hablar con JARVIS**.
Espera «Te escucho», di tu petición completa y haz una pausa de unos tres segundos.
La frase se envía automáticamente y se intenta leer la respuesta real. No hay
que pulsar Enviar ni cerrar el micrófono al terminar de hablar. **Detener
conversación** cierra la sesión. Máximo seis turnos por sesión; no escucha con
la pantalla bloqueada. Aplausos permanece opcional y requiere consentimiento.

Si el navegador exige otro gesto para reproducir, se muestra **Reactivar voz**.
Este control no evita un permiso del sistema. El dictado del teclado sigue siendo
la alternativa si el navegador no proporciona reconocimiento operativo.

## Evidencia y límites

Validación local final: **93 pruebas unitarias** (17 archivos), **21 flujos de
navegador** en escritorio/iPhone/iPad emulados, TypeScript y compilación Next.js
correctos. ESLint de los archivos modificados sin errores ni advertencias; el
análisis completo conserva 18 advertencias anteriores y cero errores. No cambió
el backend; sus 357 pruebas aprobadas de la revisión anterior siguen como base y
el CI de la nueva revisión vuelve a ejecutarlas. Sin patrones de credenciales
reales en los ocho archivos de esta reparación.

Las pruebas distinguen tres niveles:

1. Tests del hook: pausas, resultados parciales/finales, reconexiones acotadas,
   callbacks obsoletos, errores, cancelación, timeout y fallback de voz.
2. Componentes y Playwright: una frase dividida entre dos sesiones llega completa
   a una sola petición y se encola su respuesta para hablar; recuperación de voz
   sin petición duplicada. Micrófono, voz y Gemini son fixtures explícitos.
3. Plataforma real: Netlify confirma que la revisión anterior `75eaccb` estaba
   publicada; no era un diagnóstico basado en suposición de caché. Su equipo
   figura como Free y conserva SSO para todos los despliegues. La nueva revisión
   se verifica por SHA después de publicarla.

El Chromium instalado aquí tiene la API de síntesis, pero no voces operativas y
devuelve `synthesis-failed`. No se presenta eso como una prueba de audio del iPad.
Safari, sus permisos y el sonido físico solo quedan verificados después de una
prueba real en el dispositivo. No se ha contactado la API de Gemini para esta
reparación ni se promete que un indicador del motor certifique sonido audible.
