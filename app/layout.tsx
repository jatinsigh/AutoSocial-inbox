export const metadata = {
  title: "AutoSocial Inbox",
  description: "WhatsApp-first inbox MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
