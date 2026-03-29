import { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, StatusBar,
  Pressable, Animated, Easing, ScrollView,
} from "react-native";
import { useStore, Answers } from "../src/state/useStore";
import { tree, FIRST_STEP_QUESTIONS } from "../src/utils/decisionTree";
import { router } from "expo-router";

// Maps each question's answer key — what field in Answers does this question set?
const QUESTION_ANSWER_KEY: Record<string, keyof Answers> = {
  chill_env:        "setting",
  chill_when:       "timeframe",
  social_when:      "timeframe",
  social_crowd:     "category",
  creative_type:    "category",
  creative_budget:  "budget",
  active_style:     "category",
  active_distance:  "distance",
  lazy_out:         "category",
  lazy_type:        "category",
  surprise_energy:  "energy",
  surprise_budget:  "budget",
};

export default function Question() {
  const { currentQuestionId, setAnswer, nextQuestion, mood } = useStore();
  const node = tree[currentQuestionId];

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(40);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [currentQuestionId]);

  if (!node) {
    router.replace("/results");
    return null;
  }

  const isFirstStep = FIRST_STEP_QUESTIONS.has(currentQuestionId);
  const stepIndex = isFirstStep ? 0 : 1;

  // Mood accent colors for the step dots
  const MOOD_COLORS: Record<string, string> = {
    chill: "#7B8FFF",
    social: "#FF6B8A",
    creative: "#A78BFA",
    active: "#34D399",
    lazy: "#FBBF24",
    surprise: "#FF8C42",
  };
  const accentColor = mood ? (MOOD_COLORS[mood] ?? "#FF8C42") : "#FF8C42";

  function handleOption(value: string, next?: string) {
    const answerKey = QUESTION_ANSWER_KEY[currentQuestionId];
    if (answerKey) setAnswer(answerKey, value);

    if (next) {
      nextQuestion(next);
    } else {
      router.replace("/results");
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* Ambient blob */}
      <View style={[styles.blob, { backgroundColor: accentColor }]} />

      {/* Progress dots */}
      <View style={styles.progressRow}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i <= stepIndex
                ? [styles.dotActive, { backgroundColor: accentColor }]
                : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          styles.content,
          { opacity: slideAnim.interpolate({ inputRange: [0, 40], outputRange: [1, 0] }),
            transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Step label */}
        <Text style={[styles.stepLabel, { color: accentColor }]}>
          STEP {stepIndex + 1} OF 2
        </Text>

        {/* Question */}
        <Text style={styles.question}>{node.prompt}</Text>
        {node.hint && <Text style={styles.hint}>{node.hint}</Text>}

        {/* Options */}
        <ScrollView
          style={styles.optionScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.optionList}
        >
          {node.options.map((opt) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [
                styles.option,
                pressed && [styles.optionPressed, { borderColor: accentColor }],
              ]}
              onPress={() => handleOption(opt.value, opt.next)}
            >
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                {opt.sublabel && (
                  <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
                )}
              </View>
              <Text style={[styles.arrow, { color: accentColor }]}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Back link */}
      <Pressable onPress={() => router.replace("/mood")} style={styles.backBtn}>
        <Text style={styles.backText}>← Change mood</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0e0e16" },

  blob: {
    position: "absolute",
    width: 300, height: 300, borderRadius: 150,
    top: -80, right: -80, opacity: 0.08,
  },

  progressRow: {
    flexDirection: "row",
    paddingHorizontal: 28,
    paddingTop: 64,
    gap: 8,
    marginBottom: 40,
  },
  dot: { height: 4, flex: 1, borderRadius: 2 },
  dotActive: {},
  dotInactive: { backgroundColor: "#2A2A3A" },

  content: { flex: 1, paddingHorizontal: 28 },

  stepLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 2.5, marginBottom: 14 },
  question: {
    fontSize: 34, fontWeight: "900", color: "#fff",
    letterSpacing: -1, lineHeight: 40, marginBottom: 8,
  },
  hint: { fontSize: 13, color: "#555570", marginBottom: 28, lineHeight: 18 },

  optionScroll: { flex: 1 },
  optionList: { paddingBottom: 16 },

  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16161f",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2A2A3A",
  },
  optionPressed: { backgroundColor: "#1e1e2e" },
  optionText: { flex: 1, marginRight: 12 },
  optionLabel: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 2 },
  optionSublabel: { fontSize: 12, color: "#555570" },
  arrow: { fontSize: 24, fontWeight: "300" },

  backBtn: { paddingHorizontal: 28, paddingBottom: 36, paddingTop: 8 },
  backText: { fontSize: 13, color: "#444455" },
});
