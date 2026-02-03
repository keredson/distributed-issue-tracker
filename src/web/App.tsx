import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeContext.js';
import { Header } from './components/Header.js';
import { Issues } from './pages/Issues.js';
import { NewIssue } from './pages/NewIssue.js';
import { IssueView } from './pages/IssueView.js';
import { Users } from './pages/Users.js';
import { UserDetail } from './pages/UserDetail.js';

export default function App() {
    return (
        <ThemeProvider>
            <BrowserRouter>
                <div className="min-h-screen flex flex-col">
                    <Header />
                    <main className="flex-1 bg-slate-50 dark:bg-slate-950 transition-colors">
                        <Routes>
                            <Route path="/" element={<Navigate to="/issues" replace />} />
                            <Route path="/issues" element={<Issues />} />
                            <Route path="/new" element={<NewIssue />} />
                            <Route path="/issue/*" element={<IssueView />} />
                            <Route path="/users" element={<Users />} />
                            <Route path="/user/:username" element={<UserDetail />} />
                            <Route path="*" element={
                                <div className="p-12 text-center">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Page not found</h2>
                                    <Link to="/issues" className="text-blue-600 hover:underline">Go to Issues</Link>
                                </div>
                            } />
                        </Routes>
                    </main>
                </div>
            </BrowserRouter>
        </ThemeProvider>
    );
}