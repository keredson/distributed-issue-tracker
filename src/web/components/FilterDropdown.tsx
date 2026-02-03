import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Avatar } from './Common';

export const FilterDropdown = ({ label, items, value, onChange, showAvatars }: { label: string, items: string[], value?: string, onChange: (val: string) => void, showAvatars?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredItems = useMemo(() => {
        if (!search) return items;
        const s = search.toLowerCase();
        return items.filter(item => item.toLowerCase().includes(s));
    }, [items, search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSearch("");
        }
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors py-1 px-2"
            >
                {label} 
                {value && (
                    <div className="flex items-center gap-1.5 ml-1">
                        {showAvatars && value !== 'Unassigned' && <Avatar username={value} size="xs" />}
                        <span className="text-slate-900 dark:text-slate-200 font-bold">{value}</span>
                    </div>
                )}
                <ChevronDown className="w-3 h-3" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filter by {label}</span>
                        {value && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange("");
                                    setIsOpen(false);
                                }}
                                className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {items.length > 5 && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                            <input 
                                type="text"
                                autoFocus
                                placeholder={`Filter ${label.toLowerCase()}s...`}
                                className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none rounded dark:text-slate-200"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                    )}
                    <div className="max-h-60 overflow-y-auto">
                        {filteredItems.map(item => (
                            <div 
                                key={item}
                                className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                                onClick={() => {
                                    onChange(item);
                                    setIsOpen(false);
                                }}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {showAvatars && item !== 'Unassigned' && <Avatar username={item} size="xs" />}
                                    <span className="truncate pr-2">{item}</span>
                                </div>
                                {value === item && <Check className="w-3 h-3 text-blue-600 flex-shrink-0" />}
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="px-4 py-3 text-xs text-slate-500 italic text-center">
                                No {label.toLowerCase()}s found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
