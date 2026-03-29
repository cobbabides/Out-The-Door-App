import { useRef, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, StatusBar, Animated, Easing } from "react-native";
import MoodButton from "../src/components/MoodButton";
import { useStore } from "../src/state/useStore";
import { router } from "expo-router";

const MOODS = [
  {
    label: "Chill & solo",
    value: "chill",
    emoji: "🌙",
    subtitle: "Low-key, quiet, just you",
    accentColor: "#7B8FFF",
  },
  {
    label: "Social & lively",
    value: "social",
    emoji: "🍻",
    subtitle: "Good vibes, good company",
    accentColor: "#FF6B8A",
  },
  {
    label: "Creative & artsy",
    value: "creative",
    emoji: "🎨",
    subtitle: "Something that inspires",
    accentColor: "#A78BFA",
  },
  {
    label: "Active & outdoorsy",
    value: "active",
    emoji: "⚡",
    subtitle: "Move your body, feel alive",
    accentColor: "#34D399",
  },
  {
    label: "Lazy but curious",
    value: "lazy",
    emoji: "🛋️",
    subtitle: "Effortless, no commitments",
    accentColor: "#FBBF24",
  },
  {
    label: "Surprise me",
    value: "surprise",
    emoji: "🎲",
    subtitle: "Feeling spontaneous",
    accentColor: "#FF8C42",
  },
] as const;

export default function Mood() {
  const setMood = useStore((s) => s.setMood);

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      delay: 60,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, []);

  const headerOpacity = headerAnim;
  const headerY = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.blob, styles.blobTopLeft]} />
      <View style={[styles.blob, styles.blobBottomRight]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[styles.header, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}
        >
          <Text style={styles.eyebrow}>HOW ARE YOU FEELING?</Text>
          <Text style={styles.title}>{"What's your\nvibe tonight?"}</Text>
          <Text style={styles.subtitle}>Pick a mood and we'll find the perfect spot.</Text>
        </Animated.View>

        <View style={styles.grid}>
          {MOODS.map(({ label, value, emoji, subtitle, accentColor }, index) => (
            <MoodButton
              key={value}
              label={label}
              emoji={emoji}
              subtitle={subtitle}
              accentColor={accentColor}
              delay={120 + index * 70}
              onPress={() => {
                setMood(value);
                router.replace("/question");
              }}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0e16" },

  blob: { position: "absolute", width: 260, height: 260, borderRadius: 130, opacity: 0.12 },
  blobTopLeft: { top: -60, left: -80, backgroundColor: "#7B8FFF" },
  blobBottomRight: { bottom: 40, right: -80, backgroundColor: "#FF6B8A" },

  scroll: { paddingBottom: 60 },

  header: { paddingTop: 72, paddingHorizontal: 24, paddingBottom: 28 },
  eyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 3, color: "#FF8C42", marginBottom: 12 },
  title: { fontSize: 42, fontWeight: "900", color: "#fff", letterSpacing: -1.5, lineHeight: 46, marginBottom: 10 },
  subtitle: { fontSize: 14, color: "#555570", lineHeight: 20 },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, justifyContent: "space-between" },
});
