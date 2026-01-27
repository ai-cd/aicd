import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-foreground bg-secondary px-2 py-1 text-xs uppercase tracking-[0.2em]",
        className
      )}
      {...props}
    />
  );
}
