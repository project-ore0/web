// Message protocol constants and helpers (from original messages.h)

export const MSG_ID = {
  UNKNOWN: 0,
  MOTOR_STATE: 1,
  TELEMETRY: 2,
  CAMERA_CONTROL: 3,
  CAMERA_CHUNK: 4,
  MOTOR_CONTROL: 5,
  MOVE_CONTROL: 6,
  BATTERY_LEVEL: 7,
  DISTANCE_READING: 8,
};

export const MSG_MOTOR_STATE = {
  IDLE: 0,
  FORWARD: 1,
  BACKWARD: 2,
  BRAKE: 3,
};

export const MSG_MOVE_CMD = {
  M1_IDLE: 0,
  M1_FWD: 1,
  M1_BCK: 2,
  M1_BRK: 3,
  M2_IDLE: 4,
  M2_FWD: 5,
  M2_BCK: 6,
  M2_BRK: 7,
};

// Message creation helpers
export function makeTelemetry(m1: number, m2: number, battery: number, distance: number): Buffer {
  // msg_id, len=4, payload
  return Buffer.from([
    MSG_ID.TELEMETRY, 4, 0, m1, m2, battery, distance
  ]);
}

export function makeCameraControl(on: boolean): Buffer {
  // msg_id, len=1, payload
  return Buffer.from([
    MSG_ID.CAMERA_CONTROL, 1, 0, on ? 1 : 0
  ]);
}

export function makeMotorControl(m1: number, m2: number): Buffer {
  // msg_id, len=2, payload
  return Buffer.from([
    MSG_ID.MOTOR_CONTROL, 2, 0, m1, m2
  ]);
}

export function makeMoveControl(cmd: number): Buffer {
  // msg_id, len=1, payload
  return Buffer.from([
    MSG_ID.MOVE_CONTROL, 1, 0, cmd
  ]);
}

export function makeCameraChunk(jpegBuffer: Buffer): Buffer {
  // msg_id, len=2+N, payload: chunk_len (LE), data[]
  const len = jpegBuffer.length;
  const header = Buffer.from([
    MSG_ID.CAMERA_CHUNK,
    (len + 2) & 0xFF, ((len + 2) >> 8) & 0xFF,
    len & 0xFF, (len >> 8) & 0xFF
  ]);
  return Buffer.concat([header, jpegBuffer]);
}

// Message parsing helpers
export function parseTelemetry(payload: Buffer): { motor1: number; motor2: number; battery: number; distance: number } | null {
  if (payload.length !== 4) return null;
  return {
    motor1: payload[0],
    motor2: payload[1],
    battery: payload[2],
    distance: payload[3],
  };
}

export function parseCameraControl(payload: Buffer): { on: number } | null {
  if (payload.length !== 1) return null;
  return { on: payload[0] };
}

export function parseMotorControl(payload: Buffer): { motor1: number; motor2: number } | null {
  if (payload.length !== 2) return null;
  return {
    motor1: payload[0],
    motor2: payload[1],
  };
}

export function parseMoveControl(payload: Buffer): { cmd: number } | null {
  if (payload.length !== 1) return null;
  return { cmd: payload[0] };
}

export function parseCameraChunk(payload: Buffer): { chunk_len: number; data: Buffer } | null {
  if (payload.length < 2) return null;
  const chunk_len = payload[0] | (payload[1] << 8);
  const data = payload.subarray(2);
  if (data.length !== chunk_len) return null;
  return { chunk_len, data };
}

// Utility functions
export function throttle<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  return function (this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return func.apply(this, args);
  };
}

export function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function (this: any, ...args: Parameters<T>): void {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}
