# PRODUCTO.md

## Decisión frente a los 5 mensajes de la primera semana

### 1. Moderación: "Necesito saber cuánto le va a mover el promedio a cada libro"

**Decisión: Implementar `banPreview`.**

Se expone un query GraphQL que calcula el impacto de banear a un usuario SIN modificar la base de datos. Recorre todas las reseñas del usuario, calcula el promedio proyectado para cada libro afectado, y devuelve un reporte con: libro, promedio actual, promedio proyectado, y delta.

**Costo:** O(n) donde n = número de reseñas del usuario. Para 4.000 reseñas es ~4ms. Si la arquitectura estuviera mal diseñada (recalculando desde la DB para cada libro), costaría ~4 segundos. Con los aggregates cacheados, es barato.

**Al autor:** No se le notifica nada antes del ban. La notificación llega después, cuando el ban ya se ejecutó.

### 2. Growth: "El cartel de 'Reseñas Insuficientes' nos está matando el click-through"

**Decisión: NO bajamos el umbral de 3 a 1.** En su lugar:

- En el **detalle del libro** (`book` query) se muestra el promedio siempre, incluyendo con 1 reseña.
- En el **top 50** se muestra `"Insuficientes"` si <3 reseñas, pero se ordena por average real.
- Se agrega campo `confidence`: `low` (1-2), `medium` (3-9), `high` (10+).

**Por qué no bajar el umbral:** Con 1 o 2 reseñas el promedio es estadísticamente inútil. Un libro con 1 reseña de 5★ no tiene "4.5 de promedio", tiene "1 persona le gustó". Mostrar el número sin contexto es peor que no mostrar nada. El campo `confidence` le da a Growth el dato para tomar decisiones (ej: mostrar el average con 2 reseñas si el confidence es `low`).

**Costo de no hacer nada:** Growth pierde click-through. Con esta solución ganan el dato sin perder credibilidad.

### 3. Autor: "Mi libro bajó de 4.6 a 2.3 y nadie me avisó"

**Decisión: Notificación automática al autor cuando se banea un usuario que reseñó su libro.**

Se crea un `ModerationNotification` con:
- Promedio anterior y nuevo
- Razón: "Tu libro tuvo un cambio en su calificación debido a la exclusión de reseñas por moderación de cuenta"
- Contacto de soporte

El autor puede consultar sus notificaciones via query `notifications(userId:)`.

**Costo:** Un `ModerationNotification.create!` por cada libro afectado. Si el usuario baneado reseñó 200 libros, son 200 inserts. Dentro de una transacción, es aceptable.

**Al autor:** No se le dice "compraste reseñas falsas". Se le dice "hubo un cambio por moderación". Esto es intencional: la moderación no acusa, informa.

### 4. Soporte: "Tengo 12 tickets preguntando por qué su reseña 'ya no aparece'"

**Decisión: Las reseñas NO desaparecen, quedan `hidden: true`.**

- El usuario que escribió la reseña ve en su perfil: "Tu reseña está ocultada por moderación"
- Soporte puede ver reseñas ocultas con el motivo via query `moderationStatus(bookId:)`
- No hay tickets de "¿dónde está mi reseña?" porque técnicamente no desaparece

**Por qué esta decisión:** La alternativa (borrar la reseña) crea un黑洞 de información. El usuario no sabe qué pasó, soporte no puede responder, y el autor no sabe por qué bajó el promedio. Con `hidden: true` todos los actores tienen visibilidad.

### 5. Dirección: "Que no se vuelva a repetir"

**Decisión: 3 métricas definidas + rake task de backfill.**

**Métricas (definidas, no implementadas):**
1. Reviews/min por libro → alerta si >50 en 1 hora → Moderación
2. Average delta por libro → alerta si cambia >1.0 en 24h → Moderación
3. Ratio banned/total reviewers → alerta si >5% en 7 días → Growth

**Backfill:** Rake task `db:seed:recalculate_all` que recalcula todos los promedios desde cero. Se ejecuta después de un ban masivo o periódicamente como insurance.

**Mientras corre el backfill:** El sistema sigue con los datos viejos. Se actualizan de a uno. No hay downtime.

---

## A cuál le dije que no

**Al umbral de 3 reseñas (Growth).** No lo bajé a 1 porque un promedio con 1-2 reseñas es engañoso. Un libro con 1 reseña de 5★ no tiene "5 estrellas", tiene "una persona lo liked". La solución fue dar a Growth el dato (confidence) para que tome su propia decisión, sin comprometer la integridad del promedio.

---

## Métricas o eventos definidos

| Métrica | Umbral | Acción | Quién la mira |
|---------|--------|--------|---------------|
| Reviews/min por libro | >50 en 1 hora | Alertar a moderación | Moderación |
| Average delta por libro | >1.0 en 24h | Alertar a moderación | Moderación |
| Ratio banned/total reviewers | >5% en 7 días | Alertar a growth | Growth |

---

## Plan para promedios corruptos en producción

1. **Rake task `recalculate_all`:** Recalcula todos los `cached_average` desde las reseñas reales
2. **Orden:** Se ejecuta en background, libros de a uno, con logging de cambios
3. **Comunicación:** Se genera un reporte de qué libros cambiaron y por cuánto
4. **Mientras corre:** El sistema sigue operativo con datos viejos

---

## Cambiaría si esto fuera mi producto

**El umbral de 3 reseñas.** Lo cambiaría a un sistema de confianza dinámico: si el libro tiene <5 reseñas, el promedio se muestra con un asterisco y tooltip "Promedio basado en pocas reseñas". Esto le da al usuario la información completa y le permite decidir si confía o no. El umbral fijo de 3 es una simplificación útil para este challenge, pero en producción_prefiero la transparencia.

**El redondeo half-up.** Lo mantengo. Es el estándar y no hay razón para cambiarlo.

**La regla de baneos.** Agregaría un "período de gracia" de 24 horas donde las reseñas del usuario baneado se ocultan pero no se excluyen del promedio. Esto da tiempo a que otros usuarios reporten el contenido antes de que afecte los promedios.

---

## Soporte de testing y demo (no es requisito del brief)

Aunque el brief sólo pide backend, se agregó una capa de validación manual:

- **Demo web interactivo** (`frontend/`, Vite + TypeScript): switcheo de roles (Admin/Autor/Lector) para probar cada decisión de producto (ban preview, ban/unban, reseñas ocultas, notificaciones) con cambios reales en la BD de desarrollo.
- **Reset a fábrica** (`db:reset_demo`, dev/test-only): destruir y recrear la BD (drop + create + migrate + seed) para no quedarse "stuck" después de probar cosas destructivas.
- **CI determinístico**: la BD de test se recrea en cada ejecución, por lo que borrar datos en una prueba no contamina la siguiente.
