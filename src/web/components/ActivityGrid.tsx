import React, { useMemo } from 'react';

interface ActivityGridProps {
    data: { [date: string]: number };
}

export const ActivityGrid: React.FC<ActivityGridProps> = ({ data }) => {
    const today = new Date();
    // Normalize today to start of day to avoid timezone weirdness with just dates
    today.setHours(0, 0, 0, 0);

    const { weeks, months } = useMemo(() => {
        const weeks = [];
        const months = [];
        
        // Find the Sunday 52 weeks ago
        const endDate = new Date(today);
        // Start from 52 weeks ago
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - (52 * 7));
        
        // Adjust to the previous Sunday if not already
        const dayOfWeek = startDate.getDay(); // 0 is Sunday
        startDate.setDate(startDate.getDate() - dayOfWeek);

        let currentDate = new Date(startDate);
        let currentWeek = [];
        let lastMonth = -1;

        // Generate exactly 53 weeks to cover the full year view including today
        for (let w = 0; w < 53; w++) {
            currentWeek = [];
            for (let d = 0; d < 7; d++) {
                // If we've passed today, we can stop or just render empty future slots
                // GitHub usually renders the full week row even if future
                const dateString = currentDate.toISOString().split('T')[0];
                const count = data[dateString] || 0;
                
                // Track months
                if (d === 0) { // Check month on the first row (Sunday)
                    const m = currentDate.getMonth();
                    if (m !== lastMonth) {
                        months.push({ name: currentDate.toLocaleString('default', { month: 'short' }), index: w });
                        lastMonth = m;
                    }
                }

                currentWeek.push({
                    date: dateString,
                    count,
                    level: getLevel(count)
                });

                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }
            weeks.push(currentWeek);
        }

        return { weeks, months };
    }, [data]);

    function getLevel(count: number) {
        if (count === 0) return 0;
        if (count <= 1) return 1;
        if (count <= 3) return 2;
        if (count <= 6) return 3;
        return 4;
    }

    const getColor = (level: number) => {
        switch (level) {
            case 0: return 'bg-slate-100 dark:bg-slate-800';
            case 1: return 'bg-green-200 dark:bg-green-900/50';
            case 2: return 'bg-green-400 dark:bg-green-700';
            case 3: return 'bg-green-600 dark:bg-green-500';
            case 4: return 'bg-green-800 dark:bg-green-300';
            default: return 'bg-slate-100 dark:bg-slate-800';
        }
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-fit">
                <div className="flex text-[10px] text-slate-400 mb-1 pl-9">
                    {months.map((m, i) => (
                        <div 
                            key={`${m.name}-${i}`} 
                            style={{ 
                                width: months[i+1] ? `${(months[i+1].index - m.index) * 13}px` : 'auto',
                                marginRight: !months[i+1] ? '0' : undefined 
                            }}
                        >
                            {m.name}
                        </div>
                    ))}
                </div>
                <div className="flex">
                    <div className="flex flex-col text-[9px] text-slate-400 w-9">
                        <div className="h-[13px] invisible">Sun</div>
                        <div className="h-[13px] flex items-center">Mon</div>
                        <div className="h-[13px] invisible">Tue</div>
                        <div className="h-[13px] flex items-center">Wed</div>
                        <div className="h-[13px] invisible">Thu</div>
                        <div className="h-[13px] flex items-center">Fri</div>
                        <div className="h-[13px] invisible">Sat</div>
                    </div>
                    <div className="flex gap-[3px]">
                        {weeks.map((week, wIndex) => (
                            <div key={wIndex} className="flex flex-col gap-[3px]">
                                {week.map((day) => (
                                    <div
                                        key={day.date}
                                        className={`w-2.5 h-2.5 rounded-[1px] ${getColor(day.level)} transition-colors hover:ring-1 hover:ring-slate-400 dark:hover:ring-slate-500`}
                                        title={`${day.count} contributions on ${day.date}`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 text-[10px] text-slate-400">
                    <span>Less</span>
                    <div className="flex gap-[3px]">
                        <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(0)}`} />
                        <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(1)}`} />
                        <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(2)}`} />
                        <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(3)}`} />
                        <div className={`w-2.5 h-2.5 rounded-[2px] ${getColor(4)}`} />
                    </div>
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};
