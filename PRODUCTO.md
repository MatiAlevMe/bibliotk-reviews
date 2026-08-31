# Decisiones de Producto — Bibliotk

Este documento resume las decisiones estratégicas de producto frente a los desafíos planteados en la plataforma, redactado con foco en negocio, usuarios y operaciones sin requerir lectura técnica del código fuente.

---

## 1. Respuesta a los 5 Mensajes de la Primera Semana

### Moderación: "¿Cuánto le va a mover el promedio a cada libro antes de banear?"

**Decisión:** Se implementó una herramienta de previsualización de impacto sin escritura (`banPreview`).
Antes de aplicar un baneo sobre un usuario con miles de reseñas, el moderador puede simular el resultado exacto: cuántos libros se verán afectados, cuál es el promedio actual de cada uno y cuál será su puntaje proyectado tras la exclusión. Esto transforma una acción que antes se ejecutaba a ciegas en una decisión informada y predecible, mitigando reclamos posteriores tanto de autores como de la comunidad.

### Growth: "El cartel de 'Reseñas Insuficientes' en la home nos mata el click-through"

**Decisión: Le decimos que NO a bajar el umbral de 3 reseñas.**
Promediar 1 o 2 reseñas no representa la calidad de una obra; un único puntaje de 5 estrellas solo refleja la opinión aislada de una persona y deteriora la credibilidad de toda la plataforma. Para conciliar la necesidad de Growth sin engañar al lector, adoptamos una estrategia dual:

- **En la Home (Top 50):** Se mantiene el rótulo "Reseñas Insuficientes" cuando hay menos de 3 opiniones, pero el ranking ordena internamente por el promedio real. Además, se ofrecen controles para ocultar libros con datos insuficientes y filtrar por nivel de riesgo estadístico (Bajo, Medio, Alto).
- **En el Detalle del Libro:** Se muestra siempre el promedio numérico exacto (incluso con 1 o 2 reseñas), acompañado de un distintivo explícito de "Reseñas insuficientes" y su indicador de riesgo. Así el lector que busca profundidad obtiene el dato con su contexto correspondiente.

### Autor: "Mi libro bajó de 4.6 a 2.3 de un día para otro y nadie me avisó"

**Decisión:** Notificaciones automáticas de moderación transparentes y no acusatorias.
Cuando un baneo masivo excluye reseñas y modifica el promedio de una obra, el sistema genera automáticamente una notificación privada en el panel del autor con el promedio anterior, el nuevo puntaje resultante y un canal directo de contacto con soporte. El mensaje no formula acusaciones ("compraste reseñas falsas"), sino que informa con sobriedad que hubo un ajuste por moderación de cuentas, reduciendo la fricción y el desconcierto.

### Soporte: "12 tickets preguntando por qué la reseña 'ya no aparece'"

**Decisión:** Las reseñas nunca se borran físicamente; se ocultan (`hidden`) y se notifica al usuario.
Borrar registros crea un vacío de información donde el usuario desconoce lo ocurrido y soporte no puede auditar el caso. Al preservar la reseña como oculta, el usuario baneado o moderado visualiza en su interfaz un aviso claro explicando que su reseña fue excluida por moderación con el motivo correspondiente e instrucciones para apelar ante soporte. Paralelamente, el equipo de soporte y el autor pueden consultar el histórico de reseñas ocultas en cada libro.

### Dirección: "Que no se vuelva a repetir"

**Decisión:** Señales preventivas de anomalías y procedimiento de remediación en frío.
Se establecieron tres señales automatizadas para detectar campañas de manipulación en tiempo real y un protocolo de recálculo masivo (backfill) para sincronizar promedios históricos sin interrumpir el servicio a los usuarios.

---

## 2. A Cuál le Dijimos que NO y Por Qué

**Le dijimos que NO a Growth en su pedido de bajar el umbral en el listado principal.** Ceder a mostrar promedios inflados de 5.0 con una sola reseña artificial incentiva directamente la creación de cuentas falsas para posicionarse en los primeros lugares del catálogo. La credibilidad del motor de calificación es el activo más valioso de Bibliotk; protegerla mediante indicadores de riesgo y umbrales claros garantiza un crecimiento sostenible a largo plazo.

---

## 3. Señales y Métricas de Salud del Motor

Para garantizar la salud de la plataforma y detectar campañas fraudulentas mientras ocurren, definimos tres señales clave:

1. **Ráfaga de reseñas por libro (Reviews / hora):** Alerta a **Moderación** si un libro supera 50 reseñas en menos de 1 hora. Permite detectar compras masivas de reseñas antes de que distorsionen el catálogo.
2. **Variación abrupta del promedio (Delta en 24h):** Alerta a **Moderación** si la calificación de un libro oscila más de 1.0 punto en un solo día, señalando posibles ataques organizados o campañas de desprestigio.
3. **Ratio de revisores baneados sobre activos:** Alerta a **Growth y Producto** si más del 5% de los usuarios que reseñaron en los últimos 7 días terminan baneados, indicando vulnerabilidades en el registro de cuentas o granjas de bots activas.

---

## 4. Plan de Remediación para Promedios en Producción

Frente a libros con promedios desactualizados o manipulados en el pasado:

- **Ejecución en segundo plano:** Un proceso de mantenimiento recalcula los agregados matemáticos libro por libro desde las reseñas legítimas activas, registrando los deltas detectados.
- **Continuidad operativa:** El catálogo permanece disponible en todo momento leyendo los valores previos hasta que cada obra es actualizada de forma atómica.
- **Comunicación transparente:** Finalizado el proceso, se emite un reporte a soporte con los títulos corregidos y se despachan las notificaciones automáticas a los autores cuyos promedios variaron.

---

## 5. Qué Cambiaría si Fuera mi Producto a Gran Escala

Si Bibliotk evolucionara hacia un producto de millones de usuarios en producción, implementaría dos cambios estructurales:

1. **Puntaje Ponderado Bayesiano (Weighted Rating):** En lugar de un corte rígido de 3 reseñas, utilizaría un algoritmo bayesiano (similar al estándar de IMDb) que pondera la calificación hacia la media global de la plataforma mientras el volumen de reseñas sea bajo. Esto permite rankear de forma justa obras nuevas sin exponerlas a la volatilidad de calificaciones únicas.
2. **Ponderación por Reputación y Antigüedad del Lector (Karma/Lectura Verificada):** Asignar mayor peso en el promedio a usuarios con trayectoria comprobada y compras verificadas frente a cuentas recién creadas. Esto neutraliza de raíz el impacto de ataques de ráfaga y bots, permitiendo que el sistema se autorregule incluso antes de la intervención de los moderadores.
3. **La regla de baneos.** Agregaría un "período de gracia" de 24 horas donde las reseñas del usuario baneado se ocultan pero no se excluyen del promedio. Esto da tiempo a que otros usuarios reporten el contenido antes de que afecte los promedios.
