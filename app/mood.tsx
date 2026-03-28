import { View, Text, ScrollView, StyleSheet, StatusBar } from "react-native";
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
    subtitle: "Effortless, easy, no commitments",
    accentColor: "#FBBF24",
  },
  {
    label: "Surprise me",
    value: "surprise",
    emoji: "🎲",
    subtitle: "I'm feeling spontaneous",
    accentColor: "#FF8C42",
  },
] as const;

export default function Mood() {
  const setMood = useStore((s) => s.setMood);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HOW ARE YOU FEELING?</Text>
        <Text style={styles.title}>Pick a vibe.</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {MOODS.map(({ label, value, emoji, subtitle, accentColor }) => (
          <MoodButton
            key={value}
            label={label}
            emoji={emoji}
            subtitle={subtitle}
            accentColor={accentColor}
            onPress={() => {
              setMood(value);
              router.replace("/question");
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111118",
  },
  header: {
    paddingTop: 72,
    paddingHorizontal: 28,
    paddingBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#FF8C42",
    marginBottom: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});
