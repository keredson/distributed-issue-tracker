import { calculateConfidence, RatingSummary } from './rankings.js';

export type PriorityDisplay = {
    text: string;
    tooltip: string;
};

export function getConfidenceDescriptor(score: number) {
    if (score === 0) return 'not confident yet';
    const abs = Math.abs(score);
    if (score > 0) {
        if (abs >= 1.5) return 'highly confident';
        if (abs >= 0.5) return 'confident';
        return 'slightly confident';
    }
    if (abs >= 1.5) return 'highly contested';
    if (abs >= 0.5) return 'contested';
    return 'slightly contested';
}

export function getPriorityDisplay(rating?: RatingSummary): PriorityDisplay | null {
    if (!rating) return null;
    const unranked = Math.abs(rating.mu - 25) < 0.001 && Math.abs(rating.sigma - (25 / 3)) < 0.001;
    if (unranked) return null;
    const ordinal = rating.ordinal;
    let bucket = '💤';
    let label = 'Very Low';
    if (ordinal >= 10) { bucket = '🔥'; label = 'Urgent'; }
    else if (ordinal >= 5) { bucket = '⚡'; label = 'High'; }
    else if (ordinal >= 0) { bucket = '🟦'; label = 'Normal'; }
    else if (ordinal >= -5) { bucket = '🧊'; label = 'Low'; }
    const confidenceScore = calculateConfidence(rating.sigma, rating.appearanceCount);
    const descriptor = getConfidenceDescriptor(confidenceScore);
    const tooltip = `Priority: ${label} (${descriptor})`;
    if (confidenceScore <= -0.5) return { text: '⚖️', tooltip };
    if (confidenceScore > 0) return { text: bucket, tooltip };
    return { text: '?', tooltip };
}
