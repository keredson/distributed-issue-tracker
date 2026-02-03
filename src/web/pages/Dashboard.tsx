import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
    CircleDot, 
    User, 
    Clock, 
    CheckCircle2, 
    MessageSquare, 
    LayoutDashboard,
    AlertCircle,
    CheckCircle,
    ListTodo
} from 'lucide-react';
import { Card, Badge, Avatar } from '../components/Common.js';

export const Dashboard = () => {
    const [issues, setIssues] = useState<any[]>([]);
    const [me, setMe] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [issuesRes, meRes] = await Promise.all([
                    fetch('/api/issues'),
                    fetch('/api/me')
                ]);
                
                const issuesData = await issuesRes.json();
                const meData = await meRes.json();
                
                setIssues(Array.isArray(issuesData) ? issuesData : []);
                setMe(meData);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const stats = useMemo(() => {
        if (!me) return null;
        
        const assignedToMe = issues.filter(i => i.assignee === me.username);
        const createdByMe = issues.filter(i => i.author === me.username);
        
        const openAssigned = assignedToMe.filter(i => i.status !== 'closed');
        const closedAssigned = assignedToMe.filter(i => i.status === 'closed');
        
        const openCreated = createdByMe.filter(i => i.status !== 'closed');
        
        return {
            assignedToMe,
            createdByMe,
            openAssigned,
            closedAssigned,
            openCreated,
            totalOpen: issues.filter(i => i.status !== 'closed').length
        };
    }, [issues, me]);

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;
    
    if (!me) return (
        <div className="max-w-7xl mx-auto p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Please log in to view your dashboard</h2>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-8">
            <div className="flex items-center gap-4 mb-8">
                <Avatar username={me.username} size="lg" className="ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-950" />
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400">Welcome back, {me.name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="p-6 border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned to You</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats?.openAssigned.length}</h3>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                            <User className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Requires your attention
                    </p>
                </Card>

                <Card className="p-6 border-l-4 border-l-green-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Created by You</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats?.openCreated.length}</h3>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg text-green-600 dark:text-green-400">
                            <ListTodo className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                        <CircleDot className="w-3 h-3" />
                        Open issues you've reported
                    </p>
                </Card>

                <Card className="p-6 border-l-4 border-l-purple-500">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed by You</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{stats?.closedAssigned.length}</h3>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Tasks you've finished
                    </p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-500" />
                            Assigned to Me
                        </h3>
                        <Link to={`/issues?q=assignee:${me.username}+is:open`} className="text-sm text-blue-600 hover:underline">View all</Link>
                    </div>
                    <Card className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats?.openAssigned.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                No open issues assigned to you.
                            </div>
                        ) : (
                            stats?.openAssigned.slice(0, 5).map(issue => (
                                <IssueRow key={issue.id} issue={issue} />
                            ))
                        )}
                    </Card>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ListTodo className="w-5 h-5 text-green-500" />
                            My Recent Issues
                        </h3>
                        <Link to={`/issues?q=author:${me.username}`} className="text-sm text-blue-600 hover:underline">View all</Link>
                    </div>
                    <Card className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats?.createdByMe.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                You haven't created any issues yet.
                            </div>
                        ) : (
                            stats?.createdByMe.slice(0, 5).map(issue => (
                                <IssueRow key={issue.id} issue={issue} />
                            ))
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

const IssueRow = ({ issue }: { issue: any }) => (
    <Link 
        to={"/issue/" + issue.dir}
        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between no-underline group transition-colors"
    >
        <div className="flex items-start gap-3 overflow-hidden">
            <div className="mt-1 flex-shrink-0">
                {issue.status === 'open' ? (
                    <CircleDot className="w-4 h-4 text-green-600" />
                ) : issue.status === 'assigned' ? (
                    <User className="w-4 h-4 text-indigo-600" />
                ) : issue.status === 'in-progress' ? (
                    <Clock className="w-4 h-4 text-yellow-600" />
                ) : (
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                )}
            </div>
            <div className="overflow-hidden">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 truncate transition-colors">
                    {issue.title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono">#{issue.id}</span>
                    <span>•</span>
                    <span>{new Date(issue.created).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            <Badge variant={issue.status}>{issue.status}</Badge>
            <div className="flex items-center gap-1 text-slate-400">
                <MessageSquare className="w-3 h-3" />
                <span className="text-[10px] font-bold">{issue.comments_count || 0}</span>
            </div>
        </div>
    </Link>
);
