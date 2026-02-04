import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, GripVertical, Save, X } from 'lucide-react';
import { Badge, Card, Avatar, Modal } from '../components/Common.js';
import { Markdown } from '../components/Markdown.js';

export const IssueRank = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [unrankedIssues, setUnrankedIssues] = useState<any[]>([]);
    const [rankedIssues, setRankedIssues] = useState<any[]>([]);
    const [dragInfo, setDragInfo] = useState<{ list: 'unranked' | 'ranked'; index: number } | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [hasLocalOrder, setHasLocalOrder] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [showHowItWorks, setShowHowItWorks] = useState(false);
    const [previewIssue, setPreviewIssue] = useState<any | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const rankState = location.state as {
        issues?: any[];
        query?: string;
        sort?: string;
        order?: string;
        page?: number;
        itemsPerPage?: number;
    } | null;

    const baseIssues = useMemo(() => {
        return Array.isArray(rankState?.issues) ? rankState?.issues ?? [] : [];
    }, [rankState?.issues]);

    const shuffleIssues = (items: any[]) => {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    useEffect(() => {
        setUnrankedIssues(shuffleIssues(baseIssues));
        setRankedIssues([]);
        setHasLocalOrder(false);
        setIsSaved(false);
    }, [baseIssues]);

    const moveBetweenLists = (
        fromList: 'unranked' | 'ranked',
        toList: 'unranked' | 'ranked',
        fromIndex: number,
        toIndex: number
    ) => {
        const fromArray = fromList === 'unranked' ? unrankedIssues : rankedIssues;
        const toArray = toList === 'unranked' ? unrankedIssues : rankedIssues;
        if (fromIndex < 0 || fromIndex >= fromArray.length) return;
        const nextFrom = [...fromArray];
        const [moved] = nextFrom.splice(fromIndex, 1);
        if (!moved) return;

        const nextTo = fromList === toList ? nextFrom : [...toArray];
        const insertAt = Math.min(Math.max(toIndex, 0), nextTo.length);
        nextTo.splice(insertAt, 0, moved);

        if (fromList === 'unranked') {
            setUnrankedIssues(nextFrom);
        } else {
            setRankedIssues(nextFrom);
        }
        if (toList === 'unranked') {
            setUnrankedIssues(nextTo);
        } else {
            setRankedIssues(nextTo);
        }
    };

    const handleDragStart = (list: 'unranked' | 'ranked', index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        setDragInfo({ list, index });
        setHasLocalOrder(true);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `${list}:${index}`);
    };

    const handleDragOverItem = (list: 'unranked' | 'ranked', index: number) => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!dragInfo) return;
        if (dragInfo.list === list && dragInfo.index === index) return;
        moveBetweenLists(dragInfo.list, list, dragInfo.index, index);
        setDragInfo({ list, index });
        setHasLocalOrder(true);
    };

    const handleDragOverList = (list: 'unranked' | 'ranked') => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const handleDropOnList = (list: 'unranked' | 'ranked') => (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!dragInfo) return;
        const targetIndex = list === 'unranked' ? unrankedIssues.length : rankedIssues.length;
        moveBetweenLists(dragInfo.list, list, dragInfo.index, targetIndex);
        setDragInfo({ list, index: targetIndex });
        setHasLocalOrder(true);
    };

    const handleDragEnd = () => {
        setDragInfo(null);
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        setMessage(null);
        try {
            const payload = {
                query: rankState?.query ?? '',
                sort: rankState?.sort ?? '',
                page: rankState?.page ?? 1,
                itemsPerPage: rankState?.itemsPerPage ?? rankedIssues.length,
                issues: rankedIssues.map((issue, index) => ({
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
            setIsSaved(true);
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

    return (
        <div className="max-w-5xl mx-auto p-8">
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                navigate('/issues');
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
                        disabled={saving || rankedIssues.length === 0 || isSaved}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm inline-flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : (isSaved ? 'Saved' : 'Save Ranking')}
                    </button>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                    Your rankings (past and present) are combined with everyone else’s to calculate priorities and globally rank all issues.
                <br/>
                    <a
                        href="#"
                        onClick={(event) => {
                            event.preventDefault();
                            setShowHowItWorks(true);
                        }}
                        className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline underline-offset-2"
                    >
                        How does this work?
                    </a>
                </div>
                {message && (
                    <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2">
                        {message}
                    </div>
                )}
            </div>

            {baseIssues.length === 0 ? (
                <Card className="border-slate-200 dark:border-slate-800">
                    <div className="p-8 text-center text-slate-500">
                        No issues were provided for ranking. Go back and click Rank from the issues list.
                    </div>
                </Card>
            ) : null}

            <div className="grid grid-cols-1 gap-6">
                <Card className="border-slate-200 dark:border-slate-800">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Ranked ({rankedIssues.length})
                        </div>
                        <span className="text-xs text-slate-500">Top = highest priority</span>
                    </div>
                    <div
                        className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800 rounded-b-xl overflow-hidden min-h-[96px]"
                        onDragOver={isSaved ? undefined : handleDragOverList('ranked')}
                        onDrop={isSaved ? undefined : handleDropOnList('ranked')}
                    >
                        {rankedIssues.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 rounded-b-xl">
                                Drag issues here to rank them.
                            </div>
                        ) : (
                            rankedIssues.map((issue, index) => (
                                <div
                                    key={`ranked-${issue.id}`}
                                    draggable={!isSaved}
                                    onDragStart={isSaved ? undefined : handleDragStart('ranked', index)}
                                    onDragOver={isSaved ? undefined : handleDragOverItem('ranked', index)}
                                    onDragEnd={isSaved ? undefined : handleDragEnd}
                                    className={`p-4 flex items-center gap-3 bg-white dark:bg-slate-900/40 ${dragInfo?.list === 'ranked' && dragInfo.index === index ? 'opacity-70' : ''} ${isSaved ? 'cursor-default' : ''}`}
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
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {!isSaved && (
                    <Card className="border-slate-200 dark:border-slate-800">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Unranked ({unrankedIssues.length})
                            </div>
                            <span className="text-xs text-slate-500">Drag into Ranked</span>
                        </div>
                        <div
                            className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800 rounded-b-xl overflow-hidden min-h-[200px]"
                            onDragOver={handleDragOverList('unranked')}
                            onDrop={handleDropOnList('unranked')}
                        >
                            {unrankedIssues.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 rounded-b-xl">
                                    All issues have been ranked.
                                </div>
                            ) : (
                                unrankedIssues.map((issue, index) => (
                                    <div
                                        key={`unranked-${issue.id}`}
                                        draggable
                                        onDragStart={handleDragStart('unranked', index)}
                                        onDragOver={handleDragOverItem('unranked', index)}
                                        onDragEnd={handleDragEnd}
                                        className={`p-4 flex items-center gap-3 bg-white dark:bg-slate-900/40 ${dragInfo?.list === 'unranked' && dragInfo.index === index ? 'opacity-70' : ''}`}
                                    >
                                        <div className="text-slate-400 cursor-grab">
                                            <GripVertical className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 flex items-start justify-between gap-6">
                                            <div>
                                                <div className="flex items-center gap-2">
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
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                )}
            </div>

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

            <Modal
                isOpen={showHowItWorks}
                onClose={() => setShowHowItWorks(false)}
                title="How This Works"
                size="md"
            >
                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-3">
                    <p>
                        Each ranking is treated as a multiplayer match where issues compete for priority. The model estimates a
                        latent “skill” for every issue and updates those estimates from the relative order you provide.
                    </p>
                    <p>
                        The engine is a factor-graph-based Bayesian inference system. It combines all users’ rankings and
                        propagates uncertainty through the graph, yielding both a priority estimate and a confidence interval.
                        More agreement across rankings increases confidence; conflicting rankings widen it.
                    </p>
                    <p>
                        This lets the system converge on a consistent, crowd-calibrated ordering without requiring everyone to
                        rank every issue.
                    </p>
                </div>
            </Modal>
        </div>
    );
};
