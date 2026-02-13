export type LevelItem = { id: string; name: string; value: number; color?: string };

export const LEVELS: LevelItem[] = [
    { id: 'all', name: 'All levels', value: 0 },
    { id: 'beginner', name: 'Beginner', value: 1, color: '#10B981' },
    { id: 'improver', name: 'Improver', value: 2, color: '#34D399' },
    { id: 'improver_plus', name: 'Improver +', value: 3, color: '#FBBF24' },
    { id: 'intermediate', name: 'Intermediate', value: 4, color: '#F97316' },
    { id: 'advance', name: 'Advance', value: 5, color: '#EF4444' },
];

export function getLevelLabel(level?: number | null): string | null {
    if (level == null) return null;
    const found = LEVELS.find((l) => l.value === level);
    return found ? found.name : `Level ${level}`;
}

export function getLevelInfo(level?: number | null): { label: string; color?: string } | null {
    if (level == null) return null;
    const found = LEVELS.find((l) => l.value === level);
    if (found) return { label: found.name, color: found.color };
    return { label: `Level ${level}`, color: undefined };
}

export default LEVELS;
