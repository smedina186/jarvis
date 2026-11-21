# Gemini real en JARVIS — integración preparada, no activada

Base de producción: `c7bf63c`, rama `prep/private-personal-assistant`. Se conservan
el diseño morado, ojo central, perro 186, diseño adaptable, OAuth del propietario
y el arreglo que evita comprobaciones repetidas. No se modifica main.

## Recorrido real y protecciones

Safari → `/api/backend/chat` (Next.js, sesión GitHub propietaria + origen válido)
→ `/api/chat` (Render, JWT privado de máximo 60 segundos)
→ API oficial Gemini `generateContent` por HTTPS.

La clave solamente se lee en Render y se envía a Google en `x-goog-api-key`, nunca
en la URL. No llega a Next.js, al navegador, al repositorio ni a los errores.
El intermediario solo permite el nuevo POST de chat; las rutas de agentes,
reconocimiento facial, scraping y WebSockets siguen bloqueadas.
El navegador no puede elegir modelo, endpoint ni herramientas de Google.
No se incorporaron claves reales y no se hicieron llamadas a Gemini.

Se reutiliza HTTPX (ya existente en el proyecto completo), añadido a los requisitos
mínimos de Render con hashes. Se evaluó el SDK mantenido `googleapis/python-genai`;
para esta imagen privada pequeña se usa la API REST oficial con HTTPX asíncrono,
sin descargar los agentes históricos ni añadir un SDK con reintentos implícitos.

GET `/api/gemini/status` está autenticado y no consulta Google. Reporta:
- `not_configured`: falta clave.
- `configured`: clave presente. No demuestra que funcione.
- `error`: ocurrió un error en una llamada; se expone un mensaje sanitizado.

`enabled` requiere todos los candados de configuración. `verified` solo pasa a true
tras recibir texto real de Google. Los estados de verificación/error son volátiles:
Render Free puede perderlos al reiniciar. La comprobación de conexión es manual
tras la primera carga; consultar el estado no genera contenido ni gasta cuota IA.

## Presupuesto obligatorio $0

Modelo único permitido: `gemini-3.5-flash-lite`, anunciado con entrada y salida
Standard gratuitas en la documentación consultada el 21-11-2026. No hay cambios
automáticos de modelo ni llamadas a búsqueda, grounding, caché, archivos, agentes,
compras u otras herramientas. No se activó facturación ni se creó una clave.

**Un nombre de modelo o una variable no garantiza costo cero.** La misma API
puede tener modalidad de pago. Antes de habilitarla hay que comprobar que el
proyecto de la clave está en Free Tier, sin facturación habilitada, y que el modelo
sigue teniendo cuota gratuita disponible para esa cuenta/región. Las variables
son declaraciones del propietario, no una consulta automática a Google Billing.
No usar créditos promocionales de un proyecto con facturación como sustituto de
esa comprobación. Una suscripción personal Gemini no demuestra acceso API gratuito.

Límites preventivos locales: una solicitud simultánea, 6 intentos/minuto y 20
intentos/día UTC por proceso. También cuentan los fallos. Se reinician con el
proceso y no sustituyen las cuotas de Google ni son un límite monetario. La
protección de $0 depende de mantener la facturación de Google desactivada.
Nunca hay reintentos automáticos ni fallback a un proveedor/modelo de pago.

## Variables: únicamente en Render

En iPad: **Render → servicio jarvis → Environment → Edit → Add variable**.
No pongas la clave en Netlify: su candado continúa rechazando claves de proveedores.
No cambies OAuth ni `JARVIS_BACKEND_AUTH_SECRET` para conectar Gemini.

| Variable | Valor ahora | Activación futura autorizada |
|---|---|---|
| `GEMINI_API_KEY` | Clave privada obtenida en Google AI Studio para el proyecto gratuito | Mantener solo en Render |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` (también es el valor predeterminado) | Mantener el modelo permitido |
| `JARVIS_GEMINI_ENABLED` | `false` | `true`, solo al autorizar llamadas reales |
| `GEMINI_FREE_TIER_CONFIRMED` | `false` | `true`, solo tras verificar Free y facturación desactivada |

Mantener `JARVIS_PERSONAL_MODE=true`, `JARVIS_OWNER_GITHUB_ID`, `JARVIS_ENV=production`
y el secreto compartido actuales. Si se preparan variables antes de publicar,
usar **Save only**. No desplegar ni habilitar los dos candados todavía.
Una clave de AI Studio se administra en https://aistudio.google.com/api-keys .
No compartas su valor en chat, capturas, GitHub o campos NEXT_PUBLIC_.

No se verificó desde este entorno el proyecto Google del propietario, su cuota,
la validez de la clave ni el acceso regional. Si no se puede confirmar Free sin
facturación, dejar las llamadas desactivadas.

## Privacidad y experiencia

Antes de enviar texto, la interfaz explica que se comparte con Google el mensaje
y hasta 9 pares recientes de conversación. El nivel gratuito publicado indica
que los datos pueden usarse para mejorar productos de Google; una aplicación
con acceso privado no equivale a procesamiento local ni a confidencialidad del
proveedor. Revisar sus condiciones antes de enviar información sensible.

El chat conserva mensajes solo en memoria de la pestaña. Cambiar de sección no
los borra; recargar, cerrar sesión o cerrar la pestaña sí. No se introduce
almacenamiento en texto plano ni una base de datos nueva. La nueva conversación
vacía la memoria local; no afirma borrar datos que Google ya haya recibido.
La salida se muestra como texto escapado, nunca como HTML ejecutable.

Límites: 6.000 caracteres por mensaje, 24.000 de contexto y 1.024 tokens máximos
de salida. Se recortan pares antiguos del contexto sin borrar el historial visible.
Respuesta completa (no streaming en esta fase); se avisa si alcanza el límite.
Tiempo máximo: 22 s en Render, 25 s en el intermediario, 28 s en la interfaz.
El botón detener cancela la espera del navegador; Google podría haber recibido
la solicitud y consumir cuota. No se promete cancelar una generación ya aceptada.
Cuota agotada: error 429 y espera visible, nunca un bucle de reintentos. Clave
rechazada, modelo ausente, respuesta bloqueada/vacía, red y timeout muestran un
error claro sin revelar el cuerpo de error de Google ni congelar la página.

## Para activar, después de la aprobación

1. Revisar este cambio y confirmar Google Free sin facturación y sus condiciones.
2. Autorizar publicación y una prueba real; hasta entonces no subir la rama.
3. Actualizar Render y Netlify coordinadamente, manteniendo sus planes Free.
4. Configurar la clave y habilitar ambos candados únicamente después de autorizar.
5. Desde la sesión propietaria en JARVIS: comprobar conexión, confirmar Gemini
   configurado y enviar un mensaje corto autorizado. Solo esa respuesta verificará
   el acceso real. Detenerse si Google pide habilitar facturación.

## Fuentes oficiales consultadas

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/api-key
- https://ai.google.dev/gemini-api/terms
- https://github.com/googleapis/python-genai

Las pruebas de Gemini usan exclusivamente `httpx.MockTransport` y fixtures
identificados como pruebas. No hay generación ficticia en el producto.

## Resultado de las verificaciones locales

- Backend completo: 333 pruebas aprobadas, 5 omitidas; cobertura 48,59% sobre el
  mínimo existente de 46%. Tras precisar el plazo del límite diario se repitieron
  las 10 pruebas Gemini: aprobadas. Ninguna usa claves reales ni red de Google.
- Frontend: 44 pruebas aprobadas, TypeScript y ESLint de archivos afectados sin
  errores; compilación de producción Next.js aprobada.
- Playwright: recorridos de propietario/chat y otra cuenta en escritorio, iPhone
  e iPad aprobados con Chromium. Tras conservar el 403 original de herramientas
  antiguas se repitieron los tres recorridos anónimos: aprobados. Son 9 recorridos
  verificados; OAuth usa sesiones sintéticas locales y Gemini fixtures declarados.
  No se afirma haber verificado Safari real ni OAuth de producción.
- Docker: imagen compilada con requisitos privados y hashes, sin errores. No se
  pudo verificar su arranque adicional: el entorno llegó al límite de disco.
  La compilación Next.js pasó tras eliminar caché generada. Se retiró únicamente
  la imagen temporal creada para esta tarea y caché, no código ni datos del usuario.
  El arranque del contenedor queda como verificación pendiente antes de publicar.
- No se subieron cambios, no se desplegó, no se llamó a Gemini y no se activó
  ningún servicio de pago. La validez real de la clave/modelo se verificará solo
  después de autorización y confirmación de Free sin facturación.
