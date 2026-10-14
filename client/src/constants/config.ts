export const APP_NAME = 'Messaging App';

export const DOWNLOAD_URLS = {
  web: '/app',
  android: 'https://github.com/adityatheog/messaging-app/releases/latest/download/app-release.apk',
  ios: 'https://testflight.apple.com/join/demo-messaging-app',
  windows: 'https://github.com/adityatheog/messaging-app/releases/latest/download/MessagingApp-Setup.exe',
  macos: 'https://github.com/adityatheog/messaging-app/releases/latest/download/MessagingApp.dmg'
};

export const AVATAR_PALETTE = [
  '#5e72e4', // Argon Primary
  '#2dce89', // Argon Success
  '#11cdef', // Argon Info
  '#fb6340', // Argon Warning
  '#f5365c', // Argon Danger
  '#825ee4', // Argon Purple
  '#172b4d'  // Argon Default
];

export const getAvatarColor = (userId: string, defaultColor?: string): string => {
  if (defaultColor) return defaultColor;
  if (!userId) return AVATAR_PALETTE[0];
  const sum = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_PALETTE[Math.abs(sum) % AVATAR_PALETTE.length];
};

export const getInitials = (name?: string, fallback = '?'): string => {
  if (!name || !name.trim()) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
};
