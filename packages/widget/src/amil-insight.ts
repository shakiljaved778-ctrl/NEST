import { messages } from "@amil/i18n";
import {
  AmilWidgetClient,
  type CheckAction,
  type CheckResponse,
  type InsightCard,
} from "@amil/sdk";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";

type Locale = "en" | "ar";
type Status = "idle" | "loading" | "ready" | "unavailable";

/** Options that continue the customer's original action: gated by "I understand" on critical cards. */
const CONTINUE_OPTIONS = new Set(["continue_closure", "settle_now"]);

export interface AmilReadyDetail {
  kind: CheckResponse["kind"];
  severity: CheckResponse["severity"];
  insightId: string;
  requiresAcknowledgement: boolean;
}
export interface AmilOptionDetail {
  insightId: string;
  key: string;
  deepLink: string;
  /** true when the option continues the customer's original action */
  continues: boolean;
}

/**
 * <amil-insight> renders an AMIL pre-decision insight card inside a bank's app.
 *
 * Either set `token` (a session token minted by the bank backend) plus `action`, `customer-ref`
 * and a product id, and the element runs the check itself; or set the `result` property to a
 * CheckResponse the host already has.
 *
 * Inform, never execute: option clicks are recorded as the customer's response and re-emitted
 * as `amil-option` events carrying the bank's deep link. The host app navigates.
 * Failure is silent for the customer: a neutral "information unavailable" line plus an
 * `amil-unavailable` event, so the bank's own flow continues.
 *
 * Events: amil-ready, amil-unavailable, amil-acknowledged, amil-option, amil-dismiss.
 * Theme: --amil-primary, --amil-primary-contrast, --amil-surface, --amil-surface-muted, --amil-text,
 * --amil-text-muted, --amil-border, --amil-critical, --amil-caution, --amil-info, --amil-radius,
 * --amil-font.
 */
export class AmilInsight extends LitElement {
  static override properties = {
    apiBase: { type: String, attribute: "api-base" },
    token: { type: String },
    action: { type: String },
    customerRef: { type: String, attribute: "customer-ref" },
    cardId: { type: String, attribute: "card-id" },
    financeId: { type: String, attribute: "finance-id" },
    locale: { type: String, reflect: true },
    result: { attribute: false },
    status: { state: true },
    acknowledged: { state: true },
  };

  declare apiBase: string;
  declare token: string;
  declare action: string;
  declare customerRef: string;
  declare cardId: string | undefined;
  declare financeId: string | undefined;
  declare locale: Locale;
  declare result: CheckResponse | null;
  declare status: Status;
  declare acknowledged: boolean;

  /** Injectable for tests. */
  fetchImpl: typeof fetch | undefined;
  private requestSeq = 0;

  constructor() {
    super();
    this.apiBase = "";
    this.token = "";
    this.action = "";
    this.customerRef = "";
    this.locale = "en";
    this.result = null;
    this.status = "idle";
    this.acknowledged = false;
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--amil-font, system-ui, "Noto Sans Arabic", sans-serif);
      color: var(--amil-text, #1f1a1c);
      --_accent: var(--amil-info, #175cd3);
    }
    :host([hidden]) {
      display: none;
    }
    .card {
      border: 1px solid var(--amil-border, #e7e0e3);
      border-inline-start: 4px solid var(--_accent);
      border-radius: var(--amil-radius, 14px);
      background: var(--amil-surface, #fff);
      padding: 16px;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
    }
    .card[data-severity="critical"] {
      --_accent: var(--amil-critical, #b42318);
    }
    .card[data-severity="caution"] {
      --_accent: var(--amil-caution, #b54708);
    }
    .head {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      justify-content: space-between;
    }
    h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.35;
      font-weight: 650;
    }
    .dismiss {
      border: 0;
      background: transparent;
      color: var(--amil-text-muted, #6b5f64);
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 4px;
    }
    p.body {
      margin: 8px 0 0;
      font-size: 13.5px;
      line-height: 1.55;
    }
    ul.facts {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 12px 0 0;
      padding: 0;
    }
    ul.facts li {
      background: var(--amil-surface-muted, #f6f1f3);
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
    }
    ul.facts li span {
      color: var(--amil-text-muted, #6b5f64);
    }
    details {
      margin-top: 10px;
      font-size: 12.5px;
    }
    summary {
      cursor: pointer;
      color: var(--amil-text-muted, #6b5f64);
    }
    details ul {
      margin: 6px 0 0;
      padding-inline-start: 18px;
    }
    label.ack {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
      font-size: 13px;
      font-weight: 600;
    }
    .options {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    button.option {
      min-height: 42px;
      border-radius: var(--amil-radius, 12px);
      border: 1px solid var(--amil-border, #e7e0e3);
      background: var(--amil-surface, #fff);
      color: var(--amil-text, #1f1a1c);
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button.option.primary {
      background: var(--amil-primary, #7a1f3d);
      border-color: var(--amil-primary, #7a1f3d);
      color: var(--amil-primary-contrast, #fff);
    }
    button.option:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    footer {
      margin-top: 12px;
      font-size: 11px;
      color: var(--amil-text-muted, #6b5f64);
    }
    .unavailable {
      font-size: 12px;
      color: var(--amil-text-muted, #6b5f64);
    }
    .loading {
      height: 96px;
      border-radius: var(--amil-radius, 14px);
      background: var(--amil-surface-muted, #f6f1f3);
    }
  `;

  override updated(changed: PropertyValues<this>): void {
    const inputs = [
      "apiBase",
      "token",
      "action",
      "customerRef",
      "cardId",
      "financeId",
      "locale",
    ] as const;
    if (inputs.some((k) => changed.has(k)) && this.token && this.action && this.customerRef) {
      void this.runCheck();
    }
    if (changed.has("result") && this.result) {
      this.status = "ready";
      this.acknowledged = false;
      this.emit<AmilReadyDetail>("amil-ready", {
        kind: this.result.kind,
        severity: this.result.severity,
        insightId: this.result.insightId,
        requiresAcknowledgement: this.result.requiresAcknowledgement,
      });
    }
  }

  private client(): AmilWidgetClient {
    return new AmilWidgetClient({
      baseUrl: this.apiBase,
      token: this.token,
      ...(this.fetchImpl ? { fetch: this.fetchImpl } : {}),
    });
  }

  /** Run the pre-action check. Errors never reach the customer. */
  async runCheck(): Promise<void> {
    const seq = ++this.requestSeq;
    this.status = "loading";
    try {
      const context = this.cardId
        ? { cardId: this.cardId }
        : this.financeId
          ? { financeId: this.financeId }
          : {};
      const result = await this.client().check({
        action: this.action as CheckAction,
        customerRef: this.customerRef,
        context,
        locale: this.locale,
      });
      if (seq !== this.requestSeq) return; // a newer request superseded this one
      this.result = result;
    } catch {
      if (seq !== this.requestSeq) return;
      this.result = null;
      this.status = "unavailable";
      this.emit("amil-unavailable", {});
    }
  }

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }

  private async respond(
    action: "continued" | "chose_option" | "talk_to_someone" | "dismissed",
    optionKey?: string,
  ): Promise<void> {
    if (!this.result || !this.token) return;
    try {
      await this.client().respond(this.result.insightId, {
        action,
        ...(optionKey ? { optionKey } : {}),
      });
    } catch {
      // Recording the response must never block the customer.
    }
  }

  private onOption(card: InsightCard, key: string): void {
    const option = card.options.find((o) => o.key === key);
    if (!option || !this.result) return;
    const continues = CONTINUE_OPTIONS.has(key);
    void this.respond(
      continues ? "continued" : key === "talk_to_someone" ? "talk_to_someone" : "chose_option",
      continues || key === "talk_to_someone" ? undefined : key,
    );
    this.emit<AmilOptionDetail>("amil-option", {
      insightId: this.result.insightId,
      key,
      deepLink: option.deepLink,
      continues,
    });
  }

  private onDismiss(): void {
    void this.respond("dismissed");
    this.emit("amil-dismiss", { insightId: this.result?.insightId });
  }

  private onAck(e: Event): void {
    this.acknowledged = (e.target as HTMLInputElement).checked;
    if (this.acknowledged) this.emit("amil-acknowledged", { insightId: this.result?.insightId });
  }

  override render() {
    const t = messages[this.locale === "ar" ? "ar" : "en"].insight;
    const dir = this.locale === "ar" ? "rtl" : "ltr";
    if (this.status === "loading")
      return html`<div class="loading" aria-busy="true" dir=${dir}></div>`;
    if (this.status === "unavailable")
      return html`<p class="unavailable" role="status" dir=${dir}>${t.unavailable}</p>`;
    const result = this.result;
    if (!result || result.kind === "none" || !result.card) return nothing;
    const card = result.card;
    const needsAck = result.requiresAcknowledgement;

    return html`
      <section
        class="card"
        data-severity=${result.severity ?? "info"}
        data-kind=${result.kind}
        dir=${dir}
        lang=${this.locale}
        role="region"
        aria-label=${card.headline}
        aria-live="polite"
      >
        <div class="head">
          <h2>${card.headline}</h2>
          <button class="dismiss" aria-label="×" @click=${() => this.onDismiss()}>×</button>
        </div>
        <p class="body">${card.body}</p>
        ${
          card.facts.length
            ? html`<ul class="facts">
                ${card.facts.map((f) => html`<li data-fact=${f.key}><span>${f.label}:</span> <bdi>${f.display}</bdi></li>`)}
              </ul>`
            : nothing
        }
        ${
          card.why.length
            ? html`<details>
                <summary>${t.why}</summary>
                <ul>
                  ${card.why.map((w) => html`<li>${w}</li>`)}
                </ul>
              </details>`
            : nothing
        }
        ${
          needsAck
            ? html`<label class="ack"
                ><input
                  type="checkbox"
                  .checked=${this.acknowledged}
                  @change=${(e: Event) => this.onAck(e)}
                />
                ${t.acknowledge}</label
              >`
            : nothing
        }
        <div class="options">
          ${card.options.map((o, i) => {
            const gated = needsAck && CONTINUE_OPTIONS.has(o.key) && !this.acknowledged;
            return html`<button
              class="option ${i === 0 && !CONTINUE_OPTIONS.has(o.key) && o.key !== "talk_to_someone" ? "primary" : ""}"
              data-option=${o.key}
              ?disabled=${gated}
              @click=${() => this.onOption(card, o.key)}
            >
              ${o.label}
            </button>`;
          })}
        </div>
        <footer>${card.aiDisclosure}</footer>
      </section>
    `;
  }
}

/** Register <amil-insight> once (safe to call repeatedly). */
export function defineAmilInsight(tag = "amil-insight"): void {
  if (typeof customElements !== "undefined" && !customElements.get(tag))
    customElements.define(tag, AmilInsight);
}
