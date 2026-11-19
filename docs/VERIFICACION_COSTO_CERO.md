# Verificación previa al PR — 19-11-2026

## Commits y privacidad

- Se revisaron los dos commits locales y los archivos nuevos/modificados.
- Se sustituyó el contacto privado del autor y committer por el correo noreply
  de GitHub antes de subirlos. Nuevos IDs: `40767e8` y `d30a3ea`.
- Los árboles del código anterior y posterior a ese cambio de metadatos coinciden.
- Escaneo de 69 rutas cambiadas: sin hallazgos de patrones de tokens de proveedor,
  claves privadas, contacto privado o URLs con usuario/contraseña. Las claves
  que aparecen en las pruebas son ficticias y están identificadas como tales.
- No se imprimieron valores de credenciales en el reporte ni se añadieron `.env`.
- Alcance limitado a los cambios de esta rama; no certifica todo el historial
  histórico público ni reemplaza la revocación de una clave previamente publicada.

## Pruebas ejecutadas después de los cambios

| Comprobación | Resultado |
| --- | --- |
| Pytest backend | 323 pasan, 5 omitidas; cobertura 47,60 % |
| Ruff backend | Pasa |
| Vitest frontend | 28 pasan |
| Build Next.js | Pasa |
| TypeScript | Pasa |
| Playwright Chromium: escritorio/iPhone/iPad | 9 pasan |
| Bloqueos de alojamiento | 4 pasan |
| Configuración Netlify y propiedad Git de Vercel | Validadas con esquemas oficiales |
| Build de alojamiento sin autorización | Rechazado, como se esperaba |
| ESLint del frontend histórico | 4 errores y 18 advertencias pendientes |

Se comprobó la aplicación FastAPI real además del middleware aislado. Sus rutas
de negocio y documentación rechazan peticiones anónimas; otra identidad no puede
entrar. Voz, tiempo real, investigación y captura siguen cerrados. `/healthz`
devuelve únicamente un estado mínimo sin configuración ni datos personales.

Los E2E emplean una sesión sintética de Auth.js y el backend local. No se probó
OAuth real, Safari físico ni el adaptador desplegado en Netlify. No se hizo un
despliegue ni se conectó un proveedor de IA para verificar estas pruebas.

## Controles de costo y publicación

- Netlify Free declarado; build cerrado por defecto y previews bloqueados.
- Render `plan: free`, sin despliegue automático, workers ni bases adicionales.
- Vercel Git deployments desactivados en la configuración de esta rama.
- El workflow de despliegue se convirtió en comprobación sin publicación.
- No hay recargas, compras o API calls de IA implementadas por esta preparación.
- El plan y los medios de pago reales de las cuentas deben revisarse desde sus
  paneles: una variable de entorno no puede verificar ni modificar la facturación.

La rama está preparada para un Pull Request en borrador; la comprobación Git de
subida devolvió 403 y no se creó un PR remoto. Su texto está en `PR_BORRADOR.md`. No
autoriza fusionar ni publicar la aplicación. Las instrucciones están en
[GUIA_IPAD_COSTO_CERO.md](../GUIA_IPAD_COSTO_CERO.md).
