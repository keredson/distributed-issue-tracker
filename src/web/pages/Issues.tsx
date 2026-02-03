import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, X, CircleDot, User, Clock, Check, CheckCircle2, MessageSquare } from 'lucide-react';
import { Card, Badge, Avatar, Pagination } from '../components/Common.js';
import { FilterDropdown } from '../components/FilterDropdown.js';

export const Issues = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    const searchQuery = searchParams.get('q') ?? "is:open ";
    const sortBy = searchParams.get('sort') ?? "Newest";
    const currentPage = parseInt(searchParams.get('page') ?? "1", 10);
    const itemsPerPage = 50;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === '/') {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.key === 'c' || e.key === 'n') {
                e.preventDefault();
                navigate('/new');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    useEffect(() => {
        fetch('/api/issues')
            .then(res => res.json())
            .then(data => {
                setIssues(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch issues", err);
                setIssues([]);
                setLoading(false);
            });
    }, []);

    const updateParams = (updates: Record<string, string | number | null>) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                newParams.delete(key);
            } else {
                newParams.set(key, value.toString());
            }
        });
        setSearchParams(newParams, { replace: true });
    };

    const setSearchQuery = (q: string) => {
        updateParams({ q, page: 1 });
    };

    const setSortBy = (sort: string) => {
        updateParams({ sort, page: 1 });
    };

    const setCurrentPage = (page: number) => {
        updateParams({ page });
    };

    const currentFilters = useMemo(() => {
        const filters: {[key: string]: string} = {};
        const regex = /([a-zA-Z]+):("[^"]+"|[^\s]+)/gi;
        let match;
        while ((match = regex.exec(searchQuery)) !== null) {
            let val = match[2];
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length - 1);
            }
            filters[match[1].toLowerCase()] = val;
        }
        return filters;
    }, [searchQuery]);

    const getFilteredIssuesExcept = (excludeKey: string) => {
        let result = [...issues];
        const filters: {[key: string]: string[]} = {};
        const textTerms: string[] = [];
        const regex = /([a-zA-Z]+):("[^"]+"|[^\s]+)|("[^"]+"|[^\s]+)/gi;
        let match;
        while ((match = regex.exec(searchQuery)) !== null) {
            if (match[1]) {
                const key = match[1].toLowerCase();
                if (key === excludeKey) continue;
                let value = match[2];
                if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
                if (!filters[key]) filters[key] = [];
                filters[key].push(value.toLowerCase());
            } else if (match[3]) {
                let term = match[3];
                if (term.startsWith('"') && term.endsWith('"')) term = term.substring(1, term.length - 1);
                textTerms.push(term.toLowerCase());
            }
        }

        return result.filter(issue => {
            if (textTerms.length > 0) {
                const content = ((issue.title || "") + " " + (issue.author || "") + " " + (issue.id || "") + " " + (issue.body || "") + " " + (issue.assignee || "")).toLowerCase();
                if (!textTerms.every(term => content.includes(term))) return false;
            }
            for (const [key, values] of Object.entries(filters)) {
                if (key === 'state' || key === 'is') {
                    if (!values.some(v => {
                        if (v === 'open') return issue.status === 'open' || issue.status === 'assigned' || issue.status === 'in-progress';
                        if (v === 'closed') return issue.status === 'closed';
                        return (issue.status || "").toLowerCase() === v;
                    })) return false;
                } else if (key === 'severity') {
                    if (!values.includes((issue.severity || "").toLowerCase())) return false;
                } else if (key === 'assignee') {
                    if (!values.some(v => {
                        if (v === 'none' || v === 'unassigned') return !issue.assignee;
                        return (issue.assignee || "").toLowerCase() === v;
                    })) return false;
                } else if (key === 'author') {
                    if (!values.some(v => (issue.author || "").toLowerCase() === v)) return false;
                } else if (key === 'label') {
                    if (!values.every(v => (issue.labels || []).some((l: string) => l.toLowerCase() === v))) return false;
                }
            }
            return true;
        });
    };

    const authors = useMemo(() => {
        const filtered = getFilteredIssuesExcept('author');
        return Array.from(new Set(filtered.map(i => i.author).filter(Boolean))).sort();
    }, [issues, searchQuery]);

    const assignees = useMemo(() => {
        const filtered = getFilteredIssuesExcept('assignee');
        return Array.from(new Set(filtered.map(i => i.assignee).filter(Boolean))).sort();
    }, [issues, searchQuery]);

    const allLabels = useMemo(() => {
        const filtered = getFilteredIssuesExcept('label');
        const labels = new Set<string>();
        filtered.forEach(issue => {
            (issue.labels || []).forEach((label: string) => labels.add(label));
        });
        return Array.from(labels).sort();
    }, [issues, searchQuery]);

    const filteredIssues = useMemo(() => {
        let result = [...issues];
        const filters: {[key: string]: string[]} = {};
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
                    (issue.title || "") + " " + 
                    (issue.author || "") + " " + 
                    (issue.id || "") + " " + 
                    (issue.body || "") + " " +
                    (issue.assignee || "")
                ).toLowerCase();
                if (!textTerms.every(term => content.includes(term))) return false;
            }
            for (const [key, values] of Object.entries(filters)) {
                if (key === 'state' || key === 'is') {
                    if (!values.some(v => {
                        if (v === 'open') return issue.status === 'open' || issue.status === 'assigned' || issue.status === 'in-progress';
                        if (v === 'closed') return issue.status === 'closed';
                        return (issue.status || "").toLowerCase() === v;
                    })) return false;
                } else if (key === 'severity') {
                    if (!values.includes((issue.severity || "").toLowerCase())) return false;
                } else if (key === 'assignee') {
                    if (!values.some(v => {
                        if (v === 'none' || v === 'unassigned') return !issue.assignee;
                        return (issue.assignee || "").toLowerCase() === v;
                    })) return false;
                } else if (key === 'author') {
                    if (!values.some(v => (issue.author || "").toLowerCase() === v)) return false;
                } else if (key === 'label') {
                    if (!values.every(v => (issue.labels || []).some((l: string) => l.toLowerCase() === v))) return false;
                } else if (key === 'id') {
                    if (!values.includes((issue.id || "").toLowerCase())) return false;
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

    const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;

    return (
        <div className="max-w-7xl mx-auto p-8">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Issues</h2>
                    <Link to="/new" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm no-underline">
                        New Issue
                    </Link>
                </div>
                <div className="relative w-full">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Search all issues" 
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-2.5 pl-9 pr-10 text-sm font-mono focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent outline-none transition-all shadow-sm dark:text-slate-200"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
            
            <Card className="border-slate-200 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-t-xl">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => {
                                let newQuery = searchQuery.replace(/(is|state):[^\s]+/gi, '').trim();
                                newQuery = 'is:open ' + newQuery;
                                setSearchQuery(newQuery.trim() + ' ');
                            }}
                            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${currentFilters.is === 'open' || currentFilters.state === 'open' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <CircleDot className="w-4 h-4" />
                            {issues.filter(i => i.status === 'open').length} Open
                        </button>
                        <button 
                            onClick={() => {
                                let newQuery = searchQuery.replace(/(is|state):[^\s]+/gi, '').trim();
                                newQuery = 'is:assigned ' + newQuery;
                                setSearchQuery(newQuery.trim() + ' ');
                            }}
                            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${currentFilters.is === 'assigned' || currentFilters.state === 'assigned' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <User className="w-4 h-4" />
                            {issues.filter(i => i.status === 'assigned').length} Assigned
                        </button>
                        <button 
                            onClick={() => {
                                let newQuery = searchQuery.replace(/(is|state):[^\s]+/gi, '').trim();
                                newQuery = 'is:in-progress ' + newQuery;
                                setSearchQuery(newQuery.trim() + ' ');
                            }}
                            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${currentFilters.is === 'in-progress' || currentFilters.state === 'in-progress' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <Clock className="w-4 h-4" />
                            {issues.filter(i => i.status === 'in-progress').length} In Progress
                        </button>
                        <button 
                            onClick={() => {
                                let newQuery = searchQuery.replace(/(is|state):[^\s]+/gi, '').trim();
                                newQuery = 'is:closed ' + newQuery;
                                setSearchQuery(newQuery.trim() + ' ');
                            }}
                            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${currentFilters.is === 'closed' || currentFilters.state === 'closed' ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            <Check className="w-4 h-4" />
                            {issues.filter(i => i.status === 'closed').length} Closed
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <FilterDropdown 
                            label="Author" 
                            items={authors} 
                            value={currentFilters.author}
                            showAvatars={true}
                            onChange={(val) => {
                                let newQuery = searchQuery.replace(/author:("[^"]+"|[^\s]+)/gi, '').trim();
                                if (val) {
                                    const escapedVal = val.includes(' ') ? `"${val}"` : val;
                                    newQuery += ` author:${escapedVal}`;
                                }
                                setSearchQuery(newQuery.trim() + ' ');
                            }} 
                        />
                        <FilterDropdown 
                            label="Assignee" 
                            items={['Unassigned', ...assignees]} 
                            value={currentFilters.assignee === 'none' ? 'Unassigned' : currentFilters.assignee}
                            showAvatars={true}
                            onChange={(val) => {
                                let newQuery = searchQuery.replace(/assignee:("[^"]+"|[^\s]+)/gi, '').trim();
                                if (val) {
                                    if (val === 'Unassigned') {
                                        newQuery += ' assignee:none';
                                    } else {
                                        const escapedVal = val.includes(' ') ? `"${val}"` : val;
                                        newQuery += ` assignee:${escapedVal}`;
                                    }
                                }
                                setSearchQuery(newQuery.trim() + ' ');
                            }} 
                        />
                        <FilterDropdown 
                            label="Label" 
                            items={allLabels} 
                            value={currentFilters.label}
                            onChange={(val) => {
                                let newQuery = searchQuery.replace(/label:("[^"]+"|[^\s]+)/gi, '').trim();
                                if (val) {
                                    const escapedVal = val.includes(' ') ? `"${val}"` : val;
                                    newQuery += ` label:${escapedVal}`;
                                }
                                setSearchQuery(newQuery.trim() + ' ');
                            }} 
                        />
                        <FilterDropdown 
                            label="Sort" 
                            items={['Newest', 'Oldest', 'Most Commented', 'Least Commented']} 
                            value={sortBy}
                            onChange={setSortBy} 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800 rounded-b-xl overflow-hidden">
                    {paginatedIssues.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 rounded-b-xl">
                            {searchQuery ? "No issues match your search." : "No issues found."}
                        </div>
                    ) : (
                        paginatedIssues.map(issue => (
                            <Link 
                                key={issue.id} 
                                to={"/issue/" + issue.dir}
                                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between no-underline group transition-colors"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="mt-1">
                                        {issue.status === 'open' ? (
                                            <CircleDot className="w-5 h-5 text-green-600 dark:text-green-500" />
                                        ) : issue.status === 'assigned' ? (
                                            <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        ) : issue.status === 'in-progress' ? (
                                            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
                                        ) : (
                                            <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{issue.title}</h3>
                                            {issue.labels && issue.labels.map((label: string) => (
                                                <span key={label} className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-100 dark:border-blue-900/30">
                                                    {label}
                                                </span>
                                            ))}
                                            {issue.isDirty && (
                                                <CircleDot className="w-3 h-3 text-yellow-500 fill-yellow-500" title="Uncommitted changes" />
                                            )}
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
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <div className="flex items-center gap-4">
                                        <Badge variant={issue.status}>{issue.status}</Badge>
                                        <div className="flex items-center gap-1 text-slate-400">
                                            <MessageSquare className="w-4 h-4" />
                                            <span className="text-xs font-bold">{issue.comments_count || 0}</span>
                                        </div>
                                    </div>
                                    {issue.assignee && (
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Avatar username={issue.assignee} size="xs" />
                                            <span className="font-medium">{issue.assignee}</span>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </Card>

            <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
            />
        </div>
    );
};
