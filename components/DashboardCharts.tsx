'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = {
  tank5: '#38bdf8', tank10: '#0369a1',
  cash: '#10b981', card: '#8b5cf6',
  gas: '#b45309', diesel: '#9a3412',
};

export function DashboardCharts({
  tanks, pay, fuelSeries,
}: {
  tanks: { t5: number; t10: number };
  pay: { cash: number; card: number };
  fuelSeries: { d: string; gas: number; diesel: number }[];
}) {
  const tankData = [
    { name: '5,000 gal', value: tanks.t5 },
    { name: '10,000 gal', value: tanks.t10 },
  ];
  const payData = [
    { name: 'Cash', value: pay.cash },
    { name: 'Card', value: pay.card },
  ];
  const fuel = fuelSeries.map((r) => ({ ...r, d: r.d.slice(5) }));

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="Waste water trips — 5k vs 10k" empty={tanks.t5 + tanks.t10 === 0}>
        <PieChart>
          <Pie data={tankData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%">
            <Cell fill={COLORS.tank5} />
            <Cell fill={COLORS.tank10} />
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" />
        </PieChart>
      </Card>

      <Card title="Daily fuel receipts" empty={fuel.length === 0}>
        <LineChart data={fuel}>
          <XAxis dataKey="d" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend verticalAlign="bottom" />
          <Line type="monotone" dataKey="gas" name="Gas" stroke={COLORS.gas} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="diesel" name="Diesel" stroke={COLORS.diesel} strokeWidth={2} dot={false} />
        </LineChart>
      </Card>

      <Card title="Maintenance spend — cash vs card" empty={pay.cash + pay.card === 0}>
        <BarChart data={payData}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            <Cell fill={COLORS.cash} />
            <Cell fill={COLORS.card} />
          </Bar>
        </BarChart>
      </Card>
    </div>
  );
}

function Card({
  title, empty, children,
}: {
  title: string;
  empty: boolean;
  children: React.ReactElement;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">{title}</h2>
      <div style={{ height: 230 }}>
        {empty ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">
            No data for this period.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
