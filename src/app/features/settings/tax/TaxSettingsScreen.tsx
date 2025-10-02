import { useMemo } from 'react';
import {
  calculateWithholding,
  getEffectiveScheduleDates,
  type PayFrequency,
  type TaxProfileSettings
} from '@tax-engine/core';
import { useTaxSettings } from './taxSettingsSlice';

const FREQUENCY_LABELS: Record<PayFrequency, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly'
};

const TAX_FREE_THRESHOLD_LABEL_ID = 'tax-free-threshold-toggle-label';
const TAX_FREE_THRESHOLD_DESCRIPTION_ID = 'tax-free-threshold-toggle-description';
const STSL_LABEL_ID = 'stsl-toggle-label';
const STSL_DESCRIPTION_ID = 'stsl-toggle-description';

export default function TaxSettingsScreen() {
  const { profile, payFrequency, setProfile, setPayFrequency, isLoading } = useTaxSettings();

  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);

  const scheduleDates = useMemo(() => getEffectiveScheduleDates(`${todayISO}T00:00:00`), [todayISO]);

  const preview = useMemo(() => {
    try {
      return calculateWithholding({
        payDate: `${todayISO}T00:00:00`,
        grossForPeriod: 0,
        frequency: payFrequency,
        profile
      });
    } catch {
      return null;
    }
  }, [todayISO, payFrequency, profile]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">Tax residency</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-300">Chrona uses your residency status to select the correct ATO scale.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setProfile({
                ...profile,
                residency: 'resident',
                claimsTaxFreeThreshold: profile.claimsTaxFreeThreshold,
                medicareLevy: profile.medicareLevy
              })
            }
            disabled={isLoading}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ${
              profile.residency === 'resident'
                ? 'bg-primary text-primary-foreground shadow'
                : 'border border-neutral-300 text-neutral-700 hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 dark:hover:text-primary-foreground'
            }`}
            aria-pressed={profile.residency === 'resident'}
          >
            Resident
          </button>
          <button
            type="button"
            onClick={() =>
              setProfile({
                ...profile,
                residency: 'nonResident',
                claimsTaxFreeThreshold: false,
                medicareLevy: 'fullExempt'
              })
            }
            disabled={isLoading}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ${
              profile.residency === 'nonResident'
                ? 'bg-primary text-primary-foreground shadow'
                : 'border border-neutral-300 text-neutral-700 hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 dark:hover:text-primary-foreground'
            }`}
            aria-pressed={profile.residency === 'nonResident'}
          >
            Non-resident
          </button>
        </div>
      </section>

      {profile.residency === 'resident' && (
        <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
          <header className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">Resident options</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-300">These toggles mirror the declarations you would make on a TFN declaration.</p>
          </header>
          <div className="flex flex-col gap-3">
            <div
              className="flex items-center justify-between gap-3 text-sm text-neutral-700 dark:text-neutral-100"
              role="group"
              aria-labelledby={TAX_FREE_THRESHOLD_LABEL_ID}
              aria-describedby={TAX_FREE_THRESHOLD_DESCRIPTION_ID}
            >
              <span className="flex flex-col">
                <span id={TAX_FREE_THRESHOLD_LABEL_ID} className="font-medium">
                  Tax-free threshold
                </span>
                <span
                  id={TAX_FREE_THRESHOLD_DESCRIPTION_ID}
                  className="text-xs text-neutral-500 dark:text-neutral-300"
                >
                  Claim the first $18,200 of income tax-free.
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setProfile({
                    ...profile,
                    claimsTaxFreeThreshold: !profile.claimsTaxFreeThreshold
                  })
                }
                disabled={isLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  profile.claimsTaxFreeThreshold ? 'bg-primary' : 'bg-neutral-300 dark:bg-midnight-700'
                }`}
                role="switch"
                aria-checked={profile.claimsTaxFreeThreshold}
                aria-labelledby={TAX_FREE_THRESHOLD_LABEL_ID}
                aria-describedby={TAX_FREE_THRESHOLD_DESCRIPTION_ID}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    profile.claimsTaxFreeThreshold ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-100">Medicare levy status</legend>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'standard', label: 'Standard', helper: 'Full 2% levy applies.' },
                  { value: 'halfExempt', label: 'Half exemption', helper: '1% levy (half exemption granted).' },
                  { value: 'fullExempt', label: 'Exempt', helper: 'No Medicare levy withheld.' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setProfile({
                        ...profile,
                        medicareLevy: option.value as TaxProfileSettings['medicareLevy']
                      })
                    }
                    disabled={isLoading}
                    className={`rounded-full px-4 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ${
                      profile.medicareLevy === option.value
                        ? 'bg-primary text-primary-foreground shadow'
                        : 'border border-neutral-300 text-neutral-700 hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 dark:hover:text-primary-foreground'
                    }`}
                    aria-pressed={profile.medicareLevy === option.value}
                  >
                    <span className="block text-left">
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-neutral-200/80 sm:text-[0.65rem] dark:text-neutral-200/90">
                        {option.helper}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">Study & Training Support Loan</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-300">Enable this if you have a HELP, VSL or STSL balance owing.</p>
        </header>
        <div
          className="flex items-center justify-between gap-3 text-sm text-neutral-700 dark:text-neutral-100"
          role="group"
          aria-labelledby={STSL_LABEL_ID}
          aria-describedby={STSL_DESCRIPTION_ID}
        >
          <span className="flex flex-col">
            <span id={STSL_LABEL_ID} className="font-medium">
              Withhold STSL repayments
            </span>
            <span id={STSL_DESCRIPTION_ID} className="text-xs text-neutral-500 dark:text-neutral-300">
              Adds Schedule 8 on top of Schedule 1.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setProfile({ ...profile, hasSTSL: !profile.hasSTSL })}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              profile.hasSTSL ? 'bg-primary' : 'bg-neutral-300 dark:bg-midnight-700'
            }`}
            role="switch"
            aria-checked={profile.hasSTSL}
            aria-labelledby={STSL_LABEL_ID}
            aria-describedby={STSL_DESCRIPTION_ID}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                profile.hasSTSL ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-midnight-800 dark:bg-midnight-900">
        <header className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">Pay frequency</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-300">Chrona assumes each shift belongs to this pay cycle when estimating withholding.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FREQUENCY_LABELS) as PayFrequency[]).map((frequency) => (
            <button
              key={frequency}
              type="button"
              onClick={() => setPayFrequency(frequency)}
              disabled={isLoading}
              className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ${
                payFrequency === frequency
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'border border-neutral-300 text-neutral-700 hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 dark:hover:text-primary-foreground'
              }`}
              aria-pressed={payFrequency === frequency}
            >
              {FREQUENCY_LABELS[frequency]}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-midnight-700 dark:bg-midnight-900/40 dark:text-neutral-200">
        <p>
          Using ATO Schedule 1 (effective {scheduleDates.schedule1EffectiveFrom})
          {profile.hasSTSL && preview?.effectiveSchedules.schedule8EffectiveFrom
            ? ` and Schedule 8 (effective ${preview.effectiveSchedules.schedule8EffectiveFrom}).`
            : '.'}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-300">
          Amounts are estimates only. Check official tax tables for your circumstances.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href="https://www.ato.gov.au/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 font-semibold text-neutral-700 transition hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 dark:hover:border-primary dark:hover:text-primary-foreground"
          >
            Learn about Schedule 1
          </a>
          <a
            href="https://www.ato.gov.au/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-3 py-1 font-semibold text-neutral-700 transition hover:border-primary hover:text-primary-emphasis dark:border-midnight-700 dark:text-neutral-200 dark:hover:border-primary dark:hover:text-primary-foreground"
          >
            Learn about Schedule 8
          </a>
        </div>
      </section>
    </div>
  );
}
