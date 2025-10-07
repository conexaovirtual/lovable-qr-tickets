import { CompanyReport } from './CompanyReport';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CompanyReportListProps {
  reports: any[];
  loading: boolean;
}

export function CompanyReportList({ reports, loading }: CompanyReportListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          Nenhum relatório disponível
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <CompanyReport key={report.company_id} report={report} />
      ))}
    </div>
  );
}
