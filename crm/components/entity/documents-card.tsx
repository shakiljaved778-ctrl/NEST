"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Upload, Eye, Download, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/utils";
import { uploadDocumentAction, deleteDocumentAction } from "@/app/(app)/actions";
import type { EntityLink } from "./quick-actions";

export type DocItem = {
  id: string;
  name: string;
  category: string;
  mime: string;
  size: number;
  version: number;
  uploadedByName: string;
  updatedAt: string;
};

const CATEGORY_VARIANT: Record<string, "destructive" | "info" | "purple" | "secondary"> = {
  KYC: "destructive",
  AGREEMENT: "info",
  PROPOSAL: "purple",
  OTHER: "secondary",
};

export function DocumentsCard({
  documents,
  link,
  path,
  readOnly,
}: {
  documents: DocItem[];
  link: EntityLink;
  path: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("OTHER");
  const [uploading, setUploading] = useState(false);
  const [versionOf, setVersionOf] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("category", category);
      fd.set("path", path);
      if (versionOf) fd.set("documentId", versionOf);
      for (const [k, v] of Object.entries(link)) if (v) fd.set(k, v);
      const res = await uploadDocumentAction(fd);
      if (res.ok) {
        toast.success(versionOf ? "New version uploaded" : "Document uploaded");
        router.refresh();
      } else toast.error(res.error);
    } finally {
      setUploading(false);
      setVersionOf(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documents</CardTitle>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["KYC", "AGREEMENT", "PROPOSAL", "OTHER"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => { setVersionOf(null); fileRef.current?.click(); }}>
                <Upload /> {uploading ? "Uploading…" : "Upload"}
              </Button>
              <input ref={fileRef} type="file" hidden onChange={onFile} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents</p>}
        {documents.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <span className="block truncate font-medium">{d.name}</span>
              <span className="text-xs text-muted-foreground">
                v{d.version} · {(d.size / 1024).toFixed(0)} KB · {d.uploadedByName} · {fmtDate(d.updatedAt)}
              </span>
            </div>
            <Badge variant={CATEGORY_VARIANT[d.category] ?? "secondary"}>{d.category}</Badge>
            {(d.mime === "application/pdf" || d.mime.startsWith("image/")) && (
              <Button size="icon" variant="ghost" asChild aria-label="Preview">
                <a href={`/api/documents/${d.id}?disposition=inline`} target="_blank" rel="noreferrer">
                  <Eye className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button size="icon" variant="ghost" asChild aria-label="Download">
              <a href={`/api/documents/${d.id}`} download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
            {!readOnly && (
              <>
                <Button size="icon" variant="ghost" aria-label="Upload new version"
                  onClick={() => { setVersionOf(d.id); setCategory(d.category); fileRef.current?.click(); }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Delete"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${d.name}"?`)) return;
                    const res = await deleteDocumentAction(d.id, path);
                    if (res.ok) { toast.success("Document deleted"); router.refresh(); }
                    else toast.error(res.error);
                  }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
