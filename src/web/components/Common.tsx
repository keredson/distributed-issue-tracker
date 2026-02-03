import React from 'react';
import { X } from 'lucide-react';

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

interface LabelInputProps {
    labels: string[];
    onChange: (labels: string[]) => void;
    placeholder?: string;
}

export const LabelInput: React.FC<LabelInputProps> = ({ labels, onChange, placeholder = "Add label..." }) => {
    const [inputValue, setInputValue] = React.useState("");

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const label = inputValue.trim().replace(/^,|,$/g, '');
            if (label && !labels.includes(label)) {
                onChange([...labels, label]);
            }
            setInputValue("");
        } else if (e.key === 'Backspace' && !inputValue && labels.length > 0) {
            onChange(labels.slice(0, -1));
        }
    };

    const removeLabel = (labelToRemove: string) => {
        onChange(labels.filter(l => l !== labelToRemove));
    };

    return (
        <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg min-h-[42px] focus-within:ring-2 focus-within:ring-slate-900 dark:focus-within:ring-slate-100 transition-all">
            {labels.map(label => (
                <span key={label} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm font-medium">
                    {label}
                    <button 
                        type="button"
                        onClick={() => removeLabel(label)}
                        className="hover:text-blue-600 dark:hover:text-blue-100 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            ))}
            <input 
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={labels.length === 0 ? placeholder : ""}
                className="flex-1 bg-transparent border-none outline-none text-sm dark:text-slate-100 min-w-[120px]"
            />
        </div>
    );
};

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl',
        full: 'max-w-[95vw]'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className={`bg-white dark:bg-slate-900 w-full ${sizes[size]} rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-none">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>
            </div>
            <div className="fixed inset-0 -z-10" onClick={onClose} />
        </div>
    );
};


