import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, ChevronRight } from 'lucide-react';
import { Card, Avatar } from '../components/Common.js';

export const Users = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-8 tracking-tight">Community</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.map(user => (
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
            
            {users.length === 0 && (
                <div className="text-center p-12 text-slate-500">
                    No users found.
                </div>
            )}
        </div>
    );
};
