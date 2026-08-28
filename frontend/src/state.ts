import type { Role, ViewId } from "./types";

export interface ActiveActor {
  role: Role;
  userId: string;
  userName: string;
}

const ACTOR_KEY = "bibliotk.demo.actor";
const VIEW_KEY = "bibliotk.demo.view";

export interface RoleAccount {
  label: string;
  userId: string;
  userName: string;
}

export const ROLE_ACCOUNTS: Record<Role, RoleAccount[]> = {
  admin: [{ label: "Admin", userId: "1", userName: "Admin" }],
  author: [
    { label: "García Márquez", userId: "2", userName: "Gabriel García Márquez" },
    { label: "Cortázar", userId: "3", userName: "Julio Cortázar" },
    { label: "Borges", userId: "4", userName: "Jorge Luis Borges" },
    { label: "Allende", userId: "5", userName: "Isabel Allende" },
    { label: "Vargas Llosa", userId: "6", userName: "Mario Vargas Llosa" },
  ],
  reader: [
    { label: "Reader 1", userId: "7", userName: "Reader 1" },
    { label: "Reader 2", userId: "8", userName: "Reader 2" },
    { label: "Reader 3", userId: "9", userName: "Reader 3" },
    { label: "Reader 10", userId: "16", userName: "Reader 10" },
  ],
};

const DEFAULT_ACTOR: ActiveActor = {
  role: "reader",
  userId: "7",
  userName: "Reader 1",
};

export const state = {
  getActor(): ActiveActor {
    try {
      const raw = localStorage.getItem(ACTOR_KEY);
      if (!raw) return DEFAULT_ACTOR;
      const parsed = JSON.parse(raw) as ActiveActor;
      if (!parsed.role || !parsed.userId) return DEFAULT_ACTOR;
      return parsed;
    } catch {
      return DEFAULT_ACTOR;
    }
  },

  setActor(actor: ActiveActor): void {
    localStorage.setItem(ACTOR_KEY, JSON.stringify(actor));
  },

  getView(): ViewId {
    return (localStorage.getItem(VIEW_KEY) as ViewId) || "login";
  },

  setView(view: ViewId): void {
    localStorage.setItem(VIEW_KEY, view);
  },
};
