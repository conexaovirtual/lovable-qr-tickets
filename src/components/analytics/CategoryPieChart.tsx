import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryDistribution } from '@/hooks/useAnalyticsData';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface CategoryPieChartProps {
  data: CategoryDistribution[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(142.1, 76.2%, 36.3%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(200, 98%, 39%)',
  'hsl(330, 81%, 60%)',
  'hsl(172, 66%, 50%)',
];

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  // Take top 7 categories + "Outros" for the rest
  const topCategories = data.slice(0, 7);
  const otherCategories = data.slice(7);
  
  const chartData = otherCategories.length > 0
    ? [
        ...topCategories,
        {
          categoria: 'Outros',
          quantidade: otherCategories.reduce((acc, c) => acc + c.quantidade, 0),
          percentual: otherCategories.reduce((acc, c) => acc + c.percentual, 0)
        }
      ]
    : topCategories;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuição por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="quantidade"
                nameKey="categoria"
                label={({ categoria, percentual }) => `${percentual}%`}
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    className="stroke-background"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [`${value} chamados`, name]}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
