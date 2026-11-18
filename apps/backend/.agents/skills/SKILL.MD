Engineering Skills & Standards — Copilot
Objetivo: producir software profesional, seguro, mantenible y eficiente. Prioriza soluciones simples, explícitas y coherentes con la arquitectura existente. Estas reglas aplican al frontend y al backend.

1. Principios generales
1. Entiende antes de modificar. Inspecciona la estructura, los patrones, las dependencias y el flujo actual antes de escribir código.
2. Respeta la arquitectura existente. No introduzcas otra librería, patrón o capa si el proyecto ya resuelve bien esa necesidad.
3. Simplicidad primero. Elige la solución más sencilla que cumpla los requisitos. Evita abstracciones prematuras, código duplicado y complejidad accidental.
4. Código legible. Prioriza nombres descriptivos, funciones pequeñas con una responsabilidad clara y estructuras fáciles de seguir.
5. Cambios acotados. Modifica únicamente lo necesario. No reformatees ni reestructures archivos ajenos a la tarea sin una razón concreta.
6. No inventes requisitos. Si una decisión afecta al comportamiento, los datos o la seguridad y no está clara, pregunta antes de asumir.
7. No ocultes errores. No uses any, @ts-ignore, casts inseguros, catch vacíos ni valores por defecto que disimulen fallos, salvo justificación explícita.
8. No simules funcionalidad. No dejes botones sin acción, datos ficticios en producción, TODOs como sustituto de una implementación ni respuestas de API inventadas.
9. Mantén consistencia. Sigue las convenciones de nombres, formato, imports, manejo de errores y organización ya adoptadas por el repositorio.
10. Explica decisiones relevantes. Al terminar, resume qué cambió, por qué y qué validaciones ejecutaste.
2. Flujo de trabajo obligatorio
Antes de implementar:
- Lee los archivos relacionados y sus dependencias directas.
- Identifica si la tarea afecta a UI, lógica de negocio, API, persistencia, autenticación o autorización.
- Comprueba los tipos, contratos y convenciones existentes.
- Reutiliza componentes, utilidades y servicios existentes cuando corresponda.
- Define el alcance mínimo que resuelve correctamente el problema.
Durante la implementación:
- Trabaja en pasos pequeños y coherentes.
- Mantén separados presentación, lógica de negocio y acceso a datos.
- Valida los datos en los límites del sistema.
- Conserva la compatibilidad con el resto de la aplicación.
- No cambies contratos públicos sin actualizar todos sus consumidores.
Después de implementar:
- Ejecuta, cuando existan, lint, typecheck, tests y build.
- Corrige los errores introducidos por tus cambios.
- Revisa estados de carga, error, vacío y éxito en la interfaz.
- Comprueba permisos, aislamiento de datos y validaciones en operaciones sensibles.
- Informa claramente de las pruebas que no pudiste ejecutar.
3. Frontend: diseño visual profesional
3.1 Criterios visuales
Construye interfaces sobrias, consistentes y orientadas al trabajo. El resultado debe sentirse como un producto SaaS profesional, no como una demo.
- Usa una jerarquía visual clara: títulos, subtítulos, contenido y acciones.
- Mantén espaciados, alturas, radios, bordes y tamaños tipográficos consistentes.
- Prioriza alineación, proporción, legibilidad y espacio en blanco.
- Usa una paleta limitada y coherente. Reserva los colores intensos para acciones principales, estados y alertas.
- Evita gradientes decorativos, sombras excesivas, efectos innecesarios, glassmorphism indiscriminado y animaciones que distraigan.
- No llenes cada espacio con tarjetas. Usa contenedores solo cuando aporten agrupación o jerarquía.
- Evita interfaces sobrecargadas. Muestra primero las acciones y la información más importantes.
- Mantén una densidad de información adecuada para aplicaciones empresariales.
- Usa iconos de forma consistente. No mezcles estilos ni uses emojis como sustituto de iconografía de interfaz.
- No inventes una estética nueva en cada pantalla: reutiliza el sistema visual del producto.
3.2 Sistema de diseño
- Antes de crear estilos, busca tokens, variables CSS, componentes y patrones existentes.
- Centraliza colores, tipografía, espaciado, radios, sombras y breakpoints cuando el proyecto tenga un sistema de diseño.
- Usa las utilidades y convenciones de Tailwind CSS ya configuradas. No mezcles arbitrariamente CSS inline, módulos y utilidades.
- Evita valores mágicos repetidos. Extrae tokens solo cuando exista repetición real o una necesidad de consistencia.
- No dupliques componentes visuales casi idénticos: crea componentes compartidos cuando tengan una responsabilidad y API claras.
- Los componentes compartidos deben ser configurables sin convertirse en componentes genéricos excesivamente complejos.
3.3 Layout y navegación
- Usa una estructura de aplicación consistente: navegación principal, encabezado, área de contenido y contexto de página.
- En dashboards, prioriza una navegación lateral clara y un encabezado con acciones contextuales.
- Indica la ubicación actual del usuario mediante estados activos, títulos o breadcrumbs cuando sean útiles.
- Mantén las acciones principales visibles y las acciones destructivas claramente diferenciadas.
- Evita scroll horizontal accidental y saltos de layout.
- Diseña primero para el contenido real, no para llenar una captura de pantalla.
3.4 Responsive y accesibilidad
- La interfaz debe funcionar en móvil, tablet y escritorio.
- Usa layouts fluidos y breakpoints coherentes; no soluciones basadas en posiciones absolutas para estructurar páginas completas.
- No dependas únicamente del color para comunicar estados.
- Usa HTML semántico: main, nav, header, section, button, form, label, etc.
- Todo control interactivo debe ser accesible por teclado y tener nombre accesible.
- Asocia cada campo con su label; muestra errores junto al campo y anúncialos cuando corresponda.
- Mantén contraste suficiente, foco visible y tamaños de interacción adecuados.
- Usa alt descriptivo en imágenes informativas y alt="" en imágenes decorativas.
3.5 Estados de interfaz
Toda pantalla que dependa de datos debe contemplar, cuando corresponda:
- Carga: indicador o skeleton proporcionado, sin bloquear innecesariamente toda la aplicación.
- Éxito: mostrar el resultado y confirmar acciones relevantes.
- Error: mensaje claro y accionable; no exponer trazas ni detalles internos.
- Vacío: explicar qué falta y ofrecer una acción útil si procede.
- Deshabilitado: explicar visualmente por qué una acción no está disponible.
- Confirmación: pedir confirmación antes de operaciones destructivas o irreversibles.
No uses alert() como solución habitual. Utiliza el sistema de notificaciones y diálogos del proyecto.
4. Frontend: React, Next.js y TypeScript
- Usa componentes funcionales y hooks siguiendo las reglas de React.
- Mantén los componentes enfocados. Extrae lógica reutilizable a hooks solo cuando realmente se reutilice o mejore la claridad.
- Evita componentes enormes que mezclen fetching, validación, estado, reglas de negocio y presentación.
- No crees estado para valores que puedan derivarse de props o de otro estado.
- Evita efectos (useEffect) para cálculos derivados o para sincronizar estados que pueden resolverse directamente durante el render.
- Añade dependencias correctas a los hooks. No desactives reglas de ESLint para ocultar problemas.
- Usa key estable y único en listas; no uses el índice si los elementos pueden cambiar de orden o eliminarse.
- Define tipos explícitos para props, respuestas de API, formularios y modelos de UI.
- Prefiere unknown a any cuando el tipo sea desconocido y valida antes de utilizarlo.
- No dupliques tipos de dominio en distintos lugares si pueden compartirse desde una fuente adecuada.
- Mantén la lógica de negocio fuera de los componentes visuales cuando sea razonable.
- Evita prop drilling excesivo, pero no introduzcas Context o una librería de estado global para estados locales simples.
- Gestiona correctamente cancelación, concurrencia y estados obsoletos en peticiones asíncronas.
- No guardes secretos, tokens privados ni credenciales en el bundle del navegador.
- En Next.js, respeta la separación entre Server Components y Client Components. Añade "use client" solo cuando se necesite interacción o APIs del navegador.
- No expongas variables privadas del servidor con prefijos públicos ni las importes en módulos cliente.
- Usa imágenes, fuentes y mecanismos de navegación recomendados por la configuración existente del proyecto.
5. Formularios y validación
- Usa controles HTML adecuados y tipos correctos de input.
- Valida en el cliente para mejorar la experiencia y vuelve a validar siempre en el servidor.
- Normaliza datos cuando corresponda: espacios, mayúsculas/minúsculas, formatos y valores vacíos.
- Distingue campos obligatorios, opcionales y nullable.
- Muestra errores específicos, comprensibles y asociados al campo correcto.
- Evita enviar formularios varias veces: gestiona el estado de envío y deshabilita temporalmente la acción.
- No confíes en validaciones del frontend como medida de seguridad.
- No borres datos introducidos por el usuario cuando falle una petición, salvo que exista una razón funcional.
6. Backend: Node.js, Express y TypeScript
- Mantén separadas rutas, controladores, servicios, validaciones, acceso a datos y middlewares según la arquitectura del proyecto.
- Las rutas definen endpoints y middlewares; los controladores traducen HTTP; los servicios contienen reglas de negocio; los repositorios o clientes de datos gestionan persistencia cuando esa capa exista.
- No coloques consultas complejas, reglas de negocio ni lógica de autorización dentro de los controladores.
- Valida params, query, body, cookies y cabeceras en el servidor con el mecanismo de validación adoptado por el proyecto.
- Trata todo dato externo como no confiable.
- Devuelve códigos HTTP correctos y respuestas de error consistentes.
- Centraliza el manejo de errores. No envíes stack traces, consultas SQL ni detalles internos al cliente.
- No uses try/catch repetitivos si el manejo centralizado de errores ya cubre el caso; captura errores cuando puedas recuperarte o añadir contexto útil.
- Usa async/await y evita promesas sin manejar.
- Configura límites de tamaño para body y cargas de archivos.
- Añade paginación, filtros y ordenamiento controlados en endpoints de colecciones.
- Evita devolver entidades completas si el cliente solo necesita algunos campos.
- No permitas que el cliente defina libremente nombres de columnas, campos de ordenamiento o fragmentos de consulta.
7. Seguridad: requisitos obligatorios
7.1 Autenticación y sesiones
- Nunca almacenes contraseñas en texto plano. Usa un algoritmo de hash de contraseñas adecuado, como Argon2id o bcrypt con parámetros actuales.
- No implementes criptografía propia.
- Verifica JWT en el servidor y limita explícitamente los algoritmos aceptados.
- Valida firma, expiración, emisor y audiencia cuando formen parte del contrato de tokens.
- No confíes en el contenido de un JWT sin verificarlo.
- Para cookies de sesión, usa HttpOnly, Secure en HTTPS y una política SameSite adecuada al flujo.
- Define expiración y revocación de sesiones. El cierre de sesión debe invalidar la sesión en el servidor cuando la arquitectura lo requiera.
- No registres tokens, contraseñas, cookies de sesión ni secretos en logs.
- Aplica rate limiting y controles contra fuerza bruta en login, recuperación de contraseña y endpoints sensibles.
- Evita revelar si un correo o usuario existe cuando esa información pueda facilitar enumeración de cuentas.
7.2 Autorización y multiempresa
- Autenticar no equivale a autorizar. Comprueba permisos en cada operación protegida.
- Aplica el principio de mínimo privilegio.
- Nunca confíes en empresaId, userId, rol o permisos enviados por el navegador.
- Obtén la identidad y el contexto de empresa desde la sesión verificada.
- En un sistema multiempresa, toda consulta y mutación de datos de negocio debe quedar limitada al tenant autorizado.
- Comprueba la pertenencia y autorización también al acceder a recursos por ID. No basta con ocultar botones en el frontend.
- Usa restricciones de base de datos cuando sea posible para reforzar unicidad y relaciones dentro del tenant.
- Evita que un usuario pueda cambiar IDs en una URL o body para acceder a datos de otra empresa (IDOR/BOLA).
- Verifica permisos tanto en operaciones de lectura como de creación, edición, eliminación, exportación y descarga.
7.3 Datos y APIs
- Usa consultas parametrizadas o el ORM de forma segura. Nunca construyas SQL concatenando entradas del usuario.
- Evita asignar directamente todo el req.body a un modelo. Selecciona explícitamente los campos permitidos.
- Protege contra mass assignment, XSS, CSRF, SSRF, inyección y traversal según el tipo de endpoint.
- Configura CORS con orígenes permitidos concretos; no uses * con credenciales.
- Usa Helmet y cabeceras de seguridad apropiadas para Express.
- Aplica CSRF cuando la autenticación basada en cookies y el flujo de la aplicación lo requieran.
- Limita intentos, frecuencia y tamaño de las operaciones sensibles.
- Valida tipo, tamaño y contenido de archivos; no confíes solo en la extensión o el MIME enviado por el cliente.
- No expongas información personal o financiera que no sea necesaria.
7.4 Secretos y configuración
- Guarda secretos en variables de entorno o en un gestor de secretos.
- Incluye un .env.example sin valores reales.
- Nunca subas .env, claves privadas, certificados ni credenciales al repositorio.
- Valida la configuración al iniciar la aplicación y falla de forma clara si falta una variable obligatoria.
- No uses valores inseguros por defecto en producción.
- Mantén dependencias actualizadas y evita instalar paquetes innecesarios.
8. Base de datos y Prisma
- Diseña modelos con nombres y relaciones claros.
- Usa claves primarias, claves foráneas, índices y restricciones únicas apropiadas.
- Define índices a partir de consultas reales y patrones de acceso; no agregues índices sin motivo.
- En sistemas multiempresa, considera restricciones compuestas como @@unique([empresaId, sku]) cuando la unicidad deba ser por empresa.
- Selecciona solo los campos necesarios mediante select.
- Evita consultas N+1 y carga de relaciones innecesarias.
- Usa transacciones cuando varias operaciones deban completarse o revertirse juntas.
- No conviertas errores de base de datos en respuestas exitosas.
- Las migraciones deben ser revisables, reproducibles y compatibles con el proceso de despliegue.
- No ejecutes cambios destructivos de datos o esquemas sin explicar el impacto y obtener autorización cuando corresponda.
- No uses datos de una empresa para construir resultados de otra, incluso en reportes, búsquedas o exportaciones.
9. Rendimiento y eficiencia
- Optimiza después de identificar un problema real; evita microoptimizaciones prematuras.
- Reduce renders y cálculos costosos cuando exista evidencia de impacto.
- Evita peticiones duplicadas, consultas repetidas y transferencias de datos innecesarias.
- Usa paginación para listados potencialmente grandes.
- Carga bajo demanda módulos o recursos pesados cuando aporte una mejora real.
- Optimiza imágenes y evita enviar al navegador recursos innecesarios.
- Usa caché solo cuando puedas definir claramente invalidación, alcance y consistencia.
- Evita abstraer una operación simple en múltiples capas sin beneficio.
- Prefiere algoritmos y estructuras de datos adecuados antes que añadir infraestructura.
10. Testing y calidad
- Escribe tests para reglas de negocio, validaciones, permisos y casos límite.
- Prioriza tests de comportamiento sobre tests que solo verifican detalles internos de implementación.
- Incluye casos de éxito, datos inválidos, ausencia de autenticación, falta de permisos y acceso entre empresas.
- Para endpoints, prueba códigos HTTP, estructura de respuesta y efectos en la base de datos.
- Para componentes, prueba interacción, accesibilidad básica y estados de carga/error/vacío.
- No cambies tests para hacerlos pasar si el comportamiento esperado sigue siendo incorrecto.
- No elimines tests existentes sin justificación.
- Mantén lint, TypeScript y build sin errores nuevos.
11. TypeScript y estilo de código
- Activa y respeta el modo estricto de TypeScript cuando el proyecto lo permita.
- Prefiere tipos explícitos en límites del sistema y tipos inferidos en expresiones sencillas.
- Usa interface o type de manera consistente con el repositorio.
- Evita enum si una unión literal o un objeto as const resuelve mejor el caso.
- Evita ! (non-null assertion) salvo que la invariancia esté garantizada y documentada.
- No conviertas errores desconocidos directamente a Error sin comprobar el tipo.
- Usa early returns para reducir anidamiento cuando mejoren la lectura.
- Evita funciones con demasiados parámetros; agrupa opciones relacionadas en un objeto cuando aporte claridad.
- No crees utilidades de una sola línea que oculten más de lo que simplifican.
- Los comentarios deben explicar intención, restricciones o decisiones no obvias; no narrar literalmente el código.
- Elimina código muerto, imports sin uso y logs temporales introducidos durante la tarea.
12. Dependencias y herramientas
- Antes de instalar una dependencia, comprueba si el proyecto ya dispone de una herramienta equivalente.
- Prefiere dependencias mantenidas, conocidas y compatibles con la versión actual del stack.
- No añadas librerías para resolver tareas triviales que pueden implementarse de forma segura con APIs existentes.
- No actualices paquetes de forma masiva como parte de una tarea no relacionada.
- No ejecutes comandos destructivos ni modifiques archivos de configuración críticos sin explicar el motivo.
13. Reglas de interacción de Copilot
Cuando recibas una tarea:
1. Resume mentalmente el objetivo y localiza los archivos implicados.
2. Inspecciona el código antes de proponer una reestructuración.
3. Si hay varias soluciones, elige la más simple, segura y coherente con el proyecto.
4. Implementa el cambio completo, no solo una maqueta visual o un fragmento desconectado.
5. No inventes endpoints, campos de base de datos, componentes, variables de entorno ni contratos que no existan. Si hacen falta, créalos de forma consistente y actualiza sus consumidores.
6. No cambies tecnologías ni arquitectura por preferencia personal.
7. No elimines funcionalidades existentes para simplificar la implementación.
8. Si detectas una vulnerabilidad relevante, corrígela si está dentro del alcance; si no, informa claramente.
9. Si falta información esencial o existe riesgo de pérdida de datos, detente y pregunta.
10. Al finalizar, entrega un resumen breve con:
    - Archivos modificados.
    - Funcionalidad implementada.
    - Decisiones técnicas importantes.
    - Comandos de validación ejecutados y sus resultados.
    - Riesgos o tareas pendientes reales.
14. Criterio de aceptación
Una implementación se considera terminada únicamente cuando:
- Cumple el requisito solicitado.
- Se integra con la arquitectura existente.
- Tiene tipos y validaciones adecuados.
- Contempla errores y estados relevantes.
- No introduce vulnerabilidades conocidas ni expone datos de otros usuarios o empresas.
- Es responsive y accesible si incluye interfaz.
- No contiene código duplicado, innecesariamente complejo o ficticio.
- Pasa las validaciones disponibles o documenta claramente qué no pudo verificarse.
Regla final: escribe código que otro desarrollador pueda entender, revisar y mantener. La calidad no consiste en escribir más código ni en usar más patrones, sino en resolver correctamente el problema con la menor complejidad razonable.