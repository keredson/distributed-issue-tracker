import React, { useState, useMemo } from 'react';
import { marked } from 'marked';

export const Markdown = ({ content, issueId }: { content: string, issueId?: string }) => {
    const html = useMemo(() => {
        if (!content) return "";

        const options: any = {};
        if (issueId) {
            options.walkTokens = (token: any) => {
                if ((token.type === 'link' || token.type === 'image') && token.href && token.href.startsWith('data/')) {
                    token.href = `/api/issues/${issueId}/${token.href}`;
                }
            };
        }

        return marked.parse(content, options) as string;
    }, [content, issueId]);

    return <div className="prose prose-slate dark:prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
};

export const MarkdownEditor = ({ 
    value, 
    onChange, 
    placeholder, 
    minHeight = "150px", 
    className = "border border-slate-200 dark:border-slate-800 rounded-lg",
    onKeyDown,
    onCmdEnter,
    onUpload,
    issueId
}: { 
    value: string, 
    onChange: (val: string) => void, 
    placeholder?: string, 
    minHeight?: string, 
    className?: string,
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void,
    onCmdEnter?: () => void,
    onUpload?: (files: FileList) => Promise<string[]>,
    issueId?: string
}) => {
    const [isPreview, setIsPreview] = useState(false);
    const textAreaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (onKeyDown) onKeyDown(e);
        if (onCmdEnter && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onCmdEnter();
        }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (!onUpload) return;
        
        const files = e.clipboardData.files;
        if (files.length > 0) {
            e.preventDefault();
            const links = await onUpload(files);
            if (links.length > 0) {
                const insertText = links.join('\n') + '\n';
                const start = textAreaRef.current?.selectionStart || 0;
                const end = textAreaRef.current?.selectionEnd || 0;
                const newValue = value.substring(0, start) + insertText + value.substring(end);
                onChange(newValue);
                
                // Set cursor after the inserted text in next tick
                setTimeout(() => {
                    if (textAreaRef.current) {
                        textAreaRef.current.selectionStart = textAreaRef.current.selectionEnd = start + insertText.length;
                    }
                }, 0);
            }
        }
    };

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
                        <Markdown content={value} issueId={issueId} />
                    ) : (
                        <span className="text-slate-400 text-sm italic">Nothing to preview</span>
                    )}
                </div>
            ) : (
                <textarea 
                    ref={textAreaRef}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={placeholder}
                    className="w-full p-4 text-sm focus:outline-none border-none resize-y bg-white dark:bg-slate-900 dark:text-slate-200"
                    style={{ minHeight }}
                ></textarea>
            )}
        </div>
    );
};
