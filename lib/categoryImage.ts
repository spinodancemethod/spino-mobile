import { supabase } from './supabase'

export const CATEGORY_IMAGE_BUCKET = 'category-images'

/** Public URL for a category tile image, or undefined when the category has none. */
export function categoryImageUrl(path: string | null | undefined): string | undefined {
    if (!path) return undefined
    return supabase.storage.from(CATEGORY_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Object path for a new upload: own folder (RLS), category id, and a timestamp so the URL changes on replace. */
export function newCategoryImagePath(userId: string, categoryId: string, mimeType: string): string {
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    return `${userId}/${categoryId}-${Date.now()}.${ext}`
}
