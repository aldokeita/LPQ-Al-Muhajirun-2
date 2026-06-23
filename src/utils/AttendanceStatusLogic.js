export const determineAttendanceStatus = (checkInTimestamp, sessionStartTime) => {
  if (!checkInTimestamp) return 'Tidak Hadir';
  if (!sessionStartTime) return 'Hadir'; // Fallback if session start time is unknown
  
  const checkIn = new Date(checkInTimestamp);
  const start = new Date(sessionStartTime);
  
  // Strict timestamp comparison logic
  if (checkIn > start) {
    return 'Terlambat';
  }
  
  return 'Hadir';
};

export const determineAttendanceStatusFromTimestamp = determineAttendanceStatus; // Alias for backward compatibility if requested

export const calculateTimeDifference = (checkInTimestamp, sessionStartTime) => {
  if (!checkInTimestamp || !sessionStartTime) return 0;
  
  const checkIn = new Date(checkInTimestamp);
  const start = new Date(sessionStartTime);
  const diffMinutes = Math.floor((checkIn - start) / (1000 * 60));
  
  return diffMinutes > 0 ? diffMinutes : 0;
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  
  const pad = (num) => String(num).padStart(2, '0');
  
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};