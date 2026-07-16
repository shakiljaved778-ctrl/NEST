import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductManager } from "@/components/admin/product-manager";
import { fmtMoney, titleCase } from "@/lib/utils";

export const metadata = { title: "Admin · Products" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireRole("ADMIN");
  const products = await db.product.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { subscriptions: true, dealProducts: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} products</p>
        <ProductManager mode="create" />
      </div>
      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead className="text-end">Price</TableHead>
              <TableHead className="text-end">Subscriptions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{titleCase(p.pricingModel)}</TableCell>
                <TableCell className="text-end">{fmtMoney(p.price)}</TableCell>
                <TableCell className="text-end">{p._count.subscriptions}</TableCell>
                <TableCell>{p.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                <TableCell>
                  <ProductManager
                    mode="edit"
                    product={{ id: p.id, name: p.name, description: p.description, pricingModel: p.pricingModel, price: p.price, active: p.active }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
