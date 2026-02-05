import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, CircleDot, MessageSquare, GitBranch } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Card, Badge, Avatar, LabelInput, Modal } from '../components/Common.js';
import { Markdown, MarkdownEditor } from '../components/Markdown.js';
import { UserSelect, User } from '../components/UserSelect.js';
import { HistoryView } from '../components/HistoryView.js';
import { computeRatings } from '../utils/rankings.js';
import { getPriorityDisplay } from '../utils/priority.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert.js';
import { IssueWorkflow, getAllowedStatusOptions, formatStatusLabel, getDefaultWorkflow, getStatusOrder, getStatusStyle, normalizeStatus, getTransitionLabel, getStateIconName } from '../utils/workflow.js';

export const IssueView = () => {
    const params = useParams();
    const splat = params['*'];
    const navigate = useNavigate();
    const [issue, setIssue] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [commentBody, setCommentBody] = useState("");
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [rankings, setRankings] = useState<any[]>([]);
    
    // Edit Mode State
    const [editMode, setEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editBody, setEditBody] = useState("");
    const [editStatus, setEditStatus] = useState("");
    const [editSeverity, setEditSeverity] = useState("");
    const [editAssignee, setEditAssignee] = useState("");
    const [editLabels, setEditLabels] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [statusError, setStatusError] = useState("");
    const [workflow, setWorkflow] = useState<IssueWorkflow>(getDefaultWorkflow());

    const [copyOpen, setCopyOpen] = useState(false);
    const [branches, setBranches] = useState<{ name: string; kind: 'local' | 'remote' }[]>([]);
    const [currentBranch, setCurrentBranch] = useState<string>("");
    const [targetBranches, setTargetBranches] = useState<string[]>([]);
    const [copyMessage, setCopyMessage] = useState<string>("");
    const [copyBusy, setCopyBusy] = useState(false);
    const [copyError, setCopyError] = useState<string>("");
    const [copyResult, setCopyResult] = useState<any[]>([]);
    const [backportInfo, setBackportInfo] = useState<Record<string, { present?: boolean; backported?: boolean }>>({});
    const [backportLoading, setBackportLoading] = useState(false);
    const [branchStatuses, setBranchStatuses] = useState<Record<string, { present?: boolean; status?: string }>>({});
    const [branchStatusLoading, setBranchStatusLoading] = useState(false);
    const [branchStatusError, setBranchStatusError] = useState("");
    const [branchDetailsOpen, setBranchDetailsOpen] = useState(false);
    const selectAllRef = useRef<HTMLInputElement | null>(null);

    const statusOptions = useMemo(() => {
        const currentRaw = issue?.status || workflow?.initial || workflow?.states?.[0] || '';
        const current = normalizeStatus(currentRaw, workflow);
        if (!current) return ['open', 'active', 'closed'];
        return getAllowedStatusOptions(current, workflow);
    }, [issue?.status, workflow]);

    const getIconComponent = (iconName: string | null) => {
        if (!iconName) return null;
        const pascal = iconName
            .split('-')
            .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
            .join('');
        const Icon = (LucideIcons as any)[pascal] as React.ComponentType<{ className?: string }>;
        return Icon || null;
    };

    const fetchIssue = () => {
        fetch("/api/issues/details/" + splat)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(data => {
                const normalizedStatus = normalizeStatus(data.status || '', workflow);
                setIssue(data);
                setEditTitle(data.title);
                setEditBody(data.body);
                setEditStatus(normalizedStatus);
                setEditSeverity(data.severity);
                setEditAssignee(data.assignee || "");
                setEditLabels(data.labels || []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch issue", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchIssue();
        fetch("/api/me")
            .then(res => res.json())
            .then(data => setCurrentUser(data))
            .catch(() => setCurrentUser(null));
        fetch("/api/rankings")
            .then(res => res.json())
            .then(data => setRankings(Array.isArray(data) ? data : []))
            .catch(err => {
                console.error('Failed to fetch rankings', err);
                setRankings([]);
            });
        fetch("/api/workflows/issue")
            .then(res => res.json())
            .then(data => setWorkflow(data))
            .catch(() => setWorkflow(getDefaultWorkflow()));
    }, [splat]);

    useEffect(() => {
        if (!issue) return;
        fetch("/api/branches")
            .then(res => res.json())
            .then(data => {
                const local = Array.isArray(data?.branches) ? data.branches : [];
                const remote = Array.isArray(data?.remoteBranches) ? data.remoteBranches : [];
                const combined = [
                    ...local.map((name: string) => ({ name, kind: 'local' as const })),
                    ...remote.map((name: string) => ({ name, kind: 'remote' as const }))
                ];
                setBranches(combined);
                setCurrentBranch(data?.currentBranch || "");
            })
            .catch(err => {
                console.error('Failed to fetch branches', err);
                setBranches([]);
            });
    }, [issue?.id]);

    useEffect(() => {
        if (!copyOpen) return;
        setTargetBranches([]);
    }, [copyOpen]);

    useEffect(() => {
        if (!copyOpen || branches.length === 0 || !issue) return;
        setBackportLoading(true);
        fetch(`/api/issues/${issue.id}/backports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceBranch: currentBranch || (window as any).repoRef || "",
                branches: branches.map(b => b.name)
            })
        })
            .then(res => res.json())
            .then(data => setBackportInfo(data?.results || {}))
            .catch(err => {
                console.error('Failed to fetch backport info', err);
                setBackportInfo({});
            })
            .finally(() => setBackportLoading(false));
    }, [copyOpen, branches, issue, currentBranch]);

    useEffect(() => {
        if (!issue || branches.length === 0) return;
        let cancelled = false;
        setBranchStatusLoading(true);
        setBranchStatusError("");
        fetch(`/api/issues/${issue.id}/branch-statuses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ branches: branches.map(b => b.name) })
        })
            .then(res => res.json())
            .then(data => {
                if (cancelled) return;
                setBranchStatuses(data?.results || {});
            })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to fetch branch statuses', err);
                setBranchStatusError('Unable to load branch statuses');
                setBranchStatuses({});
            })
            .finally(() => {
                if (cancelled) return;
                setBranchStatusLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [issue?.id, branches]);

    const selectableBranches = useMemo(() => {
        const localSet = new Set(
            branches.filter(b => b.kind === 'local').map(b => b.name)
        );
        return branches
            .filter(b => {
                const isCurrent = b.name === currentBranch;
                const remoteShort = b.name.replace(/^[^/]+\//, '');
                const isRemoteCurrent = b.kind === 'remote' && remoteShort === currentBranch;
                const remoteHasLocal = b.kind === 'remote' && localSet.has(remoteShort);
                const isBackported = !!backportInfo[b.name]?.backported;
                return !(isCurrent || isRemoteCurrent || remoteHasLocal || isBackported);
            })
            .map(b => b.name);
    }, [branches, currentBranch, backportInfo]);

    const otherBranchNames = useMemo(() => {
        if (branches.length === 0) return [];
        const localSet = new Set(
            branches.filter(b => b.kind === 'local').map(b => b.name)
        );
        return branches
            .filter(b => {
                const isCurrent = b.name === currentBranch;
                const remoteShort = b.name.replace(/^[^/]+\//, '');
                const isRemoteCurrent = b.kind === 'remote' && remoteShort === currentBranch;
                const remoteHasLocal = b.kind === 'remote' && localSet.has(remoteShort);
                return !(isCurrent || isRemoteCurrent || remoteHasLocal);
            })
            .map(b => b.name);
    }, [branches, currentBranch]);

    const otherBranchSummary = useMemo(() => {
        if (otherBranchNames.length === 0) return null;
        const counts: Record<string, number> = {};
        let missing = 0;
        for (const name of otherBranchNames) {
            const info = branchStatuses[name];
            if (!info || !info.present) {
                missing += 1;
                continue;
            }
            const status = normalizeStatus((info.status || 'open').trim() || 'open', workflow);
            counts[status] = (counts[status] || 0) + 1;
        }
        const statusOrder = getStatusOrder(workflow);
        const ordered = [
            ...statusOrder.filter(status => counts[status]),
            ...Object.keys(counts).filter(status => !statusOrder.includes(status)).sort()
        ];
        const statuses = ordered.map(status => ({ status, count: counts[status] }));
        return {
            statuses,
            missing
        };
    }, [otherBranchNames, branchStatuses]);

    const otherBranchDetails = useMemo(() => {
        const present: { branch: string; status: string }[] = [];
        const missing: string[] = [];
        if (otherBranchNames.length === 0) return { present, missing };
        for (const name of otherBranchNames) {
            const info = branchStatuses[name];
            if (!info || !info.present) {
                missing.push(name);
                continue;
            }
            const status = normalizeStatus((info.status || 'open').trim() || 'open', workflow);
            present.push({ branch: name, status });
        }
        const grouped = present.reduce((acc, item) => {
            (acc[item.status] ||= []).push(item.branch);
            return acc;
        }, {} as Record<string, string[]>);
        return { grouped, missing };
    }, [otherBranchNames, branchStatuses]);

    const hasCopied = useMemo(() => {
        return copyResult.some(result => !result.skipped);
    }, [copyResult]);

    useEffect(() => {
        if (!selectAllRef.current) return;
        const selectedCount = selectableBranches.filter(name => targetBranches.includes(name)).length;
        selectAllRef.current.indeterminate = selectedCount > 0 && selectedCount < selectableBranches.length;
    }, [selectableBranches, targetBranches]);

    const ratingMap = useMemo(() => computeRatings(rankings), [rankings]);
    const rating = issue ? ratingMap.get(issue.id) : undefined;

    const handleAddComment = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!commentBody.trim()) return;

        const res = await fetch("/api/issues/" + (issue ? issue.id : "") + "/comments", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: commentBody })
        });

        if (res.ok) {
            setCommentBody("");
            fetchIssue();
        }
    };

    const handleUpload = async (files: FileList): Promise<string[]> => {
        if (!issue) return [];
        const links: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const res = await fetch(`/api/issues/${issue.id}/data`, {
                    method: 'POST',
                    headers: {
                        'x-filename': file.name,
                        'content-type': file.type
                    },
                    body: file
                });
                if (res.ok) {
                    const data = await res.json();
                    const isImage = file.type.startsWith('image/');
                    // Use relative path for the markdown link
                    const relativeUrl = `data/${data.url.split('/').pop()}`;
                    links.push(isImage ? `![${file.name}](${relativeUrl})` : `[${file.name}](${relativeUrl})`);
                }
            } catch (err) {
                console.error("Failed to upload file", err);
            }
        }
        return links;
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/issues/" + issue.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editTitle,
                    body: editBody,
                    status: editStatus,
                    severity: editSeverity,
                    assignee: editAssignee,
                    labels: editLabels
                })
            });

            if (res.ok) {
                const updatedIssue = await res.json();
                setIssue({ ...issue, ...updatedIssue });
                setEditMode(false);
            } else {
                alert("Failed to save changes");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const handleQuickStatusChange = async (nextStatus: string) => {
        if (!issue || statusUpdating) return;
        setStatusUpdating(true);
        setStatusError("");
        try {
            const res = await fetch("/api/issues/" + issue.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: nextStatus })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to update status');
            }
            setIssue({ ...issue, ...data });
            setEditStatus(nextStatus);
        } catch (err: any) {
            setStatusError(err.message || 'Failed to update status');
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleCopyIssue = async () => {
        if (!issue || targetBranches.length === 0 || copyBusy) return;
        setCopyBusy(true);
        setCopyError("");
        setCopyResult([]);
        try {
            const res = await fetch(`/api/issues/${issue.id}/copy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetBranches,
                    sourceBranch: currentBranch || (window as any).repoRef || "",
                    commitMessage: copyMessage
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || 'Failed to copy issue');
            }
            setCopyResult(Array.isArray(data?.results) ? data.results : []);
        } catch (err: any) {
            setCopyError(err.message || 'Failed to copy issue');
        } finally {
            setCopyBusy(false);
        }
    };

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === 'Escape' && editMode) {
                setEditMode(false);
            } else if (e.key === 'e' && !editMode) {
                e.preventDefault();
                setEditMode(true);
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [editMode]);

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;
    if (!issue) return (
        <div className="max-w-4xl mx-auto p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Issue not found</h2>
            <Button
                type="button"
                variant="unstyled"
                onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/issues')}
                className="text-blue-600 dark:text-blue-400 hover:underline bg-transparent border-none cursor-pointer"
            >
                Back to issues
            </Button>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <Button
                    type="button"
                    variant="unstyled"
                    onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/issues')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white no-underline group bg-transparent border-none cursor-pointer p-0"
                >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to issues
                </Button>
                {!editMode && (
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="unstyled"
                            onClick={() => setCopyOpen(true)}
                            className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-2"
                        >
                            <GitBranch className="w-4 h-4" /> Backport
                        </Button>
                        <Button
                            type="button"
                            variant="unstyled"
                            onClick={() => setEditMode(true)}
                            className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-2"
                        >
                            <Edit2 className="w-4 h-4" /> Edit Issue
                        </Button>
                    </div>
                )}
            </div>

            <Modal
                isOpen={copyOpen}
                onClose={() => {
                    setCopyOpen(false);
                    setCopyError("");
                    setCopyResult([]);
                    setCopyMessage("");
                }}
                title="Backport Issue"
                size="sm"
            >
                <div className="space-y-4">
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                            Which branches does this issue affect?
                        </div>
                        <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            {branches.length === 0 ? (
                                <div className="text-sm text-slate-500 dark:text-slate-400 px-3 py-2">No branches found</div>
                            ) : (
                                <table className="w-full text-sm table-fixed">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="text-left font-semibold text-slate-600 dark:text-slate-300 px-3 py-2">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        ref={selectAllRef}
                                                        type="checkbox"
                                                        checked={selectableBranches.length > 0 && selectableBranches.every(name => targetBranches.includes(name))}
                                                        disabled={hasCopied}
                                                        onChange={(e) => {
                                                            setTargetBranches(e.target.checked ? selectableBranches : []);
                                                        }}
                                                    />
                                                    <span>Branches</span>
                                                    <span className="text-xs font-normal text-slate-400">({branches.length} possible)</span>
                                                    {backportLoading && (
                                                        <span className="text-xs font-normal text-slate-400">Checking...</span>
                                                    )}
                                                </label>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {branches.map(branch => {
                                            const isCurrent = branch.name === currentBranch;
                                            const remoteShort = branch.name.replace(/^[^/]+\//, '');
                                            const isRemoteCurrent = branch.kind === 'remote' && remoteShort === currentBranch;
                                            const remoteHasLocal = branch.kind === 'remote' && branches.some(b => b.kind === 'local' && b.name === remoteShort);
                                            const checked = targetBranches.includes(branch.name);
                                            const label = branch.kind === 'remote' ? `${branch.name} ↗` : branch.name;
                                            const info = backportInfo[branch.name];
                                            const isBackported = !!info?.backported;
                                            const status = info?.backported
                                                ? 'Backported'
                                                : info?.present
                                                    ? 'Present'
                                                    : '';
                                            return (
                                                <tr key={`${branch.kind}:${branch.name}`}>
                                                    <td className={`px-3 py-2 ${isCurrent ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        <label className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                disabled={isCurrent || isRemoteCurrent || remoteHasLocal || isBackported || hasCopied}
                                                                checked={checked}
                                                                onChange={(e) => {
                                                                    const next = e.target.checked
                                                                        ? [...targetBranches, branch.name]
                                                                        : targetBranches.filter(b => b !== branch.name);
                                                                    setTargetBranches(next);
                                                                }}
                                                            />
                                                            <span className="flex-1 min-w-0">
                                                                <span
                                                                    className="block truncate whitespace-nowrap"
                                                                    title={`${label}${isCurrent ? ' (current)' : ''}`}
                                                                >
                                                                    {label}{isCurrent ? ' (current)' : ''}
                                                                </span>
                                                            </span>
                                                            {status && (
                                                                <span className="ml-auto text-[11px] text-slate-400">{status}</span>
                                                            )}
                                                        </label>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Commit message (optional)</label>
                        <Input
                            type="text"
                            value={copyMessage}
                            onChange={e => setCopyMessage(e.target.value)}
                            variant="unstyled"
                            disabled={hasCopied}
                            placeholder={`Backport issue ${issue?.id} to ${targetBranches.length ? targetBranches.join(', ') : 'branch'}`}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all dark:text-slate-100"
                        />
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-600 dark:text-slate-400">
                        The new commit will preserve the original author and date from the source branch, while you become the committer.
                        A `Cherry-picked-from` trailer is added for traceability.
                    </div>
                    {copyError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                            {copyError}
                        </div>
                    )}
                    {copyResult.length > 0 && (
                        <Alert>
                            <AlertTitle>Backport Results</AlertTitle>
                            <AlertDescription>
                                {copyResult.map(result => (
                                    <div key={result.targetBranch}>
                                        {result.skipped
                                            ? `Skipped ${result.targetBranch}: ${result.reason || 'No changes.'}`
                                            : `Copied to ${result.targetBranch}. New commit ${result.commit?.slice(0, 8)}.`}
                                    </div>
                                ))}
                            </AlertDescription>
                        </Alert>
                    )}
                    {!hasCopied && (
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="unstyled"
                                onClick={() => setCopyOpen(false)}
                                className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleCopyIssue}
                                disabled={copyBusy || targetBranches.length === 0}
                                className="text-sm font-semibold"
                            >
                                {copyBusy ? 'Backporting...' : 'Backport'}
                            </Button>
                        </div>
                    )}
                </div>
            </Modal>

            {editMode ? (
                <Card className="p-8 mb-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Title</label>
                            <Input
                                type="text" 
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                variant="unstyled"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all dark:text-slate-100"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                             <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Status</label>
                                <select 
                                    value={editStatus}
                                    onChange={e => setEditStatus(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all dark:text-slate-100"
                                >
                                    {statusOptions.map(status => (
                                        <option key={status} value={status}>
                                            {formatStatusLabel(status)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Severity</label>
                                <select 
                                    value={editSeverity}
                                    onChange={e => setEditSeverity(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all dark:text-slate-100"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Assignee</label>
                                <UserSelect 
                                    value={editAssignee}
                                    onChange={setEditAssignee}
                                    placeholder="Unassigned"
                                />
                            </div>
                        </div>
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Labels</label>
                                                        <LabelInput 
                                                            labels={editLabels}
                                                            onChange={setEditLabels}
                                                            placeholder="Add labels (Enter or comma to add)..."
                                                        />
                                                    </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                            <MarkdownEditor 
                                value={editBody}
                                onChange={setEditBody}
                                placeholder="Describe the issue... (Markdown supported)"
                                minHeight="200px"
                                onCmdEnter={handleSave}
                                onUpload={handleUpload}
                                issueId={issue.id}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                type="button"
                                variant="unstyled"
                                onClick={() => setEditMode(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="unstyled"
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 transition-all"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <>
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            {(() => {
                                const normalizedStatus = normalizeStatus(issue.status || '', workflow);
                                return (
                                    <Badge variant={normalizedStatus} style={getStatusStyle(normalizedStatus, workflow)}>
                                        {formatStatusLabel(normalizedStatus)}
                                    </Badge>
                                );
                            })()}
                            {issue.labels && issue.labels.map((label: string) => (
                                <span key={label} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-100 dark:border-blue-900/30">
                                    {label.toUpperCase()}
                                </span>
                            ))}
                            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{issue.id}</span>
                            {(() => {
                                const display = getPriorityDisplay(rating);
                                if (!display) return null;
                                return (
                                    <span
                                        className="text-xs font-semibold text-slate-500 dark:text-slate-400"
                                        title={display.tooltip}
                                    >
                                        {display.text}
                                    </span>
                                );
                            })()}
                            {issue.hasHistory && (
                                <HistoryView issueId={issue.id} />
                            )}
                            {issue.isDirty && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-500 text-[10px] font-bold border border-yellow-100 dark:border-yellow-900/30">
                                    <CircleDot className="w-2.5 h-2.5 fill-yellow-400 dark:fill-yellow-500" />
                                    UNCOMMITTED CHANGES
                                </span>
                            )}
                        </div>
                        {(branchStatusLoading || branchStatusError || otherBranchSummary) && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3 flex-wrap">
                                <GitBranch className="w-3.5 h-3.5" />
                                {branchStatusLoading && <span>Checking other branches...</span>}
                                {!branchStatusLoading && branchStatusError && <span>{branchStatusError}</span>}
                                {!branchStatusLoading && !branchStatusError && otherBranchSummary && (
                                    <>
                                        <span className="font-medium">Other branches:</span>
                                        {otherBranchSummary.statuses.map(({ status }) => (
                                            <React.Fragment key={status}>
                                                <span className="inline-flex items-center">
                                                    <Badge variant={status} style={getStatusStyle(status, workflow)}>{formatStatusLabel(status)}</Badge>
                                                </span>
                                            </React.Fragment>
                                        ))}
                                        {otherBranchSummary.missing > 0 && (
                                            <span className="text-slate-400 dark:text-slate-500">
                                                (not present in {otherBranchSummary.missing} branches)
                                            </span>
                                        )}
                                        <Button
                                            type="button"
                                            variant="unstyled"
                                            onClick={() => setBranchDetailsOpen(prev => !prev)}
                                            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        >
                                            {branchDetailsOpen ? 'Hide details' : 'Details'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        )}
                        {branchDetailsOpen && !branchStatusLoading && !branchStatusError && (Object.keys(otherBranchDetails.grouped).length > 0 || otherBranchDetails.missing.length > 0) && (
                            <div className="mb-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3">
                                <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300">
                                    {Object.entries(otherBranchDetails.grouped).map(([status, branches]) => (
                                        <div key={status} className="flex items-baseline gap-2">
                                            <Badge variant={status} style={getStatusStyle(status, workflow)}>{formatStatusLabel(status)}</Badge>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {branches.join(', ')}
                                            </span>
                                        </div>
                                    ))}
                                    {otherBranchDetails.missing.length > 0 && (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                                Not in: {otherBranchDetails.missing.join(', ')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">{issue.title}</h2>
                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-6">
                            <Link to={`/user/${issue.author}`} className="flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
                                <Avatar username={issue.author} size="sm" />
                                <span className="font-medium text-slate-900 dark:text-slate-100">{issue.author}</span>
                            </Link>
                            <span>opened on {new Date(issue.created).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            {issue.assignee && (
                                <span className="flex items-center gap-1.5 ml-4">
                                    <span className="text-slate-400 dark:text-slate-500">assigned to</span>
                                    <Link to={`/user/${issue.assignee}`} className="flex items-center gap-1.5 no-underline hover:opacity-80 transition-opacity">
                                        <Avatar username={issue.assignee} size="xs" />
                                        <span className="font-medium text-slate-900 dark:text-slate-100">{issue.assignee}</span>
                                    </Link>
                                </span>
                            )}
                            {(() => {
                                const currentStatus = normalizeStatus(issue.status || '', workflow);
                                const nextStatuses = statusOptions.filter(status => status !== currentStatus);
                                return nextStatuses.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {nextStatuses.map(status => (
                                            <Button
                                                key={status}
                                                type="button"
                                                variant="unstyled"
                                                onClick={() => handleQuickStatusChange(status)}
                                                disabled={statusUpdating}
                                                className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                                                title={`Change state to ${formatStatusLabel(status)}`}
                                            >
                                            {(() => {
                                                const iconName = getStateIconName(status, workflow);
                                                const Icon = getIconComponent(iconName);
                                                return Icon ? <Icon className="w-4 h-4" /> : null;
                                            })()}
                                            {(() => {
                                                const label = getTransitionLabel(currentStatus, status, workflow) || `Move to ${formatStatusLabel(status)}`;
                                                return label.charAt(0).toUpperCase() + label.slice(1);
                                            })()}
                                        </Button>
                                    ))}
                                        {statusUpdating && (
                                            <span className="text-xs text-slate-500">Updating…</span>
                                        )}
                                        {statusError && (
                                            <span className="text-xs text-red-600 dark:text-red-400">{statusError}</span>
                                        )}
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    </div>

                    <Card className="p-8 mb-8 border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                        <Markdown content={issue.body} issueId={issue.id} />
                    </Card>
                </>
            )}

            <div className="space-y-6 mb-12">
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activity</h3>
                    <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {issue.comments?.length || 0}
                    </span>
                </div>

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 dark:before:from-slate-800 before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                    {issue.comments?.map((comment: any, i: number) => (
                        <div key={i} className="relative pl-12">
                            <Link to={`/user/${comment.author}`} className="absolute left-0 top-1 z-10 no-underline hover:opacity-80 transition-opacity">
                                <Avatar username={comment.author} size="md" className="ring-4 ring-white dark:ring-slate-900" />
                            </Link>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <Link to={`/user/${comment.author}`} className="font-bold text-sm text-slate-900 dark:text-slate-100 no-underline hover:underline">
                                            {comment.author}
                                        </Link>
                                        {comment.isDirty && (
                                            <CircleDot className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" title="Uncommitted changes" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {comment.hasHistory && (
                                            <HistoryView issueId={issue.id} commentId={comment.id} />
                                        )}
                                        {comment.branch && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                from {comment.branch}
                                            </span>
                                        )}
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{new Date(comment.date).toLocaleString()}</span>
                                    </div>
                                </div>
                                <Markdown content={comment.body} issueId={issue.id} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="relative pl-12 mt-8">
                    <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center z-10 text-white dark:text-slate-900">
                        <MessageSquare className="h-4 w-4" />
                    </div>
                    <Card className="p-0 overflow-hidden border-slate-300 dark:border-slate-700 ring-1 ring-slate-200 dark:ring-slate-800">
                        <form onSubmit={handleAddComment}>
                            <MarkdownEditor 
                                value={commentBody}
                                onChange={setCommentBody}
                                placeholder="Leave a comment"
                                minHeight="120px"
                                className="border-none"
                                onCmdEnter={handleAddComment}
                                onUpload={handleUpload}
                                issueId={issue.id}
                            />
                            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Styling with Markdown is supported</span>
                                <Button
                                    type="submit"
                                    variant="unstyled"
                                    disabled={!commentBody.trim()}
                                    className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Comment
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
};
