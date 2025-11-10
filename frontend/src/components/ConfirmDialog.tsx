import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-gray-900 dark:text-gray-100 shadow-lg">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">{message}</div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700" onClick={onCancel}>{cancelLabel}</button>
          <button className="px-3 py-2 rounded bg-red-600 text-white" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

