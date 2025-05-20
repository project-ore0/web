import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { BaseWS } from './base-websocket';
import { wsBus, WS_EVENTS, DeviceInfo } from '../utils/event-bus';
import { makeCameraControl, makeMotorControl, MSG_ID, MSG_MOTOR_STATE } from '../utils/message-protocol';
import { controlWS } from './control-gateway';
import { randomUUID } from 'crypto';

/**
 * WebSocket gateway for client connections (browsers)
 * Handles the /ws endpoint
 */
export class ClientWS extends BaseWS {
  // Map to store client IDs and their controlled devices
  private clientDevices: Map<string, string> = new Map(); // clientId -> deviceId
  
  constructor() {
    super(wsBus);
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Listen for device registration
    this.eventBus.on(WS_EVENTS.REGISTER_DEVICE, (deviceInfo: DeviceInfo) => {
      // Broadcast to all clients that a new device is available
      this.broadcastDeviceList();
    });
    
    // Listen for device unregistration
    this.eventBus.on(WS_EVENTS.UNREGISTER_DEVICE, ({ deviceId }) => {
      // Check if any client was controlling this device
      for (const [clientId, controlledDeviceId] of this.clientDevices.entries()) {
        if (controlledDeviceId === deviceId) {
          this.clientDevices.delete(clientId);
          break;
        }
      }
      
      // Broadcast updated device list
      this.broadcastDeviceList();
    });
    
    // Listen for device assumed events
    this.eventBus.on(WS_EVENTS.DEVICE_ASSUMED, ({ deviceId, clientId, deviceInfo }) => {
      // Find the client WebSocket
      const clientWs = this.findClientById(clientId);
      if (clientWs) {
        // Send confirmation to the client
        const message = {
          type: 'device_assumed',
          deviceId,
          deviceInfo
        };
        clientWs.send(JSON.stringify(message));
      }
      
      // Broadcast updated device list to all clients
      this.broadcastDeviceList();
    });
    
    // Listen for device left events
    this.eventBus.on(WS_EVENTS.DEVICE_LEFT, ({ deviceId, deviceInfo }) => {
      // Broadcast updated device list
      this.broadcastDeviceList();
    });
    
    // Listen for telemetry updates
    this.eventBus.on(WS_EVENTS.TELEMETRY, (telemetry) => {
      const { deviceId, ...telemetryData } = telemetry;
      
      // Find which client is controlling this device
      for (const [clientId, controlledDeviceId] of this.clientDevices.entries()) {
        if (controlledDeviceId === deviceId) {
          const clientWs = this.findClientById(clientId);
          if (clientWs) {
            // Send telemetry to the controlling client
            const message = {
              type: 'telemetry',
              deviceId,
              data: telemetryData
            };
            clientWs.send(JSON.stringify(message));
          }
          break;
        }
      }
    });
    
    // Listen for camera images
    this.eventBus.on(WS_EVENTS.IMAGE, ({ deviceId, image }) => {
      // Find which client is controlling this device
      for (const [clientId, controlledDeviceId] of this.clientDevices.entries()) {
        if (controlledDeviceId === deviceId) {
          const clientWs = this.findClientById(clientId);
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            // Forward the image to the controlling client
            clientWs.send(image, { binary: true });
          }
          break;
        }
      }
    });
  }
  
  private findClientById(clientId: string): WebSocket | undefined {
    for (const client of this.clients) {
      if ((client as any).clientId === clientId) {
        return client;
      }
    }
    return undefined;
  }
  
  private broadcastDeviceList(): void {
    const devices = controlWS.getDevices();
    const message = {
      type: 'device_list',
      devices
    };
    
    const messageStr = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  onConnection(ws: WebSocket, req: IncomingMessage): void {
    super.onConnection(ws, req);
    
    // Generate a unique client ID
    const clientId = randomUUID();
    (ws as any).clientId = clientId;
    
    console.log(`Client connected with ID: ${clientId}`);
    
    // Send the current device list to the new client
    this.broadcastDeviceList();
  }

  onDisconnect(ws: WebSocket): void {
    const clientId = (ws as any).clientId;
    
    if (clientId) {
      // Check if this client was controlling a device
      const deviceId = this.clientDevices.get(clientId);
      if (deviceId) {
        // Release the device
        this.eventBus.emit(WS_EVENTS.LEAVE_DEVICE, { deviceId, clientId });
        this.clientDevices.delete(clientId);
      }
      
      console.log(`Client disconnected: ${clientId}`);
    }
    
    super.onDisconnect(ws);
  }

  onMessage(message: Buffer, isBinary: boolean, ws?: WebSocket): void {
    if (!ws) return;
    
    const clientId = (ws as any).clientId;
    if (!clientId) {
      console.error('Message received from unidentified client');
      return;
    }
    
    if (isBinary) {
      // Handle binary messages (motor control commands)
      if (message.length >= 3) {
        const msg_id = message[0];
        if (msg_id === MSG_ID.MOTOR_CONTROL || msg_id === MSG_ID.MOVE_CONTROL) {
          const deviceId = this.clientDevices.get(clientId);
          if (deviceId) {
            // Forward the command to the device
            this.eventBus.emit(WS_EVENTS.CLIENT_COMMAND, { 
              deviceId, 
              command: message,
              clientId
            });
          }
          return;
        }
      }
    } else {
      // Handle JSON messages
      try {
        const jsonMessage = JSON.parse(message.toString());
        
        switch (jsonMessage.type) {
          case 'list_devices':
            // Send the current device list
            this.broadcastDeviceList();
            break;
            
          case 'assume_device':
            if (jsonMessage.deviceId) {
              // Check if device is already assumed
              const deviceInfo = controlWS.getDevice(jsonMessage.deviceId);
              if (deviceInfo && !deviceInfo.isAssumed) {
                // Store the association
                this.clientDevices.set(clientId, jsonMessage.deviceId);
                
                // Request device assumption
                this.eventBus.emit(WS_EVENTS.ASSUME_DEVICE, {
                  deviceId: jsonMessage.deviceId,
                  clientId
                });
              } else {
                // Send error message
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Device is already being controlled by another user'
                }));
              }
            }
            break;
            
          case 'leave_device':
            const deviceId = this.clientDevices.get(clientId);
            if (deviceId) {
              // Request device release
              this.eventBus.emit(WS_EVENTS.LEAVE_DEVICE, {
                deviceId,
                clientId
              });
              
              // Remove the association
              this.clientDevices.delete(clientId);
            }
            break;
            
          case 'control':
            const controlledDeviceId = this.clientDevices.get(clientId);
            if (controlledDeviceId && jsonMessage.action) {
              // Convert control action to motor commands
              let motor1 = MSG_MOTOR_STATE.IDLE;
              let motor2 = MSG_MOTOR_STATE.IDLE;
              
              switch (jsonMessage.action) {
                case 'q': // M1 FWD
                  motor1 = MSG_MOTOR_STATE.FORWARD;
                  break;
                case 'w': // M1+2 FWD
                  motor1 = MSG_MOTOR_STATE.FORWARD;
                  motor2 = MSG_MOTOR_STATE.FORWARD;
                  break;
                case 'e': // M2 FWD
                  motor2 = MSG_MOTOR_STATE.FORWARD;
                  break;
                case 'a': // M1 BCK
                  motor1 = MSG_MOTOR_STATE.BACKWARD;
                  break;
                case 's': // M1+2 BCK
                  motor1 = MSG_MOTOR_STATE.BACKWARD;
                  motor2 = MSG_MOTOR_STATE.BACKWARD;
                  break;
                case 'd': // M2 BCK
                  motor2 = MSG_MOTOR_STATE.BACKWARD;
                  break;
                case 'space': // M1+2 BRAKE
                  motor1 = MSG_MOTOR_STATE.BRAKE;
                  motor2 = MSG_MOTOR_STATE.BRAKE;
                  break;
                case 'release': // Release keys
                  motor1 = MSG_MOTOR_STATE.IDLE;
                  motor2 = MSG_MOTOR_STATE.IDLE;
                  break;
              }
              
              // Create motor control command
              const motorCommand = makeMotorControl(motor1, motor2);
              
              // Forward the command
              this.eventBus.emit(WS_EVENTS.CLIENT_COMMAND, {
                deviceId: controlledDeviceId,
                command: motorCommand,
                clientId
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing client message:', error);
      }
    }
    
    super.onMessage(message, isBinary, ws);
  }
}

// Create a singleton instance
export const clientWS = new ClientWS();
