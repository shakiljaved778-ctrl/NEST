import { MockLodgingAdapter, MockAirAdapter } from "@voyara/inventory-mesh";
import { Ledger } from "@voyara/ledger";
import { createPlanner } from "@voyara/agent-core";

/**
 * Process-wide singletons so a hold placed during /plan is still resolvable at
 * /checkout. In production these are real services; here they are the mocks.
 */
const g = globalThis as unknown as {
  __voyara?: {
    lodging: MockLodgingAdapter;
    air: MockAirAdapter;
    ledger: Ledger;
    planner: ReturnType<typeof createPlanner>;
  };
};

export function runtime() {
  if (!g.__voyara) {
    g.__voyara = {
      lodging: new MockLodgingAdapter(),
      air: new MockAirAdapter(),
      ledger: new Ledger(),
      planner: createPlanner(),
    };
  }
  return g.__voyara;
}
