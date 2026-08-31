import { api } from "../api";
import type { Book, Review } from "../types";
import { state } from "../state";
import { el, fmtAverage, renderError, card, riskLabel, riskClass } from "../ui";

export async function bookView(container: HTMLElement): Promise<void> {
  container.innerHTML = "";
  container.append(el("h2", {}, "Detalle de libro"));

  const actor = state.getActor();

  let books: Book[] = [];
  let currentBookId = "";

  const bookSelect = el("select", { class: "book-select" });
  const detail = el("div", { class: "detail-pane" });

  function renderDetail(): void {
    detail.innerHTML = "";
    const selected = books.find((b) => b.id === currentBookId);
    if (!selected) {
      detail.append(el("p", { class: "muted" }, "Seleccioná un libro."));
      return;
    }
    void renderBookInfo(detail, selected);
  }

  async function renderBookInfo(target: HTMLElement, book: Book): Promise<void> {
    try {
      const [bookRes, reviewsRes, fraudRes] = await Promise.all([
        api.book(book.id),
        api.bookReviews(book.id, false),
        api.fraudCheck(book.id),
      ]);
      const fullBook = bookRes.book;
      const reviews = reviewsRes.bookReviews;
      target.innerHTML = "";

      const info = el("div", { class: "book-info" });
      if (fullBook) {
        info.append(
          el("p", {}, `Autor: ${fullBook.authorName}`),
          el("p", { class: "avg" }, `Promedio: ${fmtAverage(fullBook.displayAverage)}`),
          el("p", {},
            "Riesgo: ",
            el("span", { class: `badge ${riskClass(fullBook.confidence)}` }, riskLabel(fullBook.confidence))),
          el("p", {}, `Reseñas: ${fullBook.cachedReviewsCount} total / ${fullBook.cachedNonBannedCount} válidas`)
        );
      }
      target.append(card("Información", info));

      if (fraudRes.fraudCheck) {
        const f = fraudRes.fraudCheck;
        target.append(
          card(
            "Fraud check",
            el("p", {},
              f.suspicious ? el("span", { class: "badge high" }, "Sospechoso") : el("span", { class: "badge low" }, "Normal"),
              ` — ${f.reason ?? "Sin anomalías"}`,
              ` (5★ ${pct(f.fiveStarRatio)}, cuentas recientes ${pct(f.recentAccountsRatio)})`
            )
          )
        );
      }

      const reviewList = el("ul", { class: "review-list" });
      if (reviews.length === 0) {
        reviewList.append(el("li", {}, "Sin reseñas visibles."));
      } else {
        for (const r of reviews) {
          reviewList.append(reviewItem(r, actor, () => renderBookInfo(target, book)));
        }
      }
      target.append(card("Reseñas visibles", reviewList));

      const canSeeHidden = actor.role === "admin" || actor.userName === book.authorName;
      if (canSeeHidden) {
        target.append(await hiddenReviewsPane(book.id, book.authorName, actor));
      }

      const alreadyReviewed = reviews.some((r) => r.user?.name === actor.userName);
      target.append(addReviewForm(book.id, actor.userId, actor.userName, alreadyReviewed, () =>
        renderBookInfo(target, book)));
    } catch (err) {
      renderError(target, err);
    }
  }

  async function loadBooks(): Promise<void> {
    try {
      const { topBooks } = await api.topBooks(200);
      books = topBooks;
      bookSelect.innerHTML = "";
      for (const b of books) {
        bookSelect.append(el("option", { value: b.id }, `#${b.id} ${b.title}`));
      }
      currentBookId = bookSelect.value || (books[0]?.id ?? "");
      renderDetail();
    } catch (err) {
      renderError(detail, err);
    }
  }

  bookSelect.addEventListener("change", () => {
    currentBookId = bookSelect.value;
    renderDetail();
  });

  container.append(card("Seleccionar libro", bookSelect), detail);
  await loadBooks();
}

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${(v * 100).toFixed(0)}%`;
}

function reviewItem(r: Review, actor: { userName: string }, refresh: () => Promise<void>): HTMLElement {
  const li = el("li", {}, `${"★".repeat(r.rating)} — ${r.user?.name ?? "?"}`);
  if (r.body) li.append(el("div", { class: "muted" }, r.body));
  if (r.hidden) li.append(el("span", { class: "badge high" }, "oculta"));

  const isMine = r.user?.name === actor.userName;
  if (isMine && !r.hidden) {
    const editBtn = el("button", { type: "button", class: "btn small" }, "Editar");
    const delBtn = el("button", { type: "button", class: "btn small danger" }, "Eliminar");
    const actions = el("div", { class: "actions", style: "margin:6px 0;" }, editBtn, delBtn);
    li.append(actions);

    editBtn.addEventListener("click", () => {
      li.innerHTML = "";
      li.append(editReviewForm(r, actor.userName, () => {
        li.replaceWith(reviewItem(r, actor, refresh));
      }, refresh));
    });

    delBtn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar tu reseña? Esta acción no se puede deshacer.")) return;
      const res = await api.deleteReview(r.id);
      if (res.deleteReview) await refresh();
    });
  }
  return li;
}

function editReviewForm(r: Review, userName: string, cancel: () => void, refresh: () => Promise<void>): HTMLElement {
  const rating = el("select", {}, ...["1", "2", "3", "4", "5"].map((v) => el("option", { value: v }, v)));
  rating.value = String(r.rating);
  const body = el("input", { type: "text", placeholder: "Texto (opcional, máx 1000)", value: r.body ?? "" });
  const saveBtn = el("button", { type: "button", class: "btn primary" }, "Guardar");
  const cancelBtn = el("button", { type: "button", class: "btn" }, "Cancelar");
  const msg = el("p", { class: "msg" });
  const form = el("div", { class: "review-form" },
    el("span", {}, `Editando (${userName}) `),
    rating, "★", body, saveBtn, cancelBtn, msg
  );

  saveBtn.addEventListener("click", async () => {
    msg.textContent = "";
    try {
      const res = await api.updateReview({
        id: r.id,
        rating: Number(rating.value),
        body: body.value || "",
      });
      if (res.updateReview) {
        msg.textContent = "Reseña actualizada.";
        await refresh();
      } else {
        msg.textContent = "No se pudo actualizar la reseña.";
      }
    } catch (err) {
      msg.textContent = err instanceof Error ? err.message : String(err);
    }
  });
  cancelBtn.addEventListener("click", cancel);
  return form;
}

/**
 * Panel colapsable de reseñas ocultas por moderación. Solo lo ve el admin o el
 * autor del libro. "Falsas" no es un estado individual: una reseña se oculta
 * porque su autor fue baneado por moderación (ban_reason) — acá se muestra ese motivo.
 */
async function hiddenReviewsPane(bookId: string, authorName: string, actor: { role: string; userName: string }): Promise<HTMLElement> {
  const box = el("div", { class: "card" });
  const actorOwnsBook = actor.userName === authorName;
  const toggle = el("button", { type: "button", class: "btn" }, "Ver reseñas ocultas por moderación");
  const content = el("div", { class: "detail-pane" });

  toggle.addEventListener("click", async () => {
    if (content.innerHTML !== "") {
      content.innerHTML = "";
      toggle.textContent = "Ver reseñas ocultas por moderación";
      return;
    }
    toggle.disabled = true;
    content.innerHTML = "Cargando...";
    try {
      const res = await api.moderationStatus(bookId);
      const m = res.moderationStatus;
      content.innerHTML = "";
      if (!m || m.hiddenCount === 0) {
        content.append(el("p", { class: "muted" }, "Sin reseñas ocultas en este libro."));
      } else {
        const list = el("ul", { class: "review-list" });
        for (const h of m.hiddenReviews) {
          list.append(
            el("li", {},
              el("strong", {}, `${"★".repeat(h.rating)} ${h.userName}`),
              h.banReason
                ? el("div", { class: "muted" }, `Motivo de moderación: ${h.banReason}`)
                : el("div", { class: "muted" }, "Sin motivo registrado")
            )
          );
        }
        content.append(
          el("p", { class: "muted" }, `${m.hiddenCount} reseña(s) ocultas en «${m.title}».`),
          list
        );
      }
      toggle.textContent = "Ocultar reseñas ocultas";
    } catch (err) {
      renderError(content, err);
    } finally {
      toggle.disabled = false;
    }
  });

  box.append(el("h3", { class: "card-title" }, "Moderación"),
    el("p", { class: "muted" },
      actorOwnsBook
        ? "Sos el autor de este libro. Las reseñas ocultas no se borran: pertenecen a usuarios baneados y conservan el motivo."
        : "Vista como admin. Las reseñas ocultas no se borran: pertenecen a usuarios baneados y conservan el motivo."),
    toggle, content);
  return box;
}

function addReviewForm(
  bookId: string,
  userId: string,
  userName: string,
  alreadyReviewed: boolean,
  refresh: () => Promise<void>
): HTMLElement {
  if (alreadyReviewed) {
    return card("Tu reseña", el("p", { class: "muted" },
      `Ya reseñaste este libro. Usá "Editar"/"Eliminar" en tu reseña de la lista de arriba (cada usuario puede dejar una sola reseña por libro).`));
  }

  const rating = el("select", {}, ...["1", "2", "3", "4", "5"].map((v) => el("option", { value: v }, v)));
  rating.value = "4";
  const body = el("input", { type: "text", placeholder: "Texto (opcional, máx 1000)" });
  const submit = el("button", { type: "button", class: "btn primary" }, "Crear reseña");
  const msg = el("p", { class: "msg" });
  const form = el("div", { class: "review-form" },
    el("span", {}, `Como ${userName} `),
    rating, "★", body, submit, msg
  );

  submit.addEventListener("click", async () => {
    msg.textContent = "";
    try {
      const res = await api.createReview({
        bookId,
        userId,
        rating: Number(rating.value),
        body: body.value || undefined,
      });
      if (res.createReview) {
        msg.textContent = `Reseña creada (id ${res.createReview.id}) y agregada a la lista abajo.`;
      } else {
        msg.textContent = "Ya tenés una reseña para este libro: cada usuario puede reseñar un libro una sola vez.";
      }
      body.value = "";
      await refresh();
    } catch (err) {
      msg.textContent = err instanceof Error ? err.message : String(err);
    }
  });

  return form;
}
