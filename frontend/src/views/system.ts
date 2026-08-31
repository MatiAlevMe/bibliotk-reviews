import { el, card } from "../ui";
import { MOCK_MODE } from "../api";
import { resetMockData } from "../mock-client";

export function systemView(container: HTMLElement): void {
  container.innerHTML = "";
  container.append(el("h2", {}, "Sistema y base de datos"));

  if (MOCK_MODE) {
    const mockMsg = el("p", { class: "msg" });
    const resetBtn = el("button", { type: "button", class: "btn danger" }, "Reiniciar datos a fábrica (Mock)");
    resetBtn.addEventListener("click", () => {
      resetMockData();
      mockMsg.textContent = "¡Datos simulados reiniciados al estado inicial de fábrica!";
      setTimeout(() => {
        mockMsg.textContent = "";
      }, 3000);
    });

    container.append(
      card(
        "Modo Offline / Mock Activo",
        el("div", {},
          el("p", { class: "muted" },
            "La demo está corriendo en modo estático en Vercel (sin backend Rails conectado). Las operaciones ocurren en memoria durante tu sesión."),
          el("div", { class: "actions" }, resetBtn),
          mockMsg
        )
      )
    );
  }

  const env = el("table");
  env.append(
    el("thead", {}, el("tr", {},
      el("th", {}, "Ambiente"), el("th", {}, "Dónde"), el("th", {}, "¿Reset a fábrica?"), el("th", {}, "Demo"))
    ),
    el("tbody", {},
      row("dev", "Tu máquina (localhost:3000)", "Sí — db:reset_demo", "Sí, backend real"),
      row("test (CI/CD)", "GitHub Actions (por ejecución)", "Sí — BD efímera, se recrea cada run", "No"),
      row("prod (Vercel)", "Vercel Demo", "Sí — Botón en memoria (mock)", "Sí, modo mock/offline")
    )
  );
  container.append(card("Ambientes", env));

  const cmd = "npm run db:reset";
  const code = el("code", { class: "code" }, cmd);
  const copyBtn = el("button", { type: "button", class: "btn" }, "Copiar comando");
  const msg = el("p", { class: "msg" });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      msg.textContent = "Comando copiado.";
    } catch {
      msg.textContent = cmd;
    }
  });

  container.append(
    card(
      "Regenerar base de datos backend (CLI para localhost)",
      el("div", {},
        el("p", { class: "muted" },
          "Para un backend real en desarrollo local, ejecutá este comando desde la carpeta `frontend/` en tu terminal. " +
          "Detiene la BD actual (drop), la recrea, corre migraciones y el seed. Solo disponible en dev/test, nunca en producción."),
        code,
        el("div", { class: "actions" }, copyBtn),
        msg
      )
    ),
    card("¿Y si borré todo y me quedé trabado?",
      el("p", {}, "No podés quedar en un loop: en mock podés presionar el botón de reinicio arriba, y en dev `" + cmd + "` restaura la BD."))
  );

  void el;
}

function row(...cells: string[]): HTMLElement {
  return el("tr", {}, ...cells.map((c) => el("td", {}, c)));
}

