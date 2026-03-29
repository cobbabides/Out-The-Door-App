import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  StyleSheet,
  Alert,
} from "react-native";
import { useSavedStore, SavedItem } from "../../src/state/useSavedStore";

// ─── Saved Card ───────────────────────────────────────────────────────────────

function SavedCard({ item, onRemove }: { item: SavedItem; onRemove: () => void }) {
  const savedDate = new Date(item.savedAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <Pressable
      style={styles.card}
      onPress={() => item.url && Linking.openURL(item.url)}
      disabled={!item.url}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.cardEmoji}>{item.emoji}</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.cardMeta}>
            <Text style={styles.cardCategory}>
              {item.emoji} {item.category.toUpperCase()}
            </Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          </View>
          <Pressable onPress={onRemove} style={styles.removeBtn} hitSlop={12}>
            <Text style={styles.removeIcon}>✕</Text>
          </Pressable>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.savedDate}>Saved {savedDate}</Text>
          {item.url ? <Text style={styles.openLink}>Open →</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>❤️</Text>
      <Text style={styles.emptyTitle}>Nothing saved yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the heart on any result card to save places and events for later.
      </Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const { items, toggle, clear } = useSavedStore();

  function confirmClear() {
    Alert.alert(
      "Clear all saved items?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear all", style: "destructive", onPress: clear },
      ]
    );
  }

  const grouped = items.reduce<Record<string, SavedItem[]>>((acc, item) => {
    const key = item.type === "place"
      ? "📍 Places"
      : item.type === "event"
      ? "🎟️ Events"
      : item.type === "movie"
      ? "🎬 Movies"
      : "📅 Local Events";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const groupOrder = ["🎟️ Events", "📅 Local Events", "🎬 Movies", "📍 Places"];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Saved</Text>
          {items.length > 0 && (
            <Pressable onPress={confirmClear} style={styles.clearBtn}>
              <Text style={styles.clearText}>Clear all</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subheading}>
          {items.length === 0
            ? "Heart anything to save it here"
            : `${items.length} saved item${items.length !== 1 ? "s" : ""}`}
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {groupOrder
            .filter((key) => grouped[key]?.length > 0)
            .map((groupKey) => (
              <View key={groupKey} style={styles.section}>
                <Text style={styles.sectionHeader}>{groupKey}</Text>
                {grouped[groupKey].map((item) => (
                  <SavedCard
                    key={item.id}
                    item={item}
                    onRemove={() => toggle(item)}
                  />
                ))}
              </View>
            ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111118" },

  header: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 3, color: "#FF8C42", marginBottom: 6 },
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1a1a26" },
  clearText: { fontSize: 12, color: "#ff6b6b", fontWeight: "600" },
  subheading: { fontSize: 13, color: "#555570", marginTop: 4 },

  list: { paddingHorizontal: 20, paddingBottom: 40 },

  section: { marginBottom: 8 },
  sectionHeader: {
    fontSize: 12, fontWeight: "700", letterSpacing: 1.5,
    color: "#555570", textTransform: "uppercase",
    marginBottom: 10, marginTop: 8,
  },

  card: {
    backgroundColor: "#1a1a26",
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#2a2a3a",
  },
  cardImage: { width: 80, height: 80 },
  cardImagePlaceholder: {
    backgroundColor: "#222235",
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmoji: { fontSize: 26 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardMeta: { flex: 1 },
  cardCategory: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, color: "#FF8C42", marginBottom: 2 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 2 },
  cardSubtitle: { fontSize: 12, color: "#666680" },
  removeBtn: { padding: 4, marginLeft: 8 },
  removeIcon: { fontSize: 12, color: "#444455" },

  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, alignItems: "center" },
  savedDate: { fontSize: 11, color: "#444455" },
  openLink: { fontSize: 11, color: "#FF8C42", fontWeight: "600" },

  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#555570", textAlign: "center", lineHeight: 20 },
});
