import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card, LabelInput } from '../components/Common.js';
import { MarkdownEditor } from '../components/Markdown.js';
import { UserSelect } from '../components/UserSelect.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';

export const NewIssue = () => {
    const [id, setId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [severity, setSeverity] = useState("medium");
    const [assignee, setAssignee] = useState("");
    const [labels, setLabels] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    React.useEffect(() => {
        fetch('/api/new-id')
            .then(res => res.json())
            .then(data => setId(data.id))
            .catch(err => console.error("Failed to fetch new ID", err));
    }, []);

    const handleUpload = async (files: FileList): Promise<string[]> => {
        if (!id) return [];
        const links: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const res = await fetch(`/api/issues/${id}/data`, {
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

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!title.trim() || !id) return;
        setLoading(true);

        try {
            const res = await fetch('/api/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id, 
                    title, 
                    body, 
                    severity, 
                    assignee,
                    labels
                })
            });
            
            if (res.ok) {
                const data = await res.json();
                navigate(data.dir ? `/issue/${data.dir}` : '/issues');
            } else {
                console.error("Failed to create issue");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                navigate('/issues');
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [navigate]);

    return (
        <div className="max-w-2xl mx-auto p-8">
            <Link to="/issues" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 no-underline group">
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to issues
            </Link>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Create New Issue</h2>

            <Card className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Title</label>
                        <Input
                            type="text" 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            variant="unstyled"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all dark:text-slate-100"
                            placeholder="Issue title"
                            required
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Severity</label>
                            <select 
                                value={severity}
                                onChange={e => setSeverity(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all dark:text-slate-100"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Assignee (Optional)</label>
                            <UserSelect 
                                value={assignee}
                                onChange={setAssignee}
                                placeholder="Assign to..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Labels</label>
                        <LabelInput 
                            labels={labels}
                            onChange={setLabels}
                            placeholder="Add labels (Enter or comma to add)..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                        <MarkdownEditor 
                            value={body}
                            onChange={setBody}
                            placeholder="Describe the issue... (Markdown supported)"
                            minHeight="150px"
                            onCmdEnter={handleSubmit}
                            onUpload={handleUpload}
                            issueId={id || undefined}
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button
                            type="submit" 
                            disabled={loading || !title.trim()}
                            className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? 'Creating...' : 'Create Issue'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
