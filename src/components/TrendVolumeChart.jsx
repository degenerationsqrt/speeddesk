import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function TrendVolumeChart({ data }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="#253128" strokeDasharray="2 4" />
          <XAxis dataKey="week" tick={{ fill: "#7f8a83", fontSize: 10 }} />
          <YAxis tick={{ fill: "#7f8a83", fontSize: 10 }} />
          <Tooltip contentStyle={{ background: "#121713", border: "1px solid #253128", borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="meters" fill="#38bdf8" name="Meters" radius={[4, 4, 0, 0]} />
          <Bar dataKey="contacts" fill="#f6c453" name="Contacts" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
