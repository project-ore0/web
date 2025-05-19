import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { BaseWS } from './base-websocket';
import { wsBus, WS_EVENTS } from '../utils/event-bus';
import { MSG_ID } from '../utils/message-protocol';

/**
 * WebSocket gateway for control connections (ORE0 device)
 * Handles the /wsc endpoint
 */
export class ControlWS extends BaseWS {
  constructor() {
    super(wsBus);
  }

  onConnection(ws: WebSocket, req: IncomingMessage): void {
    // Get client IP address from various possible headers or socket
    const ip = 
      req.headers['x-forwarded-for'] || 
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      'unknown';
    
    console.log('ORE0 connected:', ip);
  }

  onDisconnect(ws: WebSocket): void {
    console.log('ORE0 disconnected');
  }

  onMessage(message: Buffer, isBinary: boolean): void {
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
            motor1: payload[0],
            motor2: payload[1],
            battery: payload[2],
            distance: payload[3],
          };
          console.log('Telemetry:', telemetry);
          this.eventBus.emit(WS_EVENTS.TELEMETRY, telemetry);
          break;

        case MSG_ID.CAMERA_CHUNK:
          // Forward the complete message to clients without validation
          // This includes the message type byte and all headers
          this.eventBus.emit(WS_EVENTS.IMAGE, message);
          break;

        case MSG_ID.MOTOR_CONTROL:
          // struct: uint8 m1, uint8 m2
          if (payload.length !== 2) {
            console.error('Motor control payload length invalid');
            return;
          }
          const mctrl = {
            motor1: payload[0],
            motor2: payload[1],
          };
          console.log('Motor control:', mctrl);
          this.eventBus.emit(WS_EVENTS.MOTOR_CONTROL, mctrl);
          break;

        case MSG_ID.BATTERY_LEVEL:
          // struct: uint8 level
          if (payload.length !== 1) {
            console.error('Battery level payload length invalid, got', payload.length);
            return;
          }
          const battery = payload[0];
          console.log('Battery level:', battery);
          this.eventBus.emit(WS_EVENTS.BATTERY_LEVEL, { battery });
          break;

        case MSG_ID.DISTANCE_READING:
          // struct: uint8 distance
          if (payload.length !== 1) {
            console.error('Distance reading payload length invalid, got', payload.length);
            return;
          }
          const distance = payload[0];
          console.log('Distance reading:', distance);
          this.eventBus.emit(WS_EVENTS.DISTANCE_READING, { distance });
          break;

        default:
          console.error('WS unknown binary msg_id:', msg_id, 'length:', length, 'payload.length:', payload.length);
      }
    } else {
      console.log(`WS text: ${message.toString()}`);
    }
  }
}

// Create a singleton instance
export const controlWS = new ControlWS();
