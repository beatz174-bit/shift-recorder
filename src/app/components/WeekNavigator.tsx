import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import type { WeekRange } from '../logic/week';
import { formatWeekLabel } from '../logic/week';

export type WeekNavigatorProps = {
  range: WeekRange;
  onPrev: () => void;
  onNext: () => void;
};

export default function WeekNavigator({ range, onPrev, onNext }: WeekNavigatorProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onPrev}
        className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Prev
      </button>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{formatWeekLabel(range)}</p>
      <button
        type="button"
        onClick={onNext}
        className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Next <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
