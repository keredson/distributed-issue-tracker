import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Edit2, CircleDot, MessageSquare } from 'lucide-react';
import { Card, Badge } from '../components/Common.js';
import { Markdown, MarkdownEditor } from '../components/Markdown.js';
import { UserSelect, User } from '../components/UserSelect.js';

export const IssueView = () => {
    const { year, month, slug } = useParams();
    const [issue, setIssue] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [commentBody, setCommentBody] = useState("");
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    
    // Edit Mode State
    const [editMode, setEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editBody, setEditBody] = useState("");
    const [editStatus, setEditStatus] = useState("");
    const [editSeverity, setEditSeverity] = useState("");
    const [editAssignee, setEditAssignee] = useState("");
    const [saving, setSaving] = useState(false);

    const fetchIssue = () => {
        fetch("/api/issues/details/" + year + "/" + month + "/" + slug)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(data => {
                setIssue(data);
                setEditTitle(data.title);
                setEditBody(data.body);
                setEditStatus(data.status);
                setEditSeverity(data.severity);
                setEditAssignee(data.assignee || "");
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
    }, [year, month, slug]);

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentBody.trim()) return;

        const res = await fetch("/api/issues/" + (issue ? issue.id : "") + "/comments", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: commentBody, author: currentUser?.username || "Anonymous" })
        });

        if (res.ok) {
            setCommentBody("");
            fetchIssue();
        }
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
                    assignee: editAssignee
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

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;
    if (!issue) return (
        <div className="max-w-4xl mx-auto p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Issue not found</h2>
            <Link to="/issues" className="text-blue-600 dark:text-blue-400 hover:underline">Back to issues</Link>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <Link to="/issues" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white no-underline group">
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to issues
                </Link>
                {!editMode && (
                    <button 
                        onClick={() => setEditMode(true)}
                        className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-2"
                    >
                        <Edit2 className="w-4 h-4" /> Edit Issue
                    </button>
                )}
            </div>

            {editMode ? (
                <Card className="p-8 mb-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Title</label>
                            <input 
                                type="text" 
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
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
                                    <option value="open">Open</option>
                                    <option value="assigned">Assigned</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="closed">Closed</option>
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
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                            <MarkdownEditor 
                                value={editBody}
                                onChange={setEditBody}
                                placeholder="Describe the issue... (Markdown supported)"
                                minHeight="200px"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button 
                                onClick={() => setEditMode(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 transition-all"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </Card>
            ) : (
                <>
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <Badge variant={issue.status}>{issue.status}</Badge>
                            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{issue.id}</span>
                            {issue.isDirty && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-500 text-[10px] font-bold border border-yellow-100 dark:border-yellow-900/30">
                                    <CircleDot className="w-2.5 h-2.5 fill-yellow-400 dark:fill-yellow-500" />
                                    UNCOMMITTED CHANGES
                                </span>
                            )}
                        </div>
                        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">{issue.title}</h2>
                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-6">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                    {issue.author ? issue.author.charAt(0).toUpperCase() : '?'}
                                </div>
                                <span className="font-medium text-slate-900 dark:text-slate-100">{issue.author}</span>
                            </div>
                            <span>opened on {new Date(issue.created).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            {issue.assignee && (
                                <span className="flex items-center gap-1.5 ml-4">
                                    <span className="text-slate-400 dark:text-slate-500">assigned to</span>
                                    <span className="font-medium text-slate-900 dark:text-slate-100">{issue.assignee}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    <Card className="p-8 mb-8 border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                        <Markdown content={issue.body} />
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
                            <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 flex items-center justify-center z-10">
                                <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">
                                    {comment.author ? comment.author.charAt(0).toUpperCase() : '?'}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{comment.author}</span>
                                        {comment.isDirty && (
                                            <CircleDot className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" title="Uncommitted changes" />
                                        )}
                                    </div>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{new Date(comment.date).toLocaleString()}</span>
                                </div>
                                <Markdown content={comment.body} />
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
                            />
                            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Styling with Markdown is supported</span>
                                <button 
                                    type="submit" 
                                    disabled={!commentBody.trim()}
                                    className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Comment
                                </button>
                            </div>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
};
