import { buttonVariants } from "@amil/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { deepLinkToPath } from "@/lib/format";

/** A bank deep link (ddb://…) from AMIL, rendered as a link into this app. */
export function DeepLinkButton({
  deepLink,
  primary,
  testId,
  children,
}: {
  deepLink: string;
  primary?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  const href = deepLinkToPath(deepLink) ?? "/";
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: primary ? "default" : "outline", block: true })}
      data-testid={testId}
    >
      {children}
    </Link>
  );
}
