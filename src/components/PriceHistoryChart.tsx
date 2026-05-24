"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface PricePoint {
  price: number;
  recordedAt: string;
}

interface PriceHistoryChartProps {
  data: PricePoint[];
  highestPrice: number | null;
  lowestPrice: number | null;
}

export function PriceHistoryChart({
  data,
  highestPrice,
  lowestPrice,
}: PriceHistoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        No price history yet. Check back after the first price check runs.
      </div>
    );
  }

  const chartData = [...data]
    .reverse()
    .map((point) => ({
      date: new Date(point.recordedAt).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      }),
      price: point.price,
      fullDate: new Date(point.recordedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    }));

  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = Math.max((maxPrice - minPrice) * 0.1, 50);
  const labelInterval = Math.max(Math.floor(chartData.length / 8) - 1, 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
          <XAxis
            dataKey="date"
            stroke="#737373"
            tick={{ fontSize: 12 }}
            interval={labelInterval}
          />
          <YAxis
            stroke="#737373"
            tick={{ fontSize: 12 }}
            domain={[minPrice - padding, maxPrice + padding]}
            tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#141414",
              border: "1px solid #262626",
              borderRadius: "8px",
              color: "#ededed",
            }}
            formatter={(value) => [
              `₹${Number(value).toLocaleString("en-IN")}`,
              "Price",
            ]}
            labelFormatter={(_label, payload) => {
              const entry = payload?.[0]?.payload as { fullDate?: string } | undefined;
              return entry?.fullDate ?? String(_label);
            }}
          />
          <Line
            type="stepAfter"
            dataKey="price"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#06b6d4" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
