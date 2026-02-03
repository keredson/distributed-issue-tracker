import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout, Sun, Moon, Users } from 'lucide-react';
import { useTheme } from './ThemeContext.js';
import { Avatar } from './Common.js';

export const Header = () => {
    const { isDark, toggleTheme } = useTheme();
    const [me, setMe] = useState<any>(null);

    useEffect(() => {
        fetch('/api/me')
            .then(res => res.json())
            .then(data => setMe(data))
            .catch(() => {});
    }, []);

    return (
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
                <div className="flex items-center gap-8">
                    <Link to="/issues" className="flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
                        <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-1.5 rounded-lg">
                            <Layout className="w-5 h-5" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">dit</h1>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        <Link to="/issues" className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white no-underline rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                            Issues
                        </Link>
                        <Link to="/users" className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white no-underline rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            Community
                        </Link>
                    </nav>
                </div>

                <div className="flex gap-4 items-center">
                    {me && (
                        <Link to={`/user/${me.username}`} className="no-underline hover:opacity-80 transition-opacity">
                            <Avatar username={me.username} size="sm" title={`Logged in as ${me.username}`} />
                        </Link>
                    )}
                    {/* @ts-ignore */}
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">repo:{window.repoName || 'REPO'}</span>
                    
                    <button 
                        onClick={toggleTheme}
                        className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                    >
                        {isDark ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>

                    <Link to="/new" className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-sm no-underline">
                        New Issue
                    </Link>
                </div>
            </div>
        </header>
    );
};
