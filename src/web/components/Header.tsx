import React from 'react';
import { Link } from 'react-router-dom';
import { Layout, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext.js';

export const Header = () => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
                <Link to="/issues" className="flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
                <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-1.5 rounded-lg">
                    <Layout className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">dit</h1>
                </Link>
                <div className="flex gap-4 items-center">
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
