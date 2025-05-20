import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { BaseWS } from './base-websocket';
import { wsBus, WS_EVENTS, DeviceInfo } from '../utils/event-bus';
import { MSG_ID, makeCameraControl } from '../utils/message-protocol';
import { randomUUID } from 'crypto';

/**
 * WebSocket gateway for control connections (ORE0 device)
 * Handles the /wsc endpoint
 */
export class ControlWS extends BaseWS {
  // Map to store connected devices with their WebSocket connections
  private devices: Map<string, { ws: WebSocket, info: DeviceInfo }> = new Map();

  constructor() {
    super(wsBus);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for device assumption requests
    this.eventBus.on(WS_EVENTS.ASSUME_DEVICE, ({ deviceId, clientId }) => {
      const device = this.devices.get(deviceId);
      if (device) {
        // Update device status
        device.info.isAssumed = true;
        device.info.assumedBy = clientId;
        
        // Turn on camera
        const cameraOnMsg = makeCameraControl(true);
        device.ws.send(cameraOnMsg);
        
        // Notify that device has been assumed
        this.eventBus.emit(WS_EVENTS.DEVICE_ASSUMED, { 
          deviceId, 
          clientId,
          deviceInfo: device.info 
        });
      }
    });

    // Listen for device leave requests
    this.eventBus.on(WS_EVENTS.LEAVE_DEVICE, ({ deviceId, clientId }) => {
      const device = this.devices.get(deviceId);
      if (device && device.info.assumedBy === clientId) {
        // Update device status
        device.info.isAssumed = false;
        device.info.assumedBy = undefined;
        
        // Turn off camera
        const cameraOffMsg = makeCameraControl(false);
        device.ws.send(cameraOffMsg);
        
        // Notify that device has been left
        this.eventBus.emit(WS_EVENTS.DEVICE_LEFT, { 
          deviceId,
          deviceInfo: device.info 
        });
      }
    });

    // Listen for control commands
    this.eventBus.on(WS_EVENTS.CLIENT_COMMAND, ({ deviceId, command }) => {
      const device = this.devices.get(deviceId);
      if (device && device.info.isAssumed) {
        device.ws.send(command);
      }
    });
  }

  onConnection(ws: WebSocket, req: IncomingMessage): void {
    // Get client IP address from various possible headers or socket
    const ip =
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      'unknown';

    // Generate a unique ID for this device
    const deviceId = randomUUID();
    
    // Create device info
    const deviceInfo: DeviceInfo = {
      id: deviceId,
      name: `ORE0-${deviceId.substring(0, 8)}`,
      isAssumed: false
    };
    
    // Store the device
    this.devices.set(deviceId, { ws, info: deviceInfo });
    
    // Associate the WebSocket with the device ID for later reference
    (ws as any).deviceId = deviceId;
    
    console.log(`ORE0 device connected: ${ip}, ID: ${deviceId}`);
    
    // Notify about new device
    this.eventBus.emit(WS_EVENTS.REGISTER_DEVICE, deviceInfo);
  }

  onDisconnect(ws: WebSocket): void {
    const deviceId = (ws as any).deviceId;
    
    if (deviceId) {
      // Remove from devices map
      this.devices.delete(deviceId);
      
      // Notify about device disconnection
      this.eventBus.emit(WS_EVENTS.UNREGISTER_DEVICE, { deviceId });
      
      console.log(`ORE0 device disconnected: ${deviceId}`);
    } else {
      console.log('Unknown ORE0 device disconnected');
    }
  }

  onMessage(message: Buffer, isBinary: boolean, ws?: WebSocket): void {
    if (!ws) return;
    
    const deviceId = (ws as any).deviceId;
    if (!deviceId) {
      console.error('Message received from unidentified device');
      return;
    }
    
    if (isBinary) {
      // Parse message according to message protocol
      if (message.length < 3) {
        console.error('WS binary too short for header');
        return;
      }

      const msg_id = message[0];
      const length = message[1] | (message[2] << 8);
      const payload = message.subarray(3);

      if (payload.length !== length) {
        console.error(`WS payload length mismatch: expected ${length}, got ${payload.length}`);
        return;
      }

      switch (msg_id) {
        case MSG_ID.TELEMETRY:
          // struct: uint8 m1, uint8 m2, uint8 battery, uint8 distance
          if (payload.length !== 4) {
            console.error('Telemetry payload length invalid');
            return;
          }
          const telemetry = {
            deviceId,
            motor1: payload[0],
            motor2: payload[1],
            battery: payload[2],
            distance: payload[3],
          };
          this.eventBus.emit(WS_EVENTS.TELEMETRY, telemetry);
          break;

        case MSG_ID.CAMERA_CHUNK:
          // Forward the complete message to clients without validation
          // This includes the message type byte and all headers
          this.eventBus.emit(WS_EVENTS.IMAGE, { deviceId, image: message });
          break;

        case MSG_ID.MOTOR_CONTROL:
          // struct: uint8 m1, uint8 m2
          if (payload.length !== 2) {
            console.error('Motor control payload length invalid');
            return;
          }
          const mctrl = {
            deviceId,
            motor1: payload[0],
            motor2: payload[1],
          };
          this.eventBus.emit(WS_EVENTS.MOTOR_CONTROL, mctrl);
          break;

        case MSG_ID.BATTERY_LEVEL:
          // struct: uint8 level
          if (payload.length !== 1) {
            console.error('Battery level payload length invalid, got', payload.length);
            return;
          }
          const battery = payload[0];
          this.eventBus.emit(WS_EVENTS.BATTERY_LEVEL, { deviceId, battery });
          break;

        case MSG_ID.DISTANCE_READING:
          // struct: uint8 distance
          if (payload.length !== 1) {
            console.error('Distance reading payload length invalid, got', payload.length);
            return;
          }
          const distance = payload[0];
          this.eventBus.emit(WS_EVENTS.DISTANCE_READING, { deviceId, distance });
          break;

        default:
          console.error('WS unknown binary msg_id:', msg_id, 'length:', length, 'payload.length:', payload.length);
      }
    } else {
      console.log(`WS text from device ${deviceId}: ${message.toString()}`);
    }
  }
  
  // Get a list of all connected devices
  getDevices(): DeviceInfo[] {
    return Array.from(this.devices.values()).map(device => device.info);
  }
  
  // Get a specific device by ID
  getDevice(deviceId: string): DeviceInfo | undefined {
    const device = this.devices.get(deviceId);
    return device ? device.info : undefined;
  }
}

// Create a singleton instance
export const controlWS = new ControlWS();
