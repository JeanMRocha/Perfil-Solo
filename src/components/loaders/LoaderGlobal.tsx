import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@components/ui/card';

type Props = { message?: string };

export default function LoaderGlobal({ message = 'Carregando...' }: Props) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center gap-2 p-6">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <span className="font-semibold text-muted-foreground">{message}</span>
        </CardContent>
      </Card>
    </div>
  );
}
