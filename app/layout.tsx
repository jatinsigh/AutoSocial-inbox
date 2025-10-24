import "./globals.css";
import type { Metadata } from "next";
import HeaderBar from "./components/HeaderBar";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "AutoSocial",
  description: "WhatsApp + Razorpay payments made simple",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="app">
        <HeaderBar />
        <div className="page">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
