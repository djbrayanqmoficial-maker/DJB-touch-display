package com.djbrayan.djbtouchdisplaynative.midi

import android.content.Context
import android.media.midi.*
import android.os.Handler
import android.os.Looper
import com.djbrayan.djbtouchdisplaynative.model.MidiCommandType
import com.djbrayan.djbtouchdisplaynative.model.MidiPacket
import com.djbrayan.djbtouchdisplaynative.model.NumarkDj2GoHardwareMapping
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface MidiEventListener {
    fun onPlayPause(deckId: String)
    fun onCue(deckId: String)
    fun onSync(deckId: String)
    fun onPfl(deckId: String)
    fun onPitchChanged(deckId: String, value: Float)
    fun onJogWheel(deckId: String, delta: Float)
    fun onVolumeChanged(deckId: String, volume: Float)
    fun onCrossfaderChanged(position: Float)
    fun onMasterVolumeChanged(volume: Float)
    fun onBrowserScroll(delta: Int)
    fun onLoadTrack(deckId: String)
}

class NativeMidiEngine(private val context: Context) {

    private val midiManager: MidiManager? = context.getSystemService(Context.MIDI_SERVICE) as? MidiManager
    private var openDevice: MidiDevice? = null
    private var inputPort: MidiInputPort? = null
    private var outputPort: MidiOutputPort? = null

    private val _connectedDeviceName = MutableStateFlow<String?>("Numark DJ2GO (Emulated/Ready)")
    val connectedDeviceName: StateFlow<String?> = _connectedDeviceName.asStateFlow()

    private val _lastPacket = MutableStateFlow<MidiPacket?>(null)
    val lastPacket: StateFlow<MidiPacket?> = _lastPacket.asStateFlow()

    var listener: MidiEventListener? = null

    fun initialize() {
        val manager = midiManager ?: return
        val devices = manager.devices
        if (devices.isNotEmpty()) {
            openMidiDevice(devices[0])
        }

        manager.registerDeviceCallback(object : MidiManager.DeviceCallback() {
            override fun onDeviceAdded(device: MidiDeviceInfo) {
                openMidiDevice(device)
            }

            override fun onDeviceRemoved(device: MidiDeviceInfo) {
                if (openDevice?.info?.id == device.id) {
                    closeDevice()
                }
            }
        }, Handler(Looper.getMainLooper()))
    }

    private fun openMidiDevice(deviceInfo: MidiDeviceInfo) {
        midiManager?.openDevice(deviceInfo, { device ->
            openDevice = device
            val name = deviceInfo.properties.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "USB MIDI Controller"
            _connectedDeviceName.value = name

            // Open output port to receive MIDI input from controller
            val portInfo = deviceInfo.ports.firstOrNull { it.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT }
            if (portInfo != null) {
                outputPort = device.openOutputPort(portInfo.portNumber)
                outputPort?.connect(object : MidiReceiver() {
                    override fun onSend(msg: ByteArray, offset: Int, count: Int, timestamp: Long) {
                        processRawMidi(msg, offset, count)
                    }
                })
            }

            // Open input port to send LED feedback to controller
            val inputPortInfo = deviceInfo.ports.firstOrNull { it.type == MidiDeviceInfo.PortInfo.TYPE_INPUT }
            if (inputPortInfo != null) {
                inputPort = device.openInputPort(inputPortInfo.portNumber)
            }
        }, Handler(Looper.getMainLooper()))
    }

    fun processRawMidi(bytes: ByteArray, offset: Int, count: Int) {
        if (count < 3) return
        val statusByte = bytes[offset].toInt() and 0xFF
        val data1 = bytes[offset + 1].toInt() and 0xFF
        val data2 = bytes[offset + 2].toInt() and 0xFF

        val commandType = when (statusByte and 0xF0) {
            0x90 -> if (data2 > 0) MidiCommandType.NOTE_ON else MidiCommandType.NOTE_OFF
            0x80 -> MidiCommandType.NOTE_OFF
            0xB0 -> MidiCommandType.CONTROL_CHANGE
            0xE0 -> MidiCommandType.PITCH_BEND
            else -> MidiCommandType.UNKNOWN
        }

        val channel = (statusByte and 0x0F) + 1
        val packet = MidiPacket(statusByte, data1, data2, channel)
        _lastPacket.value = packet

        dispatchMidiAction(commandType, data1, data2)
    }

    private fun dispatchMidiAction(command: MidiCommandType, d1: Int, d2: Int) {
        when (command) {
            MidiCommandType.NOTE_ON -> {
                when (d1) {
                    NumarkDj2GoHardwareMapping.NOTE_DECK_A_PLAY -> listener?.onPlayPause("A")
                    NumarkDj2GoHardwareMapping.NOTE_DECK_B_PLAY -> listener?.onPlayPause("B")
                    NumarkDj2GoHardwareMapping.NOTE_DECK_A_CUE -> listener?.onCue("A")
                    NumarkDj2GoHardwareMapping.NOTE_DECK_B_CUE -> listener?.onCue("B")
                    NumarkDj2GoHardwareMapping.NOTE_DECK_A_SYNC -> listener?.onSync("A")
                    NumarkDj2GoHardwareMapping.NOTE_DECK_B_SYNC -> listener?.onSync("B")
                    NumarkDj2GoHardwareMapping.NOTE_DECK_A_PFL -> listener?.onPfl("A")
                    NumarkDj2GoHardwareMapping.NOTE_DECK_B_PFL -> listener?.onPfl("B")
                    NumarkDj2GoHardwareMapping.NOTE_BROWSER_LOAD_A -> listener?.onLoadTrack("A")
                    NumarkDj2GoHardwareMapping.NOTE_BROWSER_LOAD_B -> listener?.onLoadTrack("B")
                }
            }
            MidiCommandType.CONTROL_CHANGE -> {
                when (d1) {
                    NumarkDj2GoHardwareMapping.CC_DECK_A_VOLUME -> {
                        val vol = d2 / 127.0f
                        listener?.onVolumeChanged("A", vol)
                    }
                    NumarkDj2GoHardwareMapping.CC_DECK_B_VOLUME -> {
                        val vol = d2 / 127.0f
                        listener?.onVolumeChanged("B", vol)
                    }
                    NumarkDj2GoHardwareMapping.CC_CROSSFADER -> {
                        val pos = ((d2 / 127.0f) * 2.0f) - 1.0f
                        listener?.onCrossfaderChanged(pos)
                    }
                    NumarkDj2GoHardwareMapping.CC_MASTER_VOLUME -> {
                        val master = d2 / 127.0f
                        listener?.onMasterVolumeChanged(master)
                    }
                    NumarkDj2GoHardwareMapping.CC_DECK_A_PITCH -> {
                        val pitch = ((d2 / 127.0f) * 16.0f) - 8.0f // -8% to +8%
                        listener?.onPitchChanged("A", pitch)
                    }
                    NumarkDj2GoHardwareMapping.CC_DECK_B_PITCH -> {
                        val pitch = ((d2 / 127.0f) * 16.0f) - 8.0f
                        listener?.onPitchChanged("B", pitch)
                    }
                    NumarkDj2GoHardwareMapping.CC_DECK_A_JOG -> {
                        val delta = if (d2 > 64) (d2 - 128).toFloat() else d2.toFloat()
                        listener?.onJogWheel("A", delta)
                    }
                    NumarkDj2GoHardwareMapping.CC_DECK_B_JOG -> {
                        val delta = if (d2 > 64) (d2 - 128).toFloat() else d2.toFloat()
                        listener?.onJogWheel("B", delta)
                    }
                    NumarkDj2GoHardwareMapping.CC_BROWSER_SCROLL -> {
                        val delta = if (d2 > 64) -1 else 1
                        listener?.onBrowserScroll(delta)
                    }
                }
            }
            else -> {}
        }
    }

    fun sendLedFeedback(note: Int, state: Boolean) {
        val port = inputPort ?: return
        val status = 0x90.toByte()
        val data1 = note.toByte()
        val data2 = (if (state) 0x7F else 0x00).toByte()
        val buffer = byteArrayOf(status, data1, data2)
        try {
            port.send(buffer, 0, 3)
        } catch (_: Exception) {}
    }

    fun closeDevice() {
        outputPort?.close()
        inputPort?.close()
        openDevice?.close()
        openDevice = null
        _connectedDeviceName.value = null
    }
}
