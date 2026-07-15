"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <div className="navbar-logo">FP</div>
          <div>
            <div className="navbar-title">FinPulse</div>
            <div className="navbar-subtitle">Intelligence Platform</div>
          </div>
        </Link>
        <div className="navbar-links">
          <Link
            href="/"
            className={`navbar-link ${pathname === "/" ? "active" : ""}`}
          >
            {/* Home / Feed icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            Today
          </Link>
          <Link
            href="/archive"
            className={`navbar-link ${pathname === "/archive" ? "active" : ""}`}
          >
            {/* Archive icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5" rx="1"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            Archive
          </Link>
        </div>
      </div>
    </nav>
  );
}
