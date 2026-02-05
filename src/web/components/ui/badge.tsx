import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 dark:focus:ring-slate-300',
    {
        variants: {
            variant: {
                default: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
                open: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                closed: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
                bug: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                feature: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                active: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
);

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
