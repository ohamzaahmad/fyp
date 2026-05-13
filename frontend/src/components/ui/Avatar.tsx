import React from 'react';
import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn } from '../../lib/utils.ts';

export const Avatar: React.FC<{ src?: string; alt?: string; className?: string }> = ({ src, alt, className }) => {
  return (
    <RadixAvatar.Root className={cn('inline-flex items-center justify-center align-middle overflow-hidden select-none w-8 h-8 rounded-full bg-slate-100', className)}>
      {src ? (
        <RadixAvatar.Image src={src} alt={alt} className="object-cover w-full h-full" />
      ) : (
        <RadixAvatar.Fallback delayMs={600} className="text-slate-700 font-medium">
          {alt ? alt.charAt(0).toUpperCase() : 'U'}
        </RadixAvatar.Fallback>
      )}
    </RadixAvatar.Root>
  );
};

export default Avatar;
