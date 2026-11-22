# Reparación de audio r4

Fecha: 22 de noviembre de 2026. Rama: `prep/private-personal-assistant`.

## Diagnóstico y corrección

1. `speechSynthesis` es global en una página. Chat y Agentes tienen instancias
   independientes del hook de voz; desmontar o desactivar una instancia inactiva
   cancelaba también la reproducción ajena. `speech-focus.ts` concede una única
   propiedad de reproducción: solo su propietario puede cancelarla. Los callbacks
   de una locución sustituida no continúan la conversación anterior.
2. El detector de aplausos podía conservar la captura mientras se encolaba el
   saludo. Ahora se detienen sus pistas sincrónicamente antes de dictar o hablar,
   se suspende su AudioContext y no se adquiere captura mientras haya una locución
   pendiente. La API opcional Audio Session solicita reproducción tras usar el
   micrófono; un navegador sin esa API conserva el comportamiento nativo.
3. Algunas versiones de WebKit omiten eventos de síntesis. Se consultan también
   sus indicadores `speaking`, `pending` y `paused`; un comienzo confirmado evita
   el timeout falso. El fin alternativo exige actividad previa y dos muestras
   de reposo. No se deduce que los altavoces suenan de esos indicadores.
4. La lista de voces se vuelve a consultar al reproducir. Se conserva la elección
   explícita; el modo automático prefiere voces españolas locales mejoradas si
   existen. No se instala ningún proveedor ni se promete una voz no disponible.
5. Una consulta opcional de recuerdos se limita a dos segundos antes de Gemini,
   respetando el presupuesto temporal del proxy. Si falla, Gemini sigue sin esos
   recuerdos y se indica la omisión. Las escrituras explícitas conservan su límite
   independiente y nunca afirman éxito sin confirmación del almacenamiento.

No se cambian OAuth, JWT, secretos, modelo Gemini, Neon, Docker, planes o facturación.
El diseño morado, ojo y perro 186 se conservan. No se modifica `main`.

## Comprobaciones y alcance

| Área | Evidencia | Límite |
|---|---|---|
| Autenticación | Backend rechaza JWT falsos, vencidos y de otro propietario; Next rechaza visitantes y otra cuenta en pruebas | Sesiones OAuth de pruebas locales; no nuevo inicio de sesión real en GitHub |
| Chat | Envío escrito, errores, cancelación y dos turnos automáticos sin duplicación | Gemini se sustituye por un fixture explícito en pruebas; esta reparación no consume su API |
| Voz | Cola, fin por silencio, selección de voz, cancelación, errores, propiedad global y liberación de micrófono | Motor simulado; sonido físico y permisos de Safari requieren iPad |
| Aplausos | Pulsos/ruido, opt-in, captura tardía, pausa antes de voz y exclusión durante cola | Detector experimental; no prueba de aplausos físicos |
| Memoria | Aislamiento, corrección, eliminación, contradicciones y rehidratación en backend; carpetas y errores en UI | E2E usa fixtures; PostgreSQL real se comprueba por separado |
| Agentes | Herramientas permitidas, recibos, cuota y fallos | Procedimientos acotados a petición, no agentes con acceso general a servicios |
| Misiones | Aprobación, pausa/reanudación, checkpoints y rechazo de herramientas no permitidas | Solo ejecutor acotado de consulta de memoria; no ejecución continua |
| Dispositivos | Flujos Playwright en escritorio y tamaños iPhone/iPad | Chromium emulado no equivale a Safari físico |

Resultados locales: **81 pruebas frontend**, **357 backend** (5 omitidas),
**18 flujos Playwright** y **7 validaciones de publicación** aprobados.
TypeScript, compilación de producción Next.js y Ruff correctos. ESLint completo
tiene cero errores y 18 advertencias históricas en módulos legados; el análisis
de los archivos de esta reparación no añade advertencias. No hay nuevas dependencias.
La detección de patrones de credenciales en los 13 archivos modificados no
encontró claves; las credenciales ficticias de pruebas están identificadas como tales.

Las pruebas de reinicio de SQL usan archivos SQLite **solo para pruebas**; no son
una prueba de reinicio de Neon ni un almacenamiento alternativo en producción.
La verificación externa de Neon consulta únicamente conteos/metadatos, sin mostrar
recuerdos. Las versiones publicadas y verificaciones posteriores al despliegue se
informan por separado; este documento no certifica un despliegue todavía no observado.

## Prueba en el iPad

La barra lateral muestra `Interfaz <commit> · Audio r4` cuando Netlify publica
esta revisión. Si no aparece, el navegador o despliegue todavía sirve otra versión.
En Chat → Ajustes de voz y dictado → **Probar voz del dispositivo** se reproduce
una frase local, sin micrófono ni solicitud a Gemini. Se muestra qué hizo el motor.
Después, **Hablar con JARVIS** reproduce el saludo, escucha y envía al terminar de
hablar; lee la respuesta y continúa hasta seis turnos. Detener conversación libera
la sesión. Aplausos sigue siendo opcional y requiere consentimiento independiente.

Un resultado del motor no certifica volumen, Bluetooth, salida seleccionada ni
sonido audible. Safari puede exigir otro gesto para continuar. No se evita ese
permiso ni se promete activación con pantalla bloqueada.

## Funciones que siguen teniendo límites

- Memoria persistente: PostgreSQL en Neon; Memanto está preparado, **no conectado**.
- Historial completo del chat: memoria temporal de la pestaña, no historial durable.
- Tres procedimientos con herramientas verificadas: Archivista, Organización y
  Documentos. Los demás perfiles conversacionales no adquieren herramientas por
  seleccionarlos. No hay shell, cambios de Git, correo ni compras habilitados.
- Render Free se suspende: no hay ejecutor 24/7 ni mejora automática de código.
- OpenAI/Codex no está conectado. Una suscripción personal no concede por sí sola
  una API gratuita. No se activan llamadas ni facturación para este arreglo.

Por tanto, conectar Codex no convierte por sí solo esas capacidades pendientes en
funciones operativas. Esta entrega corrige y prueba el alcance realmente disponible.
