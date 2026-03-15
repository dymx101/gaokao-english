export type MasteryStatus = "unknown" | "fuzzy" | "mastered";
export type QuestionType = "flashcard" | "mcq" | "cloze" | "semantic";

export type TodayTaskItem = {
  vocabId: number;
  mode: "review" | "mistake" | "new";
  questionType: QuestionType;
  payload: unknown;
};

export type TodayTasksResponse = {
  date: string;
  totalVocab: number;
  items: TodayTaskItem[];
};

export type WordResponse = {
  id: number;
  word: string;
  phonetic: string | null;
  pos: string | null;
  meaningZh: unknown;
  state: null | {
    status: MasteryStatus;
    strength: number;
    nextReviewAt: string;
  };
};

export type AttemptSubmitRequest = {
  vocabId: number;
  questionType: QuestionType;
  isCorrect: boolean;
  responseMs: number;
  changedAnswer?: boolean;
  meta?: unknown;
};

export type AttemptSubmitResponse = {
  updatedState: {
    status: MasteryStatus;
    strength: number;
    nextReviewAt: string;
  };
};
