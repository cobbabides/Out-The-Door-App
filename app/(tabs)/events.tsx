import { useEffect, useState, useCallback, useMemo } from "react";
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
  TextInput,
} from "react-native";
import { getNearbyEvents, Event as TMEvent } from "../../src/api/ticketmaster";
import { scrapeAllLocalEvents, LocalEvent } from "../../src/api/scrapers";
import { scrapeAllTheaters, TheaterShowtime } from "../../src/api/scrapers/theaters";
import { useSavedStore } from "../../src/state/useSavedStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "all" | "music" | "arts" | "comedy" | "sports" | "film" | "outdoor" | "other";

interface UnifiedEvent {
  id: string;
  title: string;
  venue: string;
  address?: string;
  date: string;       // human-readable display
  rawDate: string;    // YYYY-MM-DD for sorting/grouping
  time?: string;
  category: Category;
  image?: string;
  url?: string;
  price?: string;
  source: string;
}

type DateBucket = "Today" | "Tomorrow" | "This Week" | "Later";

// ─── Date Utilities ───────────────────────────────────────────────────────────

/** Convert a local Date to a YYYY-MM-DD string without UTC offset issues */
function localISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toISO(formatted: string): string {
  const today = new Date();
  const todayISO = localISO(today);
  const lc = formatted.toLowerCase();

  if (lc === "tonight" || lc === "today") return todayISO;

  if (lc === "tomorrow") {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return localISO(d);
  }

  // Already a YYYY-MM-DD string — return as-is (no UTC shift)
  if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;

  // Try adding current year for strings like "Sat, Mar 29"
  const withYear = `${formatted}, ${today.getFullYear()}`;
  const parsed = new Date(withYear);
  if (!isNaN(parsed.getTime())) {
    return localISO(parsed);
  }

  // Direct parse
  const direct = new Date(formatted);
  if (!isNaN(direct.getTime())) {
    return localISO(direct);
  }

  return todayISO; // fallback to today
}

function getBucket(rawDate: string): DateBucket {
  const now = new Date();
  const todayISO = localISO(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const tomorrowISO = localISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const weekEndISO = localISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

  if (rawDate <= todayISO) return "Today";
  if (rawDate === tomorrowISO) return "Tomorrow";
  if (rawDate <= weekEndISO) return "This Week";
  return "Later";
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
    rawDate: e.rawDate, // already correct local YYYY-MM-DD from API
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
  const rawDate = e.date ? toISO(e.date) : new Date().toISOString().split("T")[0];
  return {
    id: e.id,
    title: e.title,
    venue: e.venue,
    address: e.address,
    date: e.date ?? "",
    rawDate,
    time: e.time,
    category: catMap[e.category] ?? "other",
    image: e.image,
    url: e.url,
    price: e.price,
    source: e.source,
  };
}

function fromTheater(s: TheaterShowtime): UnifiedEvent {
  const rawDate = s.date ? toISO(s.date) : new Date().toISOString().split("T")[0];
  return {
    id: s.id,
    title: s.title,
    venue: s.venue,
    address: s.address,
    date: s.date ?? "",
    rawDate,
    time: s.time,
    category: "film",
    image: s.posterUrl,
    url: s.checkoutUrl ?? s.url,
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

const BUCKET_ORDER: DateBucket[] = ["Today", "Tomorrow", "This Week", "Later"];

const DEFAULT_LAT = 39.9612;
const DEFAULT_LON = -82.9988;
const RADIUS_MI = 30;

// ─── Hero Card ────────────────────────────────────────────────────────────────

function HeroCard({ event }: { event: UnifiedEvent }) {
  const { isSaved, toggle } = useSavedStore();
  const saved = isSaved(event.id);
  const catInfo = CATEGORIES.find((c) => c.key === event.category) ?? CATEGORIES[0];

  const inner = (
    <View style={styles.hero}>
      {event.image ? (
        <Image source={{ uri: event.image }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroImage, styles.heroImagePlaceholder]}>
          <Text style={{ fontSize: 48 }}>{catInfo.emoji}</Text>
        </View>
      )}
      {/* Dark overlay gradient effect */}
      <View style={styles.heroOverlay} />
      {/* Content on top of image */}
      <View style={styles.heroContent}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{catInfo.emoji} {catInfo.label.toUpperCase()}</Text>
          </View>
          {event.price && (
            <View style={[styles.heroBadge, styles.heroPriceBadge]}>
              <Text style={styles.heroBadgeText}>{event.price}</Text>
            </View>
          )}
        </View>
        <Text style={styles.heroTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.heroVenue} numberOfLines={1}>{event.venue}</Text>
        <View style={styles.heroMeta}>
          {event.time && event.time !== "TBD" && (
            <Text style={styles.heroMetaText}>🕐 {event.time}</Text>
          )}
          {event.address ? (
            <Text style={styles.heroMetaText} numberOfLines={1}>📍 {event.address}</Text>
          ) : null}
        </View>
      </View>
      {/* Save button */}
      <Pressable
        style={styles.heroSaveBtn}
        onPress={(e) => {
          e.stopPropagation?.();
          toggle({
            id: event.id,
            type: "event",
            title: event.title,
            subtitle: event.venue,
            category: event.category,
            emoji: catInfo.emoji,
            image: event.image,
            url: event.url,
            savedAt: new Date().toISOString(),
          });
        }}
      >
        <Text style={styles.heroSaveIcon}>{saved ? "❤️" : "🤍"}</Text>
      </Pressable>
    </View>
  );

  if (event.url) {
    return (
      <Pressable onPress={() => Linking.openURL(event.url!)} style={styles.heroWrapper}>
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.heroWrapper}>{inner}</View>;
}

// ─── Event Row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: UnifiedEvent }) {
  const { isSaved, toggle } = useSavedStore();
  const saved = isSaved(event.id);
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
          {event.date && event.date !== "Tonight" && event.date !== "Today" ? (
            <Text style={styles.rowMetaText}>{event.date}</Text>
          ) : null}
          {event.time && event.time !== "TBD" ? (
            <Text style={styles.rowMetaText}>{event.time}</Text>
          ) : null}
          {event.price ? <Text style={styles.rowPrice}>{event.price}</Text> : null}
        </View>
      </View>
      <Pressable
        style={styles.rowSaveBtn}
        onPress={() =>
          toggle({
            id: event.id,
            type: "event",
            title: event.title,
            subtitle: event.venue,
            category: event.category,
            emoji: catInfo.emoji,
            image: event.image,
            url: event.url,
            savedAt: new Date().toISOString(),
          })
        }
        hitSlop={10}
      >
        <Text style={styles.rowSaveIcon}>{saved ? "❤️" : "🤍"}</Text>
      </Pressable>
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

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: DateBucket; count: number }) {
  const bucketColor: Record<DateBucket, string> = {
    Today: "#FF8C42",
    Tomorrow: "#FFB56B",
    "This Week": "#aaa",
    Later: "#555570",
  };
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionLabel, { color: bucketColor[label] }]}>{label}</Text>
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");

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

    // Deduplicate by title + rawDate
    const seen = new Set<string>();
    const deduped = unified.filter((e) => {
      const key = `${e.title.toLowerCase().trim()}-${e.rawDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by rawDate then time
    deduped.sort((a, b) => {
      const dateCmp = a.rawDate.localeCompare(b.rawDate);
      if (dateCmp !== 0) return dateCmp;
      return (a.time ?? "").localeCompare(b.time ?? "");
    });

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

  // Apply category + search filter
  const filtered = useMemo(() => {
    let list = activeCategory === "all" ? events : events.filter((e) => e.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q) ||
          (e.address ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, activeCategory, search]);

  // Group into date buckets
  const grouped = useMemo(() => {
    const buckets: Record<DateBucket, UnifiedEvent[]> = {
      Today: [], Tomorrow: [], "This Week": [], Later: [],
    };
    for (const e of filtered) {
      buckets[getBucket(e.rawDate)].push(e);
    }
    return buckets;
  }, [filtered]);

  // First today event with an image → hero card
  const heroEvent = useMemo(
    () => grouped["Today"].find((e) => e.image) ?? null,
    [grouped]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat.key] = cat.key === "all"
        ? events.length
        : events.filter((e) => e.category === cat.key).length;
    }
    return counts;
  }, [events]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>COLUMBUS & NEARBY</Text>
        <Text style={styles.heading}>What's On</Text>
        <Text style={styles.subheading}>Within {RADIUS_MI} miles</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search events, venues..."
            placeholderTextColor="#444455"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Text style={styles.searchClear}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Category chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.key] ?? 0;
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
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF8C42" />
          <Text style={styles.loadingText}>Pulling in events…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyText}>
            {search ? `No results for "${search}"` : `No ${activeCategory} events found nearby.`}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8C42" />
          }
        >
          {/* Hero card for today's first featured event */}
          {heroEvent && activeCategory === "all" && !search && (
            <View style={styles.heroSection}>
              <Text style={styles.heroSectionLabel}>✨ FEATURED TONIGHT</Text>
              <HeroCard event={heroEvent} />
            </View>
          )}

          {/* Date bucket sections */}
          {BUCKET_ORDER.filter((b) => grouped[b].length > 0).map((bucket) => {
            const bucketEvents = grouped[bucket];
            // Skip hero from Today section so it's not duplicated
            const listEvents =
              heroEvent && bucket === "Today" && activeCategory === "all" && !search
                ? bucketEvents.filter((e) => e.id !== heroEvent.id)
                : bucketEvents;

            if (listEvents.length === 0) return null;

            return (
              <View key={bucket} style={styles.section}>
                <SectionHeader label={bucket} count={listEvents.length} />
                {listEvents.map((e) => <EventRow key={e.id} event={e} />)}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111118" },

  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 12 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 3, color: "#FF8C42", marginBottom: 6 },
  heading: { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  subheading: { fontSize: 13, color: "#555570", marginTop: 4 },

  searchContainer: { paddingHorizontal: 20, marginBottom: 12 },
  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1a1a26", borderRadius: 12,
    borderWidth: 1, borderColor: "#2a2a3a",
    paddingHorizontal: 12, height: 44,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  searchClear: { fontSize: 12, color: "#444455", padding: 4 },

  chipsWrapper: { height: 48, marginBottom: 4 },
  chips: { paddingHorizontal: 20, alignItems: "center" },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1,
    borderColor: "#2a2a3a", backgroundColor: "#1a1a26",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#FF8C42", borderColor: "#FF8C42" },
  chipText: { fontSize: 13, color: "#888", fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  list: { paddingHorizontal: 20, paddingBottom: 40 },

  heroSection: { marginBottom: 8 },
  heroSectionLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 2,
    color: "#FF8C42", marginBottom: 8,
  },
  heroWrapper: { marginBottom: 8 },
  hero: {
    borderRadius: 20, overflow: "hidden",
    height: 240, backgroundColor: "#1a1a26",
  },
  heroImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroImagePlaceholder: {
    backgroundColor: "#222235",
    alignItems: "center", justifyContent: "center",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  heroContent: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: 16,
  },
  heroBadgeRow: { flexDirection: "row", marginBottom: 8 },
  heroBadge: {
    backgroundColor: "rgba(255,140,66,0.85)",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginRight: 6,
  },
  heroPriceBadge: { backgroundColor: "rgba(0,0,0,0.6)" },
  heroBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#fff" },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4, lineHeight: 28 },
  heroVenue: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 6 },
  heroMeta: { flexDirection: "row" },
  heroMetaText: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginRight: 12 },
  heroSaveBtn: {
    position: "absolute", top: 12, right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20, width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  heroSaveIcon: { fontSize: 16 },

  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 10, marginTop: 16,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  sectionDivider: { flex: 1, height: 1, backgroundColor: "#1e1e2e", marginHorizontal: 10 },
  sectionCount: { fontSize: 11, color: "#333345", fontWeight: "600" },

  rowWrapper: { marginBottom: 8 },
  row: {
    flexDirection: "row", backgroundColor: "#1a1a26",
    borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: "#222235",
    alignItems: "center",
  },
  rowImage: { width: 80, height: 80 },
  rowImagePlaceholder: {
    backgroundColor: "#222235",
    alignItems: "center", justifyContent: "center",
  },
  rowBody: { flex: 1, padding: 12 },
  rowCategory: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, color: "#FF8C42", marginBottom: 3 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 2 },
  rowVenue: { fontSize: 12, color: "#666680", marginBottom: 4 },
  rowMeta: { flexDirection: "row", alignItems: "center" },
  rowMetaText: { fontSize: 11, color: "#555570", marginRight: 8 },
  rowPrice: { fontSize: 11, color: "#FF8C42", fontWeight: "600" },
  rowSaveBtn: { paddingHorizontal: 12, paddingVertical: 14 },
  rowSaveIcon: { fontSize: 16 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingText: { color: "#555570", marginTop: 12, fontSize: 14 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyText: { color: "#555570", fontSize: 15, textAlign: "center" },
});
