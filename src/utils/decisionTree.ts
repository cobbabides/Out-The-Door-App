export interface QNode {
  id: string;
  prompt: string;
  hint?: string; // small subtext below the prompt
  options: { label: string; sublabel?: string; value: string; next?: string }[];
}

// ─── Chill & solo path ────────────────────────────────────────────────────────
// Q1: where · Q2: when

// ─── Social & lively path ────────────────────────────────────────────────────
// Q1: when · Q2: crowd type → sets category + distance

// ─── Creative & artsy path ───────────────────────────────────────────────────
// Q1: make vs experience · Q2: budget

// ─── Active & outdoorsy path ─────────────────────────────────────────────────
// Q1: move hard vs explore · Q2: how far

// ─── Lazy but curious path ───────────────────────────────────────────────────
// Q1: leave couch or not · Q2: what sounds easiest

// ─── Surprise me path ────────────────────────────────────────────────────────
// Q1: energy · Q2: budget

export const tree: Record<string, QNode> = {

  // ── Chill & solo ──────────────────────────────────────────────────────────

  chill_env: {
    id: "chill_env",
    prompt: "Inside or outside?",
    hint: "No wrong answer.",
    options: [
      { label: "Somewhere cozy inside", sublabel: "Cafe, bar, bookshop…", value: "indoor", next: "chill_when" },
      { label: "Fresh air, open space", sublabel: "Park, trail, patio…", value: "outdoor", next: "chill_when" },
    ],
  },

  chill_when: {
    id: "chill_when",
    prompt: "When are you thinking?",
    options: [
      { label: "Right now", sublabel: "I'm already bored", value: "now" },
      { label: "Later tonight", sublabel: "A few hours from now", value: "tonight" },
      { label: "This weekend", sublabel: "Planning ahead", value: "weekend" },
    ],
  },

  // ── Social & lively ──────────────────────────────────────────────────────

  social_when: {
    id: "social_when",
    prompt: "Early night or going late?",
    options: [
      { label: "Early — done by midnight", sublabel: "Dinner, drinks, call it", value: "tonight", next: "social_crowd" },
      { label: "Late night, no plans tomorrow", sublabel: "Let's actually go out", value: "now", next: "social_crowd" },
    ],
  },

  social_crowd: {
    id: "social_crowd",
    prompt: "What kind of energy?",
    options: [
      { label: "Big crowd, live music, dancing", sublabel: "Newport, KEMBA, rooftops", value: "music" },
      { label: "Smaller spot, good conversation", sublabel: "Bars, breweries, patios", value: "bar" },
      { label: "Good food first, then we'll see", sublabel: "Dinner + wherever the night goes", value: "food" },
    ],
  },

  // ── Creative & artsy ─────────────────────────────────────────────────────

  creative_type: {
    id: "creative_type",
    prompt: "Make something or experience something?",
    options: [
      { label: "Make or do something", sublabel: "Pottery, painting, improv, workshop…", value: "make", next: "creative_budget" },
      { label: "Watch, see, or explore", sublabel: "Gallery, theater, film, museum…", value: "experience", next: "creative_budget" },
    ],
  },

  creative_budget: {
    id: "creative_budget",
    prompt: "What are you comfortable spending?",
    hint: "This shapes what we show you.",
    options: [
      { label: "Free or under $15", sublabel: "Galleries, parks, free events", value: "low" },
      { label: "$15–40, worth it for the right thing", sublabel: "Most shows, classes, dinners", value: "mid" },
      { label: "Not thinking about it tonight", sublabel: "Special occasion energy", value: "high" },
    ],
  },

  // ── Active & outdoorsy ───────────────────────────────────────────────────

  active_style: {
    id: "active_style",
    prompt: "How do you want to move?",
    options: [
      { label: "Sweat — hike, run, paddle, climb", sublabel: "Actually exert yourself", value: "outdoor", next: "active_distance" },
      { label: "Explore on foot", sublabel: "Wander somewhere interesting", value: "explore", next: "active_distance" },
    ],
  },

  active_distance: {
    id: "active_distance",
    prompt: "How far are you willing to go?",
    options: [
      { label: "Keep it close", sublabel: "In or near Columbus", value: "close" },
      { label: "Worth a 30-minute drive", sublabel: "Parks, trails, Hocking Hills area", value: "far" },
    ],
  },

  // ── Lazy but curious ─────────────────────────────────────────────────────

  lazy_out: {
    id: "lazy_out",
    prompt: "Can we get you off the couch?",
    options: [
      { label: "Fine — but make it easy", sublabel: "No effort, no planning", value: "out", next: "lazy_type" },
      { label: "Honestly no — suggest something low-key", sublabel: "Delivery, streaming, couch activities", value: "home" },
    ],
  },

  lazy_type: {
    id: "lazy_type",
    prompt: "What sounds most painless?",
    options: [
      { label: "Movie or show somewhere comfortable", sublabel: "Theater, drive-in, free screening", value: "movies" },
      { label: "Food somewhere chill", sublabel: "Low-key spot, no wait", value: "food" },
      { label: "Wander somewhere with no agenda", sublabel: "Market, park, neighborhood", value: "explore" },
    ],
  },

  // ── Surprise me ──────────────────────────────────────────────────────────

  surprise_energy: {
    id: "surprise_energy",
    prompt: "Honest check: how much energy do you have?",
    hint: "We'll calibrate accordingly.",
    options: [
      { label: "Running on fumes", sublabel: "Easy, nearby, low effort", value: "low", next: "surprise_budget" },
      { label: "Normal amount", sublabel: "Open to most things", value: "medium", next: "surprise_budget" },
      { label: "Feeling alive tonight", sublabel: "Let's actually do something", value: "high", next: "surprise_budget" },
    ],
  },

  surprise_budget: {
    id: "surprise_budget",
    prompt: "What's your honest budget?",
    options: [
      { label: "Free or cheap", sublabel: "Under $15", value: "low" },
      { label: "Happy to spend a bit", sublabel: "$15–50 for the right thing", value: "mid" },
      { label: "Tonight's a treat", sublabel: "Not the night to hold back", value: "high" },
    ],
  },

};

// Which question each mood starts at
export const MOOD_FIRST_QUESTION: Record<string, string> = {
  chill:    "chill_env",
  social:   "social_when",
  creative: "creative_type",
  active:   "active_style",
  lazy:     "lazy_out",
  surprise: "surprise_energy",
};

// Which questions are the first step of their path (used for progress display)
export const FIRST_STEP_QUESTIONS = new Set([
  "chill_env", "social_when", "creative_type",
  "active_style", "lazy_out", "surprise_energy",
]);
