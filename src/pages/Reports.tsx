import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { reportList } from '@/lib/report-config';
import { BackButton } from '@/components/BackButton';

export default function Reports() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-sm text-muted-foreground">Comprehensive business intelligence</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportList.map(report => {
          const ReportIcon = report.icon;
          return (
            <Link
              key={report.id}
              to={`/reports/${report.slug}`}
              className="glass-card card-hover p-5 flex items-start gap-4 block transition-all hover:ring-2 hover:ring-primary/20"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ReportIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-muted-foreground shrink-0">
                    {report.category}
                  </span>
                </div>
                <span className="flex items-center gap-1.5 mt-3 text-xs text-primary font-medium">
                  <Download className="w-3 h-3" />
                  View report
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
