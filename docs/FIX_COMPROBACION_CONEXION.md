# Corrección del ciclo de comprobación — 21-11-2026

Base: `c759da8`, la interfaz morada publicada, en `prep/private-personal-assistant`.
La versión local anterior `37b245d` se conserva intacta en
`archive/private-assistant-37b245d`; no se mezclan los dos rediseños.

Una prueba reproduce más de una petición por montaje cuando cambia la identidad
que devuelve useRouter. El efecto dependía del callback que dependía del router.
Ahora usa un callback estable, navegación mediante referencia actualizada,
una sola petición simultánea y cancelación al abandonar el panel. Hay un límite
de 12 segundos para la comprobación completa y ningún reintento automático.
Tras error o timeout, el usuario decide cuándo volver a comprobar.

Además, un 401/403 de Render se convertía en un 401 del navegador: podía enviarlo
a /login y volver al panel porque su sesión OAuth seguía siendo válida. Ahora
es un 502 con diagnóstico de credenciales de backend, sin valores secretos.
Un usuario sin sesión sigue recibiendo 401 y las herramientas siguen bloqueadas.
No se modificaron credenciales, OAuth, backend ni configuración de planes.

Verificación: 9 pruebas dirigidas aprobadas (incluidas regresión del ciclo,
timeout, reintento manual, cancelación, autorización y diagnóstico del proxy),
ESLint de archivos afectados y compilación de producción Next.js aprobados.
Se eliminó solamente `.next/dev`, caché generada que conservaba tipos de una
ruta perteneciente a la versión local anterior; no se borró código del proyecto.

Corrección guardada localmente. No se subió ni desplegó: subir esta rama puede
activar Netlify automáticamente y requiere autorización de publicación.
