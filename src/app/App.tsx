import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { getSettings } from './db/repo';
import SummaryPage from './routes/SummaryPage';
import ShiftsPage from './routes/ShiftsPage';
import SettingsPage from './routes/SettingsPage';
import { useSettings } from './state/SettingsContext';
import NotificationManager from './state/NotificationManager';
import ImportExportModal from './components/ImportExportModal';

function NavigationLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary text-primary-foreground shadow'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function Layout() {
  const { settings } = useSettings();
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    enabled: !settings
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <NotificationManager />
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">Shift Recorder</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Offline-first time tracker</p>
          </div>
          <nav className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <NavigationLink to="/" label="Summary" />
            <NavigationLink to="/shifts" label="Shifts" />
            <NavigationLink to="/settings" label="Settings" />
            <button
              type="button"
              onClick={() => setIsImportExportOpen(true)}
              className="px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Import/Export
            </button>
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
      <ImportExportModal isOpen={isImportExportOpen} onClose={() => setIsImportExportOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
