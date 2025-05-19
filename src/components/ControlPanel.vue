<template>
  <div class="control-panel">
    <h2>ORE0 Control Panel</h2>
    
    <div class="status-section">
      <h3>Vehicle Status</h3>
      <div class="status-grid">
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
        
        <div class="status-item">
          <div class="status-label">Motor 1:</div>
          <div class="status-value">{{ motorStateText(motor1) }}</div>
        </div>
        
        <div class="status-item">
          <div class="status-label">Motor 2:</div>
          <div class="status-value">{{ motorStateText(motor2) }}</div>
        </div>
      </div>
    </div>
    
    <div class="camera-section">
      <h3>Camera Feed</h3>
      <div class="camera-feed" ref="cameraFeed">
        <img v-if="imageUrl" :src="imageUrl" alt="Camera Feed" />
        <div v-else class="no-camera">No camera feed available</div>
      </div>
    </div>
    
    <div class="control-section">
      <h3>Vehicle Control</h3>
      <div class="control-grid">
        <button @mousedown="move('forward')" @mouseup="stop" @mouseleave="stop" class="control-btn forward-btn">
          Forward
        </button>
        
        <button @mousedown="move('left')" @mouseup="stop" @mouseleave="stop" class="control-btn left-btn">
          Left
        </button>
        
        <button @mousedown="stop" class="control-btn stop-btn">
          Stop
        </button>
        
        <button @mousedown="move('right')" @mouseup="stop" @mouseleave="stop" class="control-btn right-btn">
          Right
        </button>
        
        <button @mousedown="move('backward')" @mouseup="stop" @mouseleave="stop" class="control-btn backward-btn">
          Backward
        </button>
      </div>
    </div>
    
    <div class="connection-status" :class="{ connected: isConnected }">
      {{ isConnected ? 'Connected' : 'Disconnected' }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// WebSocket connection
const ws = ref(null);
const isConnected = ref(false);

// Vehicle status
const batteryLevel = ref(0);
const distance = ref(0);
const motor1 = ref(0);
const motor2 = ref(0);
const imageUrl = ref('');

// Message protocol constants
const MSG_ID = {
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

const MSG_MOTOR_STATE = {
  IDLE: 0,
  FORWARD: 1,
  BACKWARD: 2,
  BRAKE: 3,
};

const MSG_MOVE_CMD = {
  M1_IDLE: 0,
  M1_FWD: 1,
  M1_BCK: 2,
  M1_BRK: 3,
  M2_IDLE: 4,
  M2_FWD: 5,
  M2_BCK: 6,
  M2_BRK: 7,
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
  };
  
  ws.value.onclose = () => {
    console.log('WebSocket disconnected');
    isConnected.value = false;
    
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
  const buffer = new Uint8Array(data);
  
  if (buffer.length < 3) {
    console.error('Message too short');
    return;
  }
  
  const msgId = buffer[0];
  const length = buffer[1] | (buffer[2] << 8);
  const payload = buffer.slice(3);
  
  if (payload.length !== length) {
    console.error(`Payload length mismatch: expected ${length}, got ${payload.length}`);
    return;
  }
  
  switch (msgId) {
    case MSG_ID.TELEMETRY:
      if (payload.length === 4) {
        motor1.value = payload[0];
        motor2.value = payload[1];
        batteryLevel.value = payload[2];
        distance.value = payload[3];
      }
      break;
      
    case MSG_ID.CAMERA_CHUNK:
      try {
        // Extract the JPEG data directly from the payload
        // The payload format is: [chunk_len_low, chunk_len_high, jpeg_data...]
        if (payload.length >= 2) {
          // Get the chunk length from the first 2 bytes
          const chunkLen = payload[0] | (payload[1] << 8);
          
          // Get the actual JPEG data (skip the chunk length bytes)
          const imageData = payload.slice(2);
          
          console.log(`Camera chunk: payload length=${payload.length}, chunk_len=${chunkLen}, image data length=${imageData.length}`);
          
          // Check if the chunk length doesn't match the actual data length
          if (imageData.length !== chunkLen) {
            console.warn(`Chunk length mismatch: expected ${chunkLen}, got ${imageData.length}. Using actual data length.`);
          }
          
          // Check if the data starts with JPEG-related bytes
          if (imageData.length > 2) {
            console.log(`First bytes: ${imageData[0].toString(16)} ${imageData[1].toString(16)}`);
            
            // Try to fix the image data if it doesn't start with FF D8 (JPEG SOI marker)
            let finalImageData;
            if (imageData[0] === 0xFF && imageData[1] === 0xE0) {
              // This is an APP0 marker, which is common in JPEG files but should be preceded by SOI
              console.log('Found APP0 marker (FF E0) without SOI, adding SOI marker');
              
              // Create a new array with FF D8 (SOI) at the beginning
              const fixedData = new Uint8Array(imageData.length + 2);
              fixedData[0] = 0xFF; // SOI marker
              fixedData[1] = 0xD8;
              fixedData.set(imageData, 2); // Copy the original data after SOI
              
              finalImageData = fixedData;
            } else if (imageData[0] === 0xFF) {
              console.log('Potential JPEG data detected (starts with 0xFF)');
              finalImageData = imageData;
            } else {
              console.warn('Data does not start with 0xFF, might not be valid image data');
              finalImageData = imageData; // Try anyway
            }
            
            // Convert image data to blob and create URL
            const blob = new Blob([finalImageData], { type: 'image/jpeg' });
            console.log('Blob created:', blob.size, 'bytes');
            
            // Revoke previous URL to prevent memory leaks
            if (imageUrl.value) {
              URL.revokeObjectURL(imageUrl.value);
            }
            
            // Create and set the object URL
            const url = URL.createObjectURL(blob);
            console.log('Image URL created:', url);
            imageUrl.value = url;
            
            // Force a re-render of the image
            setTimeout(() => {
              const img = document.querySelector('.camera-feed img');
              if (img) {
                // Add an onload handler to check if the image loaded successfully
                img.onload = () => {
                  console.log('Image loaded successfully, dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                };
                
                img.onerror = (err) => {
                  console.error('Error loading image:', err);
                };
                
                // Force a redraw
                img.style.display = 'none';
                setTimeout(() => {
                  img.style.display = 'block';
                }, 10);
              } else {
                console.error('Image element not found in DOM');
              }
            }, 100);
          } else {
            console.error('Image data too short');
          }
        } else {
          console.error('Camera chunk payload too short');
        }
      } catch (error) {
        console.error('Error processing camera chunk:', error);
      }
      break;
      
    case MSG_ID.BATTERY_LEVEL:
      if (payload.length === 1) {
        batteryLevel.value = payload[0];
      }
      break;
      
    case MSG_ID.DISTANCE_READING:
      if (payload.length === 1) {
        distance.value = payload[0];
      }
      break;
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

const sendMotorControl = (m1, m2) => {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return;
  
  const buffer = new Uint8Array([
    MSG_ID.MOTOR_CONTROL,
    2, 0, // Length (2 bytes, little endian)
    m1, m2 // Payload
  ]);
  
  ws.value.send(buffer);
};

const sendMoveControl = (cmd) => {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return;
  
  const buffer = new Uint8Array([
    MSG_ID.MOVE_CONTROL,
    1, 0, // Length (2 bytes, little endian)
    cmd // Payload
  ]);
  
  ws.value.send(buffer);
};

const move = (direction) => {
  switch (direction) {
    case 'forward':
      sendMotorControl(MSG_MOTOR_STATE.FORWARD, MSG_MOTOR_STATE.FORWARD);
      break;
    case 'backward':
      sendMotorControl(MSG_MOTOR_STATE.BACKWARD, MSG_MOTOR_STATE.BACKWARD);
      break;
    case 'left':
      sendMotorControl(MSG_MOTOR_STATE.BACKWARD, MSG_MOTOR_STATE.FORWARD);
      break;
    case 'right':
      sendMotorControl(MSG_MOTOR_STATE.FORWARD, MSG_MOTOR_STATE.BACKWARD);
      break;
  }
};

const stop = () => {
  sendMotorControl(MSG_MOTOR_STATE.IDLE, MSG_MOTOR_STATE.IDLE);
};

// Keyboard controls
const handleKeyDown = (event) => {
  switch (event.key) {
    case 'ArrowUp':
      move('forward');
      break;
    case 'ArrowDown':
      move('backward');
      break;
    case 'ArrowLeft':
      move('left');
      break;
    case 'ArrowRight':
      move('right');
      break;
    case ' ': // Space
      stop();
      break;
  }
};

const handleKeyUp = (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    stop();
  }
};

// Lifecycle hooks
onMounted(() => {
  connectWebSocket();
  
  // Add keyboard event listeners
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
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
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
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

.status-section,
.camera-section,
.control-section {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
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
  background-color: #e0e0e0;
  border-radius: 5px;
  margin-top: 5px;
  overflow: hidden;
}

.battery-level {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.camera-feed {
  width: 100%;
  height: 300px;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 4px;
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

.control-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 10px;
  max-width: 300px;
  margin: 0 auto;
}

.control-btn {
  padding: 15px;
  border: none;
  border-radius: 4px;
  background-color: #2196F3;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background-color: #0b7dda;
}

.control-btn:active {
  background-color: #0a69b7;
}

.forward-btn {
  grid-column: 2;
  grid-row: 1;
}

.left-btn {
  grid-column: 1;
  grid-row: 2;
}

.stop-btn {
  grid-column: 2;
  grid-row: 2;
  background-color: #F44336;
}

.stop-btn:hover {
  background-color: #d32f2f;
}

.right-btn {
  grid-column: 3;
  grid-row: 2;
}

.backward-btn {
  grid-column: 2;
  grid-row: 3;
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
  .status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
