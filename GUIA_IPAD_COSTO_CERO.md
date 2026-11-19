# Próxima etapa desde tu iPad — costo $0

**Por ahora: revisar el Pull Request. No fusionar ni pulsar Deploy.**
No se creó ningún servicio ni se activó facturación. Los pasos de alojamiento
de abajo son para cuando autorices explícitamente el primer despliegue gratuito.

## 1. Revisa el código en GitHub

En Safari, abre `github.com/smedina186/jarvis` → **Pull requests** → el borrador
de JARVIS privado. La rama es `prep/private-personal-assistant`. Puedes revisar
los archivos y pruebas sin fusionar. No actives Auto-merge ni un workflow de deploy.

El repositorio sigue siendo público: cualquiera puede leer su código. El acceso
al panel y los datos se protege mediante inicio de sesión; eso no oculta el código
fuente. No cambié la visibilidad de tu repositorio.

## 2. Comprueba los planes antes de conectar nada

| Plataforma | Elegir | Evitar |
| --- | --- | --- |
| Netlify | **Free**, $0, límite mensual estricto | Personal, Pro, upgrades, créditos extra y complementos |
| Render | **Free** para un Web Service | Starter, workers, discos y bases de pago |
| GitHub OAuth | OAuth App normal, sin suscripción | Copiar claves al repositorio |
| IA | Demostración sin proveedor | API keys, AI Gateway y pruebas con facturación |

No añadas una tarjeta ni actives recargas. Si te pide pagar o verificar mediante
tarjeta, detente. Netlify Free pausa proyectos si se agotan sus créditos.
Render Free puede suspenderse por cuotas; no se configura un plan de pago de respaldo.

## 3. Prepara el acceso privado

Después de autorizar la configuración:

1. Elige un nombre estable para el sitio, por ejemplo `TU-JARVIS.netlify.app`.
2. En GitHub, abre **Settings → Developer settings → OAuth Apps → New OAuth App**.
3. Homepage URL: `https://TU-JARVIS.netlify.app`.
4. Callback: `https://TU-JARVIS.netlify.app/api/auth/callback/github`.
5. Guarda Client ID y Client secret en tu gestor de contraseñas. No los envíes
   por chat ni los pegues en archivos de GitHub.
6. Necesitas tu ID numérico de GitHub: puedes ver el campo `id` en
   `https://api.github.com/users/smedina186`. No uses el nombre de usuario ni `node_id`.
7. Crea en tu gestor dos secretos aleatorios diferentes, de al menos 32 bytes
   (por ejemplo, 43 o más caracteres aleatorios). Son para la sesión y el backend.
   No copies los secretos ficticios que aparecen en las pruebas.

## 4. Netlify Free: conectar el frontend

Estos pasos pueden iniciar una compilación: **no ejecutarlos todavía**.
Cuando autorices el despliegue, desde Safari:

1. Entra en Netlify con tu cuenta y confirma que el equipo usa **Free**.
2. **Add new project → Import an existing project → GitHub**. Autoriza acceso
   únicamente a `smedina186/jarvis` cuando GitHub permita seleccionar repositorios.
3. Selecciona `prep/private-personal-assistant` para revisar esta versión; no
   selecciones `main`, que aún contiene la versión anterior al PR.
4. El archivo `netlify.toml` debe detectar:
   - Base directory: `frontend`.
   - Build command: `npm run build:netlify`.
   - Publish directory: `.next`.
   - Node: 24 y adaptador Next.js/OpenNext automático.
5. Desactiva Deploy Previews y branch deploys en la configuración del proyecto.
   No compartas secretos de producción con previews. El código también los bloquea.
6. En **Environment variables**, configura los siguientes valores de servidor
   para producción, disponibles en **Builds y Functions/runtime**:

| Variable | Qué poner |
| --- | --- |
| `AUTH_URL` | `https://TU-JARVIS.netlify.app` |
| `AUTH_TRUST_HOST` | `true` |
| `AUTH_SECRET` | Primer secreto aleatorio |
| `AUTH_GITHUB_ID` | Client ID de la OAuth App |
| `AUTH_GITHUB_SECRET` | Client secret de la OAuth App |
| `JARVIS_OWNER_GITHUB_ID` | Tu ID numérico |
| `JARVIS_BACKEND_URL` | La URL HTTPS que dará Render |
| `JARVIS_BACKEND_AUTH_SECRET` | Segundo secreto aleatorio |
| `JARVIS_HOSTING_PLAN` | `free` |
| `JARVIS_DEPLOY_APPROVED` | **`false` mientras no autorices publicar** |

No uses variables `NEXT_PUBLIC_` para claves. No configures AI Gateway, Netlify
Identity ni una contraseña de sitio de pago: JARVIS usa su propia autenticación.

Mientras `JARVIS_DEPLOY_APPROVED` esté ausente o sea `false`, los builds se omiten
o fallan de forma intencional sin publicar la aplicación. Solo después de tu
autorización se cambiaría a `true` para un build de producción. El valor `free`
en una variable **no cambia ni verifica la facturación**: comprueba el plan en el panel.

## 5. Render Free: conectar FastAPI

Crear el servicio inicia un despliegue: **no hacerlo todavía**.
Después de autorizarlo:

1. Entra en Render → **New → Web Service**, conecta GitHub y el repositorio.
2. Elige la rama `prep/private-personal-assistant` y runtime **Docker**.
3. Root directory: `backend`. Dockerfile: `Dockerfile.private`. Docker context: `.`.
4. Elige explícitamente **Free ($0)** y desactiva Auto-deploy.
5. Health check: `/healthz`.
6. Añade variables privadas:

| Variable | Valor |
| --- | --- |
| `JARVIS_ENV` | `production` |
| `JARVIS_PERSONAL_MODE` | `true` |
| `JARVIS_OWNER_GITHUB_ID` | El mismo ID que en Netlify |
| `JARVIS_BACKEND_AUTH_SECRET` | El mismo segundo secreto que en Netlify |

No añadir claves de IA, MongoDB, Convex, Browser Use ni Telegram. No crear workers,
discos o bases. La plantilla de referencia es `deploy/render.private.yaml` y usa Free.
Su mera presencia en GitHub no crea ni despliega el servicio.

Render proporcionará una URL `https://....onrender.com`; cópiala en
`JARVIS_BACKEND_URL` de Netlify antes de autorizar la compilación de producción.

## 6. Comprobar antes de usarlo

Después del despliegue gratuito autorizado:

1. Abre la interfaz en una pestaña privada de Safari: debe pedir iniciar sesión.
2. Solo tu cuenta de GitHub debe poder entrar. Activa 2FA o passkeys en GitHub.
3. La URL de Render `/api/health` debe rechazar acceso directo sin credencial;
   `/healthz` únicamente muestra `{"status":"ok"}` para el monitor del proveedor.
4. Desde el panel, pulsa **Comprobar conexión**. Si Render estaba suspendido,
   espera aproximadamente un minuto y vuelve a pulsar. No hay pings automáticos.
5. Cierra sesión y confirma que el panel deja de abrirse.
6. Para añadirlo al iPad/iPhone: Safari → **Compartir → Añadir a pantalla de inicio**.

No necesitas una computadora encendida una vez alojado. No será un servicio
siempre activo: Render Free duerme y Netlify puede pausar por límites. El panel
sigue siendo una demostración sin IA ni agentes reales. Las pruebas locales no
sustituyen esta comprobación de OAuth y Safari en el alojamiento real.
