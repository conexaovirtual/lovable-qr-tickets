import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendData } from '@/hooks/useAnalyticsData';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';

interface TrendChartProps {
  data: TrendData[];
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendência de Chamados (Últimos 6 Meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mes" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="criados" 
                stroke="hsl(var(--destructive))" 
                name="Criados"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--destructive))' }}
              />
              <Line 
                type="monotone" 
                dataKey="resolvidos" 
                stroke="hsl(142.1, 76.2%, 36.3%)" 
                name="Resolvidos"
                strokeWidth={2}
                dot={{ fill: 'hsl(142.1, 76.2%, 36.3%)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
