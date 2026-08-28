export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "string") node.setAttribute(k, v);
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function card(title: string, body: Node): HTMLElement {
  const h = el("h3", { class: "card-title" }, title);
  return el("div", { class: "card" }, h, body);
}

export function renderError(container: HTMLElement, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  container.append(el("p", { class: "error" }, `Error: ${msg}`));
}

export function fmtAverage(value: number | string): string {
  return typeof value === "number" ? value.toFixed(1) : value;
}
