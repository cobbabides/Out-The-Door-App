import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import { getNearbyEvents } from "../../src/api/ticketmaster";
import { getCurrentWeather } from "../../src/api/openWeather";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIPick {
  title: string;
  venue: string;
  category: string;
  emoji: string;
  reason: string;
  when: string;
  price?: string;
  url?: string;
}

interface AIResponse {
  intro: string;
  picks: AIPick[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LAT = 39.9612;
const DEFAULT_LON = -82.9988;

const VIBES = [
  { label: "chill night out", emoji: "🌙" },
  { label: "something adventurous", emoji: "🏃" },
  { label: "live music", emoji: "🎵" },
  { label: "artsy & creative", emoji: "🎨" },
  { label: "date night", emoji: "💕" },
  { label: "family-friendly", emoji: "👨‍👩‍👧" },
];

// ─── API Call ─────────────────────────────────────────────────────────────────

async function askClaude(vibe: string, contextSummary: string): Promise<AIResponse> {
  const key = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!key) throw new Error("Missing Anthropic API key");

  const systemPrompt = `You are a local activity recommender for Columbus, Ohio. Based on current real-world conditions and the user's described vibe, suggest 3-5 specific activities, venues, or events to do right now or tonight.

Current conditions:
${contextSummary}

Rules:
- Prioritize real upcoming events from the list above when they match the vibe
- If suggesting a place/venue not in the event list, make sure it's real and in Columbus, OH
- Be specific — use real venue names, real neighborhoods, actual times when known
- Keep reasons short and punchy (1 sentence, conversational)

Respond with ONLY valid JSON, no markdown:
{
  "intro": "A 1-2 sentence response that matches their energy",
  "picks": [
    {
      "title": "Event or place name",
      "venue": "Venue name",
      "category": "music|food|outdoor|film|arts|comedy|bar|other",
      "emoji": "single relevant emoji",
      "reason": "Why this fits their vibe",
      "when": "Tonight at 8pm / Open now / This weekend / etc",
      "price": "Free / $15 / $$ / null if unknown",
      "url": "https://... or null"
    }
  ]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
      messages: [
        {
          role: "user",
          content: `My vibe: ${vibe}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";

  // Strip markdown code blocks if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as AIResponse;
}

async function buildContext(): Promise<string> {
  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      lat = loc.coords.latitude;
      lon = loc.coords.longitude;
    }
  } catch {
    // use defaults
  }

  const now = new Date();
  const dayLabel = now.toLocaleDateString([], { weekday: "long" });
  const hour = now.getHours();
  const partOfDay = hour < 11 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "late night";
  const timeLabel = `${dayLabel} ${partOfDay}, ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  let weatherLine = "Weather: unknown";
  let eventLines = "No upcoming events found.";

  try {
    const weather = await getCurrentWeather(lat, lon);
    weatherLine = `Weather: ${weather.temp}°F, ${weather.description}, sunset at ${weather.sunsetTime}`;
  } catch {
    // ignore
  }

  try {
    const events = await getNearbyEvents(lat, lon, 30, 20);
    if (events.length > 0) {
      eventLines =
        "Upcoming events nearby:\n" +
        events
          .slice(0, 15)
          .map((e) => `- ${e.name} at ${e.venue} (${e.date}${e.time && e.time !== "TBD" ? ` at ${e.time}` : ""}${e.minPrice != null ? `, from $${Math.round(e.minPrice)}` : ""}) — ${e.url}`)
          .join("\n");
    }
  } catch {
    // ignore
  }

  return `Time: ${timeLabel}\n${weatherLine}\n\n${eventLines}`;
}

// ─── Pick Card ────────────────────────────────────────────────────────────────

function PickCard({ pick }: { pick: AIPick }) {
  return (
    <Pressable
      style={styles.pickCard}
      onPress={() => pick.url && Linking.openURL(pick.url)}
      disabled={!pick.url}
    >
      <View style={styles.pickHeader}>
        <Text style={styles.pickEmoji}>{pick.emoji}</Text>
        <View style={styles.pickHeaderText}>
          <Text style={styles.pickCategory}>{pick.category.toUpperCase()}</Text>
          <Text style={styles.pickTitle} numberOfLines={2}>{pick.title}</Text>
        </View>
        {pick.price ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>{pick.price}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.pickVenue} numberOfLines={1}>{pick.venue}</Text>
      <Text style={styles.pickWhen}>{pick.when}</Text>
      <Text style={styles.pickReason}>{pick.reason}</Text>
      {pick.url ? (
        <Text style={styles.pickLink}>Tap to open →</Text>
      ) : null}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AskScreen() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (vibe: string) => {
    const trimmed = vibe.trim();
    if (!trimmed) return;
    setInput(trimmed);
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const ctx = await buildContext();
      const res = await askClaude(trimmed, ctx);
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setInput("");
    setResult(null);
    setError(null);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>POWERED BY CLAUDE AI</Text>
          <Text style={styles.heading}>What's your vibe?</Text>
          <Text style={styles.subheading}>
            Describe how you're feeling and I'll find the perfect thing to do.
          </Text>
        </View>

        {/* Vibe chips */}
        {!result && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vibeChips}
          >
            {VIBES.map((v) => (
              <Pressable
                key={v.label}
                style={[styles.vibeChip, input === v.label && styles.vibeChipActive]}
                onPress={() => setInput(v.label)}
              >
                <Text style={[styles.vibeChipText, input === v.label && styles.vibeChipTextActive]}>
                  {v.emoji} {v.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        {!result && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="I'm feeling..."
              placeholderTextColor="#444455"
              multiline
              maxLength={200}
              returnKeyType="done"
            />
          </View>
        )}

        {/* Submit */}
        {!result && !loading && (
          <Pressable
            style={[styles.submitBtn, !input.trim() && styles.submitBtnDisabled]}
            onPress={() => submit(input)}
            disabled={!input.trim()}
          >
            <Text style={styles.submitText}>✨ Find something</Text>
          </Pressable>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FF8C42" />
            <Text style={styles.loadingText}>Thinking about it…</Text>
            <Text style={styles.loadingSubtext}>Checking what's happening nearby</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <Pressable onPress={reset} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {/* Results */}
        {result && (
          <View style={styles.results}>
            <View style={styles.introBox}>
              <Text style={styles.introText}>{result.intro}</Text>
            </View>
            {result.picks.map((pick, i) => (
              <PickCard key={i} pick={pick} />
            ))}
            <Pressable onPress={reset} style={styles.resetBtn}>
              <Text style={styles.resetText}>Ask something else</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111118" },
  scroll: { paddingBottom: 48 },

  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 3, color: "#FF8C42", marginBottom: 6 },
  heading: { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  subheading: { fontSize: 14, color: "#555570", marginTop: 6, lineHeight: 20 },

  vibeChips: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  vibeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 100, borderWidth: 1,
    borderColor: "#2a2a3a", backgroundColor: "#1a1a26",
  },
  vibeChipActive: { backgroundColor: "#FF8C42", borderColor: "#FF8C42" },
  vibeChipText: { fontSize: 13, color: "#888", fontWeight: "600" },
  vibeChipTextActive: { color: "#fff" },

  inputRow: { marginHorizontal: 20, marginBottom: 16 },
  input: {
    backgroundColor: "#1a1a26",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2a2a3a",
    color: "#fff",
    fontSize: 16,
    padding: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },

  submitBtn: {
    marginHorizontal: 20,
    backgroundColor: "#FF8C42",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 32,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 16, fontWeight: "700", color: "#fff" },

  loadingBox: { alignItems: "center", paddingVertical: 60 },
  loadingText: { color: "#fff", fontSize: 16, fontWeight: "600", marginTop: 16 },
  loadingSubtext: { color: "#555570", fontSize: 13, marginTop: 4 },

  errorBox: { margin: 20, alignItems: "center" },
  errorText: { color: "#ff6b6b", fontSize: 14, textAlign: "center", marginBottom: 16 },
  retryBtn: {
    backgroundColor: "#1a1a26",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  retryText: { color: "#FF8C42", fontWeight: "600", fontSize: 14 },

  results: { paddingHorizontal: 20 },

  introBox: {
    backgroundColor: "#1a1a26",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: "#FF8C42",
  },
  introText: { color: "#ddd", fontSize: 15, lineHeight: 22 },

  pickCard: {
    backgroundColor: "#1a1a26",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  pickHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  pickEmoji: { fontSize: 28, marginRight: 12, lineHeight: 36 },
  pickHeaderText: { flex: 1 },
  pickCategory: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, color: "#FF8C42", marginBottom: 2 },
  pickTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  priceBadge: {
    backgroundColor: "#222235",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  priceText: { fontSize: 11, color: "#FF8C42", fontWeight: "600" },
  pickVenue: { fontSize: 13, color: "#666680", marginBottom: 2 },
  pickWhen: { fontSize: 12, color: "#555570", marginBottom: 8 },
  pickReason: { fontSize: 13, color: "#aaa", lineHeight: 18, fontStyle: "italic" },
  pickLink: { fontSize: 12, color: "#FF8C42", marginTop: 8, fontWeight: "600" },

  resetBtn: { alignItems: "center", paddingVertical: 20, marginTop: 8 },
  resetText: { color: "#555570", fontSize: 14 },
});
