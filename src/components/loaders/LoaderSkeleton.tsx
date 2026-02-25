import { Card, CardContent } from '@components/ui/card';

export default function LoaderSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="h-6 w-full animate-pulse rounded bg-muted" />
          <div className="h-[18px] w-full animate-pulse rounded bg-muted" />
          <div className="h-[18px] w-full animate-pulse rounded bg-muted" />
          <div className="mt-1 h-40 w-full animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
