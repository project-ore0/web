import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { BaseWS } from './base-websocket';
import { wsBus, WS_EVENTS } from '../utils/event-bus';
import { makeCameraControl } from '../utils/message-protocol';

/**
 * WebSocket gateway for client connections (browsers)
 * Handles the /ws endpoint
 */
export class ClientWS extends BaseWS {
  constructor() {
    super(wsBus);
  }

  onConnection(ws: WebSocket, req: IncomingMessage): void {
    super.onConnection(ws, req);
    
    // Emit client count event
    this.eventBus.emit(WS_EVENTS.CLIENT_COUNT, this.clients.size);
    
    // Notify ORE0 to turn camera on if this is the first client
    if (this.clients.size === 1) {
      // MSG_CAMERA_CONTROL: id=3, len=1, payload=1 (on)
      const buf = makeCameraControl(true);
      this.eventBus.emit(WS_EVENTS.CAMERA_CONTROL_REQUEST, buf);
    }
  }

  onDisconnect(ws: WebSocket): void {
    // Emit client count event
    this.eventBus.emit(WS_EVENTS.CLIENT_COUNT, this.clients.size);
    
    super.onDisconnect(ws);
    
    // Notify ORE0 to turn camera off if this was the last client
    if (this.clients.size === 0) {
      // MSG_CAMERA_CONTROL: id=3, len=1, payload=0 (off)
      const buf = makeCameraControl(false);
      this.eventBus.emit(WS_EVENTS.CAMERA_CONTROL_REQUEST, buf);
    }
  }

  onMessage(message: Buffer, isBinary: boolean): void {
    // Forward move/motor control commands to ORE0 (wsc)
    if (isBinary && message.length >= 3) {
      const msg_id = message[0];
      if (msg_id === 5 || msg_id === 6) { // MSG_MOTOR_CONTROL or MSG_MOVE_CONTROL
        this.eventBus.emit(WS_EVENTS.CLIENT_COMMAND, message);
        return;
      }
    }
    
    super.onMessage(message, isBinary);
  }
}

// Create a singleton instance
export const clientWS = new ClientWS();
