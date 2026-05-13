import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from './Button.tsx';

export const ConfirmDialog: React.FC<{ trigger: React.ReactNode; title?: string; description?: string; onConfirm?: () => Promise<void> | void }> = ({ trigger, title, description, onConfirm }) => {
  return (
    <RadixDialog.Root>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-black/40" />
        <RadixDialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-md shadow-lg w-full max-w-md">
          {title && <RadixDialog.Title className="text-lg font-bold">{title}</RadixDialog.Title>}
          {description && <RadixDialog.Description className="text-sm text-slate-500 mt-2">{description}</RadixDialog.Description>}

          <div className="mt-6 flex justify-end gap-2">
            <RadixDialog.Close asChild>
              <Button variant="ghost" size="md">Cancel</Button>
            </RadixDialog.Close>
            <RadixDialog.Close asChild>
              <Button onClick={() => { if (onConfirm) onConfirm(); }} size="md">Confirm</Button>
            </RadixDialog.Close>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export default ConfirmDialog;
