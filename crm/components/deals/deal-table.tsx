import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney } from "@/lib/utils";
import type { KanbanDeal } from "./kanban";

const STATUS_VARIANT = { OPEN: "info", WON: "success", LOST: "secondary" } as const;

export function DealTable({ deals }: { deals: KanbanDeal[] }) {
  return (
    <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deal</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-end">Value</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Expected close</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                No deals found
              </TableCell>
            </TableRow>
          )}
          {deals.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <Link href={`/deals/${d.id}`} className="font-medium text-primary hover:underline">
                  {d.name}
                </Link>
              </TableCell>
              <TableCell>{d.account ?? "—"}</TableCell>
              <TableCell>{d.stageName}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[d.status as keyof typeof STATUS_VARIANT] ?? "secondary"}>{d.status}</Badge>
              </TableCell>
              <TableCell className="text-end font-medium">{fmtMoney(d.value, d.currency)}</TableCell>
              <TableCell>{d.owner ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{d.expectedCloseAt ? fmtDate(d.expectedCloseAt) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
