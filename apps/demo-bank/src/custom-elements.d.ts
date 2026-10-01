import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "amil-insight": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> &
        Record<string, unknown>;
    }
  }
}
