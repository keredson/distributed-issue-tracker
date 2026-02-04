import React from 'react';
import { Toaster as Sonner } from 'sonner';
import { cn } from '../../lib/utils.js';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ className, toastOptions, ...props }: ToasterProps) => (
    <Sonner
        className={cn('toaster group', className)}
        toastOptions={{
            classNames: {
                toast: 'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg dark:group-[.toaster]:bg-slate-900 dark:group-[.toaster]:text-slate-100 dark:group-[.toaster]:border-slate-800',
                description: 'group-[.toast]:text-slate-500 dark:group-[.toast]:text-slate-400',
                actionButton: 'group-[.toast]:bg-slate-900 group-[.toast]:text-white dark:group-[.toast]:bg-slate-100 dark:group-[.toast]:text-slate-900',
                cancelButton: 'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700 dark:group-[.toast]:bg-slate-800 dark:group-[.toast]:text-slate-200',
                closeButton: 'group-[.toast]:text-slate-400 hover:group-[.toast]:text-slate-700 dark:group-[.toast]:text-slate-500 dark:hover:group-[.toast]:text-slate-200'
            },
            ...toastOptions
        }}
        {...props}
    />
);

export { Toaster };
