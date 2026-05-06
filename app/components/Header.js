'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="header">
      <Link href="/" className="header-brand">
        <img src="/edutech-logo-white.png" alt="EduTech Global" className="header-logo-img" />
        <div className="header-subtitle">AI Knowledge Assistant</div>
      </Link>
      <nav className="header-nav">
        <Link href="/" className={`header-link ${pathname === '/' ? 'active' : ''}`}>
          💬 Chat
        </Link>
        <Link href="/admin" className={`header-link ${pathname === '/admin' ? 'active' : ''}`}>
          ⚙️ Admin
        </Link>
      </nav>
    </header>
  );
}
