"use client";

import { useEffect, useState } from "react";
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
  };
}

export default function AlertsPage() {
  const [chatId, setChatId] = useState("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function loadAlerts() {
    if (!chatId.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/alerts?chatId=${chatId}`);
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
    setAlerts((prev) =>
      prev.filter((a) => a.alert.id !== alertId)
    );
  }

  useEffect(() => {
    const saved = localStorage.getItem("telegramChatId");
    if (saved) {
      setChatId(saved);
    }
  }, []);

  function handleSearch() {
    localStorage.setItem("telegramChatId", chatId);
    loadAlerts();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">My Alerts</h1>
      <p className="text-muted mb-6">
        Enter your Telegram Chat ID to view and manage your price alerts.
      </p>

      <div className="flex gap-3 mb-8">
        <input
          type="text"
          placeholder="Telegram Chat ID"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm outline-none focus:border-accent w-64"
        />
        <button
          onClick={handleSearch}
          className="rounded-lg bg-accent px-6 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
        >
          Load Alerts
        </button>
      </div>

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && searched && alerts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted mb-2">No active alerts found.</p>
          <Link href="/" className="text-accent hover:underline text-sm">
            Browse games to set up alerts &rarr;
          </Link>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map(({ alert, game }) => (
            <div
              key={alert.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <Link
                  href={`/game/${game.id}`}
                  className="font-medium hover:text-accent transition-colors"
                >
                  {game.title}
                </Link>
                <div className="flex gap-4 mt-1 text-sm text-muted">
                  <span>
                    Current: ₹
                    {game.currentPrice?.toLocaleString("en-IN") ?? "N/A"}
                  </span>
                  <span>
                    Target: ₹{alert.targetPrice.toLocaleString("en-IN")}
                  </span>
                  {game.currentPrice !== null &&
                    game.currentPrice <= alert.targetPrice && (
                      <span className="text-success font-medium">
                        Below target!
                      </span>
                    )}
                </div>
              </div>
              <button
                onClick={() => removeAlert(alert.id)}
                className="rounded-lg border border-border px-3 py-1 text-sm text-muted hover:text-danger hover:border-danger transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
