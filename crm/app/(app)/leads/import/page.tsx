import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import leads" };

export default function LeadImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Import leads from CSV</h1>
      <ImportWizard />
    </div>
  );
}
