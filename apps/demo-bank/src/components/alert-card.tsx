"use client";

import type { CheckResponse } from "@amil/sdk";
import type { AmilOptionDetail } from "@amil/widget";
import { useRouter } from "next/navigation";
import { createElement, useEffect, useRef } from "react";
import { deepLinkToPath } from "@/lib/format";

interface Props {
  apiBase: string;
  token: string | null;
  insight: CheckResponse;
  locale: "en" | "ar";
}

/**
 * One proactive alert, rendered by <amil-insight> from the card AMIL computed on its scheduled run
 * (the widget does not re-run a check). Options are bank deep links, routed here.
 */
export function AlertCard({ apiBase, token, insight, locale }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLElement & { result?: CheckResponse }>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@amil/widget").then(({ defineAmilInsight }) => {
      if (cancelled) return;
      defineAmilInsight();
      if (ref.current) ref.current.result = insight;
    });
    return () => {
      cancelled = true;
    };
  }, [insight]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onOption = (e: Event) => {
      const path = deepLinkToPath((e as CustomEvent<AmilOptionDetail>).detail.deepLink);
      if (path) router.push(path);
    };
    el.addEventListener("amil-option", onOption);
    return () => el.removeEventListener("amil-option", onOption);
  }, [router]);

  return createElement("amil-insight", {
    ref,
    "api-base": apiBase,
    ...(token ? { token } : {}),
    locale,
  });
}
