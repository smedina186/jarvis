# Instrucciones para Codex — JARVIS de Sebastián

Trabaja en mi repositorio existente de JARVIS. Ya tengo un proyecto Next.js desplegado en Netlify, autenticación privada con GitHub OAuth y un backend separado en Render. **Inspecciona el repositorio y las instrucciones del proyecto antes de cambiar archivos. Conserva todo lo que funciona.**

Te adjunto cuatro referencias visuales:

1. `01-jarvis-escritorio-final.png`: pantalla principal de escritorio.
2. `02-modo-autonomo-final.png`: misiones y trabajo autónomo.
3. `03-jarvis-ipad-final.png`: adaptación para iPad/móvil.
4. `04-mascota-perro-186.png`: mi marca personal.

Las imágenes son **referencias**, no fondos de pantalla que debas pegar encima de la interfaz. Construye componentes reales, accesibles y responsivos.

## Diseño que quiero

- Estética futurista de centro de mando, inspirada en la tecnología de Tony Stark, pero propia y elegante. Paleta violeta, morado profundo y destellos lilas; nubes/nebulosa discretas, brillo moderado y mucho espacio libre.
- Muy poco texto en pantalla. Diseño premium, ordenado y limpio. Tipografía moderna de gran calidad (por ejemplo, Space Grotesk o Sora con Inter para textos), tamaños legibles y buen contraste.
- En el centro, el ojo/núcleo de JARVIS con animación sutil construida con CSS/SVG o componentes; respeta `prefers-reduced-motion`. **No escribas “186” dentro del ojo.**
- Justo debajo del ojo, una única frase visible: **«Bienvenido, Sebastián. ¿En qué trabajamos hoy?»**. Sin subtítulos, párrafos de bienvenida ni textos repetidos que la saturen.
- Mi perro es el único emblema de marca: conserva su ojo azul y el **186 debajo del perro**. Úsalo de manera muy discreta, como marca de agua en el pie o esquina, con baja opacidad, sin tapar contenido ni competir con el ojo de JARVIS. No incluyas los anteriores logos de moto.
- Navegación clara: **Chat**, **Agentes**, **Misiones**, **Conexiones**. Adaptar apropiadamente a iPad/móvil con menú compacto.
- No convertir toda la pantalla en un diseño decorativo: las acciones y estados deben seguir siendo fáciles de usar.

## Funciones e integraciones, sin simulaciones

1. **Panel de Conexiones:** presenta GitHub OAuth, Netlify, Render, Gemini y OpenAI/ChatGPT, y los servicios adicionales que de verdad existan. Cada elemento debe indicar `Conectado`, `Sin configurar`, `Error` o `Comprobando`, con hora de última verificación y latencia cuando puedan medirse de manera segura. Los indicadores deben venir de verificaciones reales en servidor, nunca de datos falsos. Si una API no permite una comprobación segura, indícalo con honestidad.
2. **No expongas claves API en el navegador ni en los registros.** Usa variables de entorno solo en servidor y muestra únicamente los nombres que faltan. No pidas que pegue secretos en el chat, no cambies las variables existentes sin necesidad y conserva la autenticación del propietario.
3. **Chat con IA:** prepara conexión real y selección manual de Gemini y OpenAI mediante rutas seguras del backend. Si faltan credenciales o configuración, muestra claramente `Sin configurar`, sin inventar respuestas. No hagas llamadas facturables automáticas ni prometas un coste de $0 si no se puede garantizar. El presupuesto de ejecución autónoma por defecto es **$0**, sujeto a aprobación explícita para cualquier gasto.
4. **Backend Render:** diagnostica por qué `https://jarvis-fyyr.onrender.com` respondió `Private access is not configured`. Configura el acceso privado correctamente respetando los controles del servidor. Nunca elimines ni relajes la autorización solo para hacer pasar la prueba. No confundas una respuesta HTTP con una comprobación de salud aprobada.
5. **Misiones autónomas persistentes:** quiero darle a un agente un objetivo/proyecto completo y que trabaje por etapas sin que yo tenga que escribir cada subtarea. Debe tener plan, cola de tareas, progreso, historial, registro de decisiones, reintentos limitados, pausa/reanudar/cancelar y recuperación tras cierre de navegador. Si hace falta proceso de larga duración, utiliza un worker/cola/programación del servidor compatible con la infraestructura real; **no finjas autonomía permanente desde una pestaña abierta**.
6. **Aprobaciones y seguridad:** cualquier edición de repositorio, publicación, acción externa, acceso sensible o gasto debe pasar por la autorización apropiada antes de ejecutarse. Primero mostrar propuesta, resumen de cambios y diff o plan. Incluir límites de tiempo, tareas y llamadas; evitar bucles de agentes.
7. **Privacidad:** que los controles indiquen fielmente qué datos se guardan y dónde. No inventes cifrado extremo a extremo ni capacidades no implementadas.

## Orden de implementación

**Fase 1 — Diseño:** implementar la nueva interfaz morada responsive con el ojo, frase exacta, perro + 186 tenue, chat y pestañas. Conservar el flujo de login GitHub, incluida la ruta de callback existente. Confirmar visualmente escritorio, iPad y móvil.

**Fase 2 — Estado real:** conectar el panel de salud de servicios a rutas seguras y estados comprobables; solucionar configuraciones faltantes sin exponer secretos.

**Fase 3 — IA:** añadir Gemini/OpenAI solo después de validar credenciales, límites, permisos y manejo de errores. No utilizar respuestas falsas.

**Fase 4 — Misiones:** diseñar e implementar primero una misión persistente de extremo a extremo con un solo agente, aprobaciones, reanudación y registros. Expandir perfiles y herramientas después de verificarla.

## Entrega y criterios de aceptación

- No romper Netlify, `next build`, acceso privado ni GitHub OAuth.
- Ejecutar las pruebas disponibles, lint y build; reparar errores introducidos.
- Mantener secretos en servidor, respetar permisos y no simular servicios.
- La pantalla principal debe mostrar **solo la frase indicada debajo del ojo**, y `186` debe aparecer **solo en el emblema del perro**.
- Documentar: archivos modificados, pruebas pasadas, problemas encontrados, **nombres** de variables de entorno faltantes y funciones pendientes.
- Antes de cada acción de riesgo, detenerte y pedirme aprobación. Si alguna fase no cabe en una sola ejecución, guarda el avance en el repositorio con tareas claras para retomar sin perder contexto.

Empieza por revisar la estructura actual y completar la **Fase 1** antes de abordar las demás.
