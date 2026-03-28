import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Image,
  Linking,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { getSuggestions, SuggestionSet, AnyResult, LocalEventResult } from "../src/utils/getSuggestions";
import { getPhotoUrl } from "../src/api/places";
import { useStore } from "../src/state/useStore";

// ─── Weather Bar ──────────────────────────────────────────────────────────────

function WeatherBar({ ctx }: { ctx: SuggestionSet["context"] }) {
  const { weather, time } = ctx;
  return (
    <View style={styles.weatherBar}>
      <Text style={styles.weatherText}>
        {weather.icon} {weather.temp}°F · {weather.description} · 🌅 {weather.sunsetTime}
      </Text>
      <Text style={styles.timeText}>{time.label}</Text>
    </View>
  );
}

// ─── Place Card ───────────────────────────────────────────────────────────────

function PlaceCard({ result }: { result: Extract<AnyResult, { type: "place" }> }) {
  const { place: p, contextTags } = result;
  const photoUri = p.photoUrl ?? (p.photoRef ? getPhotoUrl(p.photoRef) : null);
  const openUrl = p.url ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.place_id}`;

  return (
    <Pressable style={styles.card} onPress={() => Linking.openURL(openUrl)}>
      {photoUri && (
        <Image source={{ uri: photoUri }} style={styles.cardImage} />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTypeRow}>
          <Text style={styles.cardTypeLabel}>📍 Place</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {p.price && <Text style={styles.ratingText}>{p.price}</Text>}
            {p.rating != null && (
              <Text style={styles.ratingText}>
                ★ {p.rating}{p.reviewCount ? ` (${p.reviewCount})` : ""}
              </Text>
            )}
          </View>
        </View>
        <Text style={styles.cardTitle}>{p.name}</Text>
        <Text style={styles.cardSubtitle}>{p.vicinity}</Text>
        {contextTags.length > 0 && (
          <Text style={styles.badgeText}>{contextTags.join(" · ")}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ result }: { result: Extract<AnyResult, { type: "event" }> }) {
  const { event: e, contextTags } = result;
  const typeEmoji: Record<string, string> = {
    music: "🎵",
    sports: "🏟️",
    arts: "🎭",
    comedy: "😂",
    other: "🎟️",
  };
  return (
    <Pressable style={styles.card} onPress={() => Linking.openURL(e.url)}>
      {e.image && (
        <Image source={{ uri: e.image }} style={styles.cardImage} />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTypeLabel}>
          {typeEmoji[e.type] ?? "🎟️"} {e.type.charAt(0).toUpperCase() + e.type.slice(1)}
        </Text>
        <Text style={styles.cardTitle}>{e.name}</Text>
        <Text style={styles.cardSubtitle}>{e.venue}</Text>
        {contextTags.length > 0 && (
          <Text style={styles.badgeText}>{contextTags.join(" · ")}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Movie Card ───────────────────────────────────────────────────────────────

function MovieCard({ result }: { result: Extract<AnyResult, { type: "movie" }> }) {
  const { showtime: m, contextTags } = result;
  const inner = (
    <View style={styles.cardBody}>
      <Text style={styles.cardTypeLabel}>🎬 Movie</Text>
      <Text style={styles.cardTitle}>{m.movieTitle}</Text>
      <Text style={styles.cardSubtitle}>
        {[m.rating, m.runtime, m.genre].filter(Boolean).join(" · ")}
      </Text>
      <Text style={styles.cardSubtitle}>{m.theater}</Text>
      {m.address && <Text style={styles.cardSubtitle}>{m.address}</Text>}
      <View style={styles.timesRow}>
        {m.times.map((t) => (
          <View key={t} style={styles.timeChip}>
            <Text style={styles.timeChipText}>{t}</Text>
          </View>
        ))}
      </View>
      {contextTags.length > 0 && (
        <Text style={styles.badgeText}>{contextTags.join(" · ")}</Text>
      )}
    </View>
  );

  if (m.ticketUrl) {
    return (
      <Pressable style={styles.card} onPress={() => m.ticketUrl && Linking.openURL(m.ticketUrl)}>
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.card}>{inner}</View>;
}

// ─── Local Event Card ─────────────────────────────────────────────────────────

const LOCAL_CATEGORY_EMOJI: Record<string, string> = {
  music: "🎵",
  film: "🎬",
  arts: "🎭",
  food: "🍽️",
  comedy: "😂",
  sports: "🏆",
  outdoor: "🌿",
  community: "🏙️",
  other: "📅",
};

function LocalEventCard({ result }: { result: LocalEventResult }) {
  const { localEvent: e, contextTags } = result;
  const emoji = LOCAL_CATEGORY_EMOJI[e.category] ?? "📅";
  const label = e.category.charAt(0).toUpperCase() + e.category.slice(1);

  const card = (
    <View style={styles.cardBody}>
      <Text style={styles.cardTypeLabel}>
        {emoji} {label}
      </Text>
      <Text style={styles.cardTitle}>{e.title}</Text>
      <Text style={styles.cardSubtitle}>{e.venue}</Text>
      {e.address && <Text style={styles.cardSubtitle}>{e.address}</Text>}
      {contextTags.length > 0 && (
        <Text style={styles.badgeText}>{contextTags.join(" · ")}</Text>
      )}
    </View>
  );

  if (e.url) {
    return (
      <Pressable style={styles.card} onPress={() => e.url && Linking.openURL(e.url)}>
        {e.image && <Image source={{ uri: e.image }} style={styles.cardImage} />}
        {card}
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      {e.image && <Image source={{ uri: e.image }} style={styles.cardImage} />}
      {card}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Results() {
  const [data, setData] = useState<SuggestionSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { reset, setContext } = useStore();

  useEffect(() => {
    getSuggestions()
      .then((set) => {
        setContext(set.context);
        setData(set);
      })
      .catch((e) => setError(e.message));
  }, []);

  function handleStartOver() {
    reset();
    router.replace("/");
  }

  if (error)
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={handleStartOver} style={{ marginTop: 16 }}>
          <Text style={styles.linkText}>Try again</Text>
        </Pressable>
      </View>
    );

  if (!data)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFB56B" />
        <Text style={styles.loadingText}>Finding the right spots…</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <WeatherBar ctx={data.context} />

      {data.results.length === 0 && (
        <Text style={styles.emptyText}>
          Nothing found nearby. Try expanding your distance.
        </Text>
      )}

      {data.results.map((result, i) => {
        if (result.type === "place") return <PlaceCard key={i} result={result} />;
        if (result.type === "event") return <EventCard key={i} result={result} />;
        if (result.type === "movie") return <MovieCard key={i} result={result} />;
        if (result.type === "localEvent") return <LocalEventCard key={i} result={result} />;
        return null;
      })}

      <Pressable onPress={handleStartOver} style={styles.startOver}>
        <Text style={styles.startOverText}>Start over</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 48 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  weatherBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  weatherText: { fontSize: 12, color: "#555" },
  timeText: { fontSize: 12, color: "#999" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardImage: { width: "100%", height: 180 },
  cardBody: { padding: 14 },
  cardTypeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cardTypeLabel: { fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 },
  cardTitle: { fontSize: 20, fontWeight: "600", color: "#1a1a1a", marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: "#777", marginBottom: 2 },
  badgeText: { fontSize: 12, color: "#FFB56B", marginTop: 6 },
  ratingText: { fontSize: 13, color: "#FFB56B" },

  timesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  timeChip: {
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeChipText: { fontSize: 12, color: "#E87E04", fontWeight: "500" },

  loadingText: { marginTop: 12, color: "#999", fontSize: 14 },
  errorText: { fontSize: 15, color: "#c00", textAlign: "center" },
  linkText: { color: "#FFB56B", fontSize: 15 },
  emptyText: { color: "#aaa", textAlign: "center", marginBottom: 24 },

  startOver: { marginTop: 8, alignItems: "center" },
  startOverText: { color: "#bbb", fontSize: 13 },
});
