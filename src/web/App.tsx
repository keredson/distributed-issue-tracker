import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, Navigate } from 'react-router-dom';
import { marked } from 'marked';
import { 
    Sun, Moon, ChevronDown, Check, Search, X, 
    CircleDot, User, Clock, CheckCircle2, 
    MessageSquare, ArrowLeft, Edit2, Layout
} from 'lucide-react';

// Theme Context
const ThemeContext = createContext<{
    isDark: boolean;
    toggleTheme: () => void;
}>({
    isDark: false,
    toggleTheme: () => {},
});

const useTheme = () => useContext(ThemeContext);

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const toggleTheme = () => setIsDark(!isDark);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Add types for props
interface CardProps {
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = "" }) => (
    <div className={"bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm " + className}>
        {children}
    </div>
);

interface BadgeProps {
    children: React.ReactNode;
    variant?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = "default" }) => {
    const variants: {[key: string]: string} = {
        default: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
        open: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        closed: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
        bug: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        feature: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        assigned: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
        'in-progress': "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
    };
    return (
        <span className={"px-2.5 py-0.5 rounded-full text-xs font-semibold " + (variants[variant] || variants.default)}>
            {typeof children === 'string' ? children.toUpperCase() : children}
        </span>
    );
};

const Markdown = ({ content }: { content: string }) => {
    // marked.parse can be async in some versions, but usually sync.
    // However, typings might say string | Promise<string>. 
    // We assume sync for now or verify marked version.
    const html = marked.parse(content || "") as string; 
    return <div className="prose prose-slate dark:prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
};

const MarkdownEditor = ({ value, onChange, placeholder, minHeight = "150px", className = "border border-slate-200 dark:border-slate-800 rounded-lg" }: { value: string, onChange: (val: string) => void, placeholder?: string, minHeight?: string, className?: string }) => {
    const [isPreview, setIsPreview] = useState(false);

    return (
        <div className={`overflow-hidden bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-slate-900 dark:focus-within:ring-slate-100 focus-within:border-transparent transition-all ${className}`}>
            <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex gap-4">
                <button 
                    type="button" 
                    onClick={() => setIsPreview(false)}
                    className={`text-xs font-bold pb-1 transition-colors ${!isPreview ? 'text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Write
                </button>
                <button 
                    type="button" 
                    onClick={() => setIsPreview(true)}
                    className={`text-xs font-bold pb-1 transition-colors ${isPreview ? 'text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Preview
                </button>
            </div>
            {isPreview ? (
                <div className="p-4 overflow-y-auto bg-white dark:bg-slate-900" style={{ minHeight }}>
                    {value.trim() ? (
                        <Markdown content={value} />
                    ) : (
                        <span className="text-slate-400 text-sm italic">Nothing to preview</span>
                    )}
                </div>
            ) : (
                <textarea 
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full p-4 text-sm focus:outline-none border-none resize-y bg-white dark:bg-slate-900 dark:text-slate-200"
                    style={{ minHeight }}
                ></textarea>
            )}
        </div>
    );
};

interface User {
    username: string;
    name: string;
    email: string;
}

const UserSelect = ({ value, onChange, placeholder = "Select user..." }: { value: string, onChange: (val: string) => void, placeholder?: string }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredUsers = useMemo(() => {
        if (!search) return users;
        const s = search.toLowerCase();
        return users.filter(u => u.username.toLowerCase().includes(s) || u.name.toLowerCase().includes(s));
    }, [users, search]);

    useEffect(() => {
        fetch('/api/users')
            .then(res => res.json())
            .then(data => setUsers(Array.isArray(data) ? data : []));
    }, []);

    const selectedUser = users.find(u => u.username === value);

    return (
        <div className="relative">
            <div 
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedUser ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}>
                    {selectedUser ? `${selectedUser.username} (${selectedUser.name})` : placeholder}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <input 
                            type="text"
                            autoFocus
                            placeholder="Search..."
                            className="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border-none outline-none rounded dark:text-slate-200"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        <div 
                            className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer italic"
                            onClick={() => {
                                onChange("");
                                setIsOpen(false);
                                setSearch("");
                            }}
                        >
                            None (Unassigned)
                        </div>
                        {filteredUsers.map(user => (
                            <div 
                                key={user.username}
                                className="px-4 py-2 text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                                onClick={() => {
                                    onChange(user.username);
                                    setIsOpen(false);
                                    setSearch("");
                                }}
                            >
                                <span>{user.username} <span className="text-slate-500 text-xs ml-1">({user.name})</span></span>
                                {value === user.username && <Check className="w-4 h-4 text-blue-600" />}
                            </div>
                        ))}
                        {filteredUsers.length === 0 && (
                            <div className="px-4 py-2 text-sm text-slate-500">No users found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const FilterDropdown = ({ label, items, value, onChange }: { label: string, items: string[], value?: string, onChange: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const filteredItems = useMemo(() => {
        if (!search) return items;
        const s = search.toLowerCase();
        return items.filter(item => item.toLowerCase().includes(s));
    }, [items, search]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSearch("");
        }
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors py-1 px-2"
            >
                {label} {value && <span className="text-slate-900 dark:text-slate-200 font-bold ml-0.5">{value}</span>}
                <ChevronDown className="w-3 h-3" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filter by {label}</span>
                        {value && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange("");
                                    setIsOpen(false);
                                }}
                                className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {items.length > 5 && (
                        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                            <input 
                                type="text"
                                autoFocus
                                placeholder={`Filter ${label.toLowerCase()}s...`}
                                className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none rounded dark:text-slate-200"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                    )}
                    <div className="max-h-60 overflow-y-auto">
                        {filteredItems.map(item => (
                            <div 
                                key={item}
                                className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                                onClick={() => {
                                    onChange(item);
                                    setIsOpen(false);
                                }}
                            >
                                <span className="truncate pr-2">{item}</span>
                                {value === item && <Check className="w-3 h-3 text-blue-600" />}
                            </div>
                        ))}
                        {filteredItems.length === 0 && (
                            <div className="px-4 py-3 text-xs text-slate-500 italic text-center">
                                No {label.toLowerCase()}s found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const Header = () => {
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

const NewIssue = () => {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [severity, setSeverity] = useState("medium");
    const [assignee, setAssignee] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true);

        try {
            const res = await fetch('/api/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, severity, assignee })
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
                        <input 
                            type="text" 
                            value={title}
                            onChange={e => setTitle(e.target.value)}
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
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                        <MarkdownEditor 
                            value={body}
                            onChange={setBody}
                            placeholder="Describe the issue... (Markdown supported)"
                            minHeight="150px"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            type="submit" 
                            disabled={loading || !title.trim()}
                            className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? 'Creating...' : 'Create Issue'}
                        </button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

const Issues = () => {
    const [issues, setIssues] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("is:open ");
    const [sortBy, setSortBy] = useState("Newest");

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

    const counts = useMemo(() => {
        const open = issues.filter(i => i.status === 'open' || i.status === 'assigned' || i.status === 'in-progress').length;
        const closed = issues.filter(i => i.status === 'closed').length;
        return { open, closed };
    }, [issues]);

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

        const filteredIssues = useMemo(() => {

            let result = [...issues];

            

            // Improved parsing to handle quoted values like author:"John Doe"

            const filters: {[key: string]: string[]} = {};

            const textTerms: string[] = [];

            

            const regex = /([a-zA-Z]+):("[^"]+"|[^\s]+)|("[^"]+"|[^\s]+)/gi;

            let match;

            

            while ((match = regex.exec(searchQuery)) !== null) {

                if (match[1]) {

                    // It's a key:value filter

                    const key = match[1].toLowerCase();

                    let value = match[2];

                    if (value.startsWith('"') && value.endsWith('"')) {

                        value = value.substring(1, value.length - 1);

                    }

                    if (!filters[key]) filters[key] = [];

                    filters[key].push(value.toLowerCase());

                } else if (match[3]) {

                    // It's a text term

                    let term = match[3];

                    if (term.startsWith('"') && term.endsWith('"')) {

                        term = term.substring(1, term.length - 1);

                    }

                    textTerms.push(term.toLowerCase());

                }

            }

    

            result = result.filter(issue => {

                // Text Search

                if (textTerms.length > 0) {

                    const content = (

                        (issue.title || "") + " " + 

                        (issue.author || "") + " " + 

                        (issue.id || "") + " " + 

                        (issue.body || "") + " " +

                        (issue.assignee || "")

                    ).toLowerCase();

                    

                    if (!textTerms.every(term => content.includes(term))) {

                        return false;

                    }

                }

    

                // Field Filters

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

                    } else if (key === 'id') {

                        if (!values.includes((issue.id || "").toLowerCase())) return false;

                    }

                }

    

                return true;

            });

    

            // Sorting

            result.sort((a, b) => {

                if (sortBy === 'Newest') return new Date(b.created).getTime() - new Date(a.created).getTime();

                if (sortBy === 'Oldest') return new Date(a.created).getTime() - new Date(b.created).getTime();

                if (sortBy === 'Most Commented') return (b.comments_count || 0) - (a.comments_count || 0);

                if (sortBy === 'Least Commented') return (a.comments_count || 0) - (b.comments_count || 0);

                return 0;

            });

    

            return result;

        }, [issues, searchQuery, sortBy]);

    

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

                

                <Card className="overflow-hidden border-slate-200 dark:border-slate-800">

                    <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">

                        <div className="flex items-center gap-4">

                            <button 

                                onClick={() => {

                                    // Replace is:closed or state:closed with is:open

                                    let newQuery = searchQuery.replace(/(is|state):closed/gi, 'is:open');

                                    if (!newQuery.match(/(is|state):open/i)) {

                                        newQuery = 'is:open ' + newQuery;

                                    }

                                    setSearchQuery(newQuery);

                                }}

                                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${searchQuery.match(/(is|state):open/i) || (!searchQuery.match(/(is|state):closed/i)) ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}

                            >

                                <CircleDot className="w-4 h-4" />

                                {counts.open} Open

                            </button>

                            <button 

                                onClick={() => {

                                    // Replace is:open or state:open with is:closed

                                    let newQuery = searchQuery.replace(/(is|state):open/gi, 'is:closed');

                                    if (!newQuery.match(/(is|state):closed/i)) {

                                        newQuery = 'is:closed ' + newQuery;

                                    }

                                    setSearchQuery(newQuery);

                                }}

                                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${searchQuery.match(/(is|state):closed/i) ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}

                            >

                                <Check className="w-4 h-4" />

                                {counts.closed} Closed

                            </button>

                        </div>

                        

                        <div className="flex items-center gap-2">

                                                    <FilterDropdown 

                                                        label="Author" 

                                                        items={authors} 

                                                        value={currentFilters.author}

                                                        onChange={(val) => {

                                                            // Remove existing author filter

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

                                                        onChange={(val) => {

                                                            // Remove existing assignee filter

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

                                label="Sort" 

                                items={['Newest', 'Oldest', 'Most Commented', 'Least Commented']} 

                                value={sortBy}

                                onChange={setSortBy} 

                            />

                        </div>

                    </div>

    

                    <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800">

                        {filteredIssues.length === 0 ? (

                            <div className="p-12 text-center text-slate-500">

                                {searchQuery ? "No issues match your search." : "No issues found."}

                            </div>

                        ) : (

                            filteredIssues.map(issue => (

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

                                                {issue.isDirty && (

                                                    <CircleDot className="w-3 h-3 text-yellow-500 fill-yellow-500" title="Uncommitted changes" />

                                                )}

                                            </div>

                                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">

                                                <span className="font-mono">#{issue.id}</span>

                                                <span>•</span>

                                                <span>opened {new Date(issue.created).toLocaleDateString()} by {issue.author}</span>

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

                                                <User className="w-3 h-3" />

                                                <span className="font-medium">{issue.assignee}</span>

                                            </div>

                                        )}

                                    </div>

                                </Link>

                            ))

                        )}

                    </div>

                </Card>

            </div>

        );

    };

    

const IssueView = () => {
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
                            <Route path="/issue/:year/:month/:slug" element={<IssueView />} />
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
