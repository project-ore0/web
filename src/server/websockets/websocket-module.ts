import { clientWS } from './client-gateway';
import { controlWS } from './control-gateway';
import { wsBus, WS_EVENTS } from '../utils/event-bus';
import { throttle } from '../utils/message-protocol';

/**
 * WebSocket module that sets up event listeners between
 * the client and control WebSocket gateways
 */
export function setupWebSocketModule() {
  // Event bus logic for camera control and telemetry forwarding
  wsBus.on(WS_EVENTS.CAMERA_CONTROL_REQUEST, (buf: Buffer) => {
    controlWS.broadcast(buf);
  });

  wsBus.on(WS_EVENTS.TELEMETRY, (telemetry) => {
    // Construct telemetry message: id=2, len=4, payload
    const buf = Buffer.from([
      2, 4, 0,
      telemetry.motor1,
      telemetry.motor2,
      telemetry.battery,
      telemetry.distance
    ]);
    clientWS.broadcast(buf);
  });

  wsBus.on(WS_EVENTS.MOTOR_CONTROL, (mctrl) => {
    // Forward motor control state to ws clients if needed (optional)
    console.log('Motor control state forwarded:', mctrl);
  });

  wsBus.on(WS_EVENTS.CLIENT_COMMAND, (buf: Buffer) => {
    // Forward client move/motor control commands to ORE0
    controlWS.broadcast(buf);
  });

  wsBus.on(WS_EVENTS.IMAGE, (image: Buffer) => {
    const msg_id = image[0];
    const length = image[1] | (image[2] << 8);
    const payload = image.subarray(3);

    if (payload.length >= 2) {
      if (payload.length !== length) {
        console.warn(`Payload length mismatch during forwarding: expected ${length}, got ${payload.length}`);
      } else {
        clientWS.broadcast(image);
      }
    } else {
      console.warn('Malformed frame received, length:', image.length);
    }
  });

  wsBus.on(WS_EVENTS.BATTERY_LEVEL, ({ battery }) => {
    console.log('Battery level forwarded:', battery);
  });

  wsBus.on(WS_EVENTS.DISTANCE_READING, ({ distance }) => {
    console.log('Distance reading forwarded:', distance);
  });

  console.log('WebSocket module initialized');

  return {
    clientWS,
    controlWS
  };
}
