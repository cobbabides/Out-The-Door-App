import { View, Text, StyleSheet, StatusBar } from "react-native";
import { useStore, Answers } from "../src/state/useStore";
import { tree } from "../src/utils/decisionTree";
import OptionButton from "../src/components/OptionButton";
import { router } from "expo-router";

const QUESTION_ORDER = ["people", "timeframe", "distance", "category"];

export default function Question() {
  const { currentQuestionId, setAnswer, nextQuestion } = useStore();
  const node = tree[currentQuestionId];

  if (!node) {
    router.replace("/results");
    return null;
  }

  const stepIndex = QUESTION_ORDER.indexOf(currentQuestionId);
  const total = QUESTION_ORDER.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Progress */}
      <View style={styles.progressRow}>
        {QUESTION_ORDER.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i <= stepIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <Text style={styles.stepLabel}>
          {stepIndex + 1} of {total}
        </Text>
        <Text style={styles.question}>{node.prompt}</Text>
      </View>

      <View style={styles.options}>
        {node.options.map((opt) => (
          <OptionButton
            key={opt.value}
            label={opt.label}
            onPress={() => {
              setAnswer(node.id as keyof Answers, opt.value);
              if (opt.next) nextQuestion(opt.next);
              else router.replace("/results");
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111118",
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 48,
  },
  dot: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  dotActive: {
    backgroundColor: "#FF8C42",
  },
  dotInactive: {
    backgroundColor: "#2A2A3A",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 32,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#FF8C42",
    marginBottom: 16,
  },
  question: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  options: {
    paddingBottom: 8,
  },
});
