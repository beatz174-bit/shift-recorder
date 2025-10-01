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
    <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm dark:border-midnight-800 dark:bg-midnight-900 sm:px-4 sm:py-3">
      <button
        type="button"
        onClick={onPrev}
        className="flex min-w-[88px] items-center justify-center gap-2 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-midnight-800 dark:text-neutral-200 dark:hover:bg-midnight-700 sm:min-w-[104px] sm:px-3 sm:py-2 sm:text-sm"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Prev
      </button>
      <p className="flex-1 text-center text-xs font-semibold text-neutral-700 dark:text-neutral-100 sm:text-sm">
        {formatWeekLabel(range)}
      </p>
      <button
        type="button"
        onClick={onNext}
        className="flex min-w-[88px] items-center justify-center gap-2 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-midnight-800 dark:text-neutral-200 dark:hover:bg-midnight-700 sm:min-w-[104px] sm:px-3 sm:py-2 sm:text-sm"
      >
        Next <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
