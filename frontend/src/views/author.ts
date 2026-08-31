import { api } from "../api";
import { state } from "../state";
import { el, renderError } from "../ui";

export async function authorView(container: HTMLElement): Promise<void> {
  container.innerHTML = "";
  container.append(el("h2", {}, "Panel del autor"));

  const actor = state.getActor();
  const pane = el("div", { class: "detail-pane" });
  container.append(pane);

  try {
    const { user } = await api.user(actor.userId);
    if (user?.banned) {
      pane.append(el("div", { class: "card" },
        el("h3", { class: "card-title" }, "Tu cuenta fue baneada"),
        el("p", {},
          el("span", { class: "badge high" }, "Baneado"),
          user.banReason ? ` Motivo: ${user.banReason}` : " Sin motivo especificado."),
        el("p", { class: "muted" },
          "Todas tus reseñas quedaron ocultas por moderación y ya no cuentan para el promedio de los libros.",
          " Si creés que es un error, escribinos a ",
          el("strong", {}, "soporte@bibliotk.com"),
          " para apelar la decisión.")
      ));
    }

    const { notifications } = await api.notifications(actor.userId);
    pane.append(el("h3", {}, "Notificaciones de moderación"));
    const list = el("ul", { class: "review-list" });
    if (notifications.length === 0) {
      list.append(el("li", {}, "Sin notificaciones."));
    }
    for (const n of notifications) {
      list.append(
        el("li", {},
          el("strong", {}, `«${n.book?.title ?? "?"}» ${n.previousAverage.toFixed(1)} → ${n.newAverage.toFixed(1)}`),
          el("div", { class: "muted" }, n.reason)
        )
      );
    }
    pane.append(list);

    const books = await authorBooks();
    for (const book of books) {
      try {
        const res = await api.moderationStatus(book.id);
        if (!res.moderationStatus) continue;
        const m = res.moderationStatus;
        pane.append(
          el("h3", {}, `Reseñas ocultas de «${m.title}» (${m.hiddenCount})`),
          hiddenList(m)
        );
      } catch {
        /* ignorar libros sin datos */
      }
    }
  } catch (err) {
    renderError(pane, err);
  }
}

function hiddenList(m: { hiddenReviews: Array<{ id: string; userName: string; rating: number; banReason: string | null }> }): HTMLElement {
  const list = el("ul", { class: "review-list" });
  if (m.hiddenReviews.length === 0) list.append(el("li", {}, "Ninguna."));
  for (const h of m.hiddenReviews) {
    list.append(
      el("li", {},
        `#${h.id} ${"★".repeat(h.rating)} ${h.userName} — ${h.banReason ?? "sin motivo"}`)
    );
  }
  return list;
}

async function authorBooks(): Promise<Array<{ id: string }>> {
  const { topBooks } = await api.topBooks(200);
  return topBooks;
}
