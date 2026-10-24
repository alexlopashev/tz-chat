import Link from "next/link";
export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="masthead">
      <Link href="/" className="wordmark">
        RealClear<span>Research</span>
      </Link>
      {children ?? <span className="eyebrow">The polling desk</span>}
    </header>
  );
}
