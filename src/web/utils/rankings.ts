import { rating, rate, ordinal } from 'openskill';

export type RankingSnapshot = {
    created?: string;
    issues?: string[];
};

export type RatingSummary = {
    mu: number;
    sigma: number;
    ordinal: number;
    appearanceCount: number;
};

export function calculateConfidence(sigma: number, appearanceCount: number): number {
    const SIGMA_START = 8.333;
    const K = 5;
    const BIAS = 0.03;

    if (appearanceCount === 0) return 0;

    const currentReduction = SIGMA_START - sigma;
    const score = (currentReduction - (appearanceCount * 0.1)) * (appearanceCount / K) + BIAS;

    return parseFloat(score.toFixed(2));
}

export function computeRatings(rankings: RankingSnapshot[]): Map<string, RatingSummary> {
    const ratingMap = new Map<string, any>();
    const appearanceCounts = new Map<string, number>();

    const ordered = rankings
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
            const aTime = a.entry.created ? new Date(a.entry.created).getTime() : NaN;
            const bTime = b.entry.created ? new Date(b.entry.created).getTime() : NaN;
            if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) return aTime - bTime;
            if (!Number.isNaN(aTime)) return -1;
            if (!Number.isNaN(bTime)) return 1;
            return a.index - b.index;
        })
        .map(item => item.entry);

    for (const ranking of ordered) {
        if (!ranking.issues || ranking.issues.length === 0) continue;
        for (const issueId of ranking.issues) {
            appearanceCounts.set(issueId, (appearanceCounts.get(issueId) ?? 0) + 1);
        }
        const teams = ranking.issues.map(issueId => [ratingMap.get(issueId) ?? rating()]);
        const rankedTeams = rate(teams, {
            rank: ranking.issues.map((_, index) => index + 1)
        });
        rankedTeams.forEach((team, index) => {
            ratingMap.set(ranking.issues![index], team[0]);
        });
    }

    const summary = new Map<string, RatingSummary>();
    for (const [issueId, value] of ratingMap.entries()) {
        summary.set(issueId, {
            mu: value.mu,
            sigma: value.sigma,
            ordinal: ordinal(value),
            appearanceCount: appearanceCounts.get(issueId) ?? 0
        });
    }
    return summary;
}
