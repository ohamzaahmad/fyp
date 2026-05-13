import React from 'react';
import * as RadixPopover from '@radix-ui/react-popover';

export const Popover: React.FC<{ trigger: React.ReactNode; children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }> = ({ trigger, children, side = 'bottom' }) => {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>
        {trigger}
      </RadixPopover.Trigger>
      <RadixPopover.Content side={side} sideOffset={6} className="bg-white rounded-md border p-3 shadow-lg min-w-[200px]">
        {children}
        <RadixPopover.Arrow className="fill-white" />
      </RadixPopover.Content>
    </RadixPopover.Root>
  );
};

export default Popover;
