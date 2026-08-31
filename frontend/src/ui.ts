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

/**
 * Presenta la `confidence` del libro como un riesgo en español.
 * Poca data (low) → riesgo alto de que el promedio no represente; mucha data
 * (high) → riesgo bajo. Se mantiene el valor de schema (`confidence`) y solo
 * se traduce a nivel de presentación.
 */
export function riskLabel(confidence: "low" | "medium" | "high"): string {
  switch (confidence) {
    case "low": return "Alto";
    case "medium": return "Medio";
    case "high": return "Bajo";
  }
}

export function riskClass(confidence: "low" | "medium" | "high"): string {
  // low (poca data) → badge "high" de peligro; high (mucha data) → badge "low".
  switch (confidence) {
    case "low": return "high";
    case "medium": return "medium";
    case "high": return "low";
  }
}
