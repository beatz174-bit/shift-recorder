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
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-midnight-800 dark:bg-midnight-900 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onPrev}
        className="order-2 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-midnight-800 dark:text-neutral-200 dark:hover:bg-midnight-700 sm:order-1 sm:w-auto"
      >
        <ArrowLeftIcon className="h-4 w-4" /> Prev
      </button>
      <p className="order-1 text-center text-sm font-semibold text-neutral-700 dark:text-neutral-100 sm:order-2 sm:text-left">
        {formatWeekLabel(range)}
      </p>
      <button
        type="button"
        onClick={onNext}
        className="order-3 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-200 dark:bg-midnight-800 dark:text-neutral-200 dark:hover:bg-midnight-700 sm:order-3 sm:w-auto"
      >
        Next <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
