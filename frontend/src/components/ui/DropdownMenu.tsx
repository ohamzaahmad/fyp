import React from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { cn } from '../../lib/utils.ts';
import { ChevronDown } from 'lucide-react';

type MenuItem = { label: string; onSelect?: () => void; icon?: React.ReactNode };

export const DropdownMenu: React.FC<{ trigger?: React.ReactNode; items: MenuItem[]; align?: 'start' | 'center' | 'end' }> = ({ trigger, items, align = 'end' }) => {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        {trigger ? (
          // Radix `asChild` forwards props to a single element; a Fragment
          // cannot receive those props. Ensure we render a valid element.
          React.isValidElement(trigger) ? (
            trigger
          ) : (
            <button className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700">
              {trigger}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )
        ) : (
          <button className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-700">
            Menu
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </Dropdown.Trigger>

      <Dropdown.Content sideOffset={6} align={align} className="min-w-[160px] bg-white rounded-md border border-slate-100 shadow-lg p-1">
        {items.map((it, i) => (
          <Dropdown.Item key={i} onSelect={() => it.onSelect && it.onSelect()} className="outline-none">
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              {it.icon && <span className="w-4 h-4">{it.icon}</span>}
              <span>{it.label}</span>
            </div>
          </Dropdown.Item>
        ))}
      </Dropdown.Content>
    </Dropdown.Root>
  );
};

export default DropdownMenu;
