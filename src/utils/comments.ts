export type Comment = {
    id: string;
    author: string;
    date: string;
    created?: string;
    body: string;
    reply_to?: string;
    [key: string]: any;
};

export type ThreadedComment = Comment & {
    depth: number;
    replies: ThreadedComment[];
};

export function threadComments(comments: Comment[]): ThreadedComment[] {
    // Internal type for building the tree before we know the depth
    type CommentNode = Comment & {
        replies: CommentNode[];
    };

    const roots: CommentNode[] = [];
    
    // Sort by date first to maintain chronological order for roots and among siblings
    const sortedComments = [...comments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const nodeMap = new Map<string, CommentNode>();
    
    // Create nodes
    sortedComments.forEach(c => {
        nodeMap.set(c.id, {...c, replies: []});
    });

    // Build tree
    sortedComments.forEach(c => {
        const node = nodeMap.get(c.id)!;
        if (c.reply_to && nodeMap.has(c.reply_to)) {
            nodeMap.get(c.reply_to)!.replies.push(node);
        } else {
            roots.push(node);
        }
    });

    const flatten = (nodes: CommentNode[], depth = 0): ThreadedComment[] => {
        let result: ThreadedComment[] = [];
        nodes.forEach(node => {
            const threaded: ThreadedComment = {
                ...node,
                depth,
                replies: [] // we don't need the nested tree in the flat list
            };
            result.push(threaded);
            result = result.concat(flatten(node.replies, depth + 1));
        });
        return result;
    };

    return flatten(roots);
}
