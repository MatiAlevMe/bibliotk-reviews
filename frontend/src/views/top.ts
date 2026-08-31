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

    let hideInsufficient = false;
    let selectedRisk = "all"; // "all" | "low" | "medium" | "high"

    // Controles de filtrado
    const filterControls = el("div", { class: "filter-controls card", style: "display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 16px; padding: 12px 16px;" });

    const hideInsufficientLabel = el("label", { style: "display: flex; align-items: center; gap: 6px; cursor: pointer;" });
    const hideInsufficientCheckbox = el("input", { type: "checkbox" }) as HTMLInputElement;
    hideInsufficientLabel.append(hideInsufficientCheckbox, "Esconder libros con reseñas insuficientes (< 3)");

    const riskFilterWrap = el("div", { style: "display: flex; align-items: center; gap: 8px;" });
    const riskSelect = el("select", { class: "risk-select" },
      el("option", { value: "all" }, "Todos los niveles de riesgo"),
      el("option", { value: "low" }, "Solo Riesgo Bajo (10+ reseñas)"),
      el("option", { value: "medium" }, "Solo Riesgo Medio (3-9 reseñas)"),
      el("option", { value: "high" }, "Solo Riesgo Alto (1-2 reseñas)")
    ) as HTMLSelectElement;
    riskFilterWrap.append(el("span", { class: "muted" }, "Nivel de riesgo:"), riskSelect);

    filterControls.append(hideInsufficientLabel, riskFilterWrap);

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
    table.append(tbody);

    const countInfo = el("p", { class: "muted" });

    function renderFilteredRows() {
      tbody.innerHTML = "";
      const filtered = topBooks.filter((b) => {
        if (hideInsufficient && b.cachedNonBannedCount < 3) {
          return false;
        }
        if (selectedRisk !== "all" && b.confidence !== selectedRisk) {
          return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        tbody.append(el("tr", {}, el("td", { colspan: "6", style: "text-align:center; padding: 16px;" }, "No hay libros que coincidan con los filtros seleccionados.")));
      } else {
        filtered.forEach((b, i) => tbody.append(bookRow(i + 1, b)));
      }

      countInfo.textContent = `Mostrando ${filtered.length} de ${topBooks.length} libros en el catálogo.`;
    }

    hideInsufficientCheckbox.addEventListener("change", () => {
      hideInsufficient = hideInsufficientCheckbox.checked;
      renderFilteredRows();
    });

    riskSelect.addEventListener("change", () => {
      selectedRisk = riskSelect.value;
      renderFilteredRows();
    });

    renderFilteredRows();

    container.append(
      filterControls,
      table,
      countInfo
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
