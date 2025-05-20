<template>
  <div class="control-panel">
    <div v-if="!selectedDevice" class="device-selection">
      <h2>ORE0 Control Panel</h2>
      <div class="device-list">
        <h3>Available Devices</h3>
        <div v-if="devices.length === 0" class="no-devices">
          No devices available
        </div>
        <div v-else class="device-grid">
          <div v-for="device in devices" :key="device.id" class="device-item"
            :class="{ 'device-assumed': device.isAssumed }" @click="assumeDevice(device)">
            <div class="device-name">{{ device.name }}</div>
            <div class="device-status">{{ device.isAssumed ? 'In Use' : 'Available' }}</div>
          </div>
        </div>
      </div>
      <div class="connection-status" :class="{ connected: isConnected }">
        {{ isConnected ? 'Connected to Server' : 'Disconnected from Server' }}
      </div>
    </div>

    <div v-else class="control-interface">
      <!-- Full screen camera feed -->
      <div class="camera-section">
        <div class="camera-feed" ref="cameraFeed">
          <img v-if="imageUrl" :src="imageUrl" alt="Camera Feed" />
          <div v-else class="no-camera">No camera feed available</div>
        </div>
      </div>

      <!-- Device representation at the bottom -->
      <div class="device-representation">
        <div class="device-info">
          <div class="device-name">{{ selectedDevice.name }}</div>
          <button @click="leaveDevice" class="leave-btn">Release Control</button>
        </div>

        <div class="device-status-grid">
          <div class="status-item">
            <div class="status-label">Battery:</div>
            <div class="status-value">{{ batteryLevel }}%</div>
            <div class="battery-indicator">
              <div class="battery-level" :style="{ width: `${batteryLevel}%`, backgroundColor: batteryColor }"></div>
            </div>
          </div>

          <div class="status-item">
            <div class="status-label">Distance:</div>
            <div class="status-value">{{ distance }} cm</div>
          </div>
        </div>

        <div class="tracks-visualization">
          <div class="track left-track" :class="getTrackClass('left')">
            <div class="track-label">M1</div>
            <div class="track-state">{{ motorStateText(motor1) }}</div>
          </div>
          <div class="track right-track" :class="getTrackClass('right')">
            <div class="track-label">M2</div>
            <div class="track-state">{{ motorStateText(motor2) }}</div>
          </div>
        </div>

        <div class="control-help">
          <div class="key-guide">
            <div class="key">Q</div>
            <div class="key-desc">M1 Forward</div>
          </div>
          <div class="key-guide">
            <div class="key">W</div>
            <div class="key-desc">M1+M2 Forward</div>
          </div>
          <div class="key-guide">
            <div class="key">E</div>
            <div class="key-desc">M2 Forward</div>
          </div>
          <div class="key-guide">
            <div class="key">A</div>
            <div class="key-desc">M1 Backward</div>
          </div>
          <div class="key-guide">
            <div class="key">S</div>
            <div class="key-desc">M1+M2 Backward</div>
          </div>
          <div class="key-guide">
            <div class="key">D</div>
            <div class="key-desc">M2 Backward</div>
          </div>
          <div class="key-guide">
            <div class="key">SPACE</div>
            <div class="key-desc">Brake</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// WebSocket connection
const ws = ref(null);
const isConnected = ref(false);

// Device management
const devices = ref([]);
const selectedDevice = ref(null);

// Vehicle status
const batteryLevel = ref(0);
const distance = ref(0);
const motor1 = ref(0);
const motor2 = ref(0);
const imageUrl = ref('');

// Message protocol constants
const MSG_MOTOR_STATE = {
  IDLE: 0,
  FORWARD: 1,
  BACKWARD: 2,
  BRAKE: 3,
};

// Computed properties
const batteryColor = computed(() => {
  if (batteryLevel.value > 70) return '#4CAF50';
  if (batteryLevel.value > 30) return '#FFC107';
  return '#F44336';
});

// Methods
const connectWebSocket = () => {
  // Close existing connection if any
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.close();
  }

  // Create new WebSocket connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws.value = new WebSocket(wsUrl);

  ws.value.binaryType = 'arraybuffer';

  ws.value.onopen = () => {
    console.log('WebSocket connected');
    isConnected.value = true;

    // Request device list
    requestDeviceList();
  };

  ws.value.onclose = () => {
    console.log('WebSocket disconnected');
    isConnected.value = false;

    // Reset state
    selectedDevice.value = null;
    devices.value = [];

    // Try to reconnect after a delay
    setTimeout(connectWebSocket, 3000);
  };

  ws.value.onerror = (error) => {
    console.error('WebSocket error:', error);
    isConnected.value = false;
  };

  ws.value.onmessage = (event) => {
    handleMessage(event.data);
  };
};

const handleMessage = (data) => {
  // Handle binary messages (camera chunks)
  if (data instanceof ArrayBuffer) {
    try {
      const buffer = new Uint8Array(data);

      // Check if this is a camera chunk (message ID 4)
      if (buffer[0] === 4 && buffer.length >= 3) {
        const length = buffer[1] | (buffer[2] << 8);
        const payload = buffer.slice(3);

        if (payload.length !== length) {
          console.warn(`Expected payload length ${length}, but got ${payload.length}`);
          return;
        }

        if (imageUrl.value) {
          URL.revokeObjectURL(imageUrl.value);
        }

        const blob = new Blob([payload], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        imageUrl.value = url;
      }
      // Handle telemetry binary message (message ID 2)
      else if (buffer[0] === 2 && buffer.length >= 7) {
        motor1.value = buffer[3];
        motor2.value = buffer[4];
        batteryLevel.value = buffer[5];
        distance.value = buffer[6];
      }
    } catch (error) {
      console.error('Error processing binary message:', error);
    }
    return;
  }

  // Handle JSON messages
  try {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'device_list':
        devices.value = message.devices || [];
        break;

      case 'device_assumed':
        if (message.deviceId && message.deviceInfo) {
          selectedDevice.value = message.deviceInfo;
          console.log('Now controlling device:', selectedDevice.value.name);
        }
        break;

      case 'telemetry':
        if (message.data) {
          motor1.value = message.data.motor1;
          motor2.value = message.data.motor2;
          batteryLevel.value = message.data.battery;
          distance.value = message.data.distance;
        }
        break;

      case 'error':
        console.error('Server error:', message.message);
        alert(`Error: ${message.message}`);
        break;
    }
  } catch (error) {
    console.error('Error parsing JSON message:', error);
  }
};

const requestDeviceList = () => {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return;

  ws.value.send(JSON.stringify({
    type: 'list_devices'
  }));
};

const assumeDevice = (device) => {
  if (device.isAssumed) {
    alert('This device is already being controlled by another user.');
    return;
  }

  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return;

  ws.value.send(JSON.stringify({
    type: 'assume_device',
    deviceId: device.id
  }));
};

const leaveDevice = () => {
  if (!selectedDevice.value || !ws.value || ws.value.readyState !== WebSocket.OPEN) return;

  ws.value.send(JSON.stringify({
    type: 'leave_device'
  }));

  selectedDevice.value = null;
  imageUrl.value = '';
};

const motorStateText = (state) => {
  switch (state) {
    case MSG_MOTOR_STATE.IDLE: return 'Idle';
    case MSG_MOTOR_STATE.FORWARD: return 'Forward';
    case MSG_MOTOR_STATE.BACKWARD: return 'Backward';
    case MSG_MOTOR_STATE.BRAKE: return 'Brake';
    default: return 'Unknown';
  }
};

const getTrackClass = (track) => {
  const motorState = track === 'left' ? motor1.value : motor2.value;

  switch (motorState) {
    case MSG_MOTOR_STATE.FORWARD: return 'track-forward';
    case MSG_MOTOR_STATE.BACKWARD: return 'track-backward';
    case MSG_MOTOR_STATE.BRAKE: return 'track-brake';
    default: return '';
  }
};

const sendControl = (action) => {
  if (!selectedDevice.value || !ws.value || ws.value.readyState !== WebSocket.OPEN) return;

  ws.value.send(JSON.stringify({
    type: 'control',
    action
  }));
};

// Keyboard controls
const handleKeyDown = (event) => {
  if (!selectedDevice.value) return;

  // Prevent default behavior for control keys
  if (['q', 'w', 'e', 'a', 's', 'd', ' '].includes(event.key.toLowerCase())) {
    event.preventDefault();
  }

  switch (event.key.toLowerCase()) {
    case 'q':
      sendControl('q');
      break;
    case 'w':
      sendControl('w');
      break;
    case 'e':
      sendControl('e');
      break;
    case 'a':
      sendControl('a');
      break;
    case 's':
      sendControl('s');
      break;
    case 'd':
      sendControl('d');
      break;
    case ' ': // Space
      sendControl('space');
      break;
  }
};

const handleKeyUp = (event) => {
  if (!selectedDevice.value) return;

  if (['q', 'w', 'e', 'a', 's', 'd', ' '].includes(event.key.toLowerCase())) {
    sendControl('release');
  }
};

// Lifecycle hooks
onMounted(() => {
  connectWebSocket();

  // Add keyboard event listeners
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Request device list periodically
  const deviceListInterval = setInterval(() => {
    if (isConnected.value && !selectedDevice.value) {
      requestDeviceList();
    }
  }, 5000);

  // Clean up interval on unmount
  onUnmounted(() => {
    clearInterval(deviceListInterval);
  });
});

onUnmounted(() => {
  // Clean up
  if (ws.value) {
    ws.value.close();
  }

  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }

  // Remove keyboard event listeners
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});
</script>

<style scoped>
.control-panel {
  width: 100%;
  height: 100vh;
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

/* Device selection screen */
.device-selection {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
}

h2 {
  text-align: center;
  margin-bottom: 20px;
}

h3 {
  margin-top: 0;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}

.device-list {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.no-devices {
  text-align: center;
  padding: 20px;
  color: #666;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.device-item {
  background-color: #fff;
  border-radius: 4px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.device-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.device-item.device-assumed {
  opacity: 0.6;
  cursor: not-allowed;
}

.device-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.device-status {
  font-size: 0.9em;
  color: #666;
}

/* Control interface */
.control-interface {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.camera-section {
  flex: 1;
  background-color: #000;
  position: relative;
}

.camera-feed {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-feed img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-camera {
  color: #fff;
  font-size: 1.2em;
}

.device-representation {
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  position: relative;
  z-index: 10;
}

.device-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.leave-btn {
  background-color: #F44336;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.device-status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.status-item {
  display: flex;
  flex-direction: column;
}

.status-label {
  font-weight: bold;
  margin-bottom: 5px;
}

.status-value {
  font-size: 1.2em;
}

.battery-indicator {
  height: 10px;
  background-color: #444;
  border-radius: 5px;
  margin-top: 5px;
  overflow: hidden;
}

.battery-level {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.tracks-visualization {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.track {
  width: 48%;
  height: 60px;
  background-color: #333;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.track::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(45deg,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0.1) 10px,
      rgba(255, 255, 255, 0.2) 10px,
      rgba(255, 255, 255, 0.2) 20px);
}

.track-label {
  font-weight: bold;
  z-index: 1;
}

.track-state {
  font-size: 0.8em;
  z-index: 1;
}

.track-forward {
  background-color: #4CAF50;
}

.track-backward {
  background-color: #F44336;
}

.track-brake {
  background-color: #FFC107;
}

.control-help {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.key-guide {
  display: flex;
  align-items: center;
  margin-right: 15px;
}

.key {
  background-color: #444;
  color: white;
  padding: 5px 8px;
  border-radius: 4px;
  margin-right: 5px;
  font-family: monospace;
  min-width: 20px;
  text-align: center;
}

.key-desc {
  font-size: 0.9em;
}

.connection-status {
  text-align: center;
  padding: 8px;
  border-radius: 4px;
  background-color: #F44336;
  color: white;
  font-weight: bold;
  margin-top: 20px;
}

.connection-status.connected {
  background-color: #4CAF50;
}

@media (max-width: 600px) {
  .device-status-grid {
    grid-template-columns: 1fr;
  }

  .control-help {
    flex-direction: column;
    align-items: flex-start;
  }

  .key-guide {
    margin-right: 0;
    margin-bottom: 5px;
  }
}
</style>
