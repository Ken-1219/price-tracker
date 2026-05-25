"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Alert {
  alert: {
    id: number;
    targetPrice: number;
    isActive: boolean;
    lastNotified: string | null;
  };
  game: {
    id: string;
    title: string;
    currentPrice: number | null;
    lowestPrice: number | null;
    imageUrl: string | null;
  };
}

export default function AlertsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-40 rounded-xl bg-border/30" />}>
      <AlertsContent />
    </Suspense>
  );
}

function AlertsContent() {
  const searchParams = useSearchParams();
  const [chatId, setChatId] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const urlChatId = searchParams.get("chatId");
    if (urlChatId) {
      setChatId(urlChatId);
      localStorage.setItem("telegramChatId", urlChatId);
      loadAlerts(urlChatId);
      return;
    }
    const saved = localStorage.getItem("telegramChatId");
    if (saved) {
      setChatId(saved);
      loadAlerts(saved);
    }
  }, [searchParams]);

  async function loadAlerts(id: string) {
    if (!id.trim()) return;
    setLoading(true);
    setConnected(true);
    try {
      const res = await fetch(`/api/alerts?chatId=${id}`);
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch {
      console.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  async function removeAlert(alertId: number) {
    await fetch(`/api/alerts?id=${alertId}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.alert.id !== alertId));
  }

  async function testAlert(alert: Alert) {
    const res = await fetch("/api/alerts/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId: alert.alert.id, chatId }),
    });
    if (res.ok) {
      window.alert("Test notification sent to Telegram!");
    } else {
      window.alert("Failed to send test notification.");
    }
  }

  function connectTelegram() {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "price_tracker_psn_bot";
    window.open(`https://t.me/${botUsername}?start=connect`, "_blank");
  }

  if (!connected && !chatId) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-2">My Alerts</h1>
        <p className="text-muted mb-8">
          View and manage your price drop alerts.
        </p>

        <div className="max-w-md mx-auto text-center space-y-6 py-12">
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="text-4xl mb-4">
              <svg viewBox="0 0 24 24" className="h-12 w-12 mx-auto fill-[#2AABEE]">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-2">Connect with Telegram</h2>
            <p className="text-sm text-muted mb-6">
              Link your Telegram account to view and manage your price alerts here.
            </p>
            <button
              onClick={connectTelegram}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2AABEE] px-6 py-3 text-sm font-medium text-white hover:bg-[#229ED9] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Connect Telegram
            </button>
            <p className="text-xs text-muted mt-4">
              This will open Telegram and send you a link back to this page with your alerts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">My Alerts</h1>
      <p className="text-muted mb-6">
        Your active price drop alerts. You&apos;ll get a Telegram message when a price hits your target.
      </p>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-4 h-20" />
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-xl text-muted mb-2">No active alerts</p>
          <p className="text-sm text-muted mb-4">
            Set up price alerts on any game page to get notified when prices drop.
          </p>
          <Link href="/" className="text-accent hover:underline text-sm">
            Browse games &rarr;
          </Link>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map(({ alert, game }) => {
            const belowTarget =
              game.currentPrice !== null && game.currentPrice <= alert.targetPrice;
            return (
              <div
                key={alert.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/game/${game.id}`}
                    className="font-medium hover:text-accent transition-colors"
                  >
                    {game.title}
                  </Link>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted">
                    <span>
                      Current:{" "}
                      <span className={belowTarget ? "text-success font-medium" : ""}>
                        {game.currentPrice != null
                          ? `₹${game.currentPrice.toLocaleString("en-IN")}`
                          : "N/A"}
                      </span>
                    </span>
                    <span>
                      Target: ₹{alert.targetPrice.toLocaleString("en-IN")}
                    </span>
                    {belowTarget && (
                      <span className="text-success font-medium">
                        Below target!
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => testAlert({ alert, game })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-accent hover:border-accent transition-colors"
                    title="Send a test notification to Telegram"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-danger hover:border-danger transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
