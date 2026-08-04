"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButton({ href }: { href: string }) {
  return (
    <Button variant="outline" asChild>
      <a href={href} download>
        <Download /> Export CSV
      </a>
    </Button>
  );
}
