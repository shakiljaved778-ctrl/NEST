"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/market/providers/AppState";
import type {
  InvestmentHorizon,
  InvestorGoal,
  RiskTolerance,
} from "@/types/market";

const HORIZONS: { id: InvestmentHorizon; label: string; hint: string }[] = [
  { id: "days", label: "Days", hint: "Active / day trading" },
  { id: "weeks", label: "Weeks", hint: "Swing trading" },
  { id: "months", label: "Months", hint: "Position trading" },
  { id: "years", label: "Years", hint: "Long-term investing" },
];
const GOALS: { id: InvestorGoal; label: string; hint: string }[] = [
  { id: "trading", label: "Trading", hint: "Short-term gains" },
  { id: "long_term", label: "Long-term growth", hint: "Build wealth over time" },
  { id: "income", label: "Income", hint: "Dividends & yield" },
  { id: "balanced", label: "Balanced", hint: "Growth + income" },
];
const RISKS: { id: RiskTolerance; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "Preserve capital" },
  { id: "medium", label: "Medium", hint: "Balanced risk/return" },
  { id: "high", label: "High", hint: "Maximize growth" },
];

export default function OnboardingPage() {
  const { user, completeOnboarding, ready } = useAppState();
  const router = useRouter();
  const [horizon, setHorizon] = useState<InvestmentHorizon>("years");
  const [goal, setGoal] = useState<InvestorGoal>("balanced");
  const [risk, setRisk] = useState<RiskTolerance>("medium");

  useEffect(() => {
    if (ready && !user) router.push("/markets/login");
  }, [ready, user, router]);

  const submit = () => {
    completeOnboarding({ horizon, goal, risk, completedOnboarding: true });
    router.push("/markets");
  };

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-terminal-bright">Set up your investor profile</h1>
        <p className="text-xs text-terminal-muted">
          We use this to tailor your default dashboard widgets and rebalancing nudges.
        </p>
      </div>

      <Section title="Investment horizon">
        <Grid>
          {HORIZONS.map((o) => (
            <Choice
              key={o.id}
              active={horizon === o.id}
              onClick={() => setHorizon(o.id)}
              label={o.label}
              hint={o.hint}
            />
          ))}
        </Grid>
      </Section>

      <Section title="Primary goal">
        <Grid>
          {GOALS.map((o) => (
            <Choice
              key={o.id}
              active={goal === o.id}
              onClick={() => setGoal(o.id)}
              label={o.label}
              hint={o.hint}
            />
          ))}
        </Grid>
      </Section>

      <Section title="Risk tolerance">
        <Grid>
          {RISKS.map((o) => (
            <Choice
              key={o.id}
              active={risk === o.id}
              onClick={() => setRisk(o.id)}
              label={o.label}
              hint={o.hint}
            />
          ))}
        </Grid>
      </Section>

      <button onClick={submit} className="t-btn-accent mt-2 w-full py-2.5">
        Finish &amp; open dashboard
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="mb-2 t-title">{title}</h2>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}
function Choice({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border p-3 text-left transition ${
        active
          ? "border-terminal-accent bg-terminal-accent/15"
          : "border-terminal-border bg-terminal-panel2 hover:border-terminal-borderLight"
      }`}
    >
      <div className="text-sm font-semibold text-terminal-bright">{label}</div>
      <div className="text-[10px] text-terminal-muted">{hint}</div>
    </button>
  );
}
