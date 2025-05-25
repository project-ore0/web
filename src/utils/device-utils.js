// Set to store recently released device IDs
const recentlyReleasedDevices = new Set();

/**
 * Mark a device as recently released to prevent immediate reconnection
 * @param {string} deviceId - The ID of the device to mark as released
 * @param {number} cooldownMs - Cooldown time in milliseconds (default: 5000ms)
 */
export function markDeviceAsReleased(deviceId, cooldownMs = 5000) {
  console.log(`Marking device ${deviceId} as recently released`);
  recentlyReleasedDevices.add(deviceId);
  
  // Clear the device from the recently released list after the cooldown period
  setTimeout(() => {
    console.log(`Removing device ${deviceId} from recently released list`);
    recentlyReleasedDevices.delete(deviceId);
  }, cooldownMs);
}

/**
 * Check if a device was recently released
 * @param {string} deviceId - The ID of the device to check
 * @returns {boolean} - True if the device was recently released
 */
export function isDeviceRecentlyReleased(deviceId) {
  return recentlyReleasedDevices.has(deviceId);
}
