import type { Role, ViewId } from "./types";
import { state } from "./state";
import { el } from "./ui";
import { MOCK_MODE } from "./api";
import { resetMockData } from "./mock-client";
import { topView } from "./views/top";
import { bookView } from "./views/book";
import { moderationView } from "./views/moderation";
import { authorView } from "./views/author";
import { systemView } from "./views/system";
import { loginView } from "./views/login";

const root = document.getElementById("app")!;

function currentViewForRole(role: Role): ViewId {
  const view = state.getView();
  if (view === "moderation" && role !== "admin") return "top";
  if (view === "author" && role !== "author") return "top";
  return view;
}

function render(): void {
  const actor = state.getActor();
  root.innerHTML = "";

  const titleGroup = el("div", {},
    el("strong", {}, "Bibliotk Reviews Demo"),
    MOCK_MODE ? el("span", { class: "badge low", style: "margin-left: 8px;" }, "Offline Mock") : ""
  );

  const headerControls = el("span", { class: "actor" }, `${actor.role} · ${actor.userName}`);
  if (MOCK_MODE) {
    const resetBtn = el("button", { type: "button", class: "btn small" }, "Reiniciar demo");
    const resetMsg = el("span", { class: "msg" });
    resetBtn.addEventListener("click", () => {
      resetMockData();
      resetMsg.textContent = "Datos mock reiniciados a fábrica";
      setTimeout(() => { resetMsg.textContent = ""; }, 2500);
    });
    headerControls.append(" ", resetBtn, resetMsg);
  }

  root.append(
    el("header", { class: "topbar" },
      titleGroup,
      headerControls
    )
  );

  const nav = el("nav", { class: "nav" });
  const links: Array<[ViewId, string, boolean]> = [
    ["login", "Roles", true],
    ["top", "Top 50", true],
    ["book", "Libro", true],
    ["moderation", "Moderación", actor.role === "admin"],
    ["author", "Panel autor", actor.role === "author"],
    ["system", "Sistema", true],
  ];
  for (const [view, label, allowed] of links) {
    const btn = el("button", { type: "button", class: "nav-btn" }, label);
    if (!allowed) btn.disabled = true;
    btn.addEventListener("click", () => {
      state.setView(view);
      render();
    });
    nav.append(btn);
  }
  root.append(nav);

  const content = el("main", { class: "content" });
  root.append(content);

  const view = currentViewForRole(actor.role);
  (async () => {
    switch (view) {
      case "login":
        loginView(content, () => {
          state.setView("top");
          render();
        });
        break;
      case "top":
        await topView(content);
        break;
      case "book":
        await bookView(content);
        break;
      case "moderation":
        await moderationView(content);
        break;
      case "author":
        await authorView(content);
        break;
      case "system":
        systemView(content);
        break;
    }
  })();
}

render();
