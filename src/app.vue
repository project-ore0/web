<template>
  <div>
    <NuxtRouteAnnouncer />
    <ControlPanel />
  </div>
</template>

<script setup>
import ControlPanel from '~/components/ControlPanel.vue';
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  background-color: #f5f5f5;
}
</style>
