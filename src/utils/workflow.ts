import fs from 'node:fs';
import path from 'node:path';

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

const WORKFLOW_PATH = path.join(process.cwd(), '.dit', 'workflows', 'issue.mmd');

const addUnique = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
};

export const loadIssueWorkflow = (): IssueWorkflow => {
    try {
        if (!fs.existsSync(WORKFLOW_PATH)) return DEFAULT_WORKFLOW;

        const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');
        const lines = raw.split(/\r?\n/);
        const alias: Record<string, string> = {};
        const states: string[] = [];
        const transitions: Record<string, string[]> = {};
        const transitionLabels: Record<string, string> = {};
        const classDefs: Record<string, { fill?: string; stroke?: string; color?: string; icon?: string }> = {};
        const stateClasses: Record<string, string> = {};
        let initial: string | undefined;

        for (const line of lines) {
            const stripped = line.split('%%')[0].trim().replace(/;$/, '').trim();
            if (!stripped) continue;

            const aliasMatch = stripped.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z0-9_-]+)$/);
            if (aliasMatch) {
                const [, label, id] = aliasMatch;
                alias[id] = label;
                addUnique(states, label);
                continue;
            }

            const classDefMatch = stripped.match(/^classDef\s+([A-Za-z0-9_-]+)\s+(.+)$/);
            if (classDefMatch) {
                const [, className, rawDefs] = classDefMatch;
                const defs = rawDefs.split(',').map(part => part.trim());
                const entry: { fill?: string; stroke?: string; color?: string } = {};
                for (const def of defs) {
                    const [key, value] = def.split(':').map(part => part.trim());
                    if (!key || !value) continue;
                    const cleaned = value.replace(/;$/, '').trim();
                    if (key === 'fill') entry.fill = cleaned;
                    if (key === 'stroke') entry.stroke = cleaned;
                    if (key === 'color') entry.color = cleaned;
                    if (key === 'icon') entry.icon = cleaned;
                }
                classDefs[className] = entry;
                continue;
            }

            const classAssignMatch = stripped.match(/^class\s+([A-Za-z0-9_,\-\s]+)\s+([A-Za-z0-9_-]+)$/);
            if (classAssignMatch) {
                const [, rawIds, className] = classAssignMatch;
                const ids = rawIds.split(',').map(id => id.trim()).filter(Boolean);
                ids.forEach(id => {
                    const label = alias[id] || id;
                    stateClasses[label] = className;
                    addUnique(states, label);
                });
                continue;
            }

            const transitionMatch = stripped.match(/^([A-Za-z0-9_\-\[\]\*]+)\s*-->\s*([A-Za-z0-9_\-\[\]\*]+)(?:\s*:\s*(.+))?$/);
            if (!transitionMatch) continue;

            let [, from, to, label] = transitionMatch;
            if (from === '[*]') {
                const next = alias[to] || to;
                initial = next;
                addUnique(states, next);
                continue;
            }

            from = alias[from] || from;
            to = alias[to] || to;

            addUnique(states, from);
            addUnique(states, to);
            transitions[from] = transitions[from] || [];
            if (!transitions[from].includes(to)) transitions[from].push(to);
            if (label) {
                transitionLabels[`${from}->${to}`] = label.trim();
            }
        }

        if (states.length === 0) return DEFAULT_WORKFLOW;

        return {
            states,
            transitions,
            initial: initial || states[0],
            classDefs: Object.keys(classDefs).length ? classDefs : DEFAULT_WORKFLOW.classDefs,
            stateClasses: Object.keys(stateClasses).length ? stateClasses : DEFAULT_WORKFLOW.stateClasses,
            transitionLabels
        };
    } catch (_err) {
        return DEFAULT_WORKFLOW;
    }
};

export const getDefaultIssueStatus = (workflow: IssueWorkflow) => {
    return workflow.initial || workflow.states[0] || DEFAULT_WORKFLOW.initial || 'open';
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

export const getAllowedStatusOptions = (current: string, workflow: IssueWorkflow) => {
    if (!workflow.states.includes(current)) {
        const unique = [current, ...workflow.states.filter(s => s !== current)];
        return unique;
    }
    const next = workflow.transitions[current] || [];
    const options = [current, ...next.filter(s => s !== current)];
    return options;
};

export const isTransitionAllowed = (current: string, next: string, workflow: IssueWorkflow) => {
    if (current === next) return true;
    if (!workflow.states.includes(current)) return true;
    return (workflow.transitions[current] || []).includes(next);
};

const hexToRgb = (hex: string) => {
    const normalized = hex.replace('#', '').trim();
    if (normalized.length === 3) {
        const r = parseInt(normalized[0] + normalized[0], 16);
        const g = parseInt(normalized[1] + normalized[1], 16);
        const b = parseInt(normalized[2] + normalized[2], 16);
        return { r, g, b };
    }
    if (normalized.length === 6) {
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        return { r, g, b };
    }
    return null;
};

const rgbToHue = (r: number, g: number, b: number) => {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const delta = max - min;
    if (delta === 0) return 0;
    let hue = 0;
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    if (max === gn) hue = (bn - rn) / delta + 2;
    if (max === bn) hue = (rn - gn) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
    return hue;
};

const pickInkColorFromHex = (hex?: string) => {
    if (!hex) return 'gray';
    const rgb = hexToRgb(hex);
    if (!rgb) return 'gray';
    const hue = rgbToHue(rgb.r, rgb.g, rgb.b);
    if (hue >= 15 && hue < 55) return 'yellow';
    if (hue >= 55 && hue < 90) return 'green';
    if (hue >= 90 && hue < 170) return 'cyan';
    if (hue >= 170 && hue < 250) return 'blue';
    if (hue >= 250 && hue < 320) return 'magenta';
    return 'red';
};

export const getStatusInkColor = (status: string, workflow: IssueWorkflow) => {
    const stateClass = workflow.stateClasses?.[status];
    const def = stateClass ? workflow.classDefs?.[stateClass] : undefined;
    const hex = def?.color || def?.stroke || def?.fill;
    return pickInkColorFromHex(hex);
};

const hasOutgoing = (state: string, workflow: IssueWorkflow) => {
    return (workflow.transitions[state] || []).length > 0;
};

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
