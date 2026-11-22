# Voz en agentes, dos aplausos y skills revisadas

## Funciones implementadas localmente

- Los agentes pueden leer su respuesta mediante la misma síntesis del navegador.
  El checkbox «Leer respuestas del agente en voz alta» es visible; se puede
  reproducir o detener el resultado. No se añade un proveedor de voz de pago.
- «Hablar con este agente» pide consentimiento, reproduce un saludo dentro del
  gesto y transcribe el objetivo. Al terminar lo envía al procedimiento elegido,
  respetando el consentimiento independiente de consulta de memoria. Sin TTS,
  mantiene el dictado y muestra límites. Objetivo conservado, máximo 2000 caracteres.
- Activación con dos aplausos: un analizador Web Audio local del micrófono, sin
  grabaciones ni envío de sus muestras. Se habilita con consentimiento explícito,
  está apagado por defecto y se limita a diez minutos con la página visible.
- El detector mide RMS/crest y dos transitorios breves separados 160–800 ms,
  rechaza ruido sostenido y aplica dos segundos de bloqueo tras la detección.
  No es identificación biométrica ni un clasificador infalible: golpes y ruidos
  pueden causar activaciones falsas, y algunos micrófonos pueden no detectarlos.
- Tras detectar, libera todas las pistas de micrófono ANTES de iniciar la sesión
  de voz. Se pausa mientras JARVIS escucha, procesa o habla. Se rearma al acabar
  una conversación si continúa habilitado y no hay errores de voz. Al ocultar
  la página se deshabilita; no se reactiva solo al regresar ni sirve con pantalla
  bloqueada. Navegadores que suspenden AudioContext muestran el bloqueo real.
- La captura y el contexto se cierran al desactivar/desmontar, incluso si el
  permiso de micrófono se resuelve tarde. No se conecta el micrófono al altavoz.

## Procedencia de OpenJarvis

Se revisó la revisión ya fijada 5a9b5268f2432f7ea4fe402e384ecb6b64a649bb.
Su speech/voice_io.py usa sounddevice y RMS/silencio sobre el dispositivo donde
corre Python. No se encontró allí una función de doble aplauso para Safari.
El detector de navegador es código JARVIS nuevo; no se presenta como importación
ni como reconocimiento semántico de OpenJarvis. Su ejemplo de audio local no da
acceso al micrófono del iPad desde Render.

Se adaptaron instrucciones de skills/data/todo-from-notes.toml y meeting-notes.toml:
«Extraer tareas de notas» y «Preparar minuta». Se añadió resumen de texto. El agente
Documentos elige la plantilla y realiza una generación real con Gemini al pedirlo.
No se importan file_read, shell o think: en OpenJarvis think es un eco, no un LLM.
Los tipos de habilidad están cerrados por Literal y solo se permiten para Documentos;
se registran en el recibo de ejecución. Se mantienen lectura máxima 2000 caracteres,
señal de truncamiento, cuota compartida, guardia anti-bucles y políticas existentes.
Las atribuciones se amplían en backend/openjarvis_tools/NOTICE.md.

## Matriz de compatibilidad: no instalar a ciegas todo el repositorio

| OpenJarvis | Estado en nuestro JARVIS | Límite o dependencia |
|---|---|---|
| Orquestación y herramientas | Procedimientos explícitos, guardia OpenJarvis y recibos en Neon | No ejecuta el orquestador original ni shell |
| Skills de documentos/notas | Tres plantillas disponibles con Gemini | Solo contenido aportado; sin lectores de archivos remotos |
| Memoria | Neon y consulta autorizada existentes | No sustituir por archivos/SQLite efímeros |
| Voz y silencio | Navegador, lectura de agentes y detección local de aplausos | Prueba física Safari pendiente |
| Kokoro/Whisper/Ollama | No instalados | Modelos y dependencias pesadas; no se ha demostrado encaje en Render Free de 512 MB |
| Scheduler/operatives continuos | No activados | Render Free se suspende; no garantía 24/7 ni worker duradero |
| Código/shell y modificación de repositorios | No activados | Requieren permisos específicos, sandbox y revisiones; no copiar credenciales de ChatGPT |
| Gmail/calendario/canales | No conectados por esta etapa | Necesitan autorización/credenciales propias para JARVIS |
| OpenAI/otros proveedores | No activados | Suscripciones personales no equivalen a API gratuita |
| Entrenamiento/optimización automática | No activados | Requieren cómputo, llamadas y evaluación; sin garantía de costo $0 |
| Telemetría/trazas externas | No activadas | Se conservan recibos mínimos propios, sin exportar conversaciones |
| GUI/servidor originales | No instalados | Se conservan nuestra web, OAuth, Netlify y Render |

El software abierto no convierte el cómputo, API y conectores asociados en gratuitos.
No se habilitó facturación, descargó modelos ni creó un servicio adicional.

## Verificación

Backend: 355 pruebas aprobadas y 5 omitidas; frontend: 75 aprobadas. Compilación
Next.js/TypeScript correcta. Cuatro pruebas específicas del detector/hook verifican
dos pulsos, ruido, ecos, desactivación y liberación tardía del permiso. Nueve flujos
Playwright aprobados en Chromium escritorio/iPhone/iPad emulados mantienen login,
chat y dos turnos de voz. Audio, permisos y modelos son fixtures explícitos.
No se afirma haber comprobado aplausos físicos o reproducción nativa en Safari.
Ruff/ESLint y revisión de whitespace sin errores. Sin llamadas reales a Gemini.

## Activación

Sin variables nuevas ni claves manuales. Publicación pendiente de aprobación porque
se añade un modo de micrófono abierto. Una vez publicado, el propietario abre Chat →
Activar con dos aplausos → Activar dos aplausos y acepta los permisos. Puede usar
el ojo sin activar esta modalidad. Las solicitudes siguen pasando por OAuth/JWT.
No hay push, merge ni cambios de producción en esta entrega local.
