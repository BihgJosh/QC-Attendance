import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandedLoaderProps = {
  className?: string;
  compact?: boolean;
};

export function BrandedLoader({ className, compact = false }: BrandedLoaderProps) {
  return (
    <div
      className={cn("qc-loader text-center", compact && "qc-loader--compact", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading your request"
    >
      <div className="qc-loader__mark" aria-hidden="true">
        <span className="qc-loader__orbit" />
        <span className="qc-loader__orbit qc-loader__orbit--inner" />
        <Image
          src="/icon.png"
          alt=""
          width={96}
          height={96}
          priority
          className="qc-loader__logo"
        />
      </div>
      <p className="qc-loader__title">Just a moment…</p>
      {!compact ? <p className="qc-loader__copy">We’re loading your request</p> : null}
    </div>
  );
}
