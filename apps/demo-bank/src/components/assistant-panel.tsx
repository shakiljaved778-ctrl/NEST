"use client";

import type { AmilAssistantOptionDetail } from "@amil/widget";
import { useRouter } from "next/navigation";
import { createElement, useEffect, useRef } from "react";
import { deepLinkToPath } from "@/lib/format";

interface Props {
  apiBase: string;
  token: string;
  customerRef: string;
  locale: "en" | "ar";
}

/** Hosts <amil-assistant> (Ask AMIL) and routes the bank deep links it emits. */
export function AssistantPanel({ apiBase, token, customerRef, locale }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    void import("@amil/widget").then(({ defineAmilAssistant }) => defineAmilAssistant());
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onOption = (e: Event) => {
      const path = deepLinkToPath((e as CustomEvent<AmilAssistantOptionDetail>).detail.deepLink);
      if (path) router.push(path);
    };
    el.addEventListener("amil-option", onOption);
    return () => el.removeEventListener("amil-option", onOption);
  }, [router]);

  return createElement("amil-assistant", {
    ref,
    "api-base": apiBase,
    token,
    "customer-ref": customerRef,
    locale,
    "data-testid": "amil-assistant",
  });
}
