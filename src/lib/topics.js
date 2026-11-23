// src/lib/topics.js
// The topics a post can be filed under. Education in the widest sense: school subjects, but also
// languages, crafts, careers and study skills, so any learner can find a home here.
// Ids are stored on posts and in people's feed settings, so never rename an id (change the label instead).

export const TOPICS = [
  { id: "math", label: "Math" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "biology", label: "Biology" },
  { id: "cs", label: "Computer science" },
  { id: "languages", label: "Languages" },
  { id: "writing", label: "Writing & English" },
  { id: "history", label: "History & society" },
  { id: "economics", label: "Economics & business" },
  { id: "medicine", label: "Health & medicine" },
  { id: "arts", label: "Arts & crafts" },
  { id: "exams", label: "Exam prep" },
  { id: "study", label: "Study skills" },
  { id: "career", label: "Career & skills" },
  { id: "other", label: "Other" },
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);
const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export const topicLabel = (id) => BY_ID.get(id)?.label || "";
export const isTopic = (id) => BY_ID.has(id);

// The kinds of post. "question" posts get the "waiting for an answer" treatment.
export const POST_KINDS = [
  { id: "insight", label: "Insight", hint: "Share something you learned or figured out" },
  { id: "question", label: "Question", hint: "Ask something and let people help" },
  { id: "log", label: "Learning log", hint: "Show what you studied or practised" },
  { id: "resource", label: "Resource", hint: "A tip, a method or a source that helped" },
];
export const KIND_IDS = POST_KINDS.map((k) => k.id);
export const kindLabel = (id) => POST_KINDS.find((k) => k.id === id)?.label || "Post";

// A circle's subject tag (see COMMUNITY_TAGS) suggests topics to follow.
const TAG_TO_TOPIC = {
  Math: "math",
  Science: "physics",
  English: "writing",
  "Exam prep": "exams",
  Languages: "languages",
  Coding: "cs",
  Business: "economics",
  Creative: "arts",
  Career: "career",
  Health: "medicine",
  Research: "writing",
  Professional: "career",
  "Lifelong learners": "study",
  "Tutor class": "study",
  Other: "other",
};
export const topicFromCircleTag = (tag) => TAG_TO_TOPIC[tag] || "";