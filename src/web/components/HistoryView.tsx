import React, { useState, useRef, useEffect } from 'react';
import { History, FileText, GitPullRequest, Calendar, User, ChevronRight, X, Clock } from 'lucide-react';
import yaml from 'js-yaml';
import { Card, Modal, Avatar } from './Common.js';
import { Markdown } from './Markdown.js';

interface HistoryItem {
    hash: string;
    author: string;
    date: string;
    message: string;
}

interface HistoryViewProps {
    issueId: string;
    commentId?: string;
    className?: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ issueId, commentId, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<HistoryItem | null>(null);
    const [viewMode, setViewMode] = useState<'content' | 'diff'>('content');
    const [modalContent, setModalContent] = useState<string>("");
    const [loadingContent, setLoadingContent] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggleOpen = async () => {
        if (!isOpen && history.length === 0) {
            setLoading(true);
            try {
                const url = `/api/issues/${issueId}/history${commentId ? `?commentId=${commentId}` : ''}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data);
                }
            } catch (err) {
                console.error("Failed to fetch history", err);
            } finally {
                setLoading(false);
            }
        }
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleViewVersion = async (version: HistoryItem, mode: 'content' | 'diff') => {
        setSelectedVersion(version);
        setViewMode(mode);
        setLoadingContent(true);
        setIsOpen(false);

        try {
            let url = "";
            if (mode === 'content') {
                url = `/api/issues/${issueId}/history/content?commit=${version.hash}${commentId ? `&commentId=${commentId}` : ''}`;
            } else {
                // For diff, we need the previous hash. If it's the first commit, diff against empty?
                // Or just show content.
                const index = history.findIndex(h => h.hash === version.hash);
                const prevHash = index < history.length - 1 ? history[index + 1].hash : null;
                
                if (!prevHash) {
                    // Fallback to content if no previous version
                    setViewMode('content');
                    url = `/api/issues/${issueId}/history/content?commit=${version.hash}${commentId ? `&commentId=${commentId}` : ''}`;
                } else {
                    url = `/api/issues/${issueId}/history/diff?commit1=${prevHash}&commit2=${version.hash}${commentId ? `&commentId=${commentId}` : ''}`;
                }
            }

            const res = await fetch(url);
            if (res.ok) {
                const text = await res.text();
                setModalContent(text);
            }
        } catch (err) {
            console.error("Failed to fetch version data", err);
        } finally {
            setLoadingContent(false);
        }
    };

    const renderDiff = (diff: string) => {
        return diff.split('\n').map((line, i) => {
            let bgColor = "";
            let textColor = "text-slate-700 dark:text-slate-300";
            if (line.startsWith('+')) {
                bgColor = "bg-green-50 dark:bg-green-900/20";
                textColor = "text-green-700 dark:text-green-400";
            } else if (line.startsWith('-')) {
                bgColor = "bg-red-50 dark:bg-red-900/20";
                textColor = "text-red-700 dark:text-red-400";
            } else if (line.startsWith('@@')) {
                bgColor = "bg-blue-50/50 dark:bg-blue-900/10";
                textColor = "text-blue-500 dark:text-blue-400";
            }

            return (
                <div key={i} className={`${bgColor} ${textColor} px-4 font-mono text-xs py-0.5 whitespace-pre-wrap break-all`}>
                    {line}
                </div>
            );
        });
    };

    return (
        <div className={`relative inline-block ${className}`} ref={containerRef}>
            <button 
                onClick={toggleOpen}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                title="View History"
            >
                <History className={`w-3.5 h-3.5 ${isOpen ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Card className="shadow-xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden">
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Clock className="w-3 h-3" /> Revision History
                            </h4>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 flex justify-center">
                                    <div className="animate-spin h-5 w-5 border-2 border-slate-900 dark:border-white border-t-transparent rounded-full"></div>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="p-8 text-center text-xs text-slate-500">No history found</div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {history.map((item, i) => (
                                        <div key={item.hash} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                            <div className="flex items-start gap-3 mb-2">
                                                <Avatar username={item.author} size="xs" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{item.author}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{item.hash.slice(0, 7)}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.message}</p>
                                                    <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400">
                                                        <Calendar className="w-2.5 h-2.5" />
                                                        {new Date(item.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleViewVersion(item, 'content')}
                                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                                >
                                                    <FileText className="w-3 h-3" /> View
                                                </button>
                                                {i < history.length - 1 && (
                                                    <button 
                                                        onClick={() => handleViewVersion(item, 'diff')}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                                                    >
                                                        <GitPullRequest className="w-3 h-3" /> Diff
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            <Modal 
                isOpen={!!selectedVersion} 
                onClose={() => setSelectedVersion(null)}
                title={selectedVersion ? `${viewMode === 'diff' ? 'Diff' : 'Version'} ${selectedVersion.hash.slice(0, 7)} by ${selectedVersion.author}` : ""}
                size="lg"
            >
                {loadingContent ? (
                    <div className="p-12 flex justify-center">
                        <div className="animate-spin h-8 w-8 border-4 border-slate-900 dark:border-white border-t-transparent rounded-full"></div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950">
                        {viewMode === 'diff' ? (
                            <div className="py-4">
                                {renderDiff(modalContent)}
                            </div>
                        ) : (
                            <div className="p-8 bg-white dark:bg-slate-900 min-h-[40vh]">
                                {(() => {
                                    try {
                                        const parsed = yaml.load(modalContent) as any;
                                        if (parsed && typeof parsed.body === 'string') {
                                            return <Markdown content={parsed.body} issueId={issueId} />;
                                        }
                                    } catch (e) {}
                                    return (
                                        <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 overflow-auto whitespace-pre-wrap">
                                            {modalContent}
                                        </pre>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}
                <div className="mt-6 flex justify-between items-center text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3" /> {selectedVersion?.author}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" /> {selectedVersion && new Date(selectedVersion.date).toLocaleString()}
                        </div>
                    </div>
                    <div className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {selectedVersion?.hash}
                    </div>
                </div>
            </Modal>
        </div>
    );
};
