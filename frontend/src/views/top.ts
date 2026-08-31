import { api } from "../api";
import type { Book } from "../types";
import { el, fmtAverage, renderError, riskLabel, riskClass } from "../ui";
import { state } from "../state";

export async function topView(container: HTMLElement): Promise<void> {
  container.innerHTML = "";
  container.append(el("h2", {}, "Top 50 libros"));

  try {
    const { topBooks } = await api.topBooks(50);
    await renderMyNotifications(container);
    const table = el("table");
    const head = el("thead");
    head.append(
      el("tr", {},
        el("th", {}, "#"),
        el("th", {}, "Título"),
        el("th", {}, "Autor"),
        el("th", {}, "Promedio"),
        el("th", {}, "Riesgo"),
        el("th", {}, "Reseñas")
      )
    );
    table.append(head);
    const tbody = el("tbody");
    topBooks.forEach((b, i) => tbody.append(bookRow(i + 1, b)));
    table.append(tbody);
    container.append(
      table,
      el("p", { class: "muted" }, `${topBooks.length} libros en el catálogo mock (el backend real lista los mejores 50).`)
    );
  } catch (err) {
    renderError(container, err);
  }
}

async function renderMyNotifications(container: HTMLElement): Promise<void> {
  const actor = state.getActor();
  if (actor.role === "admin") return;

  const { user } = await api.user(actor.userId);
  const banned = !!user?.banned;

  if (banned) {
    container.append(el("div", { class: "card" },
      el("h3", { class: "card-title" }, "Tu cuenta fue baneada"),
      el("p", {},
        el("span", { class: "badge high" }, "Baneado"),
        user?.banReason ? ` Motivo: ${user.banReason}` : " Sin motivo especificado."),
      el("p", { class: "muted" },
        "Todas tus reseñas quedaron ocultas por moderación y ya no cuentan para el promedio de los libros.",
        " Si creés que es un error, escribinos a ",
        el("strong", {}, "soporte@bibliotk.com"),
        " para apelar la decisión.")
    ));
  }

  if (actor.role === "author") return;

  const { notifications } = await api.notifications(actor.userId);
  if (notifications.length === 0) return;

  const list = el("ul", { class: "review-list" });
  for (const n of notifications) {
    list.append(
      el("li", {},
        el("strong", {}, `«${n.book?.title ?? "?"}» ${n.previousAverage.toFixed(1)} → ${n.newAverage.toFixed(1)}`),
        el("div", { class: "muted" }, n.reason)
      )
    );
  }
  container.append(
    el("div", { class: "card" },
      el("h3", { class: "card-title" }, banned ? "Tus reseñas ocultas" : "Sobre tus reseñas"),
      list
    )
  );
}

function bookRow(index: number, b: Book): HTMLElement {
  return el("tr", {},
    el("td", {}, String(index)),
    el("td", {}, b.title),
    el("td", { class: "muted" }, b.authorName),
    el("td", { class: "avg" }, fmtAverage(b.displayAverage)),
    el("td", {}, el("span", { class: `badge ${riskClass(b.confidence)}` }, riskLabel(b.confidence))),
    el("td", {}, `${b.cachedReviewsCount} (${b.cachedNonBannedCount} visibles)`)
  );
}
