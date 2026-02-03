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
