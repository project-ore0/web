<template>
  <div class="device-selection">
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
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { isDeviceRecentlyReleased } from '@/utils/device-utils';

const emit = defineEmits(['select-device', 'websocket-ready']);

// WebSocket connection
const ws = ref(null);
const isConnected = ref(false);

// Device management
const devices = ref([]);

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
    
    // Emit websocket ready event
    emit('websocket-ready', ws.value);
  };

  ws.value.onclose = () => {
    console.log('WebSocket disconnected');
    isConnected.value = false;

    // Reset state
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
  // Skip binary messages as they're handled by DeviceControl
  if (data instanceof ArrayBuffer) {
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
          emit('select-device', message.deviceInfo, ws.value);
          console.log('Now controlling device:', message.deviceInfo.name);
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
  
  if (isDeviceRecentlyReleased(device.id)) {
    console.log(`Device ${device.id} was recently released, waiting for cooldown`);
    alert('This device was recently released. Please wait a moment before reconnecting.');
    return;
  }

  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) return;

  console.log(`Assuming control of device: ${device.id}`);
  ws.value.send(JSON.stringify({
    type: 'assume_device',
    deviceId: device.id
  }));
};

// Lifecycle hooks
onMounted(() => {
  connectWebSocket();

  // Request device list periodically
  const deviceListInterval = setInterval(() => {
    if (isConnected.value) {
      requestDeviceList();
    }
  }, 5000);

  return () => {
    clearInterval(deviceListInterval);
  };
});

onUnmounted(() => {
  // Clean up
  if (ws.value) {
    ws.value.close();
  }
});
</script>

<style scoped>
.device-selection {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  width: 100%;
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
</style>
