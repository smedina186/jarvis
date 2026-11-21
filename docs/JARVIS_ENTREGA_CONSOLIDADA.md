# Entrega consolidada: voz, memoria y especialistas

Base de producción: e4ac530. Cambios preparados en prep/private-personal-assistant,
sin subir, fusionar ni desplegar. No se incluyen claves ni datos de la empresa.
Presupuesto automático $0, Gemini con los candados existentes. No se contrataron
servicios, habilitó facturación ni hicieron llamadas reales a modelos.

## Diagnóstico de la captura

El panel mostraba Render sin conexión; Gemini no podía verificarse y el campo/
micrófono quedaban inutilizados. Se comprobó /healthz de Render de solo lectura:
200 en aproximadamente 0,4 segundos. Eso verifica el proceso público mínimo,
no la autorización privada del usuario. Render Free puede dormirse y tardar
50 segundos o más en arrancar; el proxy cortaba a 10 s y la interfaz a 12 s.

Ahora el proxy privado permite hasta 55 s para salud y la interfaz hasta 65 s,
con botón de cancelación, una solicitud simultánea y sin reintentos infinitos.
Otros endpoints no se alargan innecesariamente. Un límite del proveedor de hosting
podría cerrar antes la función; el error visible permite reintento manual una vez
que Render haya despertado. No se asegura disponibilidad permanente del plan Free.
Se conservan las verificaciones de propietario/JWT/HTTPS y errores de credenciales.
Se puede escribir, dictar y guardar memoria incluso mientras el backend no responde;
solo enviar a Gemini requiere conexión. Micrófono y chat ya no comparten ese bloqueo.

## Conversación por voz

Se mantiene el modo manual y se añade Iniciar conversación automática, disponible
tras activar Modo voz, consentir reconocimiento y tener Gemini autorizado.
La sesión envía al finalizar una transcripción y, al terminar la respuesta hablada,
vuelve a escuchar. Máximo seis turnos; error, cuota, salida de Chat, ocultar pestaña
o detener cancelan la sesión. No hay reinicios tras permisos denegados.
Se reconoce y retira el prefijo «Oye Jarvis» o «Jarvis» de una solicitud dentro de
la sesión. No es un detector permanente de palabra de activación del sistema.

Safari no garantiza escucha con pantalla bloqueada, página cerrada o en segundo
plano, ni permite eludir permisos/gestos de audio. Puede rechazar reiniciar el
reconocimiento sin otro toque. En ese caso se muestra el error y quedan el botón
micrófono, el dictado del teclado y Reproducir respuesta. No se contrata voz de
terceros ni se finge que Safari soporta una capacidad que no expone.

## Memoria dictada y archivos

En el chat, el usuario dicta/escribe información, abre Memoria personal y de empresa
y pulsa Guardar lo que acabo de contar. Puede corregir, borrar, añadir TXT/MD/CSV/
JSON, exportar y restaurar un archivo de respaldo cifrado.

Se guarda en localStorage con AES-GCM e IV aleatorio. Se reutiliza el mecanismo
criptográfico ya preparado en la rama de respaldo: clave derivada de AUTH_SECRET
por HMAC y propietario, entregada únicamente por Next.js a la sesión propietaria.
El secreto maestro no se entrega. No hay clave Gemini en navegador ni texto plano
en almacenamiento. Render dormido o reiniciado no borra esta memoria del navegador.
No se escribe información empresarial en el repositorio público.

Límites: 32 archivos, 20.000 caracteres por archivo. El buscador inspecciona todos
los documentos locales y envía como máximo ocho fragmentos relevantes de 900
caracteres, más el índice de títulos, cuando el usuario autoriza Usar mi memoria
al responder. Se informa cuántos se inspeccionaron y seleccionaron. Gemini NO
lee íntegramente todos los archivos si exceden el contexto; no se afirma lo
contrario. La memoria se pasa como datos no confiables, sin permisos de ejecutar
instrucciones presentes en documentos. Google Free puede usar datos para mejorar
productos; el consentimiento de envío es explícito y configurable.

No hay sincronización central automática: otro iPad/ordenador puede importar el
respaldo con la misma cuenta y secreto maestro. Borrar datos de Safari pierde la
copia local. Rotar AUTH_SECRET hace ilegibles respaldos anteriores; el cifrado no
protege frente a código malicioso dentro de una sesión abierta. No editar en dos
pestañas simultáneas: no hay fusión concurrente de memorias.

## Especialistas y revisión diaria

Perfiles reales en la llamada a Gemini: asistente personal, ventas, Meta Ads,
programación, investigación, documentos, organización y análisis. Selector manual
y enrutamiento por tema, con razón y fuentes devueltas. No son ocho procesos o
modelos independientes; comparten la integración Gemini autorizada. No se conoce
la empresa hasta que el propietario aporte información. No se inventan clientes,
precios, métricas, acceso a Meta o búsquedas en internet.

Misiones y revisión diaria, dentro del chat, permite pedir propuestas y guardarlas
en un archivo de memoria. Una opción desactivada por defecto autoriza un intento
diario al abrir JARVIS en primer plano; usa coordinación entre pestañas (Web Locks)
y registra el día del intento antes de consultar. Sin Web Locks se usa el botón
manual. No hay reintentos automáticos ni trabajos mientras el iPad está cerrado.
Siguen vigentes 6 intentos/minuto, 20/día/proceso y modelo gratuito permitido.

La revisión propone cambios; no modifica código, compra, envía correos, crea
anuncios, cambia presupuestos ni publica. Un ejecutor de cambios y un planificador
24/7 requieren infraestructura, permisos específicos y aprobación por acción;
no están habilitados. No hay auto-mejora desplegada sin revisión humana.

## Repositorios investigados, sin instalación indiscriminada

- langchain-ai/langgraph (MIT): útil para flujos complejos, no proporciona modelos,
  memoria alojada ni costo API cero. No necesario para este enrutador pequeño.
- microsoft/autogen: marco multiagente; exige proveedores/permisos y ejecución.
  No se ejecutaron ejemplos ni agentes externos.
- msitarzewski/agency-agents (MIT): catálogo de instrucciones/especialidades;
  no constituye acceso real a Meta, GitHub o bases de datos. No se importó todo
  el catálogo ni se copiaron perfiles sin revisar. Las políticas son propias.
- meta/facebook-python-business-sdk: SDK oficial; para datos reales necesita
  permisos Meta/business y tokens propios. No se conectó una cuenta publicitaria
  ni se habilitó gasto. Por ahora se analiza material aportado.

No existe un conjunto finito «todos los agentes de GitHub» instalable con garantía
de compatibilidad y costo cero. OpenAI/Codex como API sigue pendiente de acceso
verificado; una suscripción de ChatGPT no autoriza API de pago ilimitada.

## Pendiente y siguiente actualización

Sin empresa o documentos aportados no se puede llenar la memoria ni conocer sus
operaciones. No se necesita entregarlos ahora a Codex: podrán dictarse en JARVIS.
Memoria central entre dispositivos, automatización 24/7, API Meta, navegación web,
ejecutores externos y auto-modificación permanecen pendientes, no simulados.
Safari físico sigue requiriendo la prueba en el iPad; el entorno no tiene las
bibliotecas para WebKit, como se documentó en la fase de voz.

Cuando el propietario apruebe esta entrega consolidada, actualizar solo la rama
preparada y aplicar una vez Netlify y Render. No necesita nuevas claves ni planes:
se reutilizan OAuth, Gemini y los secretos existentes. No se publica en esta tarea.

## Validación de esta entrega

Pruebas completas backend: 334 aprobadas, 5 omitidas; cobertura 48,85%, superior
al mínimo existente. Pruebas frontend: cifrado y recuperación de memoria, selección
de fuentes, conversación automática iniciada explícitamente, persistencia cifrada
al recargar, límites de espera y acceso privado. Los nueve recorridos Playwright
en Chromium para escritorio/iPhone/iPad pasaron, incluyendo memoria y voz con
fixtures. No certifican Safari físico ni usan datos empresariales o claves reales.
No se hicieron llamadas a Gemini/Meta/OpenAI. Compilación de producción y lint de
los archivos afectados se verifican localmente antes del commit.

Resultados finales: 334 pruebas backend aprobadas (5 omitidas), 58 frontend,
9 recorridos de navegador y compilación Next.js aprobados. Se cubrió además la
revisión diaria optativa sin repetición el mismo día; no implica un cron remoto.
