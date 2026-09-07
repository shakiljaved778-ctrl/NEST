"use client";
import { useState } from "react";
import { useAppState } from "@/components/market/providers/AppState";
import { Panel } from "@/components/market/ui/Panel";
import { UpgradeCTA } from "@/components/market/ui/UpgradeCTA";
import type { PriceAlert } from "@/types/market";
import { fmtNumber } from "@/lib/market/format";

/** Create/list price & % alerts for a symbol (Premium feature). */
export function AlertForm({ symbol, price }: { symbol: string; price: number }) {
  const { features, alerts, createAlert, removeAlert, toggleAlert } = useAppState();
  const [type, setType] = useState<PriceAlert["type"]>("price_above");
  const [threshold, setThreshold] = useState(price ? price.toFixed(2) : "");

  const symbolAlerts = alerts.filter((a) => a.symbol === symbol);

  if (!features.alerts) {
    return (
      <Panel title="Alerts">
        <UpgradeCTA feature="Price & % alerts">
          Set price and % change alerts with Premium. Email/SMS delivery is on the roadmap.
        </UpgradeCTA>
      </Panel>
    );
  }

  return (
    <Panel title="Alerts">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = parseFloat(threshold);
          if (!Number.isFinite(t)) return;
          createAlert({ symbol, type, threshold: t, active: true });
          setThreshold(price ? price.toFixed(2) : "");
        }}
      >
        <label className="flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-terminal-muted">
            Condition
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PriceAlert["type"])}
            className="t-input"
          >
            <option value="price_above">Price rises above</option>
            <option value="price_below">Price falls below</option>
            <option value="pct_change">Daily % change exceeds</option>
          </select>
        </label>
        <label className="w-28">
          <span className="mb-1 block text-[10px] uppercase tracking-wide text-terminal-muted">
            {type === "pct_change" ? "% value" : "Price"}
          </span>
          <input
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            inputMode="decimal"
            className="t-input num"
          />
        </label>
        <button type="submit" className="t-btn-accent">
          Add alert
        </button>
      </form>

      {symbolAlerts.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {symbolAlerts.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded border border-terminal-border bg-terminal-panel2 px-2.5 py-1.5 text-xs"
            >
              <span className="flex-1 text-terminal-text">
                {a.type === "price_above"
                  ? "Above"
                  : a.type === "price_below"
                    ? "Below"
                    : "Δ% >"}{" "}
                <span className="num font-semibold text-terminal-bright">
                  {fmtNumber(a.threshold, 2)}
                  {a.type === "pct_change" ? "%" : ""}
                </span>
              </span>
              <button
                onClick={() => toggleAlert(a.id)}
                className={`t-chip ${a.active ? "bg-terminal-up/15 text-terminal-up" : "bg-terminal-panel text-terminal-muted"}`}
              >
                {a.active ? "Active" : "Paused"}
              </button>
              <button
                onClick={() => removeAlert(a.id)}
                className="text-terminal-muted hover:text-terminal-down"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-terminal-muted">
        In-app alerts (demo). Email/SMS delivery schema is designed for a later release.
      </p>
    </Panel>
  );
}
