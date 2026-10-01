"use client";

import type { CheckAction, CheckContext } from "@amil/sdk";
import type { AmilOptionDetail, AmilReadyDetail } from "@amil/widget";
import { useRouter } from "next/navigation";
import { createElement, useEffect, useRef, useState } from "react";
import { deepLinkToPath } from "@/lib/format";

interface Props {
  apiBase: string;
  token: string | null;
  action: CheckAction;
  customerRef: string;
  cardId?: string;
  financeId?: string;
  /** Any other context (depositId, accountId, amount, months, …), passed as JSON. */
  context?: CheckContext;
  locale: "en" | "ar";
  /** The bank's own continue path, shown when AMIL has nothing to show or is unavailable. */
  fallbackHref: string;
  fallbackLabel: string;
  fallbackNote: string;
}

/**
 * Hosts <amil-insight>. The widget runs the check with the session token; this component only
 * routes the bank deep links it emits and, if AMIL has nothing to show, offers the bank's own
 * continue button, so the customer is never blocked by AMIL.
 */
export function InsightPanel(props: Props) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"pending" | "shown" | "fallback">(
    props.token ? "pending" : "fallback",
  );

  useEffect(() => {
    let cancelled = false;
    void import("@amil/widget").then(({ defineAmilInsight }) => {
      if (!cancelled) defineAmilInsight();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onReady = (e: Event) =>
      setState((e as CustomEvent<AmilReadyDetail>).detail.kind === "none" ? "fallback" : "shown");
    const onUnavailable = () => setState("fallback");
    const onOption = (e: Event) => {
      const path = deepLinkToPath((e as CustomEvent<AmilOptionDetail>).detail.deepLink);
      if (path) router.push(path);
    };
    el.addEventListener("amil-ready", onReady);
    el.addEventListener("amil-unavailable", onUnavailable);
    el.addEventListener("amil-option", onOption);
    return () => {
      el.removeEventListener("amil-ready", onReady);
      el.removeEventListener("amil-unavailable", onUnavailable);
      el.removeEventListener("amil-option", onOption);
    };
  }, [router]);

  return (
    <div data-testid="insight-panel" data-state={state}>
      {props.token
        ? createElement("amil-insight", {
            ref,
            "api-base": props.apiBase,
            token: props.token,
            action: props.action,
            "customer-ref": props.customerRef,
            ...(props.cardId ? { "card-id": props.cardId } : {}),
            ...(props.financeId ? { "finance-id": props.financeId } : {}),
            ...(props.context ? { context: JSON.stringify(props.context) } : {}),
            locale: props.locale,
          })
        : null}
      {state === "fallback" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-ink-muted">{props.fallbackNote}</p>
          <button
            type="button"
            onClick={() => router.push(props.fallbackHref)}
            className="h-11 w-full rounded-[var(--ddb-radius)] bg-brand text-sm font-semibold text-brand-contrast"
            data-testid="bank-continue"
          >
            {props.fallbackLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
