const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN not set, skipping notification");
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      console.error(`Telegram API error: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send Telegram message: ${err}`);
    return false;
  }
}

export function formatPriceDropMessage(
  title: string,
  currentPrice: number,
  previousPrice: number,
  lowestPrice: number,
  url: string
): string {
  const drop = previousPrice - currentPrice;
  const dropPercent = Math.round((drop / previousPrice) * 100);
  const isAllTimeLow = currentPrice <= lowestPrice;

  return [
    `🎮 <b>Price Drop Alert!</b>`,
    ``,
    `<b>${title}</b>`,
    ``,
    `💰 ₹${previousPrice.toLocaleString("en-IN")} → <b>₹${currentPrice.toLocaleString("en-IN")}</b>`,
    `📉 Down ₹${drop.toLocaleString("en-IN")} (${dropPercent}% off)`,
    isAllTimeLow ? `🏆 <b>ALL-TIME LOW PRICE!</b>` : `📊 Lowest ever: ₹${lowestPrice.toLocaleString("en-IN")}`,
    ``,
    `🔗 <a href="${url}">View on PS Store</a>`,
  ].join("\n");
}
