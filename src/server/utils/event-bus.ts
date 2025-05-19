import { EventEmitter } from 'events';

/**
 * EventBus for communication between WebSocket gateways
 * This allows the client and control WebSocket servers to communicate with each other
 */
class WebSocketEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Increase max listeners to avoid warnings
  }
}

// Create a singleton instance
export const wsBus = new WebSocketEventBus();

// Event types for TypeScript
export interface TelemetryData {
  motor1: number;
  motor2: number;
  battery: number;
  distance: number;
}

export interface MotorControlData {
  motor1: number;
  motor2: number;
}

export interface CameraControlData {
  on: number;
}

export interface BatteryLevelData {
  battery: number;
}

export interface DistanceReadingData {
  distance: number;
}

// Define event names as constants to avoid typos
export const WS_EVENTS = {
  TELEMETRY: 'telemetry',
  MOTOR_CONTROL: 'motor_control',
  CAMERA_CONTROL_REQUEST: 'camera_control_request',
  CLIENT_COMMAND: 'client_command',
  IMAGE: 'image',
  CLIENT_COUNT: 'client_count',
  BATTERY_LEVEL: 'battery_level',
  DISTANCE_READING: 'distance_reading',
};
