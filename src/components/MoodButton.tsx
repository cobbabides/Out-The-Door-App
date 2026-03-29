import { useRef, useEffect } from "react";
import { Pressable, Text, Animated, Easing, StyleSheet, Dimensions } from "react-native";

const CARD_WIDTH = (Dimensions.get("window").width - 52) / 2; // 2 cols, 16px side padding + 20px gap

interface Props {
  label: string;
  emoji: string;
  subtitle: string;
  accentColor: string;
  delay?: number;
  onPress: () => void;
}

export default function MoodButton({
  label, emoji, subtitle, accentColor, delay = 0, onPress,
}: Props) {
  const entryAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: 480,
      delay,
      useNativeDriver: true,
      easing: Easing.out(Easing.back(1.5)),
    }).start();
  }, []);

  const opacity = entryAnim;
  const translateY = entryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  function onPressIn() {
    Animated.spring(pressScale, {
      toValue: 0.93,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();
  }

  function onPressOut() {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 12,
    }).start();
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { opacity, transform: [{ translateY }, { scale: pressScale }] },
      ]}
    >
      <Pressable
        style={[styles.card, { borderColor: accentColor + "55" }]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {/* Subtle tinted background overlay */}
        <Animated.View
          style={[
            styles.cardTint,
            { backgroundColor: accentColor + "18" },
          ]}
        />

        {/* Emoji orb */}
        <Animated.View
          style={[styles.orb, { backgroundColor: accentColor + "30", shadowColor: accentColor }]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Animated.View>

        {/* Text */}
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>

        {/* Bottom accent line */}
        <Animated.View style={[styles.accentLine, { backgroundColor: accentColor }]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_WIDTH,
    marginBottom: 14,
  },

  card: {
    backgroundColor: "#16161f",
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    overflow: "hidden",
    // Shadow (iOS)
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  cardTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },

  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    // Glow (iOS only)
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },

  emoji: {
    fontSize: 30,
  },

  label: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.3,
  },

  subtitle: {
    fontSize: 11,
    color: "#666680",
    textAlign: "center",
    lineHeight: 15,
    paddingHorizontal: 4,
    marginBottom: 16,
  },

  accentLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    opacity: 0.7,
  },
});
