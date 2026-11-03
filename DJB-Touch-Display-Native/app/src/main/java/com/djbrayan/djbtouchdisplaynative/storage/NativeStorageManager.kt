package com.djbrayan.djbtouchdisplaynative.storage

import android.content.ContentUris
import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import com.djbrayan.djbtouchdisplaynative.model.StoredTrackEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

data class StorageVolumeInfo(
    val id: String,
    val name: String,
    val count: Int
)

class NativeStorageManager(private val context: Context) {

    private val _tracks = MutableStateFlow<List<StoredTrackEntity>>(emptyList())
    val tracks: StateFlow<List<StoredTrackEntity>> = _tracks.asStateFlow()

    private val _volumes = MutableStateFlow<List<StorageVolumeInfo>>(
        listOf(
            StorageVolumeInfo("ALL", "All Device Music", 0),
            StorageVolumeInfo("INTERNAL", "Internal Storage", 0),
            StorageVolumeInfo("SDCARD", "SD Card", 0),
            StorageVolumeInfo("USB", "USB OTG Storage", 0)
        )
    )
    val volumes: StateFlow<List<StorageVolumeInfo>> = _volumes.asStateFlow()

    private val _selectedVolumeId = MutableStateFlow("ALL")
    val selectedVolumeId: StateFlow<String> = _selectedVolumeId.asStateFlow()

    fun selectVolume(volumeId: String) {
        _selectedVolumeId.value = volumeId
    }

    suspend fun queryDeviceAudio() = withContext(Dispatchers.IO) {
        val trackList = mutableListOf<StoredTrackEntity>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATA
        )

        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        val sortOrder = "${MediaStore.Audio.Media.TITLE} ASC"

        try {
            context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                selection,
                null,
                sortOrder
            )?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val durCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val dataCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)

                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idCol)
                    val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
                    val title = cursor.getString(titleCol) ?: "Unknown Title"
                    val artist = cursor.getString(artistCol) ?: "Unknown Artist"
                    val album = cursor.getString(albumCol) ?: ""
                    val durationMs = cursor.getLong(durCol)
                    val path = cursor.getString(dataCol) ?: ""

                    trackList.add(
                        StoredTrackEntity(
                            id = id.toString(),
                            uri = contentUri,
                            title = title,
                            artist = artist,
                            album = album,
                            durationSec = (durationMs / 1000.0).coerceAtLeast(0.0),
                            folderPath = path,
                            fileName = path.substringAfterLast('/')
                        )
                    )
                }
            }
        } catch (_: Exception) {}

        _tracks.value = trackList
        _volumes.value = _volumes.value.map { vol ->
            if (vol.id == "ALL") vol.copy(count = trackList.size) else vol
        }
    }

    suspend fun registerSingleDocumentUri(uri: Uri): StoredTrackEntity? = withContext(Dispatchers.IO) {
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, uri)
            val title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)
                ?: uri.lastPathSegment?.substringAfterLast('/')?.substringBeforeLast('.')
                ?: "Audio Track"
            val artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST) ?: "Unknown Artist"
            val album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM) ?: ""
            val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            val durationSec = (durationStr?.toDoubleOrNull() ?: 0.0) / 1000.0

            val track = StoredTrackEntity(
                id = uri.toString(),
                uri = uri,
                title = title,
                artist = artist,
                album = album,
                durationSec = durationSec,
                fileName = uri.lastPathSegment ?: "track"
            )

            val current = _tracks.value.toMutableList()
            if (!current.any { it.id == track.id }) {
                current.add(0, track)
                _tracks.value = current
            }
            track
        } catch (_: Exception) {
            null
        } finally {
            retriever.release()
        }
    }
}
