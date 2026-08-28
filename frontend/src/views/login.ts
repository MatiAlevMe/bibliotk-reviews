import { api } from "../api";
import type { Role } from "../types";
import { el, renderError, card } from "../ui";
import { ROLE_ACCOUNTS, state } from "../state";

export function loginView(
  container: HTMLElement,
  onLogin: () => void
): void {
  container.innerHTML = "";

  const current = state.getActor();
  const roleGroup = el("div", { class: "role-group" });

  const roles: Array<{ role: Role; label: string }> = [
    { role: "admin", label: "Admin" },
    { role: "author", label: "Autor" },
    { role: "reader", label: "Lector" },
  ];

  let selectedRole: Role = current.role;
  let selectedUserId: string | null = current.userId;

  const accountSelect = el("select", { class: "account-select" });

  function refreshAccounts(): void {
    const accounts = ROLE_ACCOUNTS[selectedRole];
    accountSelect.innerHTML = "";
    for (const a of accounts) {
      const opt = el("option", { value: a.userId }, `${a.label} (${a.userName})`);
      accountSelect.append(opt);
    }
    accountSelect.value = accounts.some((a) => a.userId === selectedUserId)
      ? String(selectedUserId)
      : accounts[0].userId;
  }

  for (const r of roles) {
    const btn = el(
      "button",
      { type: "button", class: `role-btn${r.role === selectedRole ? " active" : ""}` },
      r.label
    );
    btn.addEventListener("click", () => {
      selectedRole = r.role;
      roles.forEach((rr) => {
        const b = roleGroup.querySelector<HTMLButtonElement>(`[data-role="${rr.role}"]`);
        if (b) b.classList.toggle("active", rr.role === r.role);
      });
      refreshAccounts();
    });
    btn.dataset.role = r.role;
    roleGroup.append(btn);
  }

  refreshAccounts();

  const loginBtn = el("button", { type: "button", class: "btn primary" }, "Entrar a la demo");
  loginBtn.addEventListener("click", async () => {
    const userId = accountSelect.value;
    const account = ROLE_ACCOUNTS[selectedRole].find(
      (a) => a.userId === userId
    );
    if (!account) return;
    state.setActor({
      role: selectedRole,
      userId,
      userName: account.userName,
    });
    onLogin();
  });

  const intro = el(
    "p",
    { class: "muted" },
    "Elegí un rol para experimentar con cada funcionalidad. Los cambios se aplican directamente a la base de datos (dev)."
  );

  container.append(
    el("h2", {}, "Bibliotk Reviews — Demo"),
    intro,
    card("Rol activo", roleGroup),
    card("Cuenta", accountSelect),
    loginBtn
  );
}

export async function verifyActor(container: HTMLElement, fallback: () => void): Promise<void> {
  const actor = state.getActor();
  try {
    const res = await api.user(actor.userId);
    if (!res.user) throw new Error(`No existe usuario con id ${actor.userId}`);
  } catch (err) {
    renderError(container, err);
    fallback();
  }
}
