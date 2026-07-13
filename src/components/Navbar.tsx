"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-brand">
          <div className="navbar-logo">F</div>
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
            Today
          </Link>
          <Link
            href="/archive"
            className={`navbar-link ${pathname === "/archive" ? "active" : ""}`}
          >
            Archive
          </Link>
        </div>
      </div>
    </nav>
  );
}
