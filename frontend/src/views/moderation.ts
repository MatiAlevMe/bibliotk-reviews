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

  const logs = el("div", { class: "detail-pane" });
  container.append(card("Seleccionar usuario", userSelect), previewPane);

  async function refreshLogs(): Promise<void> {
    await renderLogs(logs);
  }

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
            await api.banUser({ userId: currentUserId, reason: "Reseñas falsas (campaña detectada)" });
            await Promise.all([renderPreview(), refreshLogs(), refreshUserList()]);
          }),
          actionButton("Desbanear", async () => {
            await api.unbanUser(currentUserId);
            await Promise.all([renderPreview(), refreshLogs(), refreshUserList()]);
          })
        )
      );
    } catch (err) {
      renderError(previewPane, err);
    }
  }

  async function refreshUserList(): Promise<void> {
    const current = currentUserId;
    const u = await api.user(current);
    if (u.user) {
      const opt = userSelect.querySelector<HTMLOptionElement>(`option[value="${current}"]`);
      if (opt) opt.textContent = `#${u.user.id} ${u.user.name}${u.user.banned ? " [baneado]" : ""}`;
    }
  }

  userSelect.addEventListener("change", () => {
    currentUserId = userSelect.value;
    void renderPreview();
  });

  const fraudPane = el("div", { class: "detail-pane" });
  const authorSelect = el("select", { class: "user-select" }, el("option", { value: "" }, "Elegí un autor…"));
  const checkBtn = el("button", { type: "button", class: "btn" }, "Analizar autor");
  checkBtn.disabled = true;
  const fraudResult = el("div", { class: "fraud-result" });

  // Poblarlo cuando se carguen los usuarios (autores → books/notificaciones).
  async function fillAuthors(): Promise<void> {
    try {
      const authorsSet = new Set<string>();
      const { topBooks } = await api.topBooks(200);
      for (const b of topBooks) authorsSet.add(b.authorName);
      authorSelect.innerHTML = "";
      authorSelect.append(el("option", { value: "" }, "Elegí un autor…"));
      for (const name of authorsSet) {
        authorSelect.append(el("option", { value: name }, name));
      }
      checkBtn.disabled = false;
    } catch {
      checkBtn.disabled = true;
    }
  }

  async function checkAuthor(): Promise<void> {
    const name = authorSelect.value;
    fraudResult.innerHTML = name ? "Analizando..." : "";
    if (!name) return;
    try {
      const { fraudAuthorAnomaly } = await api.fraudAuthorAnomaly(name);
      fraudResult.innerHTML = "";
      if (!fraudAuthorAnomaly) {
        fraudResult.append(el("p", { class: "muted" }, "Sin datos para el autor."));
        return;
      }
      if (fraudAuthorAnomaly.suspicious) {
        const flagged = fraudAuthorAnomaly.flaggedBooks ?? [];
        fraudResult.append(
          el("div", { class: "badge badge-danger" }, `Anomalía detectada en ${flagged.length} libro(s)`),
          el("ul", { class: "review-list" },
            ...flagged.map((b) => el("li", {}, `«${b.title}»: ${b.reason}`))
          )
        );
      } else {
        fraudResult.append(el("div", { class: "badge badge-ok" }, "Sin anomalías detectadas para este autor."));
      }
    } catch (err) {
      renderError(fraudResult, err);
    }
  }

  authorSelect.addEventListener("change", () => void checkAuthor());
  checkBtn.addEventListener("click", () => void checkAuthor());
  fraudPane.append(
    el("div", { class: "form-row" }, authorSelect, checkBtn),
    fraudResult
  );
  container.append(card("Detección de anomalías por autor (Fraude)", fraudPane));

  container.append(card("Auditoría de baneos", logs));
  await loadUsers();
  await fillAuthors();
  await refreshLogs();
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
