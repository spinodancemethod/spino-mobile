export function computeNextToggledIds(previous: string[], itemId: string) {
    const exists = previous.includes(itemId);
    const next = exists
        ? previous.filter((id) => id !== itemId)
        : [...previous, itemId];

    return {
        exists,
        next,
    };
}
