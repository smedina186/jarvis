# Memanto / memoria / misiones — auditoría y preparación, 22-11-2026

**Estado: preparado, NO conectado y NO publicado.** No se enviaron recuerdos,
fuentes de la empresa, código del repositorio ni credenciales a Memanto/Moorcheh.
No se ejecutó `memanto connect codex`, no se modificaron AGENTS.md, skills ni hooks.
La rama de trabajo conserva a1447bb y los commits anteriores; main está intacta.

## Fase 0: diagnóstico real

| Componente | Situación actual | Riesgo | Cambio previsto/preparado |
|---|---|---|---|
| Next.js / Netlify | Rama publicada prep/private-personal-assistant; producción e4ac530; nueva entrega a1447bb sigue local | Push puede activar publicación automática | No push; revisión y aprobación previas |
| GitHub OAuth | Auth.js, ID numérico propietario en servidor | Confundir 401 de Render con sesión del navegador | Guardas actuales conservadas |
| Next → Render | Proxy allowlist, JWT HS256 de 60 s, HTTPS | Permitir herramientas históricas o rutas arbitrarias | Nuevas rutas enumeradas, sesión + origen en POST |
| FastAPI privado | private_main:app, middleware verifica issuer/audience/sub | Endpoints nuevos sin autorización | Todas las rutas pasan por middleware |
| Salud | /healthz mínimo público; APIs privadas | Render Free se suspende | Sin nuevos servicios ni promesas 24/7 |
| Gemini | HTTPX asíncrono, clave solo Render, candados de autorización/free | Romper chat si memoria falla | Memoria optativa; fallo recuperable, Gemini puede seguir |
| Conversación | Memoria RAM de pestaña | Confundir con historial central | No se presenta como persistente |
| Memoria local | AES-GCM en navegador, exportación cifrada | Borrado de Safari y ausencia de sincronización | Se conserva; no migración automática |
| Memoria de producción | No hay base externa configurada | Disco efímero pierde recuerdos | MemoryService + repositorio SQL externo, desactivado |
| Memanto | No había integración | Asumir que conectar Codex conecta el producto | Adaptador SDK separado, pendiente de proveedor/consentimiento |
| Agentes | Perfiles Gemini; sin shell, Meta API o ejecutor GitHub | Fingir agentes ejecutores por instalar prompts | Registro versionado y allowlist explícita |
| Misiones | Revisión diaria local optativa, sin worker permanente | Mostrar trabajo en curso sin proceso real | Estado duradero y ejecutor manual de un paso readonly |
| Voz | Web Speech con consentimiento; pruebas con fixtures | Safari físico no certificado | Se conserva; sin proveedor de voz nuevo |
| Presupuesto | Política $0; no facturación habilitada por Codex | Confundir créditos promocionales con gratuidad permanente | Estados «no verificable», ninguna compra automática |

Variables existentes revisadas por nombre, sin leer ni imprimir valores reales:
AUTH_URL, AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_TRUST_HOST,
JARVIS_OWNER_GITHUB_ID, JARVIS_BACKEND_URL, JARVIS_BACKEND_AUTH_SECRET,
GEMINI_API_KEY, GEMINI_MODEL, JARVIS_GEMINI_ENABLED,
GEMINI_FREE_TIER_CONFIRMED, JARVIS_PERSONAL_MODE y JARVIS_ENV.

Netlify auto-publica la rama configurada; Render blueprint usa Docker root backend,
autoDeploy false, /healthz y plan free. Son despliegues independientes. CI verifica
frontend/backend, el workflow deploy existente es preflight manual sin publicar.
No se inventaron hooks de despliegue ni se cambiaron secretos que funcionan.

## Fase 1: evaluación primaria de Memanto

Fuentes leídas: README, AGENT_INTEGRATION_GUIDE.md, SECURITY.md, pyproject, licencia,
cliente Python, cliente hosted/device auth, fábrica de clientes, sesión local y
exportación. También se consultó memanto-agent-skills: instala instrucciones,
skills y hooks, no ejecutores de negocio. No se ejecutaron sus comandos de setup.

Versión estable comprobada en PyPI: **memanto 0.3.0**, Python >=3.10,<4, licencia MIT.
Se descargó la wheel oficial, se verificó SHA-256
`4f67dceab437203dc899bbba1523bebf80447b5e3c108936224948774bc45e06`, se instaló sin
scripts ni dependencias en /tmp/jarvis-memanto-sdk y se importó para inspeccionar
las firmas reales, sin crear clientes ni enviar datos.

| Operación solicitada | API real 0.3.0 |
|---|---|
| remember | Memanto.remember(content, type, title, confidence, tags, source, provenance) |
| recall | Memanto.recall(query, limit, type, tags, min_similarity, source) |
| edit | Memanto.update_memory(memory_id, **updates), no método edit() directo |
| forget | Memanto.delete_memory(memory_id), no método forget() directo |
| export | client.client.export_memory_md / export_okf_bundle; escriben archivos locales |
| bootstrap | CLI `agent bootstrap`; cliente superior no tiene bootstrap(); adaptador compone briefing acotado con recall |
| list | recall_recent existe; no se trata una búsqueda top-k como exportación exhaustiva |
| caducidad | Políticas configuradas, vencimiento lógico y purga separada; sin política no caduca automáticamente |

Export OKF tiene límites por tipo y no demuestra por sí solo un respaldo completo
de toda una cuenta. El export canónico de JARVIS es JSON legible de su base, con
versiones y auditoría; OKF queda disponible en el adaptador, pendiente de conexión
y verificación de completitud. No se presenta JSON propio como OKF.

La guía CLI de integración y SECURITY describen superficies distintas del cliente
Hosted actual. Seguridad local usa X-Session-Token; HostedClient usa x-api-key.
El login Cloud es un flujo de aprobación de dispositivo que entrega una clave;
no se copian cookies/tokens de usuario a Render. La autorización de servidor
no interactiva y el plan deben confirmarse antes de recomendarlo en producción.
El cliente Python superior está orientado al backend local/Moorcheh, no equivale
a cambiarlo por HostedClient automáticamente. Sesiones y registro activo pueden
vivir en ~/.memanto: esos archivos no son persistencia válida de misiones en Render.

| Modalidad | Persistencia y privacidad | Costo comprobado / límite | Veredicto $0 |
|---|---|---|---|
| Memanto Cloud | Recuerdos remotos, datos a tercero; backup del proveedor | Página actual: Pro desde $29/mes, mes promocional al añadir tarjeta | No activar; no es Free permanente |
| Memanto local + Moorcheh Cloud | Datos remotos en Moorcheh; registros/sesiones locales | 500 créditos iniciales, aproximadamente 100K operaciones, no prueba de renovación mensual | Preparado; cuota/retención/facturación no verificadas para esta cuenta |
| On-prem + Moorcheh/Ollama | Requiere Docker, almacenamiento y cómputo propios | Software $0; infraestructura no incluida | No cabe como solución durable/autónoma garantizada en Render Free |
| PostgreSQL externo + índice Memanto | Base canónica y checkpoints separados del índice semántico | No hay proveedor/cuenta aprobado/configurado | Preparado, no conectado; requiere decisión previa |

No se seleccionó ni creó infraestructura externa. Una base con caducidad de
prueba no sería aceptable como solución final. No hay una modalidad Memanto
permanente, alojada y compatible $0 verificada aquí. No se activa un plan de pago
ni se asume que la cuenta tiene cuotas por el texto comercial de un README.

## Arquitectura implementada

1. **Memoria del desarrollo:** instrucciones/repositorio/Codex. Sin sincronización
   Memanto ni envío de fuentes. No comparte namespaces con JARVIS.
2. **Memoria JARVIS:** MemoryService autenticado, owner tomado de configuración
   validada por JWT, project validado, repositorio SQL intercambiable y adaptador
   Memanto separado. No hay credenciales de almacenamiento en frontend.
3. **Estado de misiones:** colección SQL independiente, aprobación inmutable,
   checkpoints y eventos. Nunca se infiere aprobación de un recuerdo o texto LLM.

Los registros tienen ID, owner, project, tipo, procedencia, confianza, fechas,
vigencia, relaciones, versiones, conflictos y estado. Inferencias van a revisión
con confianza máxima 0,7. El mismo contenido normalizado no se duplica en altas;
una contradicción sobre el mismo topic queda en revisión, no pisa el hecho viejo.
La corrección explícita conserva versiones y marca la anterior como sustituida.
Se prohíben patrones de contraseñas/tokens/claves. Validación HTTP no refleja
inputs sensibles en el error 422. La expiración es lógica; no implica eliminación
física automática. La exportación y el borrado usan SQL real, no respuestas ficticias.

Repositorio principal PostgreSQL externo, TLS verify-full, timeout de conexión,
statement/lock timeouts, transacciones y control de revisión. Tabla nueva
jarvis_state con claves owner/project/collection. Creación idempotente sin borrar
ni sobrescribir tablas existentes. Solo se ejecuta tras configuración autorizada.
SQLite se usa EXCLUSIVAMENTE en tests con archivos temporales, no en configuración
ni producción; postgres_repository rechaza URLs SQLite. No hay fallback a disco.

MemantoAdapter usa las firmas SDK verificadas, namespace derivado de owner/project,
validación de versión y errores sanitizados. **Está enlazado de forma opcional y desactivada; no se ha invocado un
proveedor real.** No se declara conectado
por instalar el paquete. Activarlo exige confirmar proveedor, cuota, autenticación,
consentimiento, sincronización/borrado del índice y pruebas externas. La base SQL
puede funcionar independientemente, una vez autorizada, sin bloquear Gemini.
Con JARVIS_MEMANTO_MODE=approved_free_credits y MOORCHEH_API_KEY, solo después de
aprobar privacidad y créditos sin facturación, se permite el índice opcional:
altas/correcciones en SQL primero; acuse de escritura del índice distinto de
lectura verificada; recuperación revalidada contra IDs del owner/proyecto en SQL.
Si falla la búsqueda del índice se usa recuperación léxica y se informa error.
La actualización de SQL no se pierde por un fallo del índice. Una escritura remota
ambigua se marca pendiente y no se reintenta a ciegas. El borrado con índice
requiere confirmación remota antes del borrado canónico; si falta ID por timeout,
se requiere limpieza del namespace del proyecto, sin afirmar eliminación completa.
El borrado multialmacén puede quedar parcial si un proveedor falla; no es una
transacción distribuida ni se anuncia éxito global. Los hilos SDK quedan serializados
incluso si vence la espera HTTP, porque el cliente SDK no es thread-safe.

Antes del chat, con opt-in de memoria de servidor, se recuperan como máximo cinco
recuerdos activos del proyecto y se añaden como datos no confiables, con procedencia
y antigüedad. No se convierten en instrucciones del sistema. Sin configuración o
con fallo se informa que la respuesta va sin memoria; el chat normal no se rompe.
No se almacena toda la conversación ni se llama a extracción/answer de Memanto.
«Recuerda que…» guarda solo declaraciones explícitas con confirmación real del
repositorio; «qué recuerdas de mí» consulta. Corrección/borrado individual están
implementados por API/UI y comandos con el ID explícito; el borrado global requiere BORRAR_TODO en la interfaz.
Un comando de chat de borrado pide esa confirmación y no borra por inferencia.

La UI agrega Memoria y Misiones sin rehacer el panel morado. Estado pendiente
mientras no hay base. Recuerdos buscables/editables/borrables/exportables cuando
exista almacenamiento. Memanto se muestra preparado/no conectado, no verde.
GitHub/Gemini/Netlify/Render mantienen sus verificaciones existentes; no se afirma
facturación $0 confirmada sin datos del proveedor.

## Agentes y misiones

Registro con investigación, programación, documentos, organización, análisis,
automatización y archivista. Versión, propósito, skills, herramientas, datos,
presupuesto, pasos y política de aprobación explícitos. Skill implementada:
`memory.recall@1.0.0`, solo del owner/proyecto. No shell, GitHub write, correo,
anuncios, MCP administrativo, URLs arbitrarias ni pagos.

El ejecutor actual realiza UNA recuperación real de memoria por paso aprobado y
guarda evidencia (IDs/cantidad/fecha). Los demás ejecutores son pendientes, no
supuestos. Plan determinista de revisión, no planificador LLM ficticio. Estados:
pending_approval, queued, working solo durante el ejecutor real, paused, blocked,
completed. Al perder el proceso, working abandonado se recupera como paused al
consultar; no se reanuda solo. Aprobar registra owner/fecha/hash del plan; modificar
el plan invalida la autorización. Herramienta fuera de allowlist se bloquea.
Repetir un paso completado se rechaza. Pausar entre pasos impide ejecución; no se
promete cancelar una consulta SQL que ya esté en curso. No hay efectos irreversibles.
Concurrencia serializada por runtime y transacciones SQL; no worker 24/7 o cron.

## Configuración central y acción del propietario

Render solamente:
- JARVIS_MEMORY_MODE=disabled por defecto. approved_external solo tras aprobar
  proveedor permanente, privacidad, Free sin facturación y credencial.
- JARVIS_MEMORY_DATABASE_URL vacío por defecto; conexión PostgreSQL TLS, nunca
  copiarla al chat, Git o Netlify.
- JARVIS_MEMANTO_MODE=disabled por defecto; approved_free_credits únicamente tras
  consentimiento separado y confirmar saldo gratuito sin facturación.
- MOORCHEH_API_KEY vacía por defecto; solo Render, nunca NEXT_PUBLIC ni Netlify.

No se añaden variables de memoria a Netlify. Se reutilizan OAuth/JWT y secretos
que funcionan. Memanto 0.3.0 y psycopg[binary] 3.3.9 quedan fijados con hashes en
requisitos privados; no crean cuentas ni conexiones al instalarse. El archivo
requirements-memory documenta también los pines auditados. Credenciales de
Memanto no se solicitan ahora: aún no hay modalidad $0 aprobada y completa.

**Candidato gratuito verificado:** Neon Free. La página actual declara plan
permanente, no trial, $0 sin tarjeta, 100 CU-h/mes y 1 GB por proyecto. Al agotar
cómputo se suspende hasta el siguiente período; sus límites publicados no borran
los datos. No se creó cuenta ni proyecto. Esta es persistencia externa, no un
segundo backend JARVIS, y requiere consentimiento de transferencia de recuerdos.

**Autorización del propietario (2026-11-22):** Neon Free aprobado para
memoria/checkpoints, sin tarjeta ni facturación. La conexión de la cuenta y
verificación del proyecto Free siguen pendientes; la autorización no demuestra
que ya exista una base. Memanto/Moorcheh no están autorizados para activación
y permanecen desactivados. El índice es opcional y no condiciona
la conservación de los datos canónicos. Una vez aprobados los proveedores y
verificados en la cuenta real, se añadirían UNA VEZ en Render la URL de PostgreSQL
y, si se autoriza el índice, MOORCHEH_API_KEY; modos pasan de disabled a los valores
aprobados. Nada va en Netlify. No hay configuración manual que hacer todavía.
Memanto Cloud de pago no es una alternativa válida bajo el presupuesto actual.

No hay deploy único mágico: Netlify y Render tienen operaciones independientes.
Esta entrega sigue local y no modifica sus automatizaciones ni activa servicios.

## Retención, recuperación y reversión

Memoria activa hasta vencimiento explícito; eliminación individual elimina contenido
y versiones de la base canónica y conserva un evento sin contenido. Eliminación
global sin índice remoto borra los registros memory del owner en una transacción.
Con índice remoto, el borrado por proyectos es distribuido y puede ser parcial si
un proveedor falla; el sistema devuelve error y no confirma una eliminación completa. No se afirma borrar
backups físicos del proveedor: su retención debe verificarse antes de conectarlo.
La auditoría se acota a 200 eventos por colección, versiones a 20 y recuerdos a
200/proyecto; misiones a 32/proyecto. Máximo estado 2 MB. Límites de runtime:
30 operaciones/minuto y una simultánea, timeout de 8 s. No son una certificación
de cuotas ni facturación del proveedor.

Export JSON es legible y sensible: guárdalo en un lugar privado. Migración desde
memoria cifrada del navegador no es automática y requiere vista previa y opt-in
al proveedor elegido. La memoria local anterior y su respaldo siguen intactos.
Sin base externa no se escriben recuerdos/misiones en archivos de Render.
Revertir: JARVIS_MEMORY_MODE=disabled conserva datos remotos y chat; revertir
commit no exige borrar tablas. Restauración de backups remotos/OKF requiere un
proveedor real aprobado y validar IDs/owner/proyecto; no se ejecutó una restauración
contra terceros. Los límites y borrados del índice Memanto también deben verificarse
antes de activarlo; no hay índices remotos creados por esta tarea.

## Evidencia y pruebas

Las pruebas SQL de persistencia usan archivos SQLite de TEST, no mocks de una
respuesta de guardado. Crean registros, abren un nuevo proceso Python y recuperan
los mismos IDs. Verifican aislamiento owner/proyecto, deduplicación, corrección,
contradicciones, caducidad, secretos, borrado y checkpoints tras reinicio.
No certifican PostgreSQL alojado ni Memanto externo: faltan aprobación y credenciales.
Pruebas API comprueban rechazo anónimo y estado pending sin storage. Las pruebas
Gemini existentes usan MockTransport declarado, no llamadas pagadas. Safari físico
sigue pendiente; la emulación Chromium no prueba micrófono/voz nativos.

Fuentes primarias (consultadas sin iniciar sesión ni enviar datos privados):
- https://github.com/moorcheh-ai/memanto
- https://github.com/moorcheh-ai/memanto-agent-skills
- https://github.com/moorcheh-ai/memanto/blob/main/docs/AGENT_INTEGRATION_GUIDE.md
- https://github.com/moorcheh-ai/memanto/blob/main/SECURITY.md
- https://pypi.org/project/memanto/0.3.0/
- https://docs.memanto.ai/sdk/python
- https://www.memanto.ai/pricing
- https://moorcheh.ai/pricing
- https://neon.com/pricing
- https://render.com/docs/free
- https://docs.netlify.com/build/functions/overview/

### Resultado de la verificación local

Backend: 345 pruebas aprobadas y 5 omitidas; cobertura 51,63 %. La última
validación específica de memoria tiene 11 pruebas aprobadas. Frontend: 60 pruebas
aprobadas. Compilación Next.js y comprobación de tipos verificadas localmente.
Flujos Playwright: 9 aprobados en Chromium (escritorio, iPhone e iPad emulados).
Ruff y comprobación de whitespace revisados. No se llamó Gemini, Memanto,
Moorcheh ni PostgreSQL remoto; las pruebas de esos contratos usan dobles explícitos.
WebKit/Safari real pendiente por dependencias nativas ausentes en este entorno.
