import CustomerApp from "@/components/customer/CustomerApp";

export const metadata = {
  title: "Customer app — NEST Solutions",
};

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; service?: string }>;
}) {
  const params = await searchParams;
  return <CustomerApp initialScreen={params.screen} initialServiceId={params.service} />;
}
