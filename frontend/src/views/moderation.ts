import { api } from "../api";
import type { BanImpact, User } from "../types";
import { el, renderError, card } from "../ui";

export async function moderationView(container: HTMLElement): Promise<void> {
  container.innerHTML = "";
  container.append(el("h2", {}, "Moderación"));

  const previewPane = el("div", { class: "detail-pane" });
  let currentUserId = "";

  const userSelect = el("select", { class: "user-select" });
  let users: User[] = [];

  async function loadUsers(): Promise<void> {
    try {
      const ids = Array.from({ length: 56 }, (_, i) => String(i + 1));
      const fetched = await Promise.all(ids.map((id) => api.user(id)));
      users = fetched
        .map((r) => r.user)
        .filter((u): u is User => !!u);
      userSelect.innerHTML = "";
      for (const u of users) {
        userSelect.append(
          el("option", { value: u.id }, `#${u.id} ${u.name}${u.banned ? " [baneado]" : ""}`)
        );
      }
      currentUserId = userSelect.value || users[0]?.id || "";
      await renderPreview();
    } catch (err) {
      renderError(previewPane, err);
    }
  }

  async function renderPreview(): Promise<void> {
    previewPane.innerHTML = "";
    if (!currentUserId) {
      previewPane.append(el("p", { class: "muted" }, "Seleccioná un usuario."));
      return;
    }
    try {
      const res = await api.banPreview(currentUserId);
      const impact = res.banPreview;
      if (!impact) {
        previewPane.append(el("p", { class: "muted" }, "Usuario no encontrado."));
        return;
      }
      previewPane.append(
        el("h3", {}, `Usuario: ${impact.userName}`),
        el("p", {}, `Reseñas: ${impact.totalReviews} · Libros afectados: ${impact.booksAffected}`)
      );
      const table = el("table");
      table.append(
        el("thead", {}, el("tr", {},
          el("th", {}, "Libro"), el("th", {}, "Actual"), el("th", {}, "Proyectado"), el("th", {}, "Delta"))),
        impactTable(impact)
      );
      previewPane.append(table);

      previewPane.append(
        el("div", { class: "actions" },
          actionButton("Banear", async () => {
            await api.banUser({ userId: currentUserId, reason: "Reseñas falsas" });
            await renderPreview();
          }),
          actionButton("Desbanear", async () => {
            await api.unbanUser(currentUserId);
            await renderPreview();
          })
        )
      );
    } catch (err) {
      renderError(previewPane, err);
    }
  }

  userSelect.addEventListener("change", () => {
    currentUserId = userSelect.value;
    void renderPreview();
  });

  container.append(card("Seleccionar usuario", userSelect), previewPane);

  const fraudPane = el("div", { class: "detail-pane" });
  const authorInput = el("input", { type: "text", class: "input", placeholder: "Ej. Gabriel García Márquez", value: "Gabriel García Márquez" });
  const checkBtn = el("button", { type: "button", class: "btn" }, "Analizar autor");
  const fraudResult = el("div", { class: "fraud-result" });

  async function checkAuthor(): Promise<void> {
    fraudResult.innerHTML = "Analizando...";
    try {
      const { fraudAuthorAnomaly } = await api.fraudAuthorAnomaly(authorInput.value.trim());
      fraudResult.innerHTML = "";
      if (!fraudAuthorAnomaly) {
        fraudResult.append(el("p", { class: "muted" }, "Sin datos para el autor."));
        return;
      }
      if (fraudAuthorAnomaly.suspicious) {
        const flagged = fraudAuthorAnomaly.flaggedBooks ?? [];
        fraudResult.append(
          el("div", { class: "badge badge-danger" }, `⚠️ Anomalía detectada en ${flagged.length} libro(s)`),
          el("ul", { class: "review-list" },
            ...flagged.map((b) => el("li", {}, `«${b.title}»: ${b.reason}`))
          )
        );
      } else {
        fraudResult.append(el("div", { class: "badge badge-ok" }, "✓ Sin anomalías detectadas para este autor."));
      }
    } catch (err) {
      renderError(fraudResult, err);
    }
  }

  checkBtn.addEventListener("click", () => void checkAuthor());
  fraudPane.append(
    el("div", { class: "form-row" }, authorInput, checkBtn),
    fraudResult
  );
  container.append(card("Detección de anomalías por autor (Fraude)", fraudPane));

  const logs = el("div", { class: "detail-pane" });
  container.append(card("Auditoría de baneos", logs));
  await loadUsers();
  await renderLogs(logs);
  await checkAuthor();
}

async function renderLogs(target: HTMLElement): Promise<void> {
  try {
    const { banLogs } = await api.banLogs(10);
    target.innerHTML = "";
    const list = el("ul", { class: "review-list" });
    if (banLogs.length === 0) list.append(el("li", {}, "Sin registros."));
    for (const l of banLogs) {
      list.append(
        el("li", {},
          `${l.createdAt ?? ""} — ${l.user?.name ?? "?"} ${l.action} — ${l.booksAffected} libros (${l.performedBy ?? "system"})`)
      );
    }
    target.append(list);
  } catch (err) {
    renderError(target, err);
  }
}

function impactTable(impact: BanImpact): HTMLElement {
  const tbody = el("tbody");
  for (const d of impact.details) {
    tbody.append(
      el("tr", {},
        el("td", {}, d.title),
        el("td", {}, d.currentAverage.toFixed(1)),
        el("td", {}, d.projectedAverage.toFixed(1)),
        el("td", {}, d.delta >= 0 ? `+${d.delta.toFixed(2)}` : d.delta.toFixed(2))
      )
    );
  }
  return tbody;
}

function actionButton(label: string, onClick: () => Promise<void>): HTMLButtonElement {
  const btn = el("button", { type: "button", class: "btn danger" }, label);
  btn.addEventListener("click", () => void onClick());
  return btn;
}
