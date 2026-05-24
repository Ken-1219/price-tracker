import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PriceTracker - PS5 Game Price Tracker",
  description: "Track PS5 game prices and get alerts on price drops",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="border-b border-border px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <a href="/" className="text-xl font-bold text-accent">
              PriceTracker
            </a>
            <div className="flex gap-4 text-sm text-muted">
              <a href="/" className="hover:text-foreground transition-colors">
                Games
              </a>
              <a
                href="/alerts"
                className="hover:text-foreground transition-colors"
              >
                My Alerts
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
