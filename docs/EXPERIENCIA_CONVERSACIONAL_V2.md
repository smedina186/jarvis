# JARVIS: experiencia conversacional V2 (preparada, no publicada)

## Problemas observados

La revisión diaria confundía una respuesta recibida con exactitud del contenido.
La conversación automática existía, pero requería descubrir varios ajustes.
La memoria no cargaba al abrirse ni confirmaba una comprobación sin cambios.
Los perfiles de especialistas no se podían abrir desde Agentes. Neon no aparecía
en el panel y el estado de la interfaz Netlify no explicaba qué faltaba verificar.

## Cambios integrados

- Chat: botón principal «Hablar con JARVIS» y el mismo acceso al tocar el ojo.
  Consentimiento explícito inicial para transcripción Apple/Google y envío del
  texto a Gemini. Después reutiliza la sesión existente: escucha, envía una vez,
  lee y vuelve a escuchar, hasta seis turnos. Parada al salir, ocultar pestaña,
  revocar permiso o detectar error. Sin palabra de activación en segundo plano.
- Ajustes de voz agrupados. La lectura elimina Markdown y no recita bloques de
  código; favorece voces enhanced/premium disponibles, ritmo 0,95 y tono normal.
  No crea un proveedor de voz ni garantiza una voz humana o masculina inexistente.
- Memoria: carga inicial desde backend, carpetas por proyecto y categorías de
  recuerdos, búsqueda, edición y exportación existentes. Comprobar tiene estado
  ocupado, hora y confirmación accesible. El archivo local cifrado se conserva
  separado y plegado en Chat. No se migra ni se copia automáticamente a Google.
- Misiones: botón para solicitar propuestas reales de Gemini sobre el objetivo.
  Consultar recuerdos para esa solicitud requiere opt-in. No hay inferencia de
  acciones realizadas. Las propuestas son texto, no un ejecutor ni aprobación.
  El ejecutor duradero sigue siendo únicamente memory.recall, con aprobación.
- Agentes: acceso desde cada tarjeta al especialista del chat, incluyendo
  Archivista. Son políticas de Gemini; no se afirma haber instalado colecciones
  de skills GitHub ni herramientas externas. Automatización externa desactivada.
- Panel: Neon solo se muestra conectado tras consulta autenticada real al almacén.
  Netlify indica que esta página respondió desde el host esperado; no certifica
  cuotas, facturación, futuros despliegues ni estado global de la plataforma.
  Gemini diferencia configuración de respuesta recibida; ninguna es auditoría
  de contenido. OpenAI/ChatGPT espera API gratuita autorizada; no se interpreta
  una suscripción personal como créditos API.
- Revisión diaria y system instruction: no usar flags de transporte o detección
  de voz como prueba de exactitud, calidad o funcionamiento en el dispositivo.

## Archivos y seguridad

Frontend: GeminiConversation, useBrowserVoice, ServerMemory, ServerMissions,
PrivateDashboard y estilos adicionales. Backend: gemini_chat, personal_agents,
durable/routes (nueva operación projects, filtrada por owner del servidor).
Se reutilizan las rutas BFF y JWT existentes; no hay endpoints públicos nuevos.
Sin cambios de secretos, cuentas, planes, OAuth, Netlify, Render o main.
El checkbox de consulta de recuerdos en Chat conserva su consentimiento local
entre recargas, sin activarse por defecto. Las llamadas Gemini solo se realizan
por solicitud explícita o la revisión diaria ya autorizada por el usuario.

## Validación

- Backend completo: 346 aprobadas, 5 omitidas; cobertura 51,65 %.
- Frontend: 64 pruebas aprobadas; compilación Next.js y TypeScript correctos.
- ESLint de módulos afectados y Ruff: sin errores.
- Playwright: 9 flujos aprobados en Chromium, escritorio/iPhone/iPad emulados.
  Verifica autorización local de pruebas, chat, dictado, síntesis, no duplicados,
  memoria cifrada y cierre de sesión. Las voces, reconocimiento, sesión OAuth y
  respuestas de proveedor de estas pruebas son fixtures explícitos.
- No se llamó Gemini real ni otro proveedor externo en esta etapa.
- Safari físico pendiente: WebKit no está instalado con sus dependencias nativas
  en el entorno. Detección SpeechRecognition no demuestra permisos ni servicio
  Apple operativo; errores y dictado del teclado siguen siendo fallback real.

## Límites y publicación

Safari no permite prometer escucha permanente con la pantalla bloqueada, y puede
exigir un nuevo gesto para audio o micrófono. Una voz mejorada depende de las voces
que iPadOS exponga; si falta, se conserva texto y reproducción manual. No se añaden
APIs de audio de pago ni se activa facturación para resolverlo.

Estos cambios permanecen locales en prep/private-personal-assistant hasta aprobar
su publicación. El push a esa rama activa despliegues existentes; no hacerlo como
si fuera solo una copia de seguridad. No se requieren variables nuevas ni que el
propietario vuelva a copiar credenciales. Gemini, OAuth y memoria actuales siguen
en producción sin esta revisión visual/conversacional.

## Corrección de turnos de voz en Safari

Los dos accesos principales (ojo/botón y micrófono del compositor) inician la misma
sesión conversacional. El dictado manual queda explícitamente dentro de Ajustes,
como «Dictar borrador sin enviar». En conversación, 1,8 s sin cambios en la
transcripción cierra el turno aunque Safari no emita end; los callbacks tardíos
se invalidan para impedir envíos duplicados. Cancelar limpia ese temporizador.
Un error de no-speech tras recibir una frase conserva el turno ya capturado; los
errores de permisos no lo envían. Se muestra el estado de escucha/procesamiento/
lectura y el texto oído como confirmación, no como paso obligatorio de edición.

La regresión frontend tiene 66 pruebas aprobadas, incluida cancelación durante la
ventana de silencio y un único envío con end retrasado. Compilación y TypeScript
correctos. No cambia backend, JWT, Gemini, datos persistentes, cuotas ni secretos.
Las pruebas de audio siguen siendo fixtures; falta comprobar la secuencia física
en Safari/iPadOS. Un navegador que bloquee reproducción o reapertura del micrófono
puede seguir requiriendo un gesto explícito; no se promete comportamiento de Siri
con la pantalla bloqueada.

## Inicio de audio desde el gesto y conservación del texto

La captura del propietario mostró un timeout de inicio de síntesis. Antes, la
primera reproducción se intentaba después de esperar la respuesta HTTP de Gemini.
Ahora se encola un saludo audible «Te escucho» dentro de la pulsación inicial,
antes de cualquier await de red. El micrófono solo se abre al finalizar ese saludo,
para evitar captar la propia voz. Todos los botones de sesión usan esta ruta.
No se utiliza audio silencioso ni se eluden permisos del navegador.

El timeout de inicio era de tres segundos: se amplió a doce para no cancelar una
voz nativa que tarda en cargar. Un timeout o error sigue visible, no se presenta
como reproducción verificada. onspeechend permite cerrar el turno con una espera
de 500 ms para resultados finales; si el motor no lo emite, continúa el fallback
de transcripción estable de 1,8 s. La cancelación invalida ambos caminos.

El mensaje del propietario se incorpora al chat ANTES de consultar Gemini. Si
falla el transporte, permanece visible y el borrador se conserva para reintentar.
Los turnos fallidos no se envían como historial incompleto ni duplicado. La lectura
fallida tampoco elimina mensajes. Esto no es historial persistente: solo dura la
pestaña actual. La memoria semántica en Neon sigue teniendo su consentimiento y
operaciones explícitas; no se archivan automáticamente todas las conversaciones.

Validación de esta corrección: 68 pruebas frontend, compilación y TypeScript
correctos, ESLint sin errores. Nueve pruebas Playwright aprobadas en Chromium
(escritorio, iPhone e iPad emulados). El flujo de propietario verifica ahora dos
turnos de voz automáticos sin clic en Enviar y sin segundo clic en el micrófono,
con reconocimiento que deliberadamente no emite end y síntesis controlada por
fixtures. Las pruebas externas de Safari/iPadOS real siguen pendientes: no se
certifica eliminar todas las restricciones de audio del sistema operativo.
