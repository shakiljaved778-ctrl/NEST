"use client";
import { useState } from "react";

/**
 * Compliance footer: informational-only disclaimer, demo-data notice, and a
 * "Data sources" modal (placeholder provider list until live APIs are wired).
 */
export function Footer() {
  const [open, setOpen] = useState(false);
  return (
    <footer className="border-t border-terminal-border bg-terminal-panel px-4 py-3 text-[11px] text-terminal-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Data is for informational purposes only and does not constitute investment
          advice.
        </span>
        <span className="text-terminal-warn">
          ◆ Demo data is shown until live APIs are connected.
        </span>
        <button
          onClick={() => setOpen(true)}
          className="ml-auto underline decoration-dotted underline-offset-2 hover:text-terminal-text"
        >
          Data sources
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="t-panel w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="t-panel-head">
              <h3 className="t-title">Data sources & attribution</h3>
              <button onClick={() => setOpen(false)} className="t-btn">
                Close
              </button>
            </div>
            <div className="space-y-3 p-4 text-xs leading-relaxed text-terminal-text">
              <p className="text-terminal-muted">
                This demo runs on simulated data. When live providers are connected,
                each series will be attributed to its source below.
              </p>
              <ul className="space-y-2">
                <li>
                  <span className="font-semibold text-terminal-bright">
                    Qatar Stock Exchange (QE)
                  </span>{" "}
                  — index, sector indices &amp; listed-company quotes.{" "}
                  <span className="text-terminal-muted">
                    Planned: QSE market-data partner feed.
                  </span>
                </li>
                <li>
                  <span className="font-semibold text-terminal-bright">
                    Qatar Central Bank (QCB)
                  </span>{" "}
                  — policy/reference rates, FX (QAR peg), money supply &amp; credit.{" "}
                  <span className="text-terminal-muted">
                    Planned: QCB reports, data.gov.qa, AllRatesToday QCB FX API.
                  </span>
                </li>
                <li>
                  <span className="font-semibold text-terminal-bright">
                    Planning &amp; Statistics Authority
                  </span>{" "}
                  — inflation (CPI) &amp; GDP.{" "}
                  <span className="text-terminal-muted">Planned: PSA / data.gov.qa.</span>
                </li>
                <li>
                  <span className="font-semibold text-terminal-bright">
                    Global &amp; GCC
                  </span>{" "}
                  — Brent/WTI, US 10Y, DXY, GCC indices &amp; FX.{" "}
                  <span className="text-terminal-muted">
                    Planned: Financial Modeling Prep / Polygon / Alpha Vantage.
                  </span>
                </li>
              </ul>
              <p className="border-t border-terminal-border pt-3 text-terminal-muted">
                Nothing on this platform is a recommendation to buy or sell any security.
                Markets carry risk; past performance does not guarantee future results.
              </p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
