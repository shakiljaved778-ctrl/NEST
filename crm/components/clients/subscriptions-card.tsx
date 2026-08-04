import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney, relativeTime } from "@/lib/utils";

export type SubItem = {
  id: string;
  productName: string;
  status: string;
  startDate: string;
  renewalDate: string | null;
  mrrValue: number;
};

const STATUS_VARIANT = { ACTIVE: "success", EXPIRED: "secondary", CANCELLED: "destructive" } as const;

export function SubscriptionsCard({ subscriptions }: { subscriptions: SubItem[] }) {
  const activeMrr = subscriptions.filter((s) => s.status === "ACTIVE").reduce((sum, s) => sum + s.mrrValue, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Subscriptions</CardTitle>
          {activeMrr > 0 && <span className="text-sm font-medium">{fmtMoney(activeMrr)}/mo MRR</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {subscriptions.length === 0 && <p className="text-sm text-muted-foreground">No subscriptions</p>}
        {subscriptions.map((s) => {
          const soon =
            s.status === "ACTIVE" && s.renewalDate && new Date(s.renewalDate).getTime() - Date.now() < 30 * 86_400_000;
          return (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{s.productName}</span>
                <div className="text-xs text-muted-foreground">
                  {fmtMoney(s.mrrValue)}/mo · since {fmtDate(s.startDate)}
                </div>
              </div>
              <div className="text-end">
                <Badge variant={STATUS_VARIANT[s.status as keyof typeof STATUS_VARIANT] ?? "secondary"}>{s.status}</Badge>
                {s.renewalDate && (
                  <div className={`text-xs ${soon ? "font-medium text-amber-600" : "text-muted-foreground"}`}>
                    renews {relativeTime(s.renewalDate)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
