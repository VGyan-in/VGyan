import React from "react";
import { Platform, View } from "react-native";
import { Image } from "expo-image";

export type IconName =
  | "arrow-back"
  | "chevron-forward"
  | "home"
  | "home-active"
  | "chart"
  | "chart-active"
  | "person"
  | "person-active"
  | "globe"
  | "shield"
  | "lock"
  | "people"
  | "school"
  | "mic"
  | "doc"
  | "pencil"
  | "check"
  | "flame"
  | "speed"
  | "sound"
  | "sparkles"
  | "sync"
  | "cloud-check"
  | "logout";

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const ICON_PATHS: Record<IconName, { body: string; fill?: boolean }> = {
  "arrow-back": {
    body: '<path d="M19 12H5M12 19l-7-7 7-7" />',
  },
  "chevron-forward": {
    body: '<path d="M9 18l6-6-6-6" />',
  },
  home: {
    body: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />',
  },
  "home-active": {
    body: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="none" /><polyline points="9 22 9 12 15 12 15 22" stroke="#FFFFFF" />',
  },
  chart: {
    body: '<line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />',
  },
  "chart-active": {
    body: '<rect x="16" y="8" width="4" height="12" rx="1" fill="currentColor" /><rect x="10" y="3" width="4" height="17" rx="1" fill="currentColor" /><rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor" />',
  },
  person: {
    body: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />',
  },
  "person-active": {
    body: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="currentColor" /><circle cx="12" cy="7" r="4" fill="currentColor" />',
  },
  globe: {
    body: '<circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />',
  },
  shield: {
    body: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />',
  },
  lock: {
    body: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />',
  },
  people: {
    body: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
  },
  school: {
    body: '<path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />',
  },
  mic: {
    body: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />',
  },
  doc: {
    body: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />',
  },
  pencil: {
    body: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />',
  },
  check: {
    body: '<polyline points="20 6 9 17 4 12" />',
  },
  flame: {
    body: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />',
  },
  speed: {
    body: '<path d="M12 14l2-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />',
  },
  sound: {
    body: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />',
  },
  sparkles: {
    body: '<path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />',
  },
  sync: {
    body: '<polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />',
  },
  "cloud-check": {
    body: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /><polyline points="9 13 11 15 15 11" />',
  },
  logout: {
    body: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />',
  },
};

export function AppIcon({
  name,
  size = 20,
  color = "#0B3D2E",
  strokeWidth = 2,
}: AppIconProps) {
  const iconDef = ICON_PATHS[name] || ICON_PATHS.home;
  const encodedColor = encodeURIComponent(color);

  if (Platform.OS === "web") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          display: "inline-block",
          verticalAlign: "middle",
          flexShrink: 0,
        }}
        dangerouslySetInnerHTML={{ __html: iconDef.body }}
      />
    );
  }

  // Native iOS/Android fallback using expo-image SVG data URI
  const svgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${encodedColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${iconDef.body}</svg>`;

  return (
    <Image
      source={{ uri: svgData }}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}
