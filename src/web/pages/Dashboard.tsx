import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
    CircleDot, 
    User, 
    Clock, 
        CheckCircle2,
        MessageSquare,
        AlertCircle,
        CheckCircle,
        ListTodo,
        Activity
    } from 'lucide-react';
import { Card, Badge, Avatar } from '../components/Common.js';
import { ActivityGrid } from '../components/ActivityGrid.js';
import { IssueWorkflow, getDefaultWorkflow, getOpenStates, getClosedStates, getStatusStyle, formatStatusLabel, normalizeStatus } from '../utils/workflow.js';

export const Dashboard = () => {
    const [issues, setIssues] = useState<any[]>([]);
    const [activity, setActivity] = useState<{[key: string]: number}>({});
    const [me, setMe] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [workflow, setWorkflow] = useState<IssueWorkflow>(getDefaultWorkflow());
    const [githubAuth, setGithubAuth] = useState<{ configured: boolean; connected: boolean; user?: any } | null>(null);
    const [deviceFlow, setDeviceFlow] = useState<any>(null);
    const [deviceError, setDeviceError] = useState<string | null>(null);
    const pollTimer = useRef<number | null>(null);
    const openStates = useMemo(() => new Set(getOpenStates(workflow)), [workflow]);
    const closedStates = useMemo(() => new Set(getClosedStates(workflow)), [workflow]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [issuesRes, activityRes, meRes] = await Promise.all([
                    fetch('/api/issues'),
                    fetch('/api/activity'),
                    fetch('/api/me')
                ]);
                
                const issuesData = await issuesRes.json();
                const activityData = await activityRes.json();
                const meData = await meRes.json();
                
                setIssues(Array.isArray(issuesData) ? issuesData : []);
                setActivity(activityData || {});
                setMe(meData);
            } catch (err) {
                console.error("Failed to fetch dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        fetch('/api/workflows/issue')
            .then(res => res.json())
            .then(data => setWorkflow(data))
            .catch(() => setWorkflow(getDefaultWorkflow()));
    }, []);

    useEffect(() => {
        fetch('/api/auth/github')
            .then(res => res.json())
            .then(data => setGithubAuth(data))
            .catch(() => setGithubAuth(null));
    }, []);

    useEffect(() => {
        return () => {
            if (pollTimer.current) {
                window.clearTimeout(pollTimer.current);
                pollTimer.current = null;
            }
        };
    }, []);

    const schedulePoll = (delaySeconds: number) => {
        if (pollTimer.current) {
            window.clearTimeout(pollTimer.current);
        }
        pollTimer.current = window.setTimeout(() => {
            void pollDeviceStatus();
        }, Math.max(1, delaySeconds) * 1000);
    };

    const pollDeviceStatus = async () => {
        if (!deviceFlow?.device_id) return;
        try {
            const res = await fetch(`/api/auth/github/device/status?device_id=${deviceFlow.device_id}`);
            const data = await res.json();
            if (data.status === 'pending') {
                schedulePoll(data.retry_in || deviceFlow.interval || 5);
                return;
            }
            if (data.status === 'approved') {
                setGithubAuth((prev) => prev ? { ...prev, connected: true, user: data.user } : { configured: true, connected: true, user: data.user });
                setDeviceFlow({ status: 'approved', user: data.user });
                return;
            }
            if (data.status === 'expired') {
                setDeviceFlow({ status: 'expired' });
                return;
            }
            if (data.status === 'error') {
                setDeviceError(data.error || 'Device flow failed.');
                setDeviceFlow(null);
                return;
            }
        } catch (err) {
            setDeviceError('Device flow failed.');
            setDeviceFlow(null);
        }
    };

    const startDeviceFlow = async () => {
        setDeviceError(null);
        try {
            const res = await fetch('/api/auth/github/device/start', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setDeviceError(data?.error || 'Failed to start GitHub device flow.');
                return;
            }
            setDeviceFlow({
                status: 'pending',
                device_id: data.device_id,
                user_code: data.user_code,
                verification_uri: data.verification_uri,
                verification_uri_complete: data.verification_uri_complete,
                interval: data.interval || 5,
                expires_in: data.expires_in
            });
            schedulePoll(data.interval || 5);
        } catch (err) {
            setDeviceError('Failed to start GitHub device flow.');
        }
    };

    const logoutGitHub = async () => {
        try {
            await fetch('/api/auth/github/logout', { method: 'POST' });
        } finally {
            window.location.reload();
        }
    };

    const stats = useMemo(() => {
        if (!me) return null;
        
        const assignedToMe = issues.filter(i => i.assignee === me.username);
        const createdByMe = issues.filter(i => i.author === me.username);
        
        const openAssigned = assignedToMe.filter(i => openStates.has(normalizeStatus(i.status || '', workflow)));
        const closedAssigned = assignedToMe.filter(i => closedStates.has(normalizeStatus(i.status || '', workflow)));
        
        const openCreated = createdByMe.filter(i => openStates.has(normalizeStatus(i.status || '', workflow)));
        
        return {
            assignedToMe,
            createdByMe,
            openAssigned,
            closedAssigned,
            openCreated,
            totalOpen: issues.filter(i => openStates.has(normalizeStatus(i.status || '', workflow))).length
        };
    }, [issues, me, openStates, closedStates, workflow]);

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

            <Card className="p-6 mb-8 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">GitHub Connection</h3>
                        {githubAuth?.connected ? (
                            <p className="text-slate-600 dark:text-slate-300 mt-2">
                                Connected as <span className="font-semibold">{githubAuth.user?.login || githubAuth.user?.name || 'GitHub user'}</span>.
                            </p>
                        ) : (
                            <p className="text-slate-600 dark:text-slate-300 mt-2">
                                Connect GitHub to sync profile data.
                            </p>
                        )}
                        {!githubAuth?.configured && (
                            <p className="text-xs text-slate-500 mt-2">
                                Run <code>dit web auth</code> to set your GitHub client ID.
                            </p>
                        )}
                        {githubAuth?.configured && !githubAuth?.local_user && (
                            <p className="text-xs text-slate-500 mt-2">
                                No local user detected. Configure git user.name and user.email first.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {!githubAuth?.connected && (
                            <button
                                onClick={startDeviceFlow}
                                disabled={!githubAuth?.configured || !githubAuth?.local_user || deviceFlow?.status === 'pending'}
                                className="inline-flex items-center justify-center rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Log in with GitHub
                            </button>
                        )}
                        {githubAuth?.connected && (
                            <>
                                <span className="inline-flex items-center justify-center rounded-md bg-emerald-100 text-emerald-900 px-4 py-2 text-sm font-semibold">
                                    Connected
                                </span>
                                <button
                                    onClick={logoutGitHub}
                                    className="inline-flex items-center justify-center rounded-md border border-slate-300 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                                >
                                    Log out
                                </button>
                            </>
                        )}
                    </div>
                </div>
                {deviceError && (
                    <p className="text-sm text-red-600 mt-3">{deviceError}</p>
                )}
                {deviceFlow?.status === 'pending' && (
                    <div className="mt-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                            Enter this code on GitHub to finish signing in:
                        </p>
                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                            <span className="text-lg font-mono tracking-wider text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1">
                                {deviceFlow.user_code}
                            </span>
                            <a
                                href={deviceFlow.verification_uri_complete || deviceFlow.verification_uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-blue-600 hover:underline"
                            >
                                Open GitHub to enter code
                            </a>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Waiting for approval…</p>
                    </div>
                )}
                {deviceFlow?.status === 'approved' && (
                    <p className="text-sm text-emerald-700 mt-3">GitHub connected successfully.</p>
                )}
                {deviceFlow?.status === 'expired' && (
                    <p className="text-sm text-amber-700 mt-3">Device code expired. Please try again.</p>
                )}
            </Card>

            <Card className="p-6 mb-8 overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                    <Activity className="w-5 h-5 text-slate-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Contribution Activity</h3>
                </div>
                <ActivityGrid data={activity} />
            </Card>

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
                        <Link to={`/issues?q=assignee:${me.username}+state:${(workflow.initial || workflow.states[0] || 'open').toLowerCase()}`} className="text-sm text-blue-600 hover:underline">View all</Link>
                    </div>
                    <Card className="divide-y divide-slate-100 dark:divide-slate-800">
                        {stats?.openAssigned.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                No open issues assigned to you.
                            </div>
                        ) : (
                            stats?.openAssigned.slice(0, 5).map(issue => (
                                <IssueRow key={issue.id} issue={issue} workflow={workflow} />
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
                                <IssueRow key={issue.id} issue={issue} workflow={workflow} />
                            ))
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

const IssueRow = ({ issue, workflow }: { issue: any; workflow: IssueWorkflow }) => {
    const normalizedStatus = normalizeStatus(issue.status || '', workflow);
    const iconColor = getStatusStyle(normalizedStatus, workflow)?.borderColor;
    return (
    <Link 
        to={"/issue/" + issue.dir}
        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between no-underline group transition-colors"
    >
        <div className="flex items-start gap-3 overflow-hidden">
            <div className="mt-1 flex-shrink-0">
                {normalizedStatus === 'open' ? (
                    <CircleDot className="w-4 h-4" style={{ color: iconColor }} />
                ) : normalizedStatus === 'active' ? (
                    <Clock className="w-4 h-4" style={{ color: iconColor }} />
                ) : normalizedStatus === 'closed' ? (
                    <CheckCircle2 className="w-4 h-4" style={{ color: iconColor }} />
                ) : (
                    <CircleDot className="w-4 h-4 text-slate-400" />
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
            <Badge variant={normalizedStatus} style={getStatusStyle(normalizedStatus, workflow)}>
                {formatStatusLabel(normalizedStatus)}
            </Badge>
            <div className="flex items-center gap-1 text-slate-400">
                <MessageSquare className="w-3 h-3" />
                <span className="text-[10px] font-bold">{issue.comments_count || 0}</span>
            </div>
        </div>
    </Link>
    );
};
