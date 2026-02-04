import * as React from 'react';

import { cn } from '../../lib/utils.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: 'default' | 'unstyled';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, variant = 'default', ...props }, ref) => {
        if (variant === 'unstyled') {
            return <input ref={ref} type={type} className={cn(className)} {...props} />;
        }

        return (
            <input
                ref={ref}
                type={type}
                className={cn(
                    'flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm text-slate-950 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300',
                    className
                )}
                {...props}
            />
        );
    }
);
Input.displayName = 'Input';

export { Input };
