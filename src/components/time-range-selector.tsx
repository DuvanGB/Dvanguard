"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type TimeRange = "7d" | "30d" | "1y" | "all";

const options: { value: TimeRange; es: string; en: string }[] = [
  { value: "7d",  es: "7 días",   en: "7 days" },
  { value: "30d", es: "30 días",  en: "30 days" },
  { value: "1y",  es: "1 año",    en: "1 year" },
  { value: "all", es: "Todo",     en: "All time" },
];

export function TimeRangeSelector({ current = "7d" }: { current?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "es";

  const onChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "7d") {
        params.delete("range");
      } else {
        params.set("range", value);
      }
      const qs = params.toString();
      router.push(`${window.location.pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams]
  );

  return (
    <div className="time-range-selector">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`time-range-btn${current === opt.value ? " active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {lang === "en" ? opt.en : opt.es}
        </button>
      ))}
    </div>
  );
}
