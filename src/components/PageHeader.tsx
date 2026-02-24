
interface PageHeaderProps {
  title: string;
  color?: string; // color logic from palette might need adjustment if using Tailwind colors
}

export default function PageHeader({ title }: PageHeaderProps) {

  return (
    <div className="space-y-4 mb-6 mt-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
      </div>
      <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />
    </div>
  );
}
