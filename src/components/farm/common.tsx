'use client';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, label } from '@/lib/utils';
export function PageHeading({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  back?: string;
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link
          href={back}
          className="inline-flex items-center text-sm text-muted-foreground mb-4 gap-1 hover:text-primary"
        >
          <ArrowLeft size={15} />
          Back
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="farm-heading text-3xl sm:text-4xl">{title}</h1>
          {description && <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const positive = [
    'ACTIVE',
    'PREGNANT',
    'ONGOING',
    'COMPLETED',
    'CALVED',
    'CLOSED_CALVED',
  ].includes(value);
  const danger = ['LOST', 'DECEASED', 'OVERDUE', 'CLOSED_LOSS'].includes(value);
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium whitespace-nowrap',
        positive
          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
          : danger
            ? 'bg-red-50 text-red-700 border-red-100'
            : 'bg-slate-50 text-slate-600 border-slate-200',
      )}
    >
      {label(value)}
    </Badge>
  );
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error?: string;
  retry: () => void;
}) {
  if (error)
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="text-red-800">{error}</p>
        <Button onClick={retry} variant="outline" className="mt-4">
          <RefreshCw />
          Try again
        </Button>
      </div>
    );
  if (loading)
    return (
      <div className="space-y-4" aria-label="Loading records">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  return null;
}
export function Empty({
  title = 'No records yet',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-10 text-center border border-dashed rounded-xl bg-white">
      <Inbox className="mx-auto text-muted-foreground mb-3" size={30} />
      <h3 className="font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Pager({
  page,
  total,
  limit = 20,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex justify-between items-center gap-4 mt-5 text-sm text-muted-foreground">
      <span>
        {total === 0
          ? '0 records'
          : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
export function Detail({ label: caption, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground mb-1">{caption}</dt>
      <dd className="font-medium break-words">{value || 'Not recorded'}</dd>
    </div>
  );
}
