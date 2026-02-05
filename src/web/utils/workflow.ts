export type IssueWorkflow = {
    states: string[];
    transitions: Record<string, string[]>;
    initial?: string;
    classDefs?: Record<string, { fill?: string; stroke?: string; color?: string; icon?: string }>;
    stateClasses?: Record<string, string>;
    transitionLabels?: Record<string, string>;
};

const DEFAULT_WORKFLOW: IssueWorkflow = {
    states: ['open', 'active', 'closed'],
    transitions: {
        open: ['active'],
        active: ['closed', 'open'],
        closed: ['open']
    },
    initial: 'open',
    classDefs: {
        openState: { fill: '#E6FFED', stroke: '#16A34A', color: '#166534' },
        activeState: { fill: '#FEF3C7', stroke: '#D97706', color: '#92400E' },
        closedState: { fill: '#EDE9FE', stroke: '#7C3AED', color: '#5B21B6' }
    },
    stateClasses: {
        open: 'openState',
        active: 'activeState',
        closed: 'closedState'
    }
};

const hasOutgoing = (state: string, workflow: IssueWorkflow) => {
    return (workflow.transitions[state] || []).length > 0;
};

export const getDefaultWorkflow = () => DEFAULT_WORKFLOW;

export const getClosedStates = (workflow: IssueWorkflow) => {
    if (!workflow.states.length) return ['closed'];
    if (workflow.states.includes('closed')) return ['closed'];
    const terminals = workflow.states.filter(state => !hasOutgoing(state, workflow));
    if (terminals.length > 0) return terminals;
    return [];
};

export const getOpenStates = (workflow: IssueWorkflow) => {
    if (!workflow.states.length) return ['open', 'active'];
    const closed = getClosedStates(workflow);
    if (closed.length === 0) return workflow.states;
    return workflow.states.filter(state => !closed.includes(state));
};

export const getStatusOrder = (workflow: IssueWorkflow) => {
    if (!workflow.states.length) return DEFAULT_WORKFLOW.states;
    return workflow.states;
};

export const getAllowedStatusOptions = (current: string, workflow: IssueWorkflow) => {
    if (!workflow.states.length) return DEFAULT_WORKFLOW.states;
    if (!workflow.states.includes(current)) {
        return [current, ...workflow.states.filter(s => s !== current)];
    }
    const next = workflow.transitions[current] || [];
    return [current, ...next.filter(s => s !== current)];
};

export const formatStatusLabel = (status: string) => {
    return status
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const normalizeStatus = (status: string, workflow: IssueWorkflow) => {
    const raw = (status || '').toLowerCase();
    if (!raw) return raw;
    if (raw === 'in_progress' || raw === 'in-progress') {
        if (workflow.states.includes('active') && !workflow.states.includes(raw)) {
            return 'active';
        }
    }
    return raw;
};

export const getStatusStyle = (status: string, workflow: IssueWorkflow) => {
    const stateClass = workflow.stateClasses?.[status];
    const def = stateClass ? workflow.classDefs?.[stateClass] : undefined;
    if (!def) return undefined;
    return {
        backgroundColor: def.fill,
        color: def.color,
        borderColor: def.stroke
    } as CSSProperties;
};

export const getStatusIconColor = (status: string, workflow: IssueWorkflow) => {
    const stateClass = workflow.stateClasses?.[status];
    const def = stateClass ? workflow.classDefs?.[stateClass] : undefined;
    return def?.stroke || def?.color || undefined;
};

export const getTransitionLabel = (from: string, to: string, workflow: IssueWorkflow) => {
    const key = `${from}->${to}`;
    return workflow.transitionLabels?.[key] || null;
};

export const getStateIconName = (status: string, workflow: IssueWorkflow) => {
    const stateClass = workflow.stateClasses?.[status];
    const def = stateClass ? workflow.classDefs?.[stateClass] : undefined;
    return def?.icon || null;
};
import type { CSSProperties } from 'react';
