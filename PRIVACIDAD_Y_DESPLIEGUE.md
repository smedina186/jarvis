# JARVIS privado — presupuesto obligatorio $0

La ruta vigente es **Netlify Free + Render Free**, sin publicar todavía.
La configuración anterior de Vercel y planes pagos quedó archivada en
`docs/historical/PRIVACIDAD_VERCEL.md`; no es la recomendación actual.

Lee [GUIA_IPAD_COSTO_CERO.md](GUIA_IPAD_COSTO_CERO.md) para los pasos desde Safari.

## Seguridad preparada

- Auth.js exige el ID numérico del propietario de GitHub. No hay registro público.
- Cada lectura del panel y del proxy exige sesión válida; FastAPI exige un JWT
  firmado, propietario correcto, audiencia/emisor y caducidad de hasta 60 segundos.
- El navegador utiliza `/api/backend/*` del mismo origen. La clave de FastAPI no
  llega al navegador y debe ser distinta de `AUTH_SECRET`.
- Sin secretos, el acceso queda cerrado. Las únicas rutas públicas de aplicación
  son las de inicio de sesión/OAuth y el estado mínimo `/healthz` del backend,
  que solo devuelve `{"status":"ok"}` para el monitor de Render.
- Las APIs funcionales no admiten acceso anónimo. Swagger, agentes, captura,
  investigación personal, voz y conexiones antiguas de tiempo real están bloqueados.
- El backend recomendado es `private_main:app`, sin visión ni scraping.
- No se usan contraseñas de protección de sitio ni funciones de pago de Netlify.
  La privacidad de los datos la implementa la aplicación. La página de acceso
  y los archivos estáticos son públicos; no contienen información privada.
- El repositorio GitHub sigue siendo público. No se cambió su visibilidad.

## Bloqueos contra publicación accidental

`netlify.toml` utiliza el adaptador OpenNext automático para Next.js, con SSR,
Server Actions y Route Handlers. No es una exportación estática: necesita funciones
serverless para autenticar y firmar las llamadas al backend.

La compilación de alojamiento exige simultáneamente autorización explícita
(`JARVIS_DEPLOY_APPROVED=true`), contexto `production`, declaración de plan `free`,
URLs HTTPS y autenticación completa. El valor predeterminado es cerrado.
Previews y branch deploys se bloquean, incluso con autorización de producción.
La comprobación de plan local es una declaración, **no consulta ni cambia la
facturación de la cuenta**: también debes comprobar Free en el panel del proveedor.

- Los builds Git se omiten por defecto con `ignore`; el comando de build también
  bloquea los build hooks y primeras compilaciones sin autorización.
- `vercel.json` desactiva despliegues Git en Vercel.
- El workflow `deploy.yml` solo hace comprobaciones locales: no publica nada.
- La plantilla Render usa `plan: free`, `autoDeploy: false` y ningún worker de pago.
- No se activaron servicios, no se contrataron planes y no se configuraron claves reales.

## IA y cuotas

El panel se identifica como demostración sin IA: no hay modelo conectado ni
respuestas generadas. No se ejecutan tareas externas. No configurar claves de IA,
AI Gateway, Browser Use, Exa, almacenamiento de pago ni otros complementos.

Netlify Free tiene un límite mensual estricto de créditos; puede pausar los
proyectos al agotarse. Render Free se suspende tras 15 minutos sin tráfico y
puede tardar aproximadamente un minuto en despertar. La comprobación de conexión
se reintenta manualmente; no se hacen pings para evitar la suspensión.

No añadir tarjeta, no activar recargas ni cambiar a un plan de pago. Render
puede facturar excesos si hay un método de pago; sin método de pago, suspende
los servicios al superar sus límites. Si una pantalla exige pago o tarjeta,
detener la configuración. La disponibilidad permanente no está incluida en $0.

## Revisión para el Pull Request

Los dos commits locales originales se revisaron sin publicar sus metadatos
privados. Se sustituyó el correo privado de autor/committer por el correo
noreply de GitHub. Los commits sanitizados son `40767e8` y `d30a3ea` y sus árboles
conservan el mismo contenido que los originales. Existe una copia de seguridad
local fuera del repositorio; no se incluye en la subida.

La revisión abarca los archivos cambiados de cada commit, metadatos y nuevos
archivos. Los secretos de pruebas son ficticios y están identificados como tales.
Un escaneo de patrones no prueba la inexistencia de todos los secretos posibles,
ni audita todo el historial histórico del repositorio público. Si alguna clave
real se publicó anteriormente, debe revocarse.

El PR se prepara como **borrador**, hacia `main`, sin fusionarlo. Subir código a
GitHub no autoriza a publicar la aplicación. Las plantillas de alojamiento están
cerradas por defecto y las cuentas externas no se modifican.

## Comprobaciones reproducibles

```bash
cd backend
uv sync --locked --extra dev
uv run pytest
uv run ruff check .
cd ../frontend
npm ci
npm test
npm run test:hosting
npm run build
npm run test:e2e
```

Los E2E usan sesiones sintéticas de Auth.js y FastAPI local, sin OAuth real ni
llamadas de IA. Las pruebas móviles usan tamaños de iPhone/iPad en Chromium.
Safari real, OAuth real y el adaptador ejecutándose en Netlify quedan pendientes
hasta autorizar un despliegue gratuito. Hay incidencias de lint históricas en
componentes que no monta el panel privado; no se desactivaron reglas para ocultarlas.

Fuentes consultadas el 19-11-2026:

- [Netlify Free y límite de costos](https://www.netlify.com/pricing/)
- [Créditos y planes Netlify](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [Next.js en Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Omisión de builds](https://docs.netlify.com/build/configure-builds/ignore-builds/)
- [Auth.js detrás de un proxy](https://authjs.dev/getting-started/deployment)
- [Límites de Render Free](https://render.com/docs/free)
