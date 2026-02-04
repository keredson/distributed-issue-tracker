import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, GripVertical, Save, X, Undo2 } from 'lucide-react';
import { Badge, Card, Avatar } from '../components/Common.js';
import { Markdown } from '../components/Markdown.js';

export const IssueRank = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [orderedIssues, setOrderedIssues] = useState<any[]>([]);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [hasLocalOrder, setHasLocalOrder] = useState(false);
    const [previewIssue, setPreviewIssue] = useState<any | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [removedIssues, setRemovedIssues] = useState<Array<{ issue: any; index: number }>>([]);

    const searchQuery = searchParams.get('q') ?? 'is:open ';
    const sortBy = searchParams.get('sort') ?? 'Newest';
    const currentPage = parseInt(searchParams.get('page') ?? '1', 10);
    const itemsPerPage = 50;

    useEffect(() => {
        fetch('/api/issues')
            .then(res => res.json())
            .then(data => {
                setIssues(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch issues', err);
                setIssues([]);
                setLoading(false);
            });
    }, []);

    const filteredIssues = useMemo(() => {
        let result = [...issues];
        const filters: { [key: string]: string[] } = {};
        const textTerms: string[] = [];
        const regex = /([a-zA-Z]+):("[^"]+"|[^\s]+)|("[^"]+"|[^\s]+)/gi;
        let match;
        while ((match = regex.exec(searchQuery)) !== null) {
            if (match[1]) {
                const key = match[1].toLowerCase();
                let value = match[2];
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                }
                if (!filters[key]) filters[key] = [];
                filters[key].push(value.toLowerCase());
            } else if (match[3]) {
                let term = match[3];
                if (term.startsWith('"') && term.endsWith('"')) {
                    term = term.substring(1, term.length - 1);
                }
                textTerms.push(term.toLowerCase());
            }
        }

        result = result.filter(issue => {
            if (textTerms.length > 0) {
                const content = (
                    (issue.title || '') + ' ' +
                    (issue.author || '') + ' ' +
                    (issue.id || '') + ' ' +
                    (issue.body || '') + ' ' +
                    (issue.assignee || '')
                ).toLowerCase();
                if (!textTerms.every(term => content.includes(term))) return false;
            }
            for (const [key, values] of Object.entries(filters)) {
                if (key === 'state' || key === 'is') {
                    if (!values.some(v => {
                        if (v === 'open') return issue.status === 'open' || issue.status === 'assigned' || issue.status === 'in-progress';
                        if (v === 'closed') return issue.status === 'closed';
                        return (issue.status || '').toLowerCase() === v;
                    })) return false;
                } else if (key === 'severity') {
                    if (!values.includes((issue.severity || '').toLowerCase())) return false;
                } else if (key === 'assignee') {
                    if (!values.some(v => {
                        if (v === 'none' || v === 'unassigned') return !issue.assignee;
                        return (issue.assignee || '').toLowerCase() === v;
                    })) return false;
                } else if (key === 'author') {
                    if (!values.some(v => (issue.author || '').toLowerCase() === v)) return false;
                } else if (key === 'label') {
                    if (!values.every(v => (issue.labels || []).some((l: string) => l.toLowerCase() === v))) return false;
                } else if (key === 'id') {
                    if (!values.includes((issue.id || '').toLowerCase())) return false;
                }
            }
            return true;
        });

        result.sort((a, b) => {
            if (sortBy === 'Newest') return new Date(b.created).getTime() - new Date(a.created).getTime();
            if (sortBy === 'Oldest') return new Date(a.created).getTime() - new Date(b.created).getTime();
            if (sortBy === 'Most Commented') return (b.comments_count || 0) - (a.comments_count || 0);
            if (sortBy === 'Least Commented') return (a.comments_count || 0) - (b.comments_count || 0);
            return 0;
        });

        return result;
    }, [issues, searchQuery, sortBy]);

    const paginatedIssues = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredIssues.slice(start, start + itemsPerPage);
    }, [filteredIssues, currentPage]);

    useEffect(() => {
        setOrderedIssues(paginatedIssues);
        setRemovedIssues([]);
        setHasLocalOrder(false);
    }, [paginatedIssues]);

    const moveIssue = (from: number, to: number) => {
        setOrderedIssues(prev => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
    };

    const handleDragStart = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        setDragIndex(index);
        setHasLocalOrder(true);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOver = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) return;
        moveIssue(dragIndex, index);
        setDragIndex(index);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
    };

    const removeIssue = (index: number) => {
        if (index < 0 || index >= orderedIssues.length) return;
        const next = [...orderedIssues];
        const [removed] = next.splice(index, 1);
        if (!removed) return;
        setOrderedIssues(next);
        setRemovedIssues(current => [{ issue: removed, index }, ...current]);
        setHasLocalOrder(true);
    };

    const undoRemove = (index: number) => {
        setRemovedIssues(prev => {
            if (index < 0 || index >= prev.length) return prev;
            const next = [...prev];
            const [restored] = next.splice(index, 1);
            if (restored) {
                setOrderedIssues(current => {
                    const updated = [...current];
                    const insertAt = Math.min(restored.index, updated.length);
                    updated.splice(insertAt, 0, restored.issue);
                    return updated;
                });
            }
            return next;
        });
        setHasLocalOrder(true);
    };

    const undoAllRemovals = () => {
        if (removedIssues.length === 0) return;
        const toRestore = [...removedIssues].sort((a, b) => a.index - b.index);
        setOrderedIssues(current => {
            const updated = [...current];
            toRestore.forEach(entry => {
                const insertAt = Math.min(entry.index, updated.length);
                updated.splice(insertAt, 0, entry.issue);
            });
            return updated;
        });
        setRemovedIssues([]);
        setHasLocalOrder(true);
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        setMessage(null);
        try {
            const payload = {
                query: searchQuery,
                sort: sortBy,
                page: currentPage,
                itemsPerPage,
                issues: orderedIssues.map((issue, index) => ({
                    id: issue.id,
                    title: issue.title,
                    dir: issue.dir,
                    rank: index + 1
                }))
            };

            const res = await fetch('/api/rankings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save ranking');
            }

            const data = await res.json();
            setHasLocalOrder(false);
            setMessage(`Saved to ${data.path || 'ranking file'}.`);
        } catch (err: any) {
            setMessage(err.message || 'Failed to save ranking.');
        } finally {
            setSaving(false);
        }
    };

    const openPreview = async (issue: any) => {
        setPreviewIssue(null);
        setPreviewError(null);
        setPreviewLoading(true);
        try {
            const res = await fetch(`/api/issues/details/${issue.dir}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to load issue');
            }
            const data = await res.json();
            setPreviewIssue(data);
        } catch (err: any) {
            setPreviewError(err.message || 'Failed to load issue.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        setPreviewIssue(null);
        setPreviewError(null);
        setPreviewLoading(false);
    };

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;

    return (
        <div className="max-w-5xl mx-auto p-8">
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                const backParams = searchParams.toString();
                                navigate(backParams ? `/issues?${backParams}` : '/issues');
                            }}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Issues
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rank Issues</h2>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving || orderedIssues.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm inline-flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Ranking'}
                    </button>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Drag issues to reorder the current page ({orderedIssues.length} items). {removedIssues.length > 0 ? `${removedIssues.length} removed.` : ''} {hasLocalOrder ? 'Unsaved changes.' : 'Order matches current sort.'}
                </div>
                {message && (
                    <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2">
                        {message}
                    </div>
                )}
            </div>

            {removedIssues.length > 0 && (
                <Card className="border-slate-200 dark:border-slate-800 mb-6">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Removed from ranking
                        </div>
                        <button
                            type="button"
                            onClick={undoAllRemovals}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                            Undo all
                        </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {removedIssues.map((entry, index) => (
                            <div key={`${entry.issue.id}-removed`} className="px-4 py-3 flex items-center justify-between">
                                <div className="text-sm text-slate-700 dark:text-slate-300">
                                    {entry.issue.title}
                                    <span className="ml-2 text-xs text-slate-400 font-mono">#{entry.issue.id}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => undoRemove(index)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                >
                                    <Undo2 className="w-3 h-3" />
                                    Undo
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card className="border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800 rounded-xl overflow-hidden">
                    {orderedIssues.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 rounded-b-xl">
                            No issues match your search.
                        </div>
                    ) : (
                        orderedIssues.map((issue, index) => (
                            <div
                                key={issue.id}
                                draggable
                                onDragStart={handleDragStart(index)}
                                onDragOver={handleDragOver(index)}
                                onDragEnd={handleDragEnd}
                                className={`p-4 flex items-center gap-3 bg-white dark:bg-slate-900/40 ${dragIndex === index ? 'opacity-70' : ''}`}
                            >
                                <div className="text-slate-400 cursor-grab">
                                    <GripVertical className="w-5 h-5" />
                                </div>
                                <div className="flex-1 flex items-start justify-between gap-6">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => openPreview(issue)}
                                                className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                                            >
                                                {issue.title}
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="font-mono">#{issue.id}</span>
                                            <span>•</span>
                                            <div className="flex items-center gap-1">
                                                <span>opened {new Date(issue.created).toLocaleDateString()} by</span>
                                                <Avatar username={issue.author} size="xs" />
                                                <span className="font-medium">{issue.author}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={issue.status}>{issue.status}</Badge>
                                        {issue.assignee && (
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <Avatar username={issue.assignee} size="xs" />
                                                <span className="font-medium">{issue.assignee}</span>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeIssue(index)}
                                            title="Remove from ranking (undo available above)"
                                            aria-label="Remove from ranking"
                                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {previewIssue !== null || previewLoading || previewError ? (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-slate-900/40"
                        onClick={closePreview}
                    />
                    <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-slate-950 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Issue Preview</h3>
                                {previewIssue?.id && (
                                    <span className="text-xs font-mono text-slate-400">#{previewIssue.id}</span>
                                )}
                                {previewIssue?.dir && (
                                    <button
                                        type="button"
                                        onClick={() => window.open(`/issue/${previewIssue.dir}`, '_blank', 'noreferrer')}
                                        className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md transition-colors"
                                    >
                                        Open full issue
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={closePreview}
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    aria-label="Close preview"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {previewLoading && (
                                <div className="text-sm text-slate-500">Loading preview...</div>
                            )}
                            {previewError && (
                                <div className="text-sm text-red-600">{previewError}</div>
                            )}
                            {previewIssue && (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xl font-bold text-slate-900 dark:text-white">{previewIssue.title}</div>
                                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                            <Badge variant={previewIssue.status}>{previewIssue.status}</Badge>
                                            <span>opened {new Date(previewIssue.created).toLocaleDateString()}</span>
                                            <span>by</span>
                                            <Avatar username={previewIssue.author} size="xs" />
                                            <span className="font-medium">{previewIssue.author}</span>
                                        </div>
                                    </div>
                                    {previewIssue.labels && previewIssue.labels.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {previewIssue.labels.map((label: string) => (
                                                <span key={label} className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-100 dark:border-blue-900/30">
                                                    {label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="prose prose-slate dark:prose-invert max-w-none">
                                        <Markdown content={previewIssue.body || ''} issueId={previewIssue.id} />
                                    </div>
                                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            Comments ({(previewIssue.comments || []).length})
                                        </h4>
                                        {(!previewIssue.comments || previewIssue.comments.length === 0) ? (
                                            <div className="text-sm text-slate-500">No comments yet.</div>
                                        ) : (
                                            <div className="space-y-4">
                                                {previewIssue.comments.map((comment: any) => (
                                                    <div key={comment.id} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/40">
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                                                            <Avatar username={comment.author} size="xs" />
                                                            <span className="font-medium">{comment.author}</span>
                                                            <span>•</span>
                                                            <span>{new Date(comment.date).toLocaleString()}</span>
                                                        </div>
                                                        <div className="prose prose-slate dark:prose-invert max-w-none">
                                                            <Markdown content={comment.body || ''} issueId={previewIssue.id} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 text-sm text-slate-500">
                                        <span>Severity: {previewIssue.severity || 'n/a'}</span>
                                        {previewIssue.assignee && (
                                            <span className="flex items-center gap-2">
                                                <Avatar username={previewIssue.assignee} size="xs" />
                                                {previewIssue.assignee}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
