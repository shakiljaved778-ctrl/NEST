import { messages } from "@amil/i18n";
import {
  AmilWidgetClient,
  type AssistantAnswer,
  type AssistantContext,
  type CardOption,
  type CompareResponse,
  type FactChip,
} from "@amil/sdk";
import { css, html, LitElement, nothing, type TemplateResult } from "lit";

type Locale = "en" | "ar";

interface Turn {
  role: "customer" | "amil";
  text: string;
  answer?: AssistantAnswer;
}

export interface AmilAssistantOptionDetail {
  key: string;
  deepLink: string;
  messageId: string;
}

/**
 * `<amil-assistant>`: Ask AMIL. A chat about the customer's own products, streamed from
 * `POST /v1/assistant/messages` with a widget session token (scope `assistant:chat`).
 *
 * - Shows each step while the answer is being computed; the answer text appears only after it has
 *   passed the number validator and the guard on the server.
 * - Every answer with figures shows its fact chips (label, value, source as-of); comparisons render
 *   as a side-by-side table with the best option marked.
 * - Options are bank deep links: the element emits `amil-option` and never navigates.
 * - Suggestions carry a topic and product (never free text) and are sent as the next question.
 * - On failure: a neutral line and `amil-unavailable`.
 *
 * Attributes: api-base, token, customer-ref, locale. Theme: the same --amil-* variables as
 * `<amil-insight>`.
 */
export class AmilAssistant extends LitElement {
  static override properties = {
    apiBase: { type: String, attribute: "api-base" },
    token: { type: String },
    customerRef: { type: String, attribute: "customer-ref" },
    locale: { type: String, reflect: true },
    turns: { state: true },
    streaming: { state: true },
    step: { state: true },
    failed: { state: true },
  };

  declare apiBase: string;
  declare token: string;
  declare customerRef: string;
  declare locale: Locale;
  declare turns: Turn[];
  declare streaming: string | null;
  declare step: string | null;
  declare failed: boolean;

  /** Injectable for tests. */
  fetchImpl: typeof fetch | undefined;
  private conversationId: string | undefined;

  constructor() {
    super();
    this.apiBase = "";
    this.token = "";
    this.customerRef = "";
    this.locale = "en";
    this.turns = [];
    this.streaming = null;
    this.step = null;
    this.failed = false;
  }

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: var(--amil-font, system-ui, "Noto Sans Arabic", sans-serif);
      color: var(--amil-text, #1f1a1c);
    }
    .intro {
      font-size: 13.5px;
      color: var(--amil-text-muted, #6b5f64);
      margin: 0;
    }
    .log {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bubble {
      max-width: 92%;
      border-radius: var(--amil-radius, 14px);
      padding: 10px 12px;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .customer {
      align-self: flex-end;
      background: var(--amil-primary, #7a1f3d);
      color: var(--amil-primary-contrast, #fff);
    }
    .amil {
      align-self: flex-start;
      background: var(--amil-surface, #fff);
      border: 1px solid var(--amil-border, #e7e0e3);
      border-inline-start: 4px solid var(--_accent, var(--amil-info, #175cd3));
    }
    .amil[data-severity="critical"] {
      --_accent: var(--amil-critical, #b42318);
    }
    .amil[data-severity="caution"] {
      --_accent: var(--amil-caution, #b54708);
    }
    h3 {
      margin: 0 0 4px;
      font-size: 14.5px;
      font-weight: 650;
    }
    p {
      margin: 6px 0 0;
    }
    ul.facts {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 10px 0 0;
      padding: 0;
    }
    ul.facts li {
      background: var(--amil-surface-muted, #f6f1f3);
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 12px;
    }
    ul.facts li span {
      color: var(--amil-text-muted, #6b5f64);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 12px;
    }
    th,
    td {
      text-align: start;
      padding: 4px;
      border-bottom: 1px solid var(--amil-border, #e7e0e3);
      vertical-align: top;
    }
    th[data-best="true"] {
      color: var(--amil-primary, #7a1f3d);
    }
    .best {
      display: block;
      font-size: 10.5px;
      font-weight: 600;
    }
    .options,
    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    button {
      font: inherit;
      cursor: pointer;
    }
    button.option {
      border-radius: var(--amil-radius, 12px);
      border: 1px solid var(--amil-border, #e7e0e3);
      background: var(--amil-surface, #fff);
      padding: 6px 10px;
      font-size: 13px;
      font-weight: 600;
    }
    button.option:first-child {
      background: var(--amil-primary, #7a1f3d);
      color: var(--amil-primary-contrast, #fff);
      border-color: transparent;
    }
    button.suggestion {
      border-radius: 999px;
      border: 1px solid var(--amil-primary, #7a1f3d);
      color: var(--amil-primary, #7a1f3d);
      background: transparent;
      padding: 5px 10px;
      font-size: 12.5px;
    }
    details {
      margin-top: 8px;
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
    footer {
      margin-top: 8px;
      font-size: 11px;
      color: var(--amil-text-muted, #6b5f64);
    }
    .step {
      font-size: 12px;
      color: var(--amil-text-muted, #6b5f64);
    }
    form {
      display: flex;
      gap: 6px;
    }
    input {
      flex: 1;
      min-width: 0;
      border-radius: var(--amil-radius, 12px);
      border: 1px solid var(--amil-border, #e7e0e3);
      padding: 10px 12px;
      font: inherit;
      font-size: 14px;
      background: var(--amil-surface, #fff);
      color: inherit;
    }
    button.send {
      border: 0;
      border-radius: var(--amil-radius, 12px);
      padding: 0 14px;
      background: var(--amil-primary, #7a1f3d);
      color: var(--amil-primary-contrast, #fff);
      font-weight: 600;
    }
    button:disabled,
    input:disabled {
      opacity: 0.55;
      cursor: default;
    }
  `;

  private get m() {
    return messages[this.locale === "ar" ? "ar" : "en"].assistant;
  }

  private client(): AmilWidgetClient {
    return new AmilWidgetClient({
      baseUrl: this.apiBase,
      token: this.token,
      ...(this.fetchImpl ? { fetch: this.fetchImpl } : {}),
    });
  }

  /** Ask a question (free text, or a suggestion carrying its topic and product). */
  async ask(message: string, context?: AssistantContext): Promise<void> {
    const text = message.trim();
    if (!text || this.streaming !== null) return;
    this.failed = false;
    this.turns = [...this.turns, { role: "customer", text }];
    this.streaming = "";
    this.step = null;
    try {
      for await (const e of this.client().ask({
        customerRef: this.customerRef,
        message: text,
        locale: this.locale,
        ...(this.conversationId ? { conversationId: this.conversationId } : {}),
        ...(context ? { context } : {}),
      })) {
        if (e.event === "status") this.step = e.data.step;
        else if (e.event === "delta") this.streaming += e.data.text;
        else if (e.event === "answer") {
          this.conversationId = e.data.conversationId;
          this.turns = [...this.turns, { role: "amil", text: "", answer: e.data }];
          this.emit("amil-answer", e.data);
        } else if (e.event === "error") throw new Error(e.data.error);
      }
    } catch {
      this.failed = true;
      this.emit("amil-unavailable", {});
    } finally {
      this.streaming = null;
      this.step = null;
    }
  }

  private emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private onSubmit(e: Event): void {
    e.preventDefault();
    const input = this.renderRoot.querySelector("input");
    if (!input) return;
    const value = input.value;
    input.value = "";
    void this.ask(value);
  }

  private chips(facts: FactChip[]): TemplateResult | typeof nothing {
    if (!facts.length) return nothing;
    return html`<ul class="facts">
      ${facts.map(
        (f) =>
          html`<li data-fact=${f.key} title=${`${f.source} · ${f.asOf}`}>
            <span>${f.label}:</span> <bdi>${f.display}</bdi>
          </li>`,
      )}
    </ul>`;
  }

  private comparison(c: CompareResponse): TemplateResult {
    const rows = c.options[0]?.facts.map((f) => f.key) ?? [];
    return html`<table data-scenario=${c.scenario}>
      <thead>
        <tr>
          <th></th>
          ${c.options.map(
            (o) =>
              html`<th data-best=${String(o.best)} data-option=${o.key}>
                ${o.title}${o.best ? html`<span class="best">${this.m.best}</span>` : nothing}
              </th>`,
          )}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (key) =>
            html`<tr>
              <th>${c.options[0]?.facts.find((f) => f.key === key)?.label}</th>
              ${c.options.map(
                (o) =>
                  html`<td><bdi>${o.facts.find((f) => f.key === key)?.display ?? ""}</bdi></td>`,
              )}
            </tr>`,
        )}
      </tbody>
    </table>`;
  }

  private option(a: AssistantAnswer, o: CardOption): TemplateResult {
    return html`<button
      class="option"
      data-option=${o.key}
      @click=${() =>
        this.emit<AmilAssistantOptionDetail>("amil-option", {
          key: o.key,
          deepLink: o.deepLink,
          messageId: a.messageId,
        })}
    >
      ${o.label}
    </button>`;
  }

  private answer(a: AssistantAnswer, last: boolean): TemplateResult {
    return html`<div
      class="bubble amil"
      data-kind=${a.kind}
      data-severity=${a.severity ?? "info"}
      role="article"
    >
      <h3>${a.headline}</h3>
      ${a.body ? html`<p>${a.body}</p>` : nothing} ${a.details.map((d) => html`<p>${d}</p>`)}
      ${
        a.why.length
          ? html`<details>
              <summary>${messages[this.locale === "ar" ? "ar" : "en"].insight.why}</summary>
              <ul>
                ${a.why.map((w) => html`<li>${w}</li>`)}
              </ul>
            </details>`
          : nothing
      }
      ${this.chips(a.facts)} ${a.comparison ? this.comparison(a.comparison) : nothing}
      ${
        a.options.length
          ? html`<div class="options">${a.options.map((o) => this.option(a, o))}</div>`
          : nothing
      }
      ${
        last && a.suggestions.length
          ? html`<div class="suggestions">
              ${a.suggestions.map(
                (s) =>
                  html`<button
                    class="suggestion"
                    ?disabled=${this.streaming !== null}
                    @click=${() => void this.ask(s.message, s.context)}
                  >
                    ${s.label}
                  </button>`,
              )}
            </div>`
          : nothing
      }
      ${a.aiDisclosure ? html`<footer>${a.aiDisclosure}</footer>` : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const m = this.m;
    const dir = this.locale === "ar" ? "rtl" : "ltr";
    const lastAmil = this.turns.map((t) => t.role).lastIndexOf("amil");
    return html`<div dir=${dir} lang=${this.locale} style="display:contents">
      ${
        this.turns.length === 0
          ? html`<p class="intro">${m.intro}</p>
              <div class="suggestions">
                ${m.starters.map(
                  (s) =>
                    html`<button
                      class="suggestion"
                      @click=${() => void this.ask(s.label, { topic: s.topic })}
                    >
                      ${s.label}
                    </button>`,
                )}
              </div>`
          : nothing
      }
      <div class="log" aria-live="polite">
        ${this.turns.map((t, i) =>
          t.role === "customer"
            ? html`<div class="bubble customer">${t.text}</div>`
            : this.answer(t.answer as AssistantAnswer, i === lastAmil),
        )}
        ${
          this.streaming !== null
            ? html`<div class="bubble amil" data-streaming>
                ${
                  this.streaming ||
                  html`<span class="step"
                    >${this.step ? (m.steps as Record<string, string>)[this.step] : "…"}</span
                  >`
                }
              </div>`
            : nothing
        }
        ${this.failed ? html`<p class="step" role="status">${m.unavailable}</p>` : nothing}
      </div>
      <form @submit=${(e: Event) => this.onSubmit(e)}>
        <input
          type="text"
          maxlength="500"
          aria-label=${m.placeholder}
          placeholder=${m.placeholder}
          ?disabled=${this.streaming !== null}
        />
        <button class="send" type="submit" ?disabled=${this.streaming !== null}>${m.send}</button>
      </form>
    </div>`;
  }
}

export function defineAmilAssistant(): void {
  if (!customElements.get("amil-assistant")) customElements.define("amil-assistant", AmilAssistant);
}

declare global {
  interface HTMLElementTagNameMap {
    "amil-assistant": AmilAssistant;
  }
}
