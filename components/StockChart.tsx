import React from 'react';
// FIX: Removed TooltipProps from import to avoid type conflicts. The recharts TooltipProps type can be inconsistent.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StockHistoryPoint } from '../types';

interface StockChartProps {
  data: StockHistoryPoint[];
}

// FIX: Defined a specific interface for CustomTooltip props to resolve type errors.
interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number | string }[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-slate-800 p-2 rounded-md shadow-lg">
        <p className="label text-muted-foreground">{`${label}`}</p>
        <p className="intro text-accent font-bold">{`Price: $${payload[0].value}`}</p>
      </div>
    );
  }

  return null;
};

export const StockChart: React.FC<StockChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-secondary/30 rounded-lg">
        <p className="text-muted-foreground">No historical data available.</p>
      </div>
    );
  }
  
  const chartColor = data[data.length - 1].close >= data[0].close ? '#22c55e' : '#ef4444';

  return (
    <div className="h-64 sm:h-96 w-full bg-transparent p-4 rounded-lg">
        <ResponsiveContainer>
            <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 20.2% 65.1% / 0.3)" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={['dataMin', 'dataMax']} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="close" stroke={chartColor} strokeWidth={2} dot={false} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};
