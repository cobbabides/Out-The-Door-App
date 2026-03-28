import { Pressable, Text, View, StyleSheet } from "react-native";

interface Props {
  label: string;
  emoji: string;
  subtitle: string;
  accentColor: string;
  onPress: () => void;
}

export default function MoodButton({ label, emoji, subtitle, accentColor, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.emojiWrap, { backgroundColor: accentColor + "22" }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.arrow, { color: accentColor }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C28",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2A2A3A",
  },
  pressed: {
    opacity: 0.75,
  },
  emojiWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  emoji: {
    fontSize: 24,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#666680",
  },
  arrow: {
    fontSize: 24,
    fontWeight: "300",
    marginLeft: 8,
  },
});
