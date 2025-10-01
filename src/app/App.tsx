import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { getSettings } from './db/repo';
import SummaryPage from './routes/SummaryPage';
import ShiftsPage from './routes/ShiftsPage';
import SettingsPage from './routes/SettingsPage';
import { useSettings } from './state/SettingsContext';
import NotificationManager from './state/NotificationManager';
import { CalendarDaysIcon, ChartPieIcon, Cog6ToothIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { ShiftCreationProvider, useShiftCreation } from './state/ShiftCreationContext';

function NavigationLink({ to, children, label }: { to: string; children: ReactNode; label?: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary text-primary-foreground shadow'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
        }`
      }
      aria-label={label}
      title={label}
    >
      {children}
    </NavLink>
  );
}

function Layout() {
  const { settings } = useSettings();
  const { openCreateModal } = useShiftCreation();
  useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: !settings,
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <NotificationManager />
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">Chrona</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Precision shift tracking for people who live by the clock
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <NavigationLink to="/" label="Summary">
              <span className="sr-only">Summary</span>
              <ChartPieIcon className="h-5 w-5" aria-hidden />
            </NavigationLink>
            <NavigationLink to="/shifts" label="Shifts">
              <span className="sr-only">Shifts</span>
              <CalendarDaysIcon className="h-5 w-5" aria-hidden />
            </NavigationLink>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={!settings}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 disabled:hover:bg-primary dark:focus-visible:ring-offset-slate-900"
              aria-label="Add shift"
              title="Add shift"
            >
              <PlusCircleIcon className="h-6 w-6" aria-hidden />
            </button>
            <NavigationLink to="/settings" label="Settings">
              <span className="sr-only">Settings</span>
              <Cog6ToothIcon className="h-5 w-5" aria-hidden />
            </NavigationLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-32 pt-6">
        <Routes>
          <Route path="/" element={<SummaryPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ShiftCreationProvider>
        <Layout />
      </ShiftCreationProvider>
    </BrowserRouter>
  );
}
