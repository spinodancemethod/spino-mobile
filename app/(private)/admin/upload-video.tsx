import React, { useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native'
import { Redirect } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import ThemedView from 'Components/ThemedView'
import ThemedText from 'Components/ThemedText'
import ThemedButton from 'Components/ThemedButton'
import { useTheme } from 'constants/useTheme'
import { useAuth } from 'lib/auth'
import { usePositions } from 'lib/hooks/usePositions'
import { useCreateVideo } from 'lib/hooks/useCreateVideo'
import { supabase } from 'lib/supabase'
import { showSnack } from 'lib/snackbarService'

const ADMIN_EMAIL = 'spino@spino.com'

type DanceType = 'salsa' | 'bachata'
type AccessTier = 'free' | 'paid'

type FileState = { uri: string; name: string; mimeType?: string } | null

async function checkDuplicate(bucket: string, path: string): Promise<boolean> {
    const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : ''
    const filename = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path
    const { data } = await supabase.storage.from(bucket).list(folder, { search: filename })
    return (data ?? []).some((f) => f.name === filename)
}

async function uploadFile(
    bucket: string,
    path: string,
    uri: string,
    mimeType: string,
): Promise<void> {
    const response = await fetch(uri)
    const blob = await response.blob()
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: mimeType })
    if (error) throw new Error(`Upload to ${bucket} failed: ${error.message}`)
}

function getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
}

export default function UploadVideoScreen() {
    const { user } = useAuth()
    const { colors } = useTheme()
    const { data: positions = [] } = usePositions(undefined)
    const createVideo = useCreateVideo()

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [positionId, setPositionId] = useState('')
    const [danceType, setDanceType] = useState<DanceType>('bachata')
    const [danceStyle, setDanceStyle] = useState('')
    const [level, setLevel] = useState('')
    const [accessTier, setAccessTier] = useState<AccessTier>('paid')
    const [isPosition, setIsPosition] = useState(false)

    const [videoFile, setVideoFile] = useState<FileState>(null)
    const [thumbnailFile, setThumbnailFile] = useState<FileState>(null)
    const [gifFile, setGifFile] = useState<FileState>(null)

    const [uploading, setUploading] = useState(false)

    if (user?.email !== ADMIN_EMAIL) {
        return <Redirect href="/home" />
    }

    async function pickVideo() {
        const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true })
        if (result.canceled) return
        const asset = result.assets[0]
        setVideoFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'video/mp4' })
    }

    async function pickImage(setter: (f: FileState) => void) {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
        })
        if (result.canceled) return
        const asset = result.assets[0]
        const name = asset.uri.split('/').pop() ?? 'image.jpg'
        setter({ uri: asset.uri, name, mimeType: asset.mimeType ?? 'image/jpeg' })
    }

    async function pickGif(setter: (f: FileState) => void) {
        const result = await DocumentPicker.getDocumentAsync({ type: 'image/gif', copyToCacheDirectory: true })
        if (result.canceled) return
        const asset = result.assets[0]
        setter({ uri: asset.uri, name: asset.name, mimeType: 'image/gif' })
    }

    async function handleSubmit() {
        if (!title.trim()) { showSnack('Title is required'); return }
        if (!positionId) { showSnack('Please select a position'); return }
        if (!videoFile) { showSnack('Please select a video file'); return }
        if (!user?.id) return

        const videoPath = `${danceType}/${videoFile.name}`
        const thumbnailPath = thumbnailFile ? `${danceType}/${thumbnailFile.name}` : null
        const gifPath = gifFile ? `${danceType}/${gifFile.name}` : null

        setUploading(true)
        try {
            // Duplicate checks
            if (await checkDuplicate('videos', videoPath)) {
                showSnack(`A file named "${videoFile.name}" already exists in the videos bucket.`)
                return
            }
            if (thumbnailPath && await checkDuplicate('thumbnails', thumbnailPath)) {
                showSnack(`A file named "${thumbnailFile!.name}" already exists in the thumbnails bucket.`)
                return
            }
            if (gifPath && await checkDuplicate('roadmap-previews', gifPath)) {
                showSnack(`A file named "${gifFile!.name}" already exists in the roadmap-previews bucket.`)
                return
            }

            // Uploads
            await uploadFile('videos', videoPath, videoFile.uri, videoFile.mimeType ?? 'video/mp4')

            let thumbnailUrl: string | null = null
            if (thumbnailFile && thumbnailPath) {
                await uploadFile('thumbnails', thumbnailPath, thumbnailFile.uri, thumbnailFile.mimeType ?? 'image/jpeg')
                thumbnailUrl = getPublicUrl('thumbnails', thumbnailPath)
            }

            let roadmapUrl: string | null = null
            if (gifFile && gifPath) {
                await uploadFile('roadmap-previews', gifPath, gifFile.uri, 'image/gif')
                roadmapUrl = getPublicUrl('roadmap-previews', gifPath)
            }

            await createVideo.mutateAsync({
                title: title.trim(),
                description: description.trim() || null,
                position_id: positionId,
                user_id: user.id,
                dance_type: danceType,
                dance_style: danceStyle.trim() || null,
                level: level ? parseInt(level, 10) : null,
                access_tier: accessTier,
                is_position: isPosition,
                file_path: videoPath,
                thumbnail_url: thumbnailUrl,
                roadmap_preview_url: roadmapUrl,
                roadmap_gif_url: roadmapUrl,
            })

            showSnack('Video uploaded successfully!')
            // Reset form
            setTitle('')
            setDescription('')
            setPositionId('')
            setDanceStyle('')
            setLevel('')
            setIsPosition(false)
            setVideoFile(null)
            setThumbnailFile(null)
            setGifFile(null)
        } catch (err: any) {
            Alert.alert('Upload failed', err?.message ?? 'An unexpected error occurred.')
        } finally {
            setUploading(false)
        }
    }

    const inputStyle = [styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]

    return (
        <ThemedView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
                <ThemedText variant="title" style={styles.heading}>Upload Video</ThemedText>

                <ThemedText variant="small" style={styles.label}>Title *</ThemedText>
                <TextInput
                    style={inputStyle}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Lesson 1 — Basic Step"
                    placeholderTextColor={colors.border}
                />

                <ThemedText variant="small" style={styles.label}>Description</ThemedText>
                <TextInput
                    style={[inputStyle, styles.multiline]}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    placeholder="Short description of this video"
                    placeholderTextColor={colors.border}
                />

                <ThemedText variant="small" style={styles.label}>Position *</ThemedText>
                <View style={[styles.pickerRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                    {positions.length === 0 ? (
                        <ThemedText variant="small">Loading positions…</ThemedText>
                    ) : (
                        positions.map((p: any) => (
                            <TouchableOpacity
                                key={p.id}
                                onPress={() => setPositionId(p.id)}
                                style={[styles.chip, { borderColor: positionId === p.id ? colors.primary : colors.border, backgroundColor: positionId === p.id ? colors.primary : 'transparent' }]}
                            >
                                <ThemedText style={{ color: positionId === p.id ? colors.onPrimary : colors.text, fontSize: 12 }}>
                                    {p.name}
                                </ThemedText>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                <ThemedText variant="small" style={styles.label}>Dance Type</ThemedText>
                <View style={styles.toggleRow}>
                    {(['bachata', 'salsa'] as DanceType[]).map((dt) => (
                        <TouchableOpacity
                            key={dt}
                            onPress={() => setDanceType(dt)}
                            style={[styles.toggleBtn, { borderColor: danceType === dt ? colors.primary : colors.border, backgroundColor: danceType === dt ? colors.primary : 'transparent' }]}
                        >
                            <ThemedText style={{ color: danceType === dt ? colors.onPrimary : colors.text }}>
                                {dt.charAt(0).toUpperCase() + dt.slice(1)}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>

                <ThemedText variant="small" style={styles.label}>Dance Style</ThemedText>
                <TextInput
                    style={inputStyle}
                    value={danceStyle}
                    onChangeText={setDanceStyle}
                    placeholder="e.g. fusion, sensual"
                    placeholderTextColor={colors.border}
                />

                <ThemedText variant="small" style={styles.label}>Level (1–5)</ThemedText>
                <TextInput
                    style={inputStyle}
                    value={level}
                    onChangeText={(v) => setLevel(v.replace(/[^1-5]/g, ''))}
                    keyboardType="numeric"
                    maxLength={1}
                    placeholder="1"
                    placeholderTextColor={colors.border}
                />

                <ThemedText variant="small" style={styles.label}>Access Tier</ThemedText>
                <View style={styles.toggleRow}>
                    {(['paid', 'free'] as AccessTier[]).map((t) => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setAccessTier(t)}
                            style={[styles.toggleBtn, { borderColor: accessTier === t ? colors.primary : colors.border, backgroundColor: accessTier === t ? colors.primary : 'transparent' }]}
                        >
                            <ThemedText style={{ color: accessTier === t ? colors.onPrimary : colors.text }}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.switchRow}>
                    <ThemedText variant="small">Is Position Video</ThemedText>
                    <Switch value={isPosition} onValueChange={setIsPosition} />
                </View>

                <View style={[styles.divider, { borderColor: colors.border }]} />

                <ThemedText variant="subheader" style={styles.sectionHead}>Files</ThemedText>

                <ThemedText variant="small" style={styles.label}>Video File *</ThemedText>
                <ThemedButton
                    title={videoFile ? `✓ ${videoFile.name}` : 'Choose Video'}
                    variant="ghost"
                    onPress={pickVideo}
                    style={{ width: '100%', marginBottom: 8 }}
                />

                <ThemedText variant="small" style={styles.label}>Thumbnail Image</ThemedText>
                <ThemedButton
                    title={thumbnailFile ? `✓ ${thumbnailFile.name}` : 'Choose Thumbnail'}
                    variant="ghost"
                    onPress={() => pickImage(setThumbnailFile)}
                    style={{ width: '100%', marginBottom: 8 }}
                />

                <ThemedText variant="small" style={styles.label}>Roadmap GIF</ThemedText>
                <ThemedButton
                    title={gifFile ? `✓ ${gifFile.name}` : 'Choose GIF'}
                    variant="ghost"
                    onPress={() => pickGif(setGifFile)}
                    style={{ width: '100%', marginBottom: 24 }}
                />

                {uploading ? (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator />
                        <ThemedText style={{ marginLeft: 10 }}>Uploading…</ThemedText>
                    </View>
                ) : (
                    <ThemedButton
                        title="Upload Video"
                        onPress={handleSubmit}
                        style={{ width: '100%' }}
                    />
                )}
            </ScrollView>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 40,
    },
    heading: {
        fontWeight: '800',
        marginBottom: 20,
    },
    label: {
        marginBottom: 4,
        opacity: 0.7,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        marginBottom: 14,
    },
    multiline: {
        minHeight: 72,
        textAlignVertical: 'top',
    },
    pickerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 14,
    },
    chip: {
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
    },
    toggleBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    divider: {
        borderTopWidth: 1,
        marginVertical: 16,
    },
    sectionHead: {
        fontWeight: '700',
        marginBottom: 12,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
})
