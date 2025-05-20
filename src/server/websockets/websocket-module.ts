import { clientWS } from './client-gateway';
import { controlWS } from './control-gateway';
import { wsBus, WS_EVENTS, DeviceInfo } from '../utils/event-bus';
import { throttle } from '../utils/message-protocol';

// Store connected devices
const connectedDevices: Map<string, DeviceInfo> = new Map();

/**
 * WebSocket module that sets up event listeners between
 * the client and control WebSocket gateways
 */
export function setupWebSocketModule() {
  // Device registration and management
  wsBus.on(WS_EVENTS.REGISTER_DEVICE, (deviceInfo: DeviceInfo) => {
    connectedDevices.set(deviceInfo.id, deviceInfo);
    console.log(`Device registered: ${deviceInfo.name} (${deviceInfo.id})`);
  });

  wsBus.on(WS_EVENTS.UNREGISTER_DEVICE, ({ deviceId }) => {
    connectedDevices.delete(deviceId);
    console.log(`Device unregistered: ${deviceId}`);
  });

  wsBus.on(WS_EVENTS.ASSUME_DEVICE, ({ deviceId, clientId }) => {
    console.log(`Client ${clientId} is assuming control of device ${deviceId}`);
  });

  wsBus.on(WS_EVENTS.DEVICE_ASSUMED, ({ deviceId, clientId, deviceInfo }) => {
    if (connectedDevices.has(deviceId)) {
      connectedDevices.set(deviceId, deviceInfo);
    }
    console.log(`Device ${deviceId} assumed by client ${clientId}`);
  });

  wsBus.on(WS_EVENTS.LEAVE_DEVICE, ({ deviceId, clientId }) => {
    console.log(`Client ${clientId} is leaving device ${deviceId}`);
  });

  wsBus.on(WS_EVENTS.DEVICE_LEFT, ({ deviceId, deviceInfo }) => {
    if (connectedDevices.has(deviceId)) {
      connectedDevices.set(deviceId, deviceInfo);
    }
    console.log(`Device ${deviceId} control released`);
  });

  // Camera control
  wsBus.on(WS_EVENTS.CAMERA_CONTROL_REQUEST, ({ deviceId, on }) => {
    console.log(`Camera control request for device ${deviceId}: ${on ? 'ON' : 'OFF'}`);
  });

  // Telemetry and control
  wsBus.on(WS_EVENTS.TELEMETRY, (telemetry) => {
    // Telemetry is now handled by the client gateway directly
    console.log(`Telemetry received from device ${telemetry.deviceId}`);
  });

  wsBus.on(WS_EVENTS.MOTOR_CONTROL, (mctrl) => {
    // Motor control state is now handled by the client gateway directly
    console.log(`Motor control state from device ${mctrl.deviceId}: M1=${mctrl.motor1}, M2=${mctrl.motor2}`);
  });

  wsBus.on(WS_EVENTS.CLIENT_COMMAND, ({ deviceId, command, clientId }) => {
    // Client commands are now handled by the control gateway directly
    console.log(`Control command from client ${clientId} to device ${deviceId}`);
  });

  wsBus.on(WS_EVENTS.IMAGE, ({ deviceId, image }) => {
    // Images are now handled by the client gateway directly
  });

  wsBus.on(WS_EVENTS.BATTERY_LEVEL, ({ deviceId, battery }) => {
    console.log(`Battery level from device ${deviceId}: ${battery}%`);
  });

  wsBus.on(WS_EVENTS.DISTANCE_READING, ({ deviceId, distance }) => {
    console.log(`Distance reading from device ${deviceId}: ${distance} cm`);
  });

  console.log('WebSocket module initialized');

  return {
    clientWS,
    controlWS
  };
}
