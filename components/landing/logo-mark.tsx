"use client";

import { useId } from "react";

/** Vector approximation of the sun / moon split mark (fallback when raster is too small). */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const clipL = `${uid}-l`;
  const clipR = `${uid}-r`;
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="none" stroke="var(--mkt-chocolate)" strokeWidth="3" />
      <path d="M24 2v44" fill="none" />
      <clipPath id={clipL}>
        <rect x="0" y="0" width="24" height="48" />
      </clipPath>
      <clipPath id={clipR}>
        <rect x="24" y="0" width="24" height="48" />
      </clipPath>
      <g clipPath={`url(#${clipL})`}>
        <circle cx="24" cy="24" r="20" fill="var(--mkt-terracotta)" />
        <circle cx="24" cy="20" r="6" fill="white" />
        <g stroke="white" strokeWidth="1.5" strokeLinecap="round">
          <path d="M24 10v-3M18 12l-2-2M30 12l2-2M15 17l-2-2M33 17l2-2" />
        </g>
      </g>
      <g clipPath={`url(#${clipR})`}>
        <circle cx="24" cy="24" r="20" fill="var(--mkt-slate)" />
        <path
          d="M30 14a8 8 0 0 0-10 10 8 8 0 0 1 10-10Z"
          fill="white"
          opacity={0.95}
        />
        <circle cx="34" cy="16" r="1.2" fill="white" />
        <circle cx="36" cy="22" r="0.9" fill="white" />
        <circle cx="32" cy="26" r="0.7" fill="white" />
      </g>
    </svg>
  );
}
