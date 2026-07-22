import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const compactDate = (date) => (date || "").slice(5);

export default function TrendLineChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#253128" strokeDasharray="2 4" />
          <XAxis dataKey="date" tick={{ fill: "#7f8a83", fontSize: 10 }} tickFormatter={compactDate} />
          <YAxis
            tick={{ fill: "#7f8a83", fontSize: 10 }}
            tickFormatter={(value) => Number(value).toFixed(2)}
            domain={[
              (dataMin) => Math.max(0, Math.floor((dataMin - 0.1) * 100) / 100),
              (dataMax) => Math.ceil((dataMax + 0.1) * 100) / 100,
            ]}
          />
          <Tooltip contentStyle={{ background: "#121713", border: "1px solid #253128", borderRadius: 8, fontSize: 12 }} />
          <Line type="monotone" dataKey="time" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} name="Time" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
