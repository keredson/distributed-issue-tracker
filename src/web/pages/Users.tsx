import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { User, Mail, ChevronRight, Search, X } from 'lucide-react';
import { Card, Avatar, Pagination } from '../components/Common.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';

export const Users = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    const searchQuery = searchParams.get('q') ?? "";
    const currentPage = parseInt(searchParams.get('page') ?? "1", 10);
    const itemsPerPage = 50;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === '/') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        fetch('/api/users')
            .then(res => res.json())
            .then(data => {
                setUsers(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch users", err);
                setLoading(false);
            });
    }, []);

    const updateParams = (updates: Record<string, string | number | null>) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                newParams.delete(key);
            } else {
                newParams.set(key, value.toString());
            }
        });
        setSearchParams(newParams, { replace: true });
    };

    const setSearchQuery = (q: string) => {
        updateParams({ q, page: 1 });
    };

    const setCurrentPage = (page: number) => {
        updateParams({ page });
    };

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;
        
        const query = searchQuery.toLowerCase().trim();
        
        return users.filter(user => {
            const name = (user.name || "").toLowerCase();
            const username = (user.username || "").toLowerCase();
            
            // Prefix match on username
            if (username.startsWith(query) || (query.startsWith('@') && username.startsWith(query.slice(1)))) {
                return true;
            }
            
            // Fuzzy match on name (simple version: name contains query)
            // Or if query is multiple words, check if all words are in the name
            const words = query.split(/\s+/);
            if (words.every(word => name.includes(word))) {
                return true;
            }

            return false;
        });
    }, [users, searchQuery]);

    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(start, start + itemsPerPage);
    }, [filteredUsers, currentPage]);

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="flex flex-col gap-6 mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Community</h2>
                
                <div className="relative w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Search by name or @username..." 
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        variant="unstyled"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 pl-9 pr-10 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all shadow-sm dark:text-slate-200"
                    />
                    {searchQuery && (
                        <Button
                            type="button"
                            variant="unstyled"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {paginatedUsers.map(user => (
                    <Link key={user.username} to={`/user/${user.username}`} className="no-underline group">
                        <Card className="p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Avatar username={user.username} size="lg" />
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {user.name}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                                        @{user.username}
                                    </div>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-700 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                        </Card>
                    </Link>
                ))}
            </div>
            
            {filteredUsers.length === 0 && (
                <div className="text-center p-12 text-slate-500">
                    {searchQuery ? "No users match your search." : "No users found."}
                </div>
            )}

            <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
            />
        </div>
    );
};
