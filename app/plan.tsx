import { useEffect, useState, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Linking, Animated, Easing,
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { usePlanStore } from "../src/state/usePlanStore";
import { getCurrentWeather } from "../src/api/openWeather";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItineraryStop {
  time: string;
  emoji: string;
  title: string;
  venue: string;
  description: string;
  neighborhood?: string;
  travelNote?: string;
  isAnchor?: boolean;
  url?: string;
}

interface NightPlan {
  narrative: string;
  stops: ItineraryStop[];
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  music: "#FF6B8A",
  food: "#FBBF24",
  bar: "#A78BFA",
  arts: "#34D399",
  outdoor: "#34D399",
  film: "#7B8FFF",
  comedy: "#FF8C42",
  other: "#FF8C42",
};

// ─── Claude call ──────────────────────────────────────────────────────────────

async function buildNightPlan(
  anchor: NonNullable<ReturnType<typeof usePlanStore.getState>["anchor"]>,
  contextSummary: string
): Promise<NightPlan> {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!key) throw new Error("Missing Anthropic API key");

  const systemPrompt = `You are a night-out itinerary planner for Columbus, Ohio. Someone is anchoring their evening around a specific event or place. Build them a smooth 3–4 stop evening that flows naturally.

Current conditions:
${contextSummary}

Anchor event: "${anchor.title}" at ${anchor.venue}${anchor.time ? ` at ${anchor.time}` : ""}${anchor.address ? ` (${anchor.address})` : ""}

Rules:
- Use REAL Columbus venues — Short North, German Village, Franklinton, Grandview, Arena District, etc.
- The anchor is the centerpiece — place it as stop 2 or 3, with a pre-event stop before it
- If it's late (after 9pm), skip dinner and focus on bars/after-party options instead
- Give specific times that flow logically (leave buffer between stops)
- Keep descriptions punchy — 1 sentence, conversational, like a friend texting you
- Include a travelNote like "5 min walk" or "quick Uber" between stops
- Be specific about neighborhoods

Respond with ONLY valid JSON, no markdown:
{
  "narrative": "One vivid sentence that sells the whole evening",
  "stops": [
    {
      "time": "7:30 PM",
      "emoji": "🍽️",
      "title": "Dinner at Florentine",
      "venue": "Florentine",
      "description": "Their wood-fired pizza is the move before a show.",
      "neighborhood": "Short North",
      "travelNote": "10 min walk to anchor",
      "isAnchor": false,
      "url": "https://theflozcolumbus.com"
    }
  ]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: "Build my night plan." }],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as NightPlan;
}

async function getContext(anchor: NonNullable<ReturnType<typeof usePlanStore.getState>["anchor"]>): Promise<string> {
  let lat = 39.9612, lon = -82.9988;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      lat = loc.coords.latitude;
      lon = loc.coords.longitude;
    }
  } catch {}

  const now = new Date();
  const hour = now.getHours();
  const dayLabel = now.toLocaleDateString([], { weekday: "long" });
  const part = hour < 11 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "late night";
  const timeLabel = `${dayLabel} ${part}, ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  let weatherLine = "Weather: unknown";
  try {
    const w = await getCurrentWeather(lat, lon);
    weatherLine = `Weather: ${w.temp}°F, ${w.description}, sunset ${w.sunsetTime}`;
  } catch {}

  return `Time: ${timeLabel}\n${weatherLine}`;
}

// ─── Stop Card ────────────────────────────────────────────────────────────────

function StopCard({
  stop, index, color, animValue,
}: {
  stop: ItineraryStop;
  index: number;
  color: string;
  animValue: Animated.Value;
}) {
  const opacity = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const translateX = animValue.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

  return (
    <Animated.View style={[styles.stopRow, { opacity, transform: [{ translateX }] }]}>
      {/* Timeline spine */}
      <View style={styles.spineCol}>
        <View style={[
          styles.dot,
          stop.isAnchor
            ? [styles.anchorDot, { borderColor: color, shadowColor: color }]
            : [styles.normalDot, { backgroundColor: color }],
        ]} />
        {/* Line below (not shown for last stop — handled by parent) */}
        <View style={[styles.spineLine, { backgroundColor: color + "40" }]} />
      </View>

      {/* Content */}
      <Pressable
        style={[
          styles.stopCard,
          stop.isAnchor && [styles.anchorCard, { borderColor: color + "80" }],
        ]}
        onPress={() => stop.url && Linking.openURL(stop.url)}
        disabled={!stop.url}
      >
        {stop.isAnchor && (
          <View style={[styles.anchorBadge, { backgroundColor: color }]}>
            <Text style={styles.anchorBadgeText}>⚓ YOUR ANCHOR</Text>
          </View>
        )}

        <View style={styles.stopHeader}>
          <Text style={[styles.stopTime, { color }]}>{stop.time}</Text>
          <Text style={styles.stopEmoji}>{stop.emoji}</Text>
        </View>

        <Text style={styles.stopTitle}>{stop.title}</Text>
        <Text style={styles.stopVenue}>{stop.venue}{stop.neighborhood ? ` · ${stop.neighborhood}` : ""}</Text>
        <Text style={styles.stopDesc}>{stop.description}</Text>

        {stop.travelNote && (
          <View style={styles.travelNote}>
            <Text style={styles.travelNoteText}>→ {stop.travelNote}</Text>
          </View>
        )}

        {stop.url && (
          <Text style={[styles.openLink, { color }]}>Open →</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const { anchor, clear } = usePlanStore();
  const [plan, setPlan] = useState<NightPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-stop animation values
  const stopAnims = useRef<Animated.Value[]>([]).current;

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!anchor) return;
    setLoading(true);

    Animated.timing(headerAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();

    getContext(anchor)
      .then((ctx) => buildNightPlan(anchor, ctx))
      .then((p) => {
        setPlan(p);
        // Pre-create anim values
        p.stops.forEach((_, i) => {
          stopAnims[i] = new Animated.Value(0);
        });
        // Stagger in
        Animated.stagger(
          100,
          p.stops.map((_, i) =>
            Animated.timing(stopAnims[i], {
              toValue: 1, duration: 400, useNativeDriver: true,
              easing: Easing.out(Easing.cubic),
            })
          )
        ).start();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const accentColor = CATEGORY_COLORS[anchor?.category ?? "other"] ?? "#FF8C42";

  if (!anchor) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No event selected.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Ambient glow */}
      <View style={[styles.blob, { backgroundColor: accentColor }]} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          },
        ]}>
          <Pressable onPress={() => { clear(); router.back(); }} style={styles.backLink}>
            <Text style={styles.backLinkText}>← Back</Text>
          </Pressable>
          <Text style={[styles.eyebrow, { color: accentColor }]}>TONIGHT'S PLAN</Text>
          <Text style={styles.heading}>Built around{"\n"}{anchor.emoji} {anchor.title}</Text>
        </Animated.View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={styles.loadingText}>Planning your evening…</Text>
            <Text style={styles.loadingSubtext}>Thinking about what flows best tonight</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Plan */}
        {plan && (
          <View style={styles.planBody}>
            {/* Narrative */}
            <View style={[styles.narrativeBox, { borderLeftColor: accentColor }]}>
              <Text style={styles.narrativeText}>{plan.narrative}</Text>
            </View>

            {/* Timeline */}
            <View style={styles.timeline}>
              {plan.stops.map((stop, i) => (
                <View key={i} style={i === plan.stops.length - 1 ? styles.lastStop : undefined}>
                  <StopCard
                    stop={stop}
                    index={i}
                    color={stop.isAnchor ? accentColor : CATEGORY_COLORS[stop.emoji === "🍽️" ? "food" : stop.emoji === "🍸" ? "bar" : "other"] ?? "#666680"}
                    animValue={stopAnims[i] ?? new Animated.Value(1)}
                  />
                </View>
              ))}
            </View>

            {/* Footer */}
            <Pressable onPress={() => { clear(); router.back(); }} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Looks good — I'm out the door</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0e0e16" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0e0e16" },

  blob: {
    position: "absolute", width: 320, height: 320,
    borderRadius: 160, top: -100, right: -100, opacity: 0.07,
  },

  scroll: { paddingBottom: 60 },

  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  backLink: { marginBottom: 16 },
  backLinkText: { fontSize: 13, color: "#444455" },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 3, marginBottom: 8 },
  heading: { fontSize: 30, fontWeight: "900", color: "#fff", letterSpacing: -0.8, lineHeight: 36 },

  loadingBox: { alignItems: "center", paddingVertical: 60 },
  loadingText: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 16 },
  loadingSubtext: { color: "#555570", fontSize: 13, marginTop: 4 },

  errorBox: { margin: 24 },
  errorText: { color: "#ff6b6b", fontSize: 14, textAlign: "center" },

  planBody: { paddingHorizontal: 20 },

  narrativeBox: {
    borderLeftWidth: 3, paddingLeft: 14,
    marginBottom: 32, marginTop: 4,
  },
  narrativeText: { color: "#aaa", fontSize: 15, lineHeight: 22, fontStyle: "italic" },

  timeline: {},
  lastStop: { marginBottom: 0 },

  // Stop row
  stopRow: { flexDirection: "row", marginBottom: 0 },

  spineCol: { width: 36, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 20, zIndex: 1 },
  normalDot: {},
  anchorDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "transparent",
    borderWidth: 3,
    shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
    marginTop: 18,
  },
  spineLine: { flex: 1, width: 2, marginTop: 2 },

  stopCard: {
    flex: 1,
    backgroundColor: "#16161f",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#222235",
  },
  anchorCard: {
    backgroundColor: "#1a1a28",
    borderWidth: 1,
  },

  anchorBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginBottom: 10,
  },
  anchorBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, color: "#fff" },

  stopHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  stopTime: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  stopEmoji: { fontSize: 18 },

  stopTitle: { fontSize: 17, fontWeight: "800", color: "#fff", marginBottom: 2 },
  stopVenue: { fontSize: 12, color: "#666680", marginBottom: 6 },
  stopDesc: { fontSize: 13, color: "#888", lineHeight: 18 },

  travelNote: {
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: "#222235",
  },
  travelNoteText: { fontSize: 11, color: "#555570" },
  openLink: { fontSize: 12, fontWeight: "600", marginTop: 8 },

  backBtn: { marginTop: 16, padding: 12 },
  backBtnText: { color: "#FF8C42", fontSize: 14, fontWeight: "600" },

  doneBtn: {
    marginTop: 24,
    backgroundColor: "#FF8C42",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 8,
  },
  doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
