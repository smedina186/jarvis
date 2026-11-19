# Preparar JARVIS privado en Netlify Free y Render Free, sin publicar

Estado previsto: **Draft**. Base: `main`. Rama: `prep/private-personal-assistant`.
El PR remoto todavía no está creado: la credencial Git del entorno devuelve 403.

## Problema y resultado

El prototipo original no tenía acceso privado y la propuesta anterior incluía
alojamiento de pago. Esta rama prepara un panel de propietario único con Auth.js,
API FastAPI autenticada por separado y plantillas Netlify Free + Render Free.
El presupuesto obligatorio es $0; no se publica ni se contrata ningún servicio.

## Cambios para revisión

- Conserva los arreglos de instalación y arranque de la primera etapa.
- Limita inicio de sesión al ID estable del propietario en GitHub; el backend
  valida JWT firmado de hasta 60 segundos. Los secretos permanecen en el servidor.
- Mantiene cerradas las funciones de reconocimiento facial, investigación de
  personas, agentes, voz y tiempo real. El panel identifica la demostración sin IA.
- Añade `netlify.toml` con SSR/OpenNext y autenticación; builds cerrados por defecto
  y previews bloqueados. Render selecciona Free y no despliega automáticamente.
- Desactiva los despliegues Git de Vercel y convierte el workflow de despliegue
  en una comprobación que no publica. No hay alta de cuentas ni recargas.
- Sustituye el contacto privado de los commits locales por el correo noreply
  antes de cualquier subida, sin cambiar su contenido.
- Incluye guía sencilla para Safari/iPad y configuración de secretos fuera de Git.

## Validación local

- Backend: 323 pruebas pasan, 5 omitidas; cobertura 47,60 %. Ruff pasa.
- Frontend: 28 pruebas pasan; TypeScript y build pasan.
- 9 E2E pasan: tamaños escritorio/iPhone/iPad, acceso y conexión al FastAPI local.
- 4 pruebas de bloqueo de publicación pasan; configuración contrastada con esquemas.
- El build Netlify sin autorización se rechaza intencionalmente.
- Los archivos cambiados y metadatos se revisaron buscando credenciales y contacto
  privado; no se detectaron patrones en el alcance examinado.

## Límites y siguientes pasos

No se validó OAuth real, Safari físico ni un despliegue Netlify/Render. Hay 4
errores y 18 advertencias de lint históricos fuera del panel privado. No hay chat
real, agentes ejecutables ni persistencia de conversación. `/healthz` solo expone
un estado mínimo para monitorización; las APIs de negocio requieren autenticación.

La aplicación será privada mediante autenticación; el repositorio sigue público.
Netlify y Render pueden pausar por cuotas/inactividad. No añadir tarjeta ni
activar un plan de pago. **No fusionar ni desplegar sin aprobación del propietario.**
