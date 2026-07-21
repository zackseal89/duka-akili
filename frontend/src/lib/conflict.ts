/**
 * Detects when an answer is reporting that two of the shop's own documents
 * disagree, so the UI can render it as a warning card instead of a plain answer.
 *
 * The agent decides whether a conflict exists. This module only classifies the
 * answer it produced, in English or Kiswahili.
 *
 * Strong markers are enough on their own. Weak markers are ordinary words that
 * also show up in non conflict answers, so they only count when the answer
 * cites at least two different documents.
 */

import type { Citation } from "./chat-types";

const STRONG_MARKERS = [
  /\bconflicts?\b/i,
  /\bconflicting\b/i,
  /\bcontradicts?\b/i,
  /\bcontradiction\b/i,
  /\bcontradictory\b/i,
  /\bdiscrepanc(?:y|ies)\b/i,
  /\binconsistent\b/i,
  /\binconsistency\b/i,
  /\bdisagree(?:s|ment)?\b/i,
  /\bmgongano\b/i,
  /\bzinapingana\b/i,
  /\byanapingana\b/i,
  /\bhazilingani\b/i,
  /\bhayalingani\b/i,
];

export interface ConflictVerdict {
  isConflict: boolean;
  /** Documents involved, when at least two were cited. */
  documents: string[];
}

/**
 * Strong markers only. An earlier version also flagged plain words like
 * "different" or "whereas" whenever two documents were cited, and it fired on
 * a real live answer where the agent explicitly reasoned that two suppliers
 * having different terms is normal, not a conflict, and said so in a plain
 * answer with no disagreement language at all. The system prompt instructs
 * the agent to use explicit language ("the shop's records disagree") only
 * when it has decided there is a genuine conflict, so that language is the
 * reliable signal. Guessing from incidental wording is not.
 */
export function detectConflict(text: string, citations: Citation[]): ConflictVerdict {
  const documents = [...new Set(citations.map((citation) => citation.doc))];
  if (!text || text.trim().length < 20) {
    return { isConflict: false, documents };
  }

  const hasStrong = STRONG_MARKERS.some((pattern) => pattern.test(text));
  return { isConflict: hasStrong, documents };
}

/**
 * Detects the other notable answer type: the agent refusing because nothing in
 * the documents grounds the question. Worth styling differently, because a
 * clean refusal is a feature here rather than a failure.
 */
const REFUSAL_MARKERS = [
  /\b(?:i (?:can(?:'|no)?t|cannot|could not|couldn't|don'?t|do not))\b[^.]{0,60}\b(?:find|see|have|know|answer)\b/i,
  /\bnot (?:covered|mentioned|addressed|specified|stated|contained?)\b/i,
  /\bno (?:information|section|document|guidance|answer)\b[^.]{0,40}\b(?:about|on|for|covering)\b/i,
  /\bis(?:n'?t| not) in (?:the|your|these) documents?\b/i,
  // Matches real model phrasing such as "the shop's documents do not contain
  // the wifi password", where the negation sits on "documents"/"records"
  // rather than on a first person "I don't know" construction.
  /\b(?:documents?|records?)\b[^.]{0,40}\b(?:do(?:es)? not|don'?t|doesn'?t)\b[^.]{0,40}\b(?:contain|cover|mention|address|include|have|specify)\b/i,
  /\bnone of the\b[^.]{0,40}\b(?:documents?|records?)\b[^.]{0,60}\b(?:mention|cover|address|contain|specify)\b/i,
  /\bsipati\b/i,
  /\bhakuna (?:taarifa|habari|maelezo)\b/i,
  /\bhaipo katika\b/i,
];

export function detectRefusal(text: string, citations: Citation[]): boolean {
  if (!text || text.trim().length < 15) return false;
  if (citations.length > 0) return false;
  return REFUSAL_MARKERS.some((pattern) => pattern.test(text));
}
