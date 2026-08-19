import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth'
import { queryKeys } from '../queryKeys'
import { supabase } from '../supabase'
import { countSegmentsByVideoUpload } from '../videoSegmentCounts'

export function useVideoSegmentCounts() {
    const { user, loading } = useAuth()

    return useQuery({
        queryKey: queryKeys.videoSegmentCounts(user?.id),
        queryFn: async () => {
            const { data, error } = await supabase
                .from('segments')
                .select('video_upload_id')
                .eq('user_id', user!.id)
            if (error) throw error
            return countSegmentsByVideoUpload((data ?? []) as { video_upload_id: string }[])
        },
        enabled: !loading && !!user?.id,
    })
}