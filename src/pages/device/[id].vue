<template>
  <div>
    <div v-if="!selectedDevice">
      <p>Loading device...</p>
      <button @click="goBack">Back to Device List</button>
    </div>
    
    <DeviceControl 
      v-else 
      :device="selectedDevice" 
      :ws="websocket" 
      @leave="handleDeviceLeave" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, inject } from 'vue';
import DeviceControl from '@/components/DeviceControl.vue';
import { useRoute, useRouter } from 'vue-router';
import { markDeviceAsReleased } from '@/utils/device-utils';

const route = useRoute();
const router = useRouter();
const deviceId = route.params.id;

const websocket = ref(null);
const selectedDevice = ref(null);

// Connect to WebSocket and request device info
const connectWebSocket = () => {
  // Create new WebSocket connection
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  websocket.value = new WebSocket(wsUrl);
  websocket.value.binaryType = 'arraybuffer';

  websocket.value.onopen = () => {
    console.log('WebSocket connected');
    
    // Request to assume control of the device
    if (websocket.value.readyState === WebSocket.OPEN) {
      websocket.value.send(JSON.stringify({
        type: 'assume_device',
        deviceId: deviceId
      }));
    }
  };

  websocket.value.onclose = () => {
    console.log('WebSocket disconnected');
    // Try to reconnect after a delay
    setTimeout(connectWebSocket, 3000);
  };

  websocket.value.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  websocket.value.onmessage = (event) => {
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
      case 'device_assumed':
        if (message.deviceId && message.deviceInfo) {
          selectedDevice.value = message.deviceInfo;
          console.log('Now controlling device:', selectedDevice.value.name);
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

const handleDeviceLeave = () => {
  console.log('Device leave event received in device page');
  
  // Make sure to clean up before navigating
  cleanupAndNavigate();
};

const cleanupAndNavigate = () => {
  console.log('Cleaning up before navigation');
  
  // Mark the device as recently released to prevent immediate reconnection
  if (deviceId) {
    markDeviceAsReleased(deviceId);
  }
  
  // Clear the selected device
  selectedDevice.value = null;
  
  // Close WebSocket connection properly
  if (websocket.value && websocket.value.readyState === WebSocket.OPEN) {
    console.log('Closing WebSocket connection');
    
    // Remove all event listeners to prevent any callbacks
    websocket.value.onclose = null;
    websocket.value.onerror = null;
    websocket.value.onmessage = null;
    
    // Close the connection
    websocket.value.close();
    websocket.value = null;
  }
  
  // Wait a moment to ensure cleanup is complete before navigation
  setTimeout(() => {
    console.log('Navigating back to home page');
    router.push('/');
  }, 100);
};

const goBack = () => {
  cleanupAndNavigate();
};

onMounted(() => {
  connectWebSocket();
});

onUnmounted(() => {
  console.log('Device page unmounting, cleaning up resources');
  
  // Use the same cleanup function for consistency
  if (websocket.value) {
    // Don't navigate when unmounting
    // Just clean up the WebSocket connection
    
    // Remove all event listeners to prevent any callbacks
    websocket.value.onclose = null;
    websocket.value.onerror = null;
    websocket.value.onmessage = null;
    
    // Close the connection if it's open
    if (websocket.value.readyState === WebSocket.OPEN) {
      websocket.value.close();
    }
    
    websocket.value = null;
  }
});
</script>

<style scoped>
button {
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
