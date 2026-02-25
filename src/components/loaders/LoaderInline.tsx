import { Loader2 } from 'lucide-react';

type Props = { message?: string };

export default function LoaderInline({ message = 'Carregando...' }: Props) {
  return (
    <div className="flex items-center gap-2" aria-busy="true">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
