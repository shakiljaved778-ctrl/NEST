/**
 * Design tokens — the single source of the dark-luxury system. Consumed by the
 * web Tailwind preset and by the Expo app as a plain TS token file (React
 * Native cannot read Tailwind, so tokens live here, framework-agnostic).
 */
export const colors = {
  navy950: "#060B1E",
  navy900: "#0A1128",
  navy800: "#111A3A",
  navy700: "#1A244D",
  gold: "#C9A227",
  goldSoft: "#E0BE52",
  cream: "#F5EFE1",
  slateblue: "#6B7DA8", // WAIT verdict
  amberGuardian: "#E8A13A",
  rebate: "#5FB98B", // success / refund
} as const;

export const verdictColor = { BUY: colors.gold, WAIT: colors.slateblue } as const;

export const fonts = {
  display: '"Fraunces", Georgia, serif',
  body: '"Inter", system-ui, sans-serif',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24 } as const;
