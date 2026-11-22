# OpenJarvis: integración selectiva de agentes

## Decisión e instalación

Se incorpora una parte auditada del código de OpenJarvis, no el framework completo.
Origen: https://github.com/open-jarvis/OpenJarvis
Revisión fijada: 5a9b5268f2432f7ea4fe402e384ecb6b64a649bb
Licencia Apache-2.0, texto y atribución dentro de backend/openjarvis_tools.
NOTICE.md registra el SHA256 original y modificaciones. LoopGuard es el componente
reutilizado; no se afirma ejecutar el OrchestratorAgent original.

Se eliminó descubrimiento Rust y emisión a su event bus: solo Python estándar.
Los procedimientos de runtime.py son integración propia de JARVIS, guiada por
la arquitectura de herramientas y permisos de OpenJarvis. Se reinstaló el paquete
editable existente de JARVIS con --no-deps para registrar este módulo. No se ejecutó
el instalador remoto ni se instaló OpenJarvis completo, Ollama, Whisper, Kokoro,
colecciones de skills, telemetría o dependencias de entrenamiento/GPU.

## Capacidades reales

- Archivista: memory.recall sobre el propietario/proyecto, hasta cinco recuerdos
  activos (máximo 1000 caracteres cada uno), después síntesis con Gemini. Solicita
  consentimiento para transmitir ese contexto. No modifica ni borra recuerdos.
- Organizador: recibe un objetivo y prepara propuestas con una llamada a Gemini.
  Puede consultar recuerdos con opt-in; no crea misiones ni actúa sin aprobación.
  El botón de propuestas de Misiones reutiliza este procedimiento.
- Documentos: lee exclusivamente el texto enviado en la solicitud, no archivos
  del servidor. Límite de entrada 6000 caracteres; solo procesa los primeros 2000
  y expone document_truncated. Puede combinar hasta cinco recuerdos consentidos.

No hay búsqueda web, ejecución de código, acceso GitHub, correo o Meta conectados.
Los demás perfiles de ventas/Meta Ads/etc. siguen siendo políticas conversacionales
con Gemini. El modelo recibe esa distinción para no confundir perfiles con agentes
externos o inventar herramientas. No hay ejecución 24/7 ni programación nueva.

## Seguridad y persistencia

GET /api/agents/tools y POST /api/agents/run pasan por el BFF existente, sesión
GitHub del propietario y JWT backend de 60 segundos. El backend fija el propietario;
la entrada no permite enviarlo. Proyecto validado, extra forbid, tamaños acotados
y rechazo de patrones de credenciales. Documento y recuerdos se tratan como datos,
no instrucciones de autoridad. Una respuesta textual no concede permisos.

Lista permitida por procedimiento, denegación por defecto, guardia anti-repetición
con bloqueo inmediato, un procedimiento simultáneo y UNA llamada a Gemini por
solicitud. Reutiliza modelo gratuito, autorización, cuotas, cooldown y límites del
chat. No llama OpenAI ni cambia proveedores o claves. Presupuesto configurado $0
no equivale a certificación de facturación de terceros.

Plazos: lectura de memoria 2 s, generación 16 s, recibo 2 s. Sin reintentos
ni workers desatendidos. Cancelar la espera no garantiza cancelar una petición
que Google ya haya recibido. No hay acciones externas irreversibles.

Recibos en colección agent_runs de la misma tabla PostgreSQL, filtrados por owner
+ proyecto. Guardan ID, versión, herramientas completadas, IDs de recuerdos,
hash del objetivo, fechas y estado. No guardan texto del objetivo, documento ni
respuesta. Retención máxima 100 recibos por proyecto; no es historial íntegro de
conversaciones. Si falla el guardado, audit_persisted=false y la UI lo muestra.
Una prueba abre otro repositorio SQL y recupera el mismo recibo; los errores se
registran como fallidos, no como tareas completadas.

## Interfaz y configuración

Nueva sección dentro de Agentes: «Agentes con herramientas limitadas», con objetivo,
proyecto, texto de documento opcional, consentimiento y ejecución explícita. Muestra
resultado y herramientas confirmadas, con advertencia si falta recibo o se truncó
el documento. No hay llamadas al modelo al abrir la pestaña. Conserva los perfiles
existentes y el diseño morado. No se modifica el flujo de voz.

Sin variables nuevas. Reutiliza GEMINI_API_KEY y autorizaciones existentes en Render,
JARVIS_MEMORY_DATABASE_URL y aprobación Neon, y OAuth/JWT ya configurados. No se
pide copiar secretos de nuevo. No se crea tabla ni infraestructura adicional.
Dockerfile.private copia el módulo y su licencia; pyproject empaqueta el módulo.

## Verificación y alcance

Pruebas de herramientas usan SQLite de TEST realmente escrito y reabierto; Gemini
se sustituye explícitamente por un doble. Cubren aislamiento, persistencia de recibo,
consentimiento, límites, default deny, bucles, errores de cuota, concurrencia y
rechazo de visitantes/cuentas ajenas. Frontend verifica que no hay ejecución al
montar ni confirmaciones ficticias en errores. Playwright preserva login/chat/voz
con fixtures, en Chromium escritorio e iPhone/iPad emulados.

No se llamó un proveedor real ni se enviaron recuerdos/documentos de producción.
No se certificó Safari físico ni una ejecución de agente real en Render en esta
etapa. La publicación importante queda pendiente de aprobación. No hubo push,
merge, despliegue, cambio de cuenta ni facturación. Revertir el commit elimina los
procedimientos y conserva memoria y recibos; no se borran datos.

Resultado local final: backend 354 aprobadas y 5 omitidas (cobertura 52,23 %),
frontend 70 aprobadas, build Next.js/TypeScript correcto, 9 flujos Playwright
aprobados. Ruff y ESLint de módulos afectados sin errores.
