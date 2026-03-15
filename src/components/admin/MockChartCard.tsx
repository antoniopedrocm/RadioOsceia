import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export function MockChartCard() {
  const pieData = [{ name: 'Estudo', value: 8 }, { name: 'Reflexão', value: 6 }, { name: 'Oração', value: 4 }];
  const barData = [{ tipo: 'YouTube', qtd: 18 }, { tipo: 'Local', qtd: 10 }, { tipo: 'Vinheta', qtd: 7 }];
  const colors = ['#1E4FAE', '#D8B45C', '#0F766E'];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Conteúdos por categoria</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80}>{pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card>
      <Card><CardHeader><CardTitle>Mídias por tipo</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={barData}><XAxis dataKey="tipo" /><YAxis /><Tooltip /><Bar dataKey="qtd" fill="#1E4FAE" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
    </div>
  );
}
