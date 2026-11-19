# Desbloqueo autorizado de jarvismedina — 19-11-2026

El propietario autorizó expresamente una prueba en `jarvismedina` y confirmó que
el equipo propietario muestra el plan **Free** en Billing. No se consultó una API
de facturación: esta confirmación es del propietario, no una verificación automática.

## Causa y corrección

El mensaje anterior agrupaba tres condiciones en una sola: aprobación, contexto
production y declaración de plan free. El TOML no registraba la aprobación; esta
debía configurarse externamente. El log no mostraba cuál de las tres faltaba.

Ahora `netlify.toml` registra la aprobación **solo para el contexto production**.
El script exige además el nombre de proyecto y la rama autorizados. Los demás
proyectos, `main`, previews y branch deploys siguen rechazados. Las comprobaciones
de OAuth, secretos distintos, HTTPS y ausencia de claves de IA se conservan.

El comando `ignore` revisa todas las condiciones antes de permitir un build Git:
si falta configuración, lo omite con un mensaje específico. Los builds manuales
o hooks también pasan por el mismo candado mediante `npm run build:netlify`.

## Configuración que debe tener Netlify

- Proyecto: `jarvismedina`. Netlify proporciona `SITE_NAME=jarvismedina`.
- Rama de producción: `prep/private-personal-assistant`, no `main`.
- Build command: `npm run build:netlify`; base: `frontend`; publish: `.next`.
- El contexto debe ser `production`. Que la rama se llame `prep/...` no impide
  usarla como rama de producción del proyecto; no debe ejecutarse como branch deploy.
- El TOML aporta `JARVIS_HOSTING_PLAN=free` y, en production,
  `JARVIS_DEPLOY_APPROVED=true`. No hace falta repetir la autorización del propietario.

En Netlify, **Project configuration → Environment variables**, los valores reales
deben estar disponibles en producción tanto para **Builds** como para
**Functions/runtime**:

`AUTH_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`,
`JARVIS_OWNER_GITHUB_ID`, `JARVIS_BACKEND_URL`, `JARVIS_BACKEND_AUTH_SECRET` y
`AUTH_TRUST_HOST=true`.

`AUTH_URL` debe coincidir con la URL principal HTTPS de Netlify. Si el dominio
principal es `https://jarvismedina.netlify.app`, el callback de GitHub debe ser
`https://jarvismedina.netlify.app/api/auth/callback/github`. Si usas otro dominio
principal, configura ambos con ese dominio, sin quitar la validación de coincidencia.

No se incluyeron credenciales reales en este cambio. No configurar API keys de IA.
No añadir tarjeta, complementos ni recargas; si deja de ser Free, detener builds.

Para seleccionar la rama correcta: **Project configuration → Build & deploy →
Continuous deployment → Branches and deploy contexts → Production branch**,
seleccionar `prep/private-personal-assistant` y guardar. Esto no fusiona con main.

## Validación y siguiente ejecución

Las pruebas del candado se ejecutan con `npm run test:hosting`.
La compilación local usa el comando real `npm run build:netlify`, con valores
ficticios de OAuth y secretos exclusivamente de prueba. Verifica la compilación,
no el acceso OAuth ni la configuración real del panel Netlify.

No se lanzan builds remotos de diagnóstico ni se instalan dependencias nuevas.
Después de subir el cambio solo a la rama preparada, un build Git se permitirá
únicamente si ya están completas las variables reales. Si se omite por faltar
alguna, corregir todas las indicadas antes de solicitar **un único** reintento.

La autorización es para esta prueba, proyecto y rama. Para volver a cerrar el
candado, cambiar `JARVIS_DEPLOY_APPROVED` a `false` en el contexto production del
TOML; las variables declaradas en TOML pueden prevalecer sobre las del panel.
Mantener los despliegues automáticos desactivados cuando termine la prueba.
