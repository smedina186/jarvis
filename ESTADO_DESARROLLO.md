# JARVIS — revisión e instalación, etapa 1

> Registro histórico de la primera etapa. El estado actual de acceso, arranque
> y verificaciones está en [PRIVACIDAD_Y_DESPLIEGUE.md](PRIVACIDAD_Y_DESPLIEGUE.md).
> El acceso anónimo descrito aquí ya no está disponible.

Revisión: 19 de noviembre de 2026. Base: `4369c34babd21d539c420866da51c7a8365f1c9e`.
Repositorio local: `/workspace/jarvis`.

## Resultado y alcance

El backend y el panel existente pueden arrancar sin claves. Esto es una base
de desarrollo, todavía no la primera versión del asistente general solicitado.
No se activaron cuentas externas, investigaciones de personas, cámaras,
creación de cuentas, ni reconocimiento facial.

Se revisaron las instrucciones de `AGENTS.md`, `.codex/AGENTS.md`,
`.claude/CLAUDE.md` y las convenciones generadas de `.agents/skills/JARVIS`.
Se contrastaron README, documentación de arquitectura/diseño, tareas, configuración,
rutas, módulos y pruebas. Las aplicaciones móviles de `samples/` se inventariaron;
no se compilaron ni se validaron con dispositivos físicos en este entorno Linux.
La documentación histórica incluye propuestas que no están implementadas y
funciones de investigación personal que quedan fuera del alcance autorizado.

## Componentes y estado comprobado

| Componente | Estado | Limitación |
| --- | --- | --- |
| FastAPI | Arranca; health, servicios y tareas tienen pruebas | Health indica proceso activo, no verifica APIs externas |
| Next.js 16 + React 19 | Instala, compila y sirve HTTP 200 | Panel centrado en personas, todavía no asistente general |
| Pruebas de componentes | 23 pasan | La prueba de Home sustituye IntelBoard por un mock |
| Pipeline y agentes | 298 pruebas backend pasan | Mayormente servicios simulados; no valida cuentas reales |
| Exa / Browser Use / Anthropic / Gemini | Adaptadores existentes | Sin claves: no hay investigación o síntesis real |
| Chat general | Ausente | Faltan conversación, historial y selección de proveedor |
| Autorización de tareas | Ausente | Faltan permisos por herramienta, aprobación y auditoría |
| Convex | Cliente, esquema y funciones existentes | No se probó con un despliegue real |
| Almacenamiento local | Gateway en memoria | Se pierde al reiniciar; no sincroniza con el panel entre pestañas |
| MongoDB | Variable de configuración | No se encontró cliente de persistencia operativo |
| MediaPipe | Detector y modelo en repositorio | No es identificación; no se activó captura real |
| ArcFace | Simulación determinista basada en hash | No es un modelo de reconocimiento real |
| YOLO | Dependencia conservada, carga diferida | El primer uso de vídeo todavía puede descargar pesos |
| Voz / gafas / Telegram | Código e integraciones existentes | Requieren permisos, dispositivos o servicios; sin validar en vivo |
| Datos de demostración | Fixtures en el frontend | No representan información obtenida de servicios reales |

El panel actual inicia vacío sin Convex. El hook antiguo `useJarvisData` usa
fixtures como fallback; no debe tratarse como evidencia de una integración real.

## Instalación reproducible

Entorno comprobado: Python 3.12.14, Node 24.22.1, npm 11.9.0, uv 0.13.6, Linux CPU.
El proyecto admite Python 3.11–3.13 y requiere Node 20 o superior.

Terminal 1:

```bash
cd /workspace/jarvis/backend
uv sync --locked --extra dev
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd /workspace/jarvis/frontend
npm ci
npm run dev -- --hostname 127.0.0.1
```

Abrir `http://localhost:3000`. API: `http://localhost:8000/docs`.
No hace falta crear `.env` para comprobar el arranque sin servicios externos.
Las direcciones son locales al equipo donde se ejecutan estos procesos.

Para producción local: `npm run build` y después `npm start` en `frontend/`.
Esto no equivale a un despliegue público: faltan autenticación y permisos de tareas.

## Correcciones realizadas

- PyTorch y torchvision usan el índice oficial CPU en Linux, conservando YOLO.
  La instalación original descargaba CUDA y varias bibliotecas NVIDIA innecesarias.
  Se regeneró `backend/uv.lock`; otras plataformas conservan PyPI.
  Para una futura instalación GPU habrá que configurar el índice apropiado.
- `FrameHandler` ya no construye YOLO al importar FastAPI: el servidor puede
  iniciar y responder a health sin descargar pesos. Se añadió una prueba de regresión.
- Se añadieron los orígenes locales `127.0.0.1:3000/3001` a CORS en desarrollo:
  antes el navegador podía mostrar backend desconectado aunque health respondiera.
- Una variable `NEXT_PUBLIC_API_URL` vacía ahora usa el backend local por defecto
  en el cliente API y en IntelBoard, consistente con el archivo de ejemplo.
- Se corrigieron referencias actualizadas durante render, declaración de función,
  un texto JSX y nombre de componente de pruebas; quedan incidencias de hooks.
- Se registró la marca pytest `live` y se excluyeron de Git los artefactos
  de cobertura, Playwright y la base local `accounts.db` generada por dependencias.

Decisión USE: conservar FastAPI, Next.js, uv y PyTorch oficiales. Se consultaron
los repositorios mantenidos `astral-sh/uv` y `pytorch/pytorch` y la guía oficial
de integración PyTorch de uv antes de ajustar la instalación.

## Comprobaciones

```bash
cd /workspace/jarvis/backend
uv run pytest
uv run ruff check .
cd /workspace/jarvis/frontend
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

- Backend: **298 pasan, 5 omitidas**, cobertura **46,92 %** (umbral existente 46 %).
- Ruff: pasa.
- Frontend: **23 pasan**, TypeScript pasa, build de producción pasa.
- ESLint: quedan **5 errores** de `react-hooks/set-state-in-effect` y
  **18 advertencias**. Cuatro errores están en IntelBoard y uno en useVoiceCommands.
  No se deshabilitaron las reglas para ocultarlos.
- Playwright: Chromium instalado. La prueba existente **falla** porque busca
  `jarvis-app`, tarjetas y un dossier de una versión anterior; la página actual
  monta IntelBoard. Hay que actualizar la prueba junto con el nuevo panel.
- Comprobación adicional con Chromium: la página carga sin errores JavaScript.
- No se ejecutaron llamadas de IA, búsquedas reales ni pruebas con dispositivos.

## Qué configurar después

Para el arranque básico: nada adicional. Los flags de servicios están todos
desactivados en este entorno. Una clave presente solo significa «configurada»,
no «conexión probada».

Para chat real habrá que elegir y configurar un proveedor. El repositorio ya
usa Anthropic y Gemini para síntesis; OpenAI se usa en agentes, no hay chat general.
No se eligió ni se creó ninguna clave. Las credenciales deben guardarse en
archivos locales ignorados, nunca en el frontend ni en Git.

Convex es opcional y requiere `CONVEX_URL` en backend y
`NEXT_PUBLIC_CONVEX_URL` en frontend. `NEXT_PUBLIC_API_URL` debe apuntar al backend
cuando no esté en el mismo equipo/puerto local. No basta con configurar
`MONGODB_URI` para obtener persistencia MongoDB: falta la implementación.

No conectar PimEyes, enriquecimiento personal, creación automática de cuentas
ni agentes de investigación invasiva para este objetivo. Su código histórico
permanece en el repositorio y no debe exponerse como capacidad del nuevo asistente.

## Etapas siguientes

1. Adaptar el panel al asistente y añadir chat. Sin proveedor: demostración
   explícita, sin respuestas presentadas como procedentes de un servicio real.
2. Agentes especializados sobre texto y tareas aportadas por el usuario;
   herramientas permitidas, aprobación para efectos externos y registro de ejecución.
3. Persistencia, autenticación, aislamiento y pruebas del flujo completo.
4. Validar un proveedor real con credenciales configuradas explícitamente.

Se conservarán Next.js, Tailwind, Framer Motion y FastAPI. No se implementará
identificación de desconocidos ni recopilación invasiva de información personal.
