package com.djbrayan.djbtouchdisplay.core.midi

import android.content.Context
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiInputPort
import android.media.midi.MidiManager
import android.media.midi.MidiOutputPort
import android.media.midi.MidiReceiver
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class MidiCommandType {
    NOTE_ON,
    NOTE_OFF,
    CONTROL_CHANGE,
    PITCH_BEND,
    UNKNOWN
}

data class MidiMessagePacket(
    val status: Int,
    val command: MidiCommandType,
    val channel: Int,
    val data1: Int,
    val data2: Int,
    val timestampNanos: Long
)

data class MidiDeviceDescriptor(
    val id: Int,
    val name: String,
    val manufacturer: String,
    val product: String,
    val inputPortCount: Int,
    val outputPortCount: Int,
    val isConnected: Boolean
)

data class MidiMappingRule(
    val actionId: String,
    val command: MidiCommandType,
    val channel: Int,
    val data1: Int,
    val ledFeedbackSupported: Boolean = true,
    val ledOnVelocity: Int = 0x7F,
    val ledOffVelocity: Int = 0x00
)

data class ControllerProfile(
    val profileId: String,
    val name: String,
    val controllerModel: String,
    val mappings: List<MidiMappingRule>
)

interface MidiActionListener {
    fun onPlayPause(deckId: String)
    fun onCue(deckId: String)
    fun onSync(deckId: String)
    fun onPitchChanged(deckId: String, value: Float)
    fun onJogNudge(deckId: String, delta: Float)
    fun onCrossfaderChanged(value: Float)
    fun onMasterVolumeChanged(value: Float)
    fun onHeadphonesCueToggled(deckId: String)
    fun onVolumeChanged(deckId: String, value: Float) {}
    fun onPitchBendStep(deckId: String, stepDelta: Float) {}
    fun onLoadTrack(deckId: String) {}
}

/**
 * DJB Core — Android USB MIDI Engine (android.media.midi)
 * Created by DJ Brayan for DJB Touch Display.
 * Integrates hot-plug detection, Numark DJ2GO default hardware mapping,
 * MIDI Learn, bidirectional LED feedback, and real-time audio engine dispatch.
 */
class AndroidMidiEngine(context: Context) {

    private val midiManager: MidiManager? =
        context.getSystemService(Context.MIDI_SERVICE) as? MidiManager
    private val mainHandler = Handler(Looper.getMainLooper())

    private var activeDevice: MidiDevice? = null
    private var activeOutputPort: MidiOutputPort? = null // Receives MIDI FROM controller
    private var activeInputPort: MidiInputPort? = null   // Sends MIDI LED feedback TO controller

    var actionListener: MidiActionListener? = null

    private val _devices = MutableStateFlow<List<MidiDeviceDescriptor>>(emptyList())
    val devices: StateFlow<List<MidiDeviceDescriptor>> = _devices.asStateFlow()

    private val _lastPacket = MutableStateFlow<MidiMessagePacket?>(null)
    val lastPacket: StateFlow<MidiMessagePacket?> = _lastPacket.asStateFlow()

    private val _midiLearnTargetAction = MutableStateFlow<String?>(null)
    val midiLearnTargetAction: StateFlow<String?> = _midiLearnTargetAction.asStateFlow()

    // Default Numark DJ2GO mapping profile matching src/core/midi/MidiMapping.ts exactly
    private val numarkDj2GoProfile = ControllerProfile(
        profileId = "profile-numark-dj2go-vdj",
        name = "Numark DJ2GO (VirtualDJ Reference)",
        controllerModel = "Numark DJ2GO",
        mappings = listOf(
            // DECK A
            MidiMappingRule("deck-a:play", MidiCommandType.NOTE_ON, 1, 0x3b), // 59
            MidiMappingRule("deck-a:cue", MidiCommandType.NOTE_ON, 1, 0x33),  // 51
            MidiMappingRule("deck-a:pfl", MidiCommandType.NOTE_ON, 1, 0x65),  // 101
            MidiMappingRule("deck-a:sync", MidiCommandType.NOTE_ON, 1, 0x40), // 64
            MidiMappingRule("deck-a:load", MidiCommandType.NOTE_ON, 1, 0x4b), // 75
            MidiMappingRule("deck-a:jog", MidiCommandType.CONTROL_CHANGE, 1, 0x19), // 25
            MidiMappingRule("deck-a:pitch", MidiCommandType.CONTROL_CHANGE, 1, 0x0d), // 13
            MidiMappingRule("deck-a:vol", MidiCommandType.CONTROL_CHANGE, 1, 0x08), // 8
            MidiMappingRule("deck-a:vol-inc", MidiCommandType.NOTE_ON, 1, 0x43), // 67
            MidiMappingRule("deck-a:vol-dec", MidiCommandType.NOTE_ON, 1, 0x44), // 68

            // DECK B
            MidiMappingRule("deck-b:play", MidiCommandType.NOTE_ON, 1, 0x42), // 66
            MidiMappingRule("deck-b:cue", MidiCommandType.NOTE_ON, 1, 0x3c),  // 60
            MidiMappingRule("deck-b:pfl", MidiCommandType.NOTE_ON, 1, 0x66),  // 102
            MidiMappingRule("deck-b:sync", MidiCommandType.NOTE_ON, 1, 0x47), // 71
            MidiMappingRule("deck-b:load", MidiCommandType.NOTE_ON, 1, 0x34), // 52
            MidiMappingRule("deck-b:jog", MidiCommandType.CONTROL_CHANGE, 1, 0x18), // 24
            MidiMappingRule("deck-b:pitch", MidiCommandType.CONTROL_CHANGE, 1, 0x0e), // 14
            MidiMappingRule("deck-b:vol", MidiCommandType.CONTROL_CHANGE, 1, 0x09), // 9
            MidiMappingRule("deck-b:vol-inc", MidiCommandType.NOTE_ON, 1, 0x45), // 69
            MidiMappingRule("deck-b:vol-dec", MidiCommandType.NOTE_ON, 1, 0x46), // 70

            // MIXER & BROWSER
            MidiMappingRule("mixer:crossfader", MidiCommandType.CONTROL_CHANGE, 1, 0x0a), // 10
            MidiMappingRule("mixer:master-vol", MidiCommandType.CONTROL_CHANGE, 1, 0x17), // 23
            MidiMappingRule("mixer:headphone-vol", MidiCommandType.CONTROL_CHANGE, 1, 0x0b), // 11
            MidiMappingRule("browser:scroll", MidiCommandType.CONTROL_CHANGE, 1, 0x1a), // 26
            MidiMappingRule("browser:back", MidiCommandType.NOTE_ON, 1, 0x59), // 89
            MidiMappingRule("browser:enter", MidiCommandType.NOTE_ON, 1, 0x5a) // 90
        )
    )

    private val _activeProfile = MutableStateFlow(numarkDj2GoProfile)
    val activeProfile: StateFlow<ControllerProfile> = _activeProfile.asStateFlow()

    private val deviceCallback = object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
            refreshDevices()
            // Auto connect if it's the first device
            if (activeDevice == null) {
                connectDevice(device.id)
            }
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
            refreshDevices()
            if (activeDevice?.info?.id == device.id) {
                disconnectCurrentDevice()
            }
        }
    }

    init {
        midiManager?.registerDeviceCallback(deviceCallback, mainHandler)
        refreshDevices()
    }

    fun refreshDevices() {
        val infos = midiManager?.devices ?: emptyArray()
        _devices.value = infos.map { info ->
            val props = info.properties
            MidiDeviceDescriptor(
                id = info.id,
                name = props.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "USB MIDI Device #${info.id}",
                manufacturer = props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER) ?: "Generic USB",
                product = props.getString(MidiDeviceInfo.PROPERTY_PRODUCT) ?: "MIDI Controller",
                inputPortCount = info.inputPortCount,
                outputPortCount = info.outputPortCount,
                isConnected = activeDevice?.info?.id == info.id
            )
        }
    }

    fun connectDevice(deviceId: Int) {
        val targetInfo = midiManager?.devices?.firstOrNull { it.id == deviceId } ?: return
        disconnectCurrentDevice()

        midiManager.openDevice(targetInfo, { device ->
            if (device != null) {
                activeDevice = device
                // Open controller output port 0 to receive incoming MIDI packets
                if (targetInfo.outputPortCount > 0) {
                    activeOutputPort = device.openOutputPort(0)?.apply {
                        connect(midiInputReceiver)
                    }
                }
                // Open controller input port 0 to send LED feedback MIDI messages
                if (targetInfo.inputPortCount > 0) {
                    activeInputPort = device.openInputPort(0)
                }
                refreshDevices()
            }
        }, mainHandler)
    }

    fun disconnectCurrentDevice() {
        try {
            activeOutputPort?.close()
            activeInputPort?.close()
            activeDevice?.close()
        } catch (_: Exception) {
        } finally {
            activeOutputPort = null
            activeInputPort = null
            activeDevice = null
            refreshDevices()
        }
    }

    private val midiInputReceiver = object : MidiReceiver() {
        override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
            if (count < 3) return
            val status = msg[offset].toInt() and 0xFF
            val data1 = msg[offset + 1].toInt() and 0x7F
            val data2 = msg[offset + 2].toInt() and 0x7F

            val packet = parseMidiBytes(status, data1, data2, timestamp)
            _lastPacket.value = packet

            val learnAction = _midiLearnTargetAction.value
            if (learnAction != null && (packet.command == MidiCommandType.NOTE_ON || packet.command == MidiCommandType.CONTROL_CHANGE)) {
                assignMidiLearnMapping(learnAction, packet)
                _midiLearnTargetAction.value = null
                return
            }

            // Dispatch mapped actions to listener
            dispatchAction(packet)
        }
    }

    private fun dispatchAction(packet: MidiMessagePacket) {
        val mapping = _activeProfile.value.mappings.firstOrNull {
            it.command == packet.command && it.channel == packet.channel && it.data1 == packet.data1
        } ?: return

        when (mapping.actionId) {
            "deck-a:play" -> actionListener?.onPlayPause("deck-a")
            "deck-a:cue" -> actionListener?.onCue("deck-a")
            "deck-a:sync" -> actionListener?.onSync("deck-a")
            "deck-a:pfl" -> actionListener?.onHeadphonesCueToggled("deck-a")
            "deck-a:load" -> actionListener?.onLoadTrack("deck-a")
            "deck-a:pitch" -> {
                // CC value 0..127 mapped to -16% .. +16%
                val pct = ((packet.data2 - 64) / 64.0f) * 16.0f
                actionListener?.onPitchChanged("deck-a", pct)
            }
            "deck-a:jog" -> {
                val delta = if (packet.data2 > 64) (packet.data2 - 128).toFloat() else packet.data2.toFloat()
                actionListener?.onJogNudge("deck-a", delta * 0.05f)
            }
            "deck-a:vol" -> {
                actionListener?.onVolumeChanged("deck-a", packet.data2 / 127.0f)
            }
            "deck-a:vol-inc" -> actionListener?.onPitchBendStep("deck-a", 1.0f)
            "deck-a:vol-dec" -> actionListener?.onPitchBendStep("deck-a", -1.0f)

            "deck-b:play" -> actionListener?.onPlayPause("deck-b")
            "deck-b:cue" -> actionListener?.onCue("deck-b")
            "deck-b:sync" -> actionListener?.onSync("deck-b")
            "deck-b:pfl" -> actionListener?.onHeadphonesCueToggled("deck-b")
            "deck-b:load" -> actionListener?.onLoadTrack("deck-b")
            "deck-b:pitch" -> {
                val pct = ((packet.data2 - 64) / 64.0f) * 16.0f
                actionListener?.onPitchChanged("deck-b", pct)
            }
            "deck-b:jog" -> {
                val delta = if (packet.data2 > 64) (packet.data2 - 128).toFloat() else packet.data2.toFloat()
                actionListener?.onJogNudge("deck-b", delta * 0.05f)
            }
            "deck-b:vol" -> {
                actionListener?.onVolumeChanged("deck-b", packet.data2 / 127.0f)
            }
            "deck-b:vol-inc" -> actionListener?.onPitchBendStep("deck-b", 1.0f)
            "deck-b:vol-dec" -> actionListener?.onPitchBendStep("deck-b", -1.0f)

            "mixer:crossfader" -> {
                val xf = packet.data2 / 127.0f
                actionListener?.onCrossfaderChanged(xf)
            }
            "mixer:master-vol" -> {
                val vol = packet.data2 / 127.0f
                actionListener?.onMasterVolumeChanged(vol)
            }
            "mixer:headphone-vol" -> {
                actionListener?.onHeadphonesCueToggled("deck-a")
            }
            "browser:scroll" -> {
                val delta = if (packet.data2 > 64) -1f else 1f
                actionListener?.onJogNudge("deck-a", delta)
            }
            "browser:back", "browser:enter" -> {
                actionListener?.onLoadTrack("deck-a")
            }
        }
    }

    fun parseMidiBytes(status: Int, data1: Int, data2: Int, timestamp: Long): MidiMessagePacket {
        val highNibble = status and 0xF0
        val channel = (status and 0x0F) + 1
        val command = when (highNibble) {
            0x90 -> if (data2 == 0) MidiCommandType.NOTE_OFF else MidiCommandType.NOTE_ON
            0x80 -> MidiCommandType.NOTE_OFF
            0xB0 -> MidiCommandType.CONTROL_CHANGE
            0xE0 -> MidiCommandType.PITCH_BEND
            else -> MidiCommandType.UNKNOWN
        }
        return MidiMessagePacket(
            status = status,
            command = command,
            channel = channel,
            data1 = data1,
            data2 = data2,
            timestampNanos = timestamp
        )
    }

    fun startMidiLearn(actionId: String) {
        _midiLearnTargetAction.value = actionId
    }

    fun cancelMidiLearn() {
        _midiLearnTargetAction.value = null
    }

    private fun assignMidiLearnMapping(actionId: String, packet: MidiMessagePacket) {
        val current = _activeProfile.value
        val updatedMappings = current.mappings.filterNot { it.actionId == actionId } +
            MidiMappingRule(
                actionId = actionId,
                command = packet.command,
                channel = packet.channel,
                data1 = packet.data1,
                ledFeedbackSupported = packet.command == MidiCommandType.NOTE_ON
            )
        _activeProfile.value = current.copy(mappings = updatedMappings)
    }

    /**
     * Sends MIDI message to controller InputPort (e.g. for LED illumination feedback).
     */
    fun sendLedFeedback(channel: Int, noteOrCc: Int, isOn: Boolean, onVelocity: Int = 0x7F, offVelocity: Int = 0x00) {
        val port = activeInputPort ?: return
        val statusByte = (0x90 or ((channel - 1) and 0x0F)).toByte()
        val data1Byte = (noteOrCc and 0x7F).toByte()
        val data2Byte = (if (isOn) onVelocity else offVelocity).toByte()
        val buffer = byteArrayOf(statusByte, data1Byte, data2Byte)
        try {
            port.send(buffer, 0, buffer.size)
        } catch (_: Exception) {
        }
    }

    fun setDeckLed(deckId: String, isPlaying: Boolean, isCue: Boolean) {
        if (deckId == "deck-a") {
            sendLedFeedback(1, 59, isPlaying)
            sendLedFeedback(1, 51, isCue)
        } else {
            sendLedFeedback(1, 66, isPlaying)
            sendLedFeedback(1, 60, isCue)
        }
    }

    fun release() {
        midiManager?.unregisterDeviceCallback(deviceCallback)
        disconnectCurrentDevice()
    }
}
