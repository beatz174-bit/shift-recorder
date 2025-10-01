import { ReactNode, createContext, useContext, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '../components/Modal';
import ShiftForm, { type ShiftFormValues } from '../components/ShiftForm';
import { createShift } from '../db/repo';
import { useSettings } from './SettingsContext';

export type ShiftCreationContextValue = {
  openCreateModal: () => void;
  closeCreateModal: () => void;
  isCreateModalOpen: boolean;
};

const ShiftCreationContext = createContext<ShiftCreationContextValue | undefined>(undefined);

export function ShiftCreationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  const createMutation = useMutation({
    mutationFn: async (values: ShiftFormValues) => {
      if (!settings) {
        throw new Error('Settings are not ready yet.');
      }
      return createShift({ startISO: values.start, endISO: values.end, note: values.note }, settings);
    },
    onSuccess: async () => {
      setIsOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] })
      ]);
    }
  });

  const openCreateModal = () => {
    setIsOpen(true);
  };

  const closeCreateModal = () => {
    setIsOpen(false);
  };

  const value = useMemo<ShiftCreationContextValue>(
    () => ({
      openCreateModal,
      closeCreateModal,
      isCreateModalOpen: isOpen
    }),
    [isOpen]
  );

  return (
    <ShiftCreationContext.Provider value={value}>
      {children}
      <Modal isOpen={isOpen} onClose={closeCreateModal} title="Add a shift">
        <ShiftForm
          key={isOpen ? 'create-open' : 'create-closed'}
          onSubmit={async (values) => {
            await createMutation.mutateAsync(values);
          }}
          onCancel={closeCreateModal}
          submitLabel="Save shift"
        />
      </Modal>
    </ShiftCreationContext.Provider>
  );
}

export function useShiftCreation() {
  const context = useContext(ShiftCreationContext);
  if (!context) {
    throw new Error('useShiftCreation must be used within a ShiftCreationProvider');
  }
  return context;
}
