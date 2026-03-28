import { View, Text, Pressable, StyleSheet, StatusBar } from "react-native";
import { Link } from "expo-router";

export default function Home() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.content}>
        <Text style={styles.eyebrow}>YOUR NEXT MOVE</Text>
        <Text style={styles.title}>Out the{"\n"}Door.</Text>
        <Text style={styles.subtitle}>
          Tell us how you feel.{"\n"}We'll find somewhere to go.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Link href="/mood" asChild>
          <Pressable style={styles.cta}>
            <Text style={styles.ctaText}>Let's go →</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111118",
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 52,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    color: "#FF8C42",
    marginBottom: 20,
  },
  title: {
    fontSize: 64,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 68,
    marginBottom: 24,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    color: "#8888A0",
    lineHeight: 26,
  },
  bottom: {
    paddingBottom: 8,
  },
  cta: {
    backgroundColor: "#FF8C42",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 100,
    alignItems: "center",
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
