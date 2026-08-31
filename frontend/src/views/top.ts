import { api } from "../api";
import type { Book } from "../types";
import { el, fmtAverage, renderError, riskLabel, riskClass } from "../ui";

export async function topView(container: HTMLElement): Promise<void> {
  container.innerHTML = "";
  container.append(el("h2", {}, "Top 50 libros"));

  try {
    const { topBooks } = await api.topBooks(50);
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
