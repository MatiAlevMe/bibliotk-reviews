import { api } from "../api";
import type { Book } from "../types";
import { el, fmtAverage, renderError } from "../ui";

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
        el("th", {}, "Promedio"),
        el("th", {}, "Confianza"),
        el("th", {}, "Reseñas")
      )
    );
    table.append(head);
    const tbody = el("tbody");
    topBooks.forEach((b, i) => tbody.append(bookRow(i + 1, b)));
    table.append(tbody);
    container.append(table);
  } catch (err) {
    renderError(container, err);
  }
}

function bookRow(index: number, b: Book): HTMLElement {
  return el("tr", {},
    el("td", {}, String(index)),
    el("td", {}, b.title),
    el("td", { class: "avg" }, fmtAverage(b.displayAverage)),
    el("td", {}, el("span", { class: `badge ${b.confidence}` }, b.confidence)),
    el("td", {}, `${b.cachedReviewsCount} (${b.cachedNonBannedCount} visibles)`)
  );
}
