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
import { useSavedStore } from "../src/state/useSavedStore";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Turn "2026-03-29" or "Tonight" into a display-friendly label */
function friendlyDate(raw?: string): string {
  if (!raw) return "";
  // Already a human label (Tonight, Tomorrow, Sat, Mar 29…)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((date.getTime() - todayMid.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ─── Category helpers ─────────────────────────────────────────────────────────

const PLACE_EMOJI: Record<string, string> = {
  restaurant: "🍽️", bar: "🍸", cafe: "☕",
  park: "🌿", museum: "🏛️", entertainment: "🎭",
  shopping: "🛍️", default: "📍",
};

const EVENT_EMOJI: Record<string, string> = {
  music: "🎵", sports: "🏟️", arts: "🎭",
  comedy: "😂", other: "🎟️",
};

const LOCAL_EMOJI: Record<string, string> = {
  music: "🎵", film: "🎬", arts: "🎭", food: "🍽️",
  comedy: "😂", sports: "🏆", outdoor: "🌿",
  community: "🏙️", other: "📅",
};

// ─── Weather Bar ──────────────────────────────────────────────────────────────

function WeatherBar({ ctx }: { ctx: SuggestionSet["context"] }) {
  const { weather, time } = ctx;
  return (
    <View style={styles.weatherBar}>
      <Text style={styles.weatherLeft}>
        <Text style={styles.weatherIcon}>{weather.icon}</Text>
        {"  "}
        <Text style={styles.weatherTemp}>{weather.temp}°</Text>
        {"  "}
        <Text style={styles.weatherDesc}>{weather.description}</Text>
      </Text>
      <Text style={styles.weatherRight}>🌅 {weather.sunsetTime} · {time.label}</Text>
    </View>
  );
}

// ─── Save Button ──────────────────────────────────────────────────────────────

function SaveButton({
  id, payload,
}: {
  id: string;
  payload: Parameters<ReturnType<typeof useSavedStore>["toggle"]>[0];
}) {
  const { isSaved, toggle } = useSavedStore();
  const saved = isSaved(id);
  return (
    <Pressable
      style={styles.saveBtn}
      onPress={() => toggle(payload)}
      hitSlop={8}
    >
      <Text style={styles.saveBtnIcon}>{saved ? "❤️" : "🤍"}</Text>
    </Pressable>
  );
}

// ─── Place Card ───────────────────────────────────────────────────────────────

function PlaceCard({ result }: { result: Extract<AnyResult, { type: "place" }> }) {
  const { place: p, contextTags } = result;
  const photoUri = p.photoUrl ?? (p.photoRef ? getPhotoUrl(p.photoRef) : null);
  const openUrl = p.url ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.place_id}`;
  const emoji = PLACE_EMOJI["default"];

  return (
    <Pressable style={styles.card} onPress={() => Linking.openURL(openUrl)}>
      {/* Image with overlay */}
      <View style={styles.cardImageBox}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={{ fontSize: 40 }}>{emoji}</Text>
          </View>
        )}
        <View style={styles.cardImageOverlay} />
        {/* Badge top-left */}
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>📍 PLACE</Text>
        </View>
        {/* Save top-right */}
        <SaveButton
          id={p.place_id}
          payload={{
            id: p.place_id,
            type: "place",
            title: p.name,
            subtitle: p.vicinity,
            category: "place",
            emoji: "📍",
            image: photoUri ?? undefined,
            url: openUrl,
            savedAt: new Date().toISOString(),
          }}
        />
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{p.name}</Text>
          <View style={styles.cardRatingRow}>
            {p.price && <Text style={styles.cardPrice}>{p.price}</Text>}
            {p.rating != null && (
              <Text style={styles.cardRating}>★ {p.rating}</Text>
            )}
          </View>
        </View>
        <Text style={styles.cardSubtitle} numberOfLines={1}>{p.vicinity}</Text>
        {p.reviewCount ? (
          <Text style={styles.cardMeta}>{p.reviewCount} reviews</Text>
        ) : null}
        {contextTags.length > 0 && (
          <Text style={styles.cardTags}>{contextTags.join(" · ")}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ result }: { result: Extract<AnyResult, { type: "event" }> }) {
  const { event: e, contextTags } = result;
  const emoji = EVENT_EMOJI[e.type] ?? "🎟️";
  const typeLabel = e.type.charAt(0).toUpperCase() + e.type.slice(1);

  return (
    <Pressable style={styles.card} onPress={() => Linking.openURL(e.url)}>
      <View style={styles.cardImageBox}>
        {e.image ? (
          <Image source={{ uri: e.image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={{ fontSize: 40 }}>{emoji}</Text>
          </View>
        )}
        <View style={styles.cardImageOverlay} />
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{emoji} {typeLabel.toUpperCase()}</Text>
        </View>
        <SaveButton
          id={`tm-${e.id}`}
          payload={{
            id: `tm-${e.id}`,
            type: "event",
            title: e.name,
            subtitle: e.venue,
            category: e.type,
            emoji,
            image: e.image,
            url: e.url,
            savedAt: new Date().toISOString(),
          }}
        />
        {/* Date overlay on image */}
        {e.date && (
          <View style={styles.cardDateOverlay}>
            <Text style={styles.cardDateText}>{friendlyDate(e.date)}{e.time && e.time !== "TBD" ? ` · ${e.time}` : ""}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{e.name}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>{e.venue}</Text>
        {e.address ? <Text style={styles.cardMeta}>{e.address}</Text> : null}
        <View style={styles.cardMetaRow}>
          {e.minPrice != null && (
            <View style={styles.pricePill}>
              <Text style={styles.pricePillText}>From ${Math.round(e.minPrice)}</Text>
            </View>
          )}
          {contextTags.length > 0 && (
            <Text style={styles.cardTags}>{contextTags.join(" · ")}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Movie Card ───────────────────────────────────────────────────────────────

function MovieCard({ result }: { result: Extract<AnyResult, { type: "movie" }> }) {
  const { showtime: m, contextTags } = result;

  const inner = (
    <>
      <View style={styles.cardImageBox}>
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 40 }}>🎬</Text>
        </View>
        <View style={styles.cardImageOverlay} />
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>🎬 MOVIE</Text>
        </View>
        <SaveButton
          id={`movie-${m.movieTitle}-${m.theater}`}
          payload={{
            id: `movie-${m.movieTitle}-${m.theater}`,
            type: "movie",
            title: m.movieTitle,
            subtitle: m.theater,
            category: "film",
            emoji: "🎬",
            url: m.ticketUrl,
            savedAt: new Date().toISOString(),
          }}
        />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{m.movieTitle}</Text>
        <Text style={styles.cardSubtitle}>{m.theater}</Text>
        <Text style={styles.cardMeta}>
          {[m.rating, m.runtime, m.genre].filter(Boolean).join(" · ")}
        </Text>
        <View style={styles.timesRow}>
          {m.times.map((t) => (
            <View key={t} style={styles.timeChip}>
              <Text style={styles.timeChipText}>{t}</Text>
            </View>
          ))}
        </View>
        {contextTags.length > 0 && (
          <Text style={styles.cardTags}>{contextTags.join(" · ")}</Text>
        )}
      </View>
    </>
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

function LocalEventCard({ result }: { result: LocalEventResult }) {
  const { localEvent: e, contextTags } = result;
  const emoji = LOCAL_EMOJI[e.category] ?? "📅";
  const label = e.category.charAt(0).toUpperCase() + e.category.slice(1);

  const inner = (
    <>
      <View style={styles.cardImageBox}>
        {e.image ? (
          <Image source={{ uri: e.image }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Text style={{ fontSize: 40 }}>{emoji}</Text>
          </View>
        )}
        <View style={styles.cardImageOverlay} />
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{emoji} {label.toUpperCase()}</Text>
        </View>
        <SaveButton
          id={e.id}
          payload={{
            id: e.id,
            type: "localEvent",
            title: e.title,
            subtitle: e.venue,
            category: e.category,
            emoji,
            image: e.image,
            url: e.url,
            savedAt: new Date().toISOString(),
          }}
        />
        {(e.date || e.time) && (
          <View style={styles.cardDateOverlay}>
            <Text style={styles.cardDateText}>
              {[friendlyDate(e.date), e.time].filter(Boolean).join(" · ")}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{e.title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>{e.venue}</Text>
        {e.address ? <Text style={styles.cardMeta}>{e.address}</Text> : null}
        <View style={styles.cardMetaRow}>
          {e.price ? (
            <View style={styles.pricePill}>
              <Text style={styles.pricePillText}>{e.price}</Text>
            </View>
          ) : null}
          {contextTags.length > 0 && (
            <Text style={styles.cardTags}>{contextTags.join(" · ")}</Text>
          )}
        </View>
      </View>
    </>
  );

  if (e.url) {
    return (
      <Pressable style={styles.card} onPress={() => e.url && Linking.openURL(e.url)}>
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.card}>{inner}</View>;
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
        <Text style={styles.errorEmoji}>😬</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={handleStartOver} style={styles.startOverBtn}>
          <Text style={styles.startOverBtnText}>Try again</Text>
        </Pressable>
      </View>
    );

  if (!data)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF8C42" />
        <Text style={styles.loadingText}>Finding the right spots…</Text>
        <Text style={styles.loadingSubtext}>Checking events, weather & places nearby</Text>
      </View>
    );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <Pressable onPress={handleStartOver} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Here's what's out there</Text>
        </View>

        <WeatherBar ctx={data.context} />

        {data.results.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🌆</Text>
            <Text style={styles.emptyText}>
              Nothing found nearby. Try expanding your distance or changing your mood.
            </Text>
          </View>
        )}

        {data.results.map((result, i) => {
          if (result.type === "place") return <PlaceCard key={i} result={result} />;
          if (result.type === "event") return <EventCard key={i} result={result} />;
          if (result.type === "movie") return <MovieCard key={i} result={result} />;
          if (result.type === "localEvent") return <LocalEventCard key={i} result={result} />;
          return null;
        })}

        <Pressable onPress={handleStartOver} style={styles.startOverBtn}>
          <Text style={styles.startOverBtnText}>Start over</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111118" },
  scroll: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 60 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#111118" },

  // Header
  pageHeader: { marginBottom: 16 },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: "#FF8C42", fontSize: 14, fontWeight: "600" },
  pageTitle: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },

  // Weather bar
  weatherBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a26",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  weatherLeft: { flex: 1 },
  weatherIcon: { fontSize: 16 },
  weatherTemp: { fontSize: 16, fontWeight: "700", color: "#fff" },
  weatherDesc: { fontSize: 13, color: "#888" },
  weatherRight: { fontSize: 11, color: "#555570" },

  // Card
  card: {
    backgroundColor: "#1a1a26",
    borderRadius: 18,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#222235",
  },

  cardImageBox: {
    height: 180,
    backgroundColor: "#222235",
    position: "relative",
  },
  cardImage: { width: "100%", height: "100%" },
  cardImagePlaceholder: {
    alignItems: "center", justifyContent: "center",
  },
  cardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  cardBadge: {
    position: "absolute", top: 12, left: 12,
    backgroundColor: "rgba(255,140,66,0.9)",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  cardBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#fff" },
  cardDateOverlay: {
    position: "absolute", bottom: 10, left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  cardDateText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "500" },

  // Save button
  saveBtn: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 18, width: 34, height: 34,
    alignItems: "center", justifyContent: "center",
  },
  saveBtnIcon: { fontSize: 16 },

  // Card body
  cardBody: { padding: 16 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#fff", flex: 1, marginRight: 8 },
  cardSubtitle: { fontSize: 13, color: "#666680", marginBottom: 2 },
  cardMeta: { fontSize: 12, color: "#444455", marginBottom: 4 },
  cardRatingRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  cardRating: { fontSize: 13, color: "#FF8C42", fontWeight: "600" },
  cardPrice: { fontSize: 13, color: "#888" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  cardTags: { fontSize: 12, color: "#FF8C42", marginTop: 6 },

  pricePill: {
    backgroundColor: "#222235",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  pricePillText: { fontSize: 11, color: "#FF8C42", fontWeight: "600" },

  timesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  timeChip: {
    backgroundColor: "#222235",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  timeChipText: { fontSize: 12, color: "#FF8C42", fontWeight: "500" },

  // Loading / error
  loadingText: { marginTop: 16, color: "#fff", fontSize: 16, fontWeight: "600" },
  loadingSubtext: { marginTop: 4, color: "#555570", fontSize: 13 },
  errorEmoji: { fontSize: 40, marginBottom: 12 },
  errorText: { fontSize: 15, color: "#aaa", textAlign: "center", marginBottom: 20 },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: "#555570", textAlign: "center", fontSize: 14, lineHeight: 20 },

  startOverBtn: {
    marginTop: 12,
    backgroundColor: "#1a1a26",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  startOverBtnText: { color: "#888", fontSize: 14, fontWeight: "600" },
});
