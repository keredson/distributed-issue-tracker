import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "" }) => (
    <div className={"bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm " + className}>
        {children}
    </div>
);

interface BadgeProps {
    children: React.ReactNode;
    variant?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = "default" }) => {
    const variants: {[key: string]: string} = {
        default: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
        open: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        closed: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
        bug: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        feature: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        assigned: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
        'in-progress': "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    };
    return (
        <span className={"px-2.5 py-0.5 rounded-full text-xs font-semibold " + (variants[variant] || variants.default)}>
            {typeof children === 'string' ? children.toUpperCase() : children}
        </span>
    );
};

interface AvatarProps {
    username: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ username, size = 'md', className = "" }) => {
    const sizes = {
        xs: "w-5 h-5 text-[10px]",
        sm: "w-8 h-8 text-xs",
        md: "w-10 h-10 text-sm",
        lg: "w-12 h-12 text-base"
    };

    const [hasError, setHasError] = React.useState(false);
    const avatarUrl = `/api/users/${username}/avatar`;

    if (!username) return null;

    return (
        <div className={`relative flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex items-center justify-center font-medium text-slate-500 border border-slate-200 dark:border-slate-700 ${sizes[size]} ${className}`}>
            {!hasError ? (
                <img 
                    src={avatarUrl} 
                    alt={username} 
                    className="w-full h-full object-cover"
                    onError={() => setHasError(true)}
                />
            ) : (
                <span>{username.slice(0, 2).toUpperCase()}</span>
            )}
        </div>
    );
};

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, className = "" }) => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    return (
        <div className={"flex items-center justify-center gap-1 mt-6 " + className}>
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
            >
                Previous
            </button>
            
            {start > 1 && (
                <>
                    <button
                        onClick={() => onPageChange(1)}
                        className="w-9 py-1.5 rounded-md text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                    >
                        1
                    </button>
                    {start > 2 && <span className="text-slate-400">...</span>}
                </>
            )}

            {pages.map(page => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-9 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        currentPage === page
                            ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                >
                    {page}
                </button>
            ))}

            {end < totalPages && (
                <>
                    {end < totalPages - 1 && <span className="text-slate-400">...</span>}
                    <button
                        onClick={() => onPageChange(totalPages)}
                        className="w-9 py-1.5 rounded-md text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                    >
                        {totalPages}
                    </button>
                </>
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
            >
                Next
            </button>
        </div>
    );
};
