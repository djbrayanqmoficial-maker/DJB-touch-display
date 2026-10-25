/**
 * DJB Core — VirtualDJ Bridge Base Architecture
 * Modular contract prepared for future USB / ADB / TCP Socket connection to VirtualDJ on Windows.
 */

export interface VirtualDjBridgeConfig {
  transportMode: 'USB_ADB_FORWARD' | 'USB_RNDIS_TETHER' | 'WIFI_LOW_LATENCY';
  windowsBridgeHost: string;
  windowsBridgePort: number;
  autoReconnect: boolean;
  sendTouchFeedback: boolean;
  receiveWaveformStream: boolean;
  connectionState: 'STANDBY_BASE_READY' | 'AWAITING_BRIDGE_HOST';
}

export const INITIAL_VDJ_BRIDGE_CONFIG: VirtualDjBridgeConfig = {
  transportMode: 'USB_ADB_FORWARD',
  windowsBridgeHost: '127.0.0.1',
  windowsBridgePort: 9040,
  autoReconnect: true,
  sendTouchFeedback: true,
  receiveWaveformStream: true,
  connectionState: 'STANDBY_BASE_READY',
};
