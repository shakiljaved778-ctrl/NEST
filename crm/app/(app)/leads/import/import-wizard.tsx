"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, ArrowRight, Download, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importLeadsAction, type ImportRowResult } from "./actions";

const TARGET_FIELDS = [
  { key: "firstName", label: "First name", required: true },
  { key: "lastName", label: "Last name", required: true },
  { key: "company", label: "Company", required: false },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "source", label: "Source", required: false },
  { key: "campaign", label: "Campaign", required: false },
  { key: "territory", label: "Territory", required: false },
  { key: "score", label: "Score", required: false },
] as const;

function guessMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const patterns: Record<string, RegExp> = {
    firstName: /^(first[\s_-]?name|fname|given)/i,
    lastName: /^(last[\s_-]?name|lname|surname|family)/i,
    company: /(company|organi[sz]ation|account)/i,
    email: /e-?mail/i,
    phone: /(phone|mobile|tel)/i,
    source: /source/i,
    campaign: /campaign/i,
    territory: /(territory|region|city|area)/i,
    score: /score/i,
  };
  for (const h of headers) {
    for (const [field, re] of Object.entries(patterns)) {
      if (!map[field] && re.test(h)) map[field] = h;
    }
  }
  return map;
}

export function ImportWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [autoRoute, setAutoRoute] = useState(true);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (!res.meta.fields || res.data.length === 0) {
          toast.error("Could not parse CSV — a header row is required");
          return;
        }
        setHeaders(res.meta.fields);
        setRows(res.data);
        setMapping(guessMapping(res.meta.fields));
        setStep(2);
      },
      error: () => toast.error("Failed to parse CSV file"),
    });
  }

  const mappedRows = useMemo(
    () =>
      rows.map((row) => {
        const out: Record<string, string> = {};
        for (const f of TARGET_FIELDS) {
          const src = mapping[f.key];
          if (src && row[src] != null && row[src] !== "") out[f.key] = String(row[src]).trim();
        }
        return out;
      }),
    [rows, mapping]
  );

  const mappingValid = TARGET_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);

  async function runImport() {
    setImporting(true);
    try {
      const { results } = await importLeadsAction(mappedRows, { skipDuplicates, autoRoute });
      setResults(results);
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function downloadErrorReport() {
    if (!results) return;
    const bad = results.filter((r) => r.status !== "created");
    const csv = Papa.unparse(
      bad.map((r) => ({ row: r.row, status: r.status, message: r.message ?? "", ...rows[r.row - 1] }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "import-error-report.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (step === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>1 · Upload CSV</CardTitle>
          <CardDescription>
            First row must be a header. Recognized columns are auto-mapped in the next step. Max 2,000 rows per
            batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/50">
            <Upload className="h-6 w-6" />
            Choose a .csv file
            <input type="file" accept=".csv,text/csv" hidden onChange={onFile} />
          </label>
        </CardContent>
      </Card>
    );
  }

  if (step === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>2 · Map columns</CardTitle>
          <CardDescription>
            {rows.length} rows parsed. Map your CSV columns to lead fields — first &amp; last name are required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGET_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-sm">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </span>
                <Select
                  value={mapping[f.key] ?? "none"}
                  onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— not mapped —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                    <TableHead key={f.key}>{f.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappedRows.slice(0, 5).map((r, i) => (
                  <TableRow key={i}>
                    {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <TableCell key={f.key} className="max-w-36 truncate">{r[f.key] ?? ""}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={skipDuplicates} onCheckedChange={(c) => setSkipDuplicates(c === true)} />
              Skip rows matching an existing lead&apos;s email or phone (duplicate detection)
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={autoRoute} onCheckedChange={(c) => setAutoRoute(c === true)} />
              Auto-route imported leads using the routing rules (otherwise they&apos;re assigned to you)
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={!mappingValid || importing} onClick={runImport}>
              {importing ? "Importing…" : (
                <>
                  Import {rows.length} rows <ArrowRight className="rtl-flip" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const created = results?.filter((r) => r.status === "created").length ?? 0;
  const dups = results?.filter((r) => r.status === "duplicate").length ?? 0;
  const errors = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>3 · Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border p-4">
            <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
            <p className="mt-1 text-2xl font-semibold">{created}</p>
            <p className="text-xs text-muted-foreground">created</p>
          </div>
          <div className="rounded-lg border p-4">
            <AlertTriangle className="mx-auto h-5 w-5 text-amber-500" />
            <p className="mt-1 text-2xl font-semibold">{dups}</p>
            <p className="text-xs text-muted-foreground">duplicates skipped</p>
          </div>
          <div className="rounded-lg border p-4">
            <XCircle className="mx-auto h-5 w-5 text-destructive" />
            <p className="mt-1 text-2xl font-semibold">{errors}</p>
            <p className="text-xs text-muted-foreground">errors</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {(dups > 0 || errors > 0) && (
            <Button variant="outline" onClick={downloadErrorReport}>
              <Download /> Error report
            </Button>
          )}
          <Button asChild>
            <Link href="/leads">Go to leads</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
