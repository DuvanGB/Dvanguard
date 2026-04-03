import Link from "next/link";

export function PlatformFooter() {
  return (
    <footer className="platform-footer">
      <div className="platform-footer-inner">
        <div className="platform-footer-brand">
          <span className="platform-footer-logo">DVanguard AI</span>
          <p className="platform-footer-copy">© 2026 DVanguard Studio. All rights reserved.</p>
        </div>
        <div className="platform-footer-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <a
            href="https://wa.me/573000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="platform-footer-wa"
          >
            <span className="material-symbols-outlined">chat</span>
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
