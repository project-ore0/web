<template>
  <div class="control-interface">
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
        <div class="device-name">{{ device.name }}</div>
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
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  device: {
    type: Object,
    required: true
  },
  ws: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['leave']);

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
      case 'telemetry':
        if (message.data) {
          motor1.value = message.data.motor1;
          motor2.value = message.data.motor2;
          batteryLevel.value = message.data.battery;
          distance.value = message.data.distance;
        }
        break;
    }
  } catch (error) {
    console.error('Error parsing JSON message:', error);
  }
};

const leaveDevice = () => {
  console.log('Release Control button clicked');
  
  if (!props.ws || props.ws.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket not available or not open');
    // Even if WebSocket is not available, still emit leave event
    emit('leave');
    return;
  }

  try {
    const message = JSON.stringify({
      type: 'leave_device'
    });
    console.log('Sending leave_device message:', message);
    props.ws.send(message);
    
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value);
      imageUrl.value = '';
    }
    
    console.log('Emitting leave event');
    emit('leave');
  } catch (error) {
    console.error('Error in leaveDevice:', error);
    // Still emit leave event even if there's an error
    emit('leave');
  }
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
  if (!props.ws || props.ws.readyState !== WebSocket.OPEN) return;

  props.ws.send(JSON.stringify({
    type: 'control',
    action
  }));
};

// Keyboard controls
const handleKeyDown = (event) => {
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
  if (['q', 'w', 'e', 'a', 's', 'd', ' '].includes(event.key.toLowerCase())) {
    sendControl('release');
  }
};

// Setup message handler
const setupMessageHandler = () => {
  if (props.ws) {
    const originalOnMessage = props.ws.onmessage;
    
    props.ws.onmessage = (event) => {
      // Call original handler if it exists
      if (originalOnMessage) {
        originalOnMessage(event);
      }
      
      // Handle messages for this component
      handleMessage(event.data);
    };
  }
};

// Lifecycle hooks
onMounted(() => {
  // Setup message handler
  setupMessageHandler();
  
  // Add keyboard event listeners
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
  // Clean up
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }

  // Remove keyboard event listeners
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
});
</script>

<style scoped>
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
