export type NoteType = "note" | "quick" | "journal" | "news";

export const NOTE_TYPES: { type: NoteType; label: string; icon: string }[] = [
  { type: "note", label: "筆記", icon: "📝" },
  { type: "quick", label: "速記", icon: "⚡" },
  { type: "journal", label: "日誌", icon: "📔" },
  { type: "news", label: "新聞", icon: "📰" },
];

export const typeLabel = (t: NoteType) => NOTE_TYPES.find((x) => x.type === t)?.label ?? t;
export const typeIcon = (t: NoteType) => NOTE_TYPES.find((x) => x.type === t)?.icon ?? "📝";

export type Note = {
  id: string;
  user_id: string;
  notebook_id: string | null;
  type: NoteType;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  journal_date: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Notebook = { id: string; name: string; created_at: string };

export type Feed = { id: string; title: string; url: string; created_at: string };

export type FeedItem = {
  title: string;
  link: string;
  published: string | null;
  summary: string;
  feedTitle: string;
};
