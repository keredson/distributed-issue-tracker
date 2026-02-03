import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Mail, Github, MapPin, Camera, Trash2, ArrowLeft } from 'lucide-react';
import { Card, Avatar } from '../components/Common.js';

export const UserDetail = () => {
    const { username } = useParams();
    const [user, setUser] = useState<any>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        try {
            const [userRes, meRes] = await Promise.all([
                fetch(`/api/users/${username}`),
                fetch('/api/me')
            ]);
            
            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData);
            }
            
            if (meRes.ok) {
                const meData = await meRes.json();
                setCurrentUser(meData);
            }
        } catch (err) {
            console.error("Error fetching user data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [username]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const res = await fetch(`/api/users/${username}/avatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': file.type
                },
                body: file
            });

            if (res.ok) {
                // Refresh to show new avatar
                window.location.reload();
            } else {
                alert("Failed to upload avatar");
            }
        } catch (err) {
            console.error(err);
            alert("Error uploading avatar");
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!confirm("Are you sure you want to remove your avatar?")) return;

        try {
            const res = await fetch(`/api/users/${username}/avatar`, {
                method: 'DELETE'
            });

            if (res.ok) {
                window.location.reload();
            } else {
                alert("Failed to remove avatar");
            }
        } catch (err) {
            console.error(err);
            alert("Error removing avatar");
        }
    };

    if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-slate-900 border-t-transparent rounded-full"></div></div>;
    
    if (!user) return (
        <div className="max-w-4xl mx-auto p-8 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">User not found</h2>
            <Link to="/users" className="text-blue-600 dark:text-blue-400 hover:underline">Back to Community</Link>
        </div>
    );

    const isMe = currentUser?.username === user.username;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <Link to="/users" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white no-underline group mb-8">
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Community
            </Link>

            <Card className="overflow-hidden border-none shadow-xl ring-1 ring-slate-200 dark:ring-slate-800">
                <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                <div className="px-8 pb-8 relative">
                    <div className="relative -mt-16 mb-6 inline-block">
                        <Avatar username={user.username} size="lg" className="w-32 h-32 text-4xl ring-8 ring-white dark:ring-slate-900" />
                        {isMe && (
                            <div className="absolute bottom-0 right-0 flex gap-2">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                                    title="Upload new avatar"
                                    disabled={uploading}
                                >
                                    <Camera className="w-5 h-5" />
                                </button>
                                {user.profilePic && (
                                    <button 
                                        onClick={handleRemoveAvatar}
                                        className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-all"
                                        title="Remove avatar"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>

                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{user.name}</h2>
                            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">@{user.username}</p>
                            {user.github?.bio && (
                                <p className="mt-4 text-slate-700 dark:text-slate-300 max-w-2xl">{user.github.bio}</p>
                            )}
                            {user.github?.location && (
                                <div className="flex items-center gap-2 mt-4 text-slate-500 dark:text-slate-400 text-sm">
                                    <MapPin className="w-4 h-4" />
                                    <span>{user.github.location}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-4">
                            {user.email && (
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                    <Mail className="w-5 h-5" />
                                    <span>{user.email}</span>
                                </div>
                            )}
                            {user.github && (
                                <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                                    <Github className="w-5 h-5" />
                                    <a 
                                        href={user.github.html_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    >
                                        github.com/{user.github.login}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};
