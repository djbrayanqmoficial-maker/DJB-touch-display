/**
 * DJB Core — Audio Engine Base Architecture
 * Defines audio device routing, Master/Headphones output split, and buffer latency configuration.
 * Advanced DSP / Stems / Dual-Deck low-latency Oboe/AAudio rendering plugs into this contract.
 */

export interface AudioDeviceOption {
  id: string;
  name: string;
  driver: 'ANDROID_AAUDIO' | 'ANDROID_OPENSL_ES' | 'USB_AUDIO_CLASS_2';
  channels: number;
  sampleRateHz: 44100 | 48000 | 96000;
}

export interface AudioEngineConfig {
  selectedDeviceId: string;
  masterRouting: 'STEREO_CH_1_2' | 'MONO_SPLIT_LEFT';
  headphonesRouting: 'STEREO_CH_3_4' | 'MONO_SPLIT_RIGHT' | 'INTERNAL_DAC';
  bufferSizeFrames: 64 | 128 | 256 | 512;
  latencyMs: number;
  sampleRateHz: 44100 | 48000 | 96000;
  masterLimiterEnabled: boolean;
}

export const AVAILABLE_AUDIO_DEVICES: AudioDeviceOption[] = [
  {
    id: 'aaudio-internal',
    name: 'Android AAudio Low-Latency Output (Internal DAC)',
    driver: 'ANDROID_AAUDIO',
    channels: 2,
    sampleRateHz: 48000,
  },
  {
    id: 'usb-dj2go-audio',
    name: 'USB Audio Class 2.0 Interface (4-Ch Master + Cue)',
    driver: 'USB_AUDIO_CLASS_2',
    channels: 4,
    sampleRateHz: 48000,
  },
  {
    id: 'opensles-fallback',
    name: 'OpenSL ES Compatibility Output',
    driver: 'ANDROID_OPENSL_ES',
    channels: 2,
    sampleRateHz: 44100,
  },
];

export const INITIAL_AUDIO_CONFIG: AudioEngineConfig = {
  selectedDeviceId: 'aaudio-internal',
  masterRouting: 'STEREO_CH_1_2',
  headphonesRouting: 'STEREO_CH_3_4',
  bufferSizeFrames: 128,
  latencyMs: 5.3,
  sampleRateHz: 48000,
  masterLimiterEnabled: true,
};
