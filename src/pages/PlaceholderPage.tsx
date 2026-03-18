import { FileQuestion } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
      </div>
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <FileQuestion className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">{title}</h1>
        <p className="text-muted-foreground max-w-md">
          {description ?? 'This page is coming soon. Use the sidebar to navigate.'}
        </p>
      </div>
    </div>
  );
}
