import { api } from "../api";
import type { Book, Review } from "../types";
import { state } from "../state";
import { el, fmtAverage, renderError, card } from "../ui";

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
    void renderBookInfo(detail, selected.id);
  }

  async function renderBookInfo(target: HTMLElement, bookId: string): Promise<void> {
    try {
      const [bookRes, reviewsRes, fraudRes] = await Promise.all([
        api.book(bookId),
        api.bookReviews(bookId, false),
        api.fraudCheck(bookId),
      ]);
      const book = bookRes.book;
      const reviews = reviewsRes.bookReviews;
      target.innerHTML = "";

      const info = el("div", { class: "book-info" });
      if (book) {
        info.append(
          el("p", {}, `Autor: ${book.authorName}`),
          el("p", { class: "avg" }, `Promedio: ${fmtAverage(book.displayAverage)}`),
          el("p", {}, `Confianza: `, el("span", { class: `badge ${book.confidence}` }, book.confidence)),
          el("p", {}, `Reseñas: ${book.cachedReviewsCount} total / ${book.cachedNonBannedCount} válidas`)
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
          reviewList.append(reviewItem(r));
        }
      }
      target.append(card("Reseñas visibles", reviewList));

      target.append(addReviewForm(bookId, actor.userId, actor.userName, refresh));
    } catch (err) {
      renderError(target, err);
    }
  }

  async function refresh(): Promise<void> {
    await renderBookInfo(detail, currentBookId);
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

function reviewItem(r: Review): HTMLElement {
  const li = el("li", {}, `${"★".repeat(r.rating)} — ${r.user?.name ?? "?"}`);
  if (r.body) li.append(el("div", { class: "muted" }, r.body));
  if (r.hidden) li.append(el("span", { class: "badge high" }, "oculta"));
  return li;
}

function addReviewForm(
  bookId: string,
  userId: string,
  userName: string,
  refresh: () => Promise<void>
): HTMLElement {
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
      msg.textContent = res.createReview
        ? `Reseña creada (id ${res.createReview.id}).`
        : "No se pudo crear (¿ya tenés una reseña para este libro?).";
      body.value = "";
      await refresh();
    } catch (err) {
      msg.textContent = err instanceof Error ? err.message : String(err);
    }
  });

  return form;
}
