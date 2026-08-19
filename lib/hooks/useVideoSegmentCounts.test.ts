import { describe, expect, it } from '@jest/globals'
import { countSegmentsByVideoUpload } from '../videoSegmentCounts'

describe('countSegmentsByVideoUpload', () => {
    it('counts segments independently for each permanent video upload ID', () => {
        expect(countSegmentsByVideoUpload([
            { video_upload_id: 'video-a' },
            { video_upload_id: 'video-b' },
            { video_upload_id: 'video-a' },
        ])).toEqual({
            'video-a': 2,
            'video-b': 1,
        })
    })
})