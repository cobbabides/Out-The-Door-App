import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { getNearbyEvents, Event as TMEvent } from "../../src/api/ticketmaster";
import { scrapeAllLocalEvents, LocalEvent } from "../../src/api/scrapers";
import { scrapeAllTheaters, TheaterShowtime } from "../../src/api/scrapers/theaters";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "all" | "music" | "arts" | "comedy" | "sports" | "film" | "outdoor" | "other";

interface UnifiedEvent {
  id: string;
  title: string;
  venue: string;
  address?: string;
  date: string;
  time?: string;
  category: Category;
  image?: string;
  url?: string;
  price?: string;
  source: string;
}

// ─── Converters ───────────────────────────────────────────────────────────────

function fromTicketmaster(e: TMEvent): UnifiedEvent {
  const cat: Category =
    e.type === "music" ? "music"
    : e.type === "sports" ? "sports"
    : e.type === "arts" ? "arts"
    : e.type === "comedy" ? "comedy"
    : "other";

  return {
    id: `tm-${e.id}`,
    title: e.name,
    venue: e.venue,
    address: e.address,
    date: e.date,
    time: e.time,
    category: cat,
    image: e.image,
    url: e.url,
    price: e.minPrice != null ? `From $${Math.round(e.minPrice)}` : undefined,
    source: "Ticketmaster",
  };
}

function fromLocal(e: LocalEvent): UnifiedEvent {
  const catMap: Record<string, Category> = {
    music: "music", film: "film", arts: "arts",
    comedy: "comedy", sports: "sports", outdoor: "outdoor",
    food: "other", community: "other", other: "other",
  };
  return {
    id: e.id,
    title: e.title,
    venue: e.venue,
    address: e.address,
    date: e.date,
    time: e.time,
    category: catMap[e.category] ?? "other",
    image: e.image,
    url: e.url,
    price: e.price,
    source: e.source,
  };
}

function fromTheater(s: TheaterShowtime): UnifiedEvent {
  return {
    id: s.id,
    title: s.title,
    venue: s.venue,
    address: s.address,
    date: s.date,
    time: s.time,
    category: "film",
    image: s.posterUrl,
    url: s.checkoutUrl ?? s.url,
    price: undefined,
    source: s.source,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: "all",     label: "All",     emoji: "✨" },
  { key: "music",   label: "Music",   emoji: "🎵" },
  { key: "arts",    label: "Arts",    emoji: "🎭" },
  { key: "comedy",  label: "Comedy",  emoji: "😂" },
  { key: "sports",  label: "Sports",  emoji: "🏆" },
  { key: "film",    label: "Film",    emoji: "🎬" },
  { key: "outdoor", label: "Outdoor", emoji: "🌿" },
  { key: "other",   label: "Other",   emoji: "📅" },
];

// Columbus, OH approximate center
const DEFAULT_LAT = 39.9612;
const DEFAULT_LON = -82.9988;
const RADIUS_MI = 30;

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: UnifiedEvent }) {
  const catInfo = CATEGORIES.find((c) => c.key === event.category) ?? CATEGORIES[0];

  const inner = (
    <View style={styles.row}>
      {event.image ? (
        <Image source={{ uri: event.image }} style={styles.rowImage} />
      ) : (
        <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
          <Text style={{ fontSize: 22 }}>{catInfo.emoji}</Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowCategory}>{catInfo.emoji} {catInfo.label.toUpperCase()}</Text>
        <Text style={styles.rowTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.rowVenue} numberOfLines={1}>{event.venue}</Text>
        <View style={styles.rowMeta}>
          {event.date ? <Text style={styles.rowMetaText}>{event.date}</Text> : null}
          {event.time ? <Text style={styles.rowMetaText}>· {event.time}</Text> : null}
          {event.price ? <Text style={styles.rowPrice}>{event.price}</Text> : null}
        </View>
      </View>
    </View>
  );

  if (event.url) {
    return (
      <Pressable onPress={() => Linking.openURL(event.url!)} style={styles.rowWrapper}>
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.rowWrapper}>{inner}</View>;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const load = useCallback(async () => {
    const [tmEvents, localEvents, theaterShowtimes] = await Promise.allSettled([
      getNearbyEvents(DEFAULT_LAT, DEFAULT_LON, RADIUS_MI, 50),
      scrapeAllLocalEvents(),
      scrapeAllTheaters(),
    ]);

    const unified: UnifiedEvent[] = [
      ...(tmEvents.status === "fulfilled" ? tmEvents.value.map(fromTicketmaster) : []),
      ...(localEvents.status === "fulfilled" ? localEvents.value.map(fromLocal) : []),
      ...(theaterShowtimes.status === "fulfilled" ? theaterShowtimes.value.map(fromTheater) : []),
    ];

    // Deduplicate by title + date
    const seen = new Set<string>();
    const deduped = unified.filter((e) => {
      const key = `${e.title.toLowerCase()}-${e.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date
    deduped.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    setEvents(deduped);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = activeCategory === "all"
    ? events
    : events.filter((e) => e.category === activeCategory);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>COLUMBUS & NEARBY</Text>
        <Text style={styles.heading}>What's On</Text>
        <Text style={styles.subheading}>Within {RADIUS_MI} miles · All upcoming events</Text>
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {CATEGORIES.map((cat) => {
          const count = cat.key === "all"
            ? events.length
            : events.filter((e) => e.category === cat.key).length;
          if (cat.key !== "all" && count === 0) return null;
          return (
            <Pressable
              key={cat.key}
              onPress={() => setActiveCategory(cat.key)}
              style={[styles.chip, activeCategory === cat.key && styles.chipActive]}
            >
              <Text style={[styles.chipText, activeCategory === cat.key && styles.chipTextActive]}>
                {cat.emoji} {cat.label}
                {count > 0 ? ` ${count}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF8C42" />
          <Text style={styles.loadingText}>Pulling in events…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No {activeCategory} events found nearby.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8C42" />
          }
        >
          {filtered.map((e) => <EventRow key={e.id} event={e} />)}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111118" },

  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 3, color: "#FF8C42", marginBottom: 6 },
  heading: { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  subheading: { fontSize: 13, color: "#555570", marginTop: 4 },

  chips: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1,
    borderColor: "#2a2a3a", backgroundColor: "#1a1a26",
  },
  chipActive: { backgroundColor: "#FF8C42", borderColor: "#FF8C42" },
  chipText: { fontSize: 13, color: "#888", fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  list: { paddingHorizontal: 20, paddingBottom: 32 },

  rowWrapper: { marginBottom: 12 },
  row: {
    flexDirection: "row", backgroundColor: "#1a1a26",
    borderRadius: 14, overflow: "hidden",
  },
  rowImage: { width: 90, height: 90 },
  rowImagePlaceholder: {
    backgroundColor: "#222235",
    alignItems: "center", justifyContent: "center",
  },
  rowBody: { flex: 1, padding: 12, justifyContent: "center" },
  rowCategory: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, color: "#FF8C42", marginBottom: 3 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 2 },
  rowVenue: { fontSize: 12, color: "#666680", marginBottom: 4 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowMetaText: { fontSize: 11, color: "#555570" },
  rowPrice: { fontSize: 11, color: "#FF8C42", fontWeight: "600" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { color: "#555570", marginTop: 12, fontSize: 14 },
  emptyText: { color: "#555570", fontSize: 15, textAlign: "center" },
});
