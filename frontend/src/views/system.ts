import { el, card } from "../ui";

export function systemView(container: HTMLElement): void {
  container.innerHTML = "";
  container.append(el("h2", {}, "Sistema y base de datos"));

  const env = el("table");
  env.append(
    el("thead", {}, el("tr", {},
      el("th", {}, "Ambiente"), el("th", {}, "Dónde"), el("th", {}, "¿Reset a fábrica?"), el("th", {}, "Demo"))
    ),
    el("tbody", {},
      row("dev", "Tu máquina (localhost:3000)", "Sí — db:reset_demo", "Sí, apunta aquí"),
      row("test (CI/CD)", "GitHub Actions (por ejecución)", "Sí — BD efímera, se recrea cada run", "No"),
      row("prod", "Deploy futuro", "No", "No")
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
      "Regenerar base de datos (volver a fábrica)",
      el("div", {},
        el("p", { class: "muted" },
          "Ejecutá este comando desde la carpeta `frontend/` en tu terminal. " +
          "Detiene la BD actual (drop), la recrea, corre migraciones y el seed. Solo disponible en dev/test, nunca en producción."),
        code,
        el("div", { class: "actions" }, copyBtn),
        msg
      )
    ),
    card("¿Y si borré todo y me quedé trabado?",
      el("p", {}, "No podés quedar en un loop: `" + cmd + "` restaura la BD al estado de fábrica del seed."))
  );

  void el;
}

function row(...cells: string[]): HTMLElement {
  return el("tr", {}, ...cells.map((c) => el("td", {}, c)));
}
