package com.djbrayan.djbtouchdisplaynative.model

enum class MidiCommandType {
    NOTE_ON,
    NOTE_OFF,
    CONTROL_CHANGE,
    PITCH_BEND,
    UNKNOWN
}

data class MidiPacket(
    val status: Int,
    val data1: Int,
    val data2: Int,
    val channel: Int,
    val timestampMs: Long = System.currentTimeMillis()
)

data class MidiMappingEntry(
    val id: String,
    val command: MidiCommandType,
    val channel: Int,
    val controlNumber: Int,
    val actionId: String,
    val deck: String? = null
)

// Numark DJ2GO Hardware Constants strictly matching src/core/midi/MidiMapping.ts
object NumarkDj2GoHardwareMapping {
    // Deck A
    const val NOTE_DECK_A_CUE = 51
    const val NOTE_DECK_A_PLAY = 59
    const val NOTE_DECK_A_SYNC = 64
    const val NOTE_DECK_A_PFL = 49
    const val CC_DECK_A_PITCH = 13
    const val CC_DECK_A_JOG = 25
    const val CC_DECK_A_VOLUME = 8

    // Deck B
    const val NOTE_DECK_B_CUE = 60
    const val NOTE_DECK_B_PLAY = 66
    const val NOTE_DECK_B_SYNC = 71
    const val NOTE_DECK_B_PFL = 50
    const val CC_DECK_B_PITCH = 14
    const val CC_DECK_B_JOG = 24
    const val CC_DECK_B_VOLUME = 9

    // Mixer & Master
    const val CC_CROSSFADER = 10
    const val CC_MASTER_VOLUME = 23
    const val CC_BROWSER_SCROLL = 26
    const val NOTE_BROWSER_LOAD_A = 48
    const val NOTE_BROWSER_LOAD_B = 52
    const val NOTE_BROWSER_BACK = 44
    const val NOTE_BROWSER_ENTER = 45
}
