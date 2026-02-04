import React from 'react';
import { X } from 'lucide-react';
export { Card } from './ui/card.js';
export { Badge } from './ui/badge.js';
import { Avatar as UiAvatar, AvatarImage, AvatarFallback } from './ui/avatar.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog.js';
import {
    Pagination as UiPagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis
} from './ui/pagination.js';

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
        <UiAvatar
            className={`flex-shrink-0 bg-slate-100 dark:bg-slate-800 font-medium text-slate-500 border border-slate-200 dark:border-slate-700 ${sizes[size]} ${className}`}
        >
            {!hasError ? (
                <AvatarImage
                    src={avatarUrl}
                    alt={username}
                    onError={() => setHasError(true)}
                />
            ) : (
                <AvatarFallback className="text-inherit">
                    {username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            )}
        </UiAvatar>
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
        <UiPagination className={`mt-6 ${className}`}>
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) onPageChange(currentPage - 1);
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : undefined}
                    />
                </PaginationItem>

                {start > 1 && (
                    <>
                        <PaginationItem>
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onPageChange(1);
                                }}
                            >
                                1
                            </PaginationLink>
                        </PaginationItem>
                        {start > 2 && (
                            <PaginationItem>
                                <PaginationEllipsis />
                            </PaginationItem>
                        )}
                    </>
                )}

                {pages.map(page => (
                    <PaginationItem key={page}>
                        <PaginationLink
                            href="#"
                            isActive={currentPage === page}
                            onClick={(e) => {
                                e.preventDefault();
                                onPageChange(page);
                            }}
                        >
                            {page}
                        </PaginationLink>
                    </PaginationItem>
                ))}

                {end < totalPages && (
                    <>
                        {end < totalPages - 1 && (
                            <PaginationItem>
                                <PaginationEllipsis />
                            </PaginationItem>
                        )}
                        <PaginationItem>
                            <PaginationLink
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onPageChange(totalPages);
                                }}
                            >
                                {totalPages}
                            </PaginationLink>
                        </PaginationItem>
                    </>
                )}

                <PaginationItem>
                    <PaginationNext
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) onPageChange(currentPage + 1);
                        }}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : undefined}
                    />
                </PaginationItem>
            </PaginationContent>
        </UiPagination>
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
    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl',
        full: 'max-w-[95vw]'
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                className={`w-full ${sizes[size]} max-h-[90vh] rounded-2xl p-0 overflow-hidden`}
            >
                <DialogHeader className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                    <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                        {title}
                    </DialogTitle>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
};
