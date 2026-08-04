import { Phone, Users, StickyNote, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/utils";

const ICONS = { CALL: Phone, MEETING: Users, NOTE: StickyNote, EMAIL: Mail };

export type TimelineActivity = {
  id: string;
  type: "CALL" | "MEETING" | "NOTE" | "EMAIL";
  subject: string;
  body: string | null;
  occurredAt: Date | string;
  userName: string;
};

export function ActivityTimeline({ activities, title = "Activity timeline" }: { activities: TimelineActivity[]; title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 && <p className="text-sm text-muted-foreground">No activity yet</p>}
        <ol className="relative space-y-4 border-s ps-5">
          {activities.map((a) => {
            const Icon = ICONS[a.type];
            return (
              <li key={a.id} className="relative">
                <span className="absolute -start-[27px] flex h-5 w-5 items-center justify-center rounded-full border bg-background">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{a.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.type.toLowerCase()} · {a.userName} · {fmtDateTime(a.occurredAt)}
                  </span>
                </div>
                {a.body && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
