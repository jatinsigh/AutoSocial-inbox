"use client";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="muted">© {new Date().getFullYear()} AutoSocial</div>
        <nav className="footer-links">
          <a href="/settings">Settings</a>
          <a href="/inbox">Inbox</a>
          <a href="https://razorpay.com" target="_blank" rel="noreferrer">Razorpay</a>
        </nav>
      </div>
    </footer>
  );
}
