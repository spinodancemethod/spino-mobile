export type LevelItem = { id: string; name: string; value: number; color?: string };

export const LEVELS: LevelItem[] = [
    // "All levels" sentinel — value 0 is never stored on a video, so the filter treats it as "show all".
    { id: 'all', name: 'All levels', value: 0 },
    // Numeric level labels are used across pills and filters.
    { id: '1', name: 'L1', value: 1, color: '#16A34A' },
    { id: '2', name: 'L2', value: 2, color: '#84CC16' },
    { id: '3', name: 'L3', value: 3, color: '#EAB308' },
    { id: '4', name: 'L4', value: 4, color: '#F97316' },
    { id: '5', name: 'L5', value: 5, color: '#DC2626' },
];

export function getLevelLabel(level?: number | null): string | null {
    if (level == null) return null;
    const found = LEVELS.find((l) => l.value === level);
    return found ? found.name : `L${level}`;
}

export function getLevelInfo(level?: number | null): { label: string; color?: string } | null {
    if (level == null) return null;
    const found = LEVELS.find((l) => l.value === level);
    if (found) return { label: found.name, color: found.color };
    return { label: `L${level}`, color: undefined };
}

export default LEVELS;
