# JARVIS — Fase 1: interfaz privada morada

Este cambio adapta la experiencia autenticada a un centro de mando morado para escritorio, iPad y móvil, de acuerdo con `PROMPT-PARA-CODEX.md`.

## Qué cambia

- Diseño responsive, navegación Chat/Agentes/Misiones/Conexiones, núcleo visual morado animado por CSS y respeto a `prefers-reduced-motion`.
- Única frase de bienvenida bajo el ojo: «Bienvenido, Sebastián. ¿En qué trabajamos hoy?».
- Emblema discreto del perro con su ojo azul y `186` debajo, sin introducir `186` en el ojo central.
- Panel de estado honesto. La sesión del propietario prueba GitHub OAuth; Render se comprueba mediante el proxy privado **existente** `/api/backend/health`; Netlify se marca «Sin verificar» porque no existe un chequeo de estado autenticado; Gemini y OpenAI se marcan «Sin configurar».
- Paneles de agentes y misiones muestran que todavía no ejecutan tareas; el compositor y el micrófono no envían peticiones mientras no haya una integración real de IA.

## Qué no cambia

- La ruta GitHub OAuth y su callback, la autorización por ID de propietario, la API privada, el backend Render, los secretos y el archivo `netlify.toml`.
- No se añadieron llamadas a modelos, permisos de acciones externas, misiones simuladas ni cobros.

## Validación requerida antes de integrar

En un entorno con las dependencias de `frontend` instaladas:

1. Ejecutar los scripts existentes de lint, pruebas unitarias y build de `frontend/package.json`.
2. Ejecutar Playwright con las variables de prueba locales y el backend disponible, como documenta el repositorio.
3. Revisar visualmente escritorio, iPad y móvil; comprobar acceso del propietario y rechazo de usuarios ajenos.

Este cambio se preparó sin dependencias completas de Next.js instaladas localmente, por lo que esas verificaciones quedan **pendientes**; no se deben dar por aprobadas sin ejecutarlas.

## Fases siguientes (no implementadas)

1. Verificación server-side de Netlify, Render y proveedores cuando haya rutas seguras, con errores, fecha y latencia reales.
2. Gemini y OpenAI con autenticación, límites y aprobación del dueño; sin respuestas fingidas.
3. Misiones persistentes en una cola/worker seguro con progreso, historial y aprobaciones por acción.

Antes de publicar, revisar los nombres de variables de entorno requeridos por el proyecto actual: `AUTH_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `JARVIS_OWNER_GITHUB_ID`, `JARVIS_BACKEND_URL` y `JARVIS_BACKEND_AUTH_SECRET`. Los dos secretos de autenticación deben ser fuertes y distintos. No introducir sus valores en el repositorio.
