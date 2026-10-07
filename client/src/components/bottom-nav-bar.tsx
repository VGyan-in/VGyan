import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { AppIcon } from "@/components/ui/app-icon";

export type TabKey = "home" | "progress" | "profile";

interface BottomNavBarProps {
  activeTab: TabKey;
  syncBadgeCount?: number;
}

export function BottomNavBar({
  activeTab,
  syncBadgeCount = 0,
}: BottomNavBarProps) {
  const router = useRouter();

  const handleTabPress = (tab: TabKey) => {
    if (tab === activeTab) return;
    if (tab === "home") {
      router.replace("/home");
    } else if (tab === "progress") {
      router.replace("/progress");
    } else if (tab === "profile") {
      router.replace("/profile");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.navBar}>
        {/* Home Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("home")}
          style={styles.tabButton}
          accessibilityRole="button"
          accessibilityLabel="Home Dashboard"
        >
          <View style={[styles.iconWrap, activeTab === "home" && styles.iconWrapActive]}>
            <AppIcon
              name={activeTab === "home" ? "home" : "home"}
              size={19}
              color={activeTab === "home" ? "#0B3D2E" : "#6B877B"}
              strokeWidth={activeTab === "home" ? 2.4 : 1.8}
            />
          </View>
          <Text
            style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}
            numberOfLines={1}
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* Progress / Analytics Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("progress")}
          style={styles.tabButton}
          accessibilityRole="button"
          accessibilityLabel="Learning Progress"
        >
          <View style={[styles.iconWrap, activeTab === "progress" && styles.iconWrapActive]}>
            <AppIcon
              name="chart"
              size={19}
              color={activeTab === "progress" ? "#0B3D2E" : "#6B877B"}
              strokeWidth={activeTab === "progress" ? 2.4 : 1.8}
            />
          </View>
          <Text
            style={[styles.tabLabel, activeTab === "progress" && styles.tabLabelActive]}
            numberOfLines={1}
          >
            Progress
          </Text>
        </TouchableOpacity>

        {/* Profile / Sync Tab */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("profile")}
          style={styles.tabButton}
          accessibilityRole="button"
          accessibilityLabel="Profile and Sync"
        >
          <View style={[styles.iconWrap, activeTab === "profile" && styles.iconWrapActive]}>
            <AppIcon
              name="person"
              size={19}
              color={activeTab === "profile" ? "#0B3D2E" : "#6B877B"}
              strokeWidth={activeTab === "profile" ? 2.4 : 1.8}
            />
            {syncBadgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{syncBadgeCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[styles.tabLabel, activeTab === "profile" && styles.tabLabelActive]}
            numberOfLines={1}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2ECE6",
    ...Platform.select({
      ios: {
        shadowColor: "#0B3D2E",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: "0 -2px 10px rgba(11, 61, 46, 0.04)",
      },
    }),
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: 58,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  iconWrap: {
    width: 38,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    position: "relative",
  },
  iconWrapActive: {
    backgroundColor: "#EAF3EF",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#6B877B",
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: "700",
    color: "#0B3D2E",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 2,
    backgroundColor: "#0B3D2E",
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 8.5,
    fontWeight: "800",
  },
});
