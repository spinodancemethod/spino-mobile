import { sortCategories } from './useUserRoadmaps'
import type { VideoCategoryRecord } from '../models'

jest.mock('../supabase', () => ({ supabase: {} }))
jest.mock('../auth', () => ({ useAuth: () => ({ user: null, loading: false }) }))

function category(partial: Partial<VideoCategoryRecord> & { name: string }): VideoCategoryRecord {
    return { id: partial.name, user_id: null, roadmap_id: 'r', description: null, system_category: false, created_at: '', updated_at: '', ...partial }
}

describe('sortCategories', () => {
    it('matches the server order: sort_order first (nulls last), then system, then name', () => {
        const sorted = sortCategories([
            category({ name: 'Zeta' }),
            category({ name: 'Misc', system_category: true }),
            category({ name: 'Alpha' }),
            category({ name: 'Second', sort_order: 20 }),
            category({ name: 'First', sort_order: 10 }),
        ]).map((item) => item.name)
        expect(sorted).toEqual(['First', 'Second', 'Misc', 'Alpha', 'Zeta'])
    })
})
