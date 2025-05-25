<template>
  <DeviceList @select-device="handleDeviceSelect" />
</template>

<script setup>
import DeviceList from '@/components/DeviceList.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

function handleDeviceSelect(deviceInfo) {
  router.push(`/device/${deviceInfo.id}`);
}
</script>
