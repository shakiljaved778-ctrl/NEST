"use client";
/**
 * AppState — client-side application state for the dashboard.
 *
 * Wraps demo auth, the user's plan, portfolios, watchlist and alerts (all
 * localStorage-backed via lib/market/session) plus an analytics passthrough.
 * Components consume it with `useAppState()`. Designed so the persistence layer
 * can be swapped for server/DB calls without touching component code.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Holding,
  PlanTier,
  Portfolio,
  PriceAlert,
  SessionUser,
  UserProfile,
} from "@/types/market";
import * as store from "@/lib/market/session";
import { features, type PlanFeatures } from "@/lib/market/plan";
import { getAnalytics, type AnalyticsEventName } from "@/services/analytics";

interface AppStateValue {
  ready: boolean;
  user: SessionUser | null;
  plan: PlanTier;
  features: PlanFeatures;

  // auth
  signUp: (name: string, email: string, pw: string) => store.AuthResult;
  logIn: (email: string, pw: string) => store.AuthResult;
  logOut: () => void;
  completeOnboarding: (profile: UserProfile) => void;
  setPlan: (plan: PlanTier) => void;

  // portfolios
  portfolios: Portfolio[];
  createPortfolio: (name: string) => { ok: boolean; error?: string };
  deletePortfolio: (id: string) => void;
  addHolding: (pfId: string, h: Omit<Holding, "id">) => void;
  removeHolding: (pfId: string, holdingId: string) => void;
  setCash: (pfId: string, cash: number) => void;

  // watchlist
  watchlist: string[];
  toggleWatch: (symbol: string) => void;

  // alerts
  alerts: PriceAlert[];
  createAlert: (a: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt">) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;

  // analytics
  track: (event: AnalyticsEventName, props?: Record<string, unknown>) => void;
}

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  const analytics = useMemo(() => getAnalytics(), []);
  const track = useCallback(
    (event: AnalyticsEventName, props?: Record<string, unknown>) =>
      analytics.track(event, props),
    [analytics],
  );

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  const hydrate = useCallback((u: SessionUser | null) => {
    setUser(u);
    if (u) {
      setPortfolios(store.loadPortfolios(u.id));
      setWatchlist(store.loadWatchlist(u.id));
      setAlerts(store.loadAlerts(u.id));
    } else {
      setPortfolios([]);
      setWatchlist([]);
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    const u = store.currentUser();
    if (u) analytics.identify(u.id, { plan: u.plan });
    hydrate(u);
    setReady(true);
  }, [analytics, hydrate]);

  const plan = user?.plan ?? "free";

  /* ------------------------------- auth ------------------------------- */
  const signUp = useCallback(
    (name: string, email: string, pw: string) => {
      const res = store.signUp(name, email, pw);
      if (res.ok) {
        analytics.identify(res.user.id, { plan: res.user.plan });
        track("sign_up", { email: res.user.email });
        hydrate(res.user);
      }
      return res;
    },
    [analytics, hydrate, track],
  );

  const logIn = useCallback(
    (email: string, pw: string) => {
      const res = store.logIn(email, pw);
      if (res.ok) {
        analytics.identify(res.user.id, { plan: res.user.plan });
        track("log_in", { email: res.user.email });
        hydrate(res.user);
      }
      return res;
    },
    [analytics, hydrate, track],
  );

  const logOut = useCallback(() => {
    store.logOut();
    hydrate(null);
  }, [hydrate]);

  const completeOnboarding = useCallback(
    (profile: UserProfile) => {
      if (!user) return;
      const updated = store.setProfile(user.id, {
        ...profile,
        completedOnboarding: true,
      });
      if (updated) setUser(updated);
      track("complete_onboarding", profile as unknown as Record<string, unknown>);
    },
    [track, user],
  );

  const setPlan = useCallback(
    (next: PlanTier) => {
      if (!user) return;
      const updated = store.setPlan(user.id, next);
      if (updated) setUser(updated);
    },
    [user],
  );

  /* ---------------------------- portfolios ---------------------------- */
  const persistPortfolios = useCallback(
    (next: Portfolio[]) => {
      if (!user) return;
      setPortfolios(next);
      store.savePortfolios(user.id, next);
    },
    [user],
  );

  const createPortfolio = useCallback(
    (name: string) => {
      if (!user) return { ok: false, error: "Sign in first." };
      const limit = features(user.plan).maxPortfolios;
      if (portfolios.length >= limit) {
        track("hit_free_limit", { feature: "portfolios", limit });
        return {
          ok: false,
          error:
            user.plan === "free"
              ? "Free plan is limited to 1 portfolio. Upgrade to Premium for up to 10."
              : `Plan limit of ${limit} portfolios reached.`,
        };
      }
      persistPortfolios([...portfolios, store.newPortfolio(name || "My Portfolio")]);
      track("create_portfolio", {});
      return { ok: true };
    },
    [persistPortfolios, portfolios, track, user],
  );

  const deletePortfolio = useCallback(
    (id: string) => persistPortfolios(portfolios.filter((p) => p.id !== id)),
    [persistPortfolios, portfolios],
  );

  const addHolding = useCallback(
    (pfId: string, h: Omit<Holding, "id">) => {
      const next = portfolios.map((p) => {
        if (p.id !== pfId) return p;
        // Merge into existing symbol (weighted avg price).
        const existing = p.holdings.find((x) => x.symbol === h.symbol);
        if (existing) {
          const totalQty = existing.quantity + h.quantity;
          const avg =
            totalQty > 0
              ? (existing.avgPrice * existing.quantity + h.avgPrice * h.quantity) /
                totalQty
              : h.avgPrice;
          return {
            ...p,
            holdings: p.holdings.map((x) =>
              x.symbol === h.symbol
                ? { ...x, quantity: totalQty, avgPrice: Math.round(avg * 1000) / 1000 }
                : x,
            ),
          };
        }
        return {
          ...p,
          holdings: [...p.holdings, { ...h, id: store.newHoldingId() }],
        };
      });
      persistPortfolios(next);
      track("add_holding", { symbol: h.symbol, quantity: h.quantity });
    },
    [persistPortfolios, portfolios, track],
  );

  const removeHolding = useCallback(
    (pfId: string, holdingId: string) => {
      persistPortfolios(
        portfolios.map((p) =>
          p.id === pfId
            ? { ...p, holdings: p.holdings.filter((h) => h.id !== holdingId) }
            : p,
        ),
      );
    },
    [persistPortfolios, portfolios],
  );

  const setCash = useCallback(
    (pfId: string, cash: number) => {
      persistPortfolios(
        portfolios.map((p) => (p.id === pfId ? { ...p, cash: Math.max(0, cash) } : p)),
      );
    },
    [persistPortfolios, portfolios],
  );

  /* ----------------------------- watchlist ---------------------------- */
  const toggleWatch = useCallback(
    (symbol: string) => {
      if (!user) return;
      const sym = symbol.toUpperCase();
      const next = watchlist.includes(sym)
        ? watchlist.filter((s) => s !== sym)
        : [...watchlist, sym];
      setWatchlist(next);
      store.saveWatchlist(user.id, next);
    },
    [user, watchlist],
  );

  /* ------------------------------- alerts ----------------------------- */
  const persistAlerts = useCallback(
    (next: PriceAlert[]) => {
      if (!user) return;
      setAlerts(next);
      store.saveAlerts(user.id, next);
    },
    [user],
  );

  const createAlert = useCallback(
    (a: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt">) => {
      persistAlerts([
        ...alerts,
        { ...a, id: store.newAlertId(), createdAt: Date.now(), triggeredAt: null },
      ]);
      track("create_alert", { symbol: a.symbol, type: a.type });
    },
    [alerts, persistAlerts, track],
  );

  const removeAlert = useCallback(
    (id: string) => persistAlerts(alerts.filter((x) => x.id !== id)),
    [alerts, persistAlerts],
  );

  const toggleAlert = useCallback(
    (id: string) =>
      persistAlerts(
        alerts.map((x) => (x.id === id ? { ...x, active: !x.active } : x)),
      ),
    [alerts, persistAlerts],
  );

  const value: AppStateValue = {
    ready,
    user,
    plan,
    features: features(plan),
    signUp,
    logIn,
    logOut,
    completeOnboarding,
    setPlan,
    portfolios,
    createPortfolio,
    deletePortfolio,
    addHolding,
    removeHolding,
    setCash,
    watchlist,
    toggleWatch,
    alerts,
    createAlert,
    removeAlert,
    toggleAlert,
    track,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used within <AppStateProvider>");
  return ctx;
}
