import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Avatar } from './Common';

export interface User {
    username: string;
    name: string;
    email: string;
}

export const UserSelect = ({ value, onChange, placeholder = "Select user..." }: { value: string, onChange: (val: string) => void, placeholder?: string }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredUsers = useMemo(() => {
        if (!search) return users;
        const s = search.toLowerCase();
        return users.filter(u => u.username.toLowerCase().includes(s) || u.name.toLowerCase().includes(s));
    }, [users, search]);

    useEffect(() => {
        fetch('/api/users')
            .then(res => res.json())
            .then(data => setUsers(Array.isArray(data) ? data : []));
    }, []);

    const selectedUser = users.find(u => u.username === value);

    return (
        <div className="relative">
            <div 
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {selectedUser && <Avatar username={selectedUser.username} size="xs" />}
                    <span className={selectedUser ? "text-slate-900 dark:text-slate-100 truncate" : "text-slate-400"}>
                        {selectedUser ? `${selectedUser.username} (${selectedUser.name})` : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <input 
                            type="text"
                            autoFocus
                            placeholder="Search..."
                            className="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border-none outline-none rounded dark:text-slate-200"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        <div 
                            className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer italic"
                            onClick={() => {
                                onChange("");
                                setIsOpen(false);
                                setSearch("");
                            }}
                        >
                            None (Unassigned)
                        </div>
                        {filteredUsers.map(user => (
                            <div 
                                key={user.username}
                                className="px-4 py-2 text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                                onClick={() => {
                                    onChange(user.username);
                                    setIsOpen(false);
                                    setSearch("");
                                }}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <Avatar username={user.username} size="xs" />
                                    <span className="truncate">{user.username} <span className="text-slate-500 text-xs ml-1">({user.name})</span></span>
                                </div>
                                {value === user.username && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                            </div>
                        ))}
                        {filteredUsers.length === 0 && (
                            <div className="px-4 py-2 text-sm text-slate-500">No users found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
