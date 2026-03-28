import Link from "next/link";

type Props = {
  label: string;
  prevHref: string;
  nextHref: string;
  disablePrev: boolean;
  disableNext: boolean;
};

export function AdminPaginationSummary({ label, prevHref, nextHref, disablePrev, disableNext }: Props) {
  return (
    <div className="admin-pagination-summary">
      <div className="admin-pagination-summary-nav" aria-label="Navegación de páginas">
        <Link
          className={`admin-pagination-summary-arrow${disablePrev ? " is-disabled" : ""}`}
          href={prevHref}
          aria-disabled={disablePrev}
          tabIndex={disablePrev ? -1 : undefined}
        >
          <ChevronLeftSmallIcon />
        </Link>
        <Link
          className={`admin-pagination-summary-arrow${disableNext ? " is-disabled" : ""}`}
          href={nextHref}
          aria-disabled={disableNext}
          tabIndex={disableNext ? -1 : undefined}
        >
          <ChevronRightSmallIcon />
        </Link>
      </div>
      <small className="muted">{label}</small>
    </div>
  );
}

function ChevronLeftSmallIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m12 5-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightSmallIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
