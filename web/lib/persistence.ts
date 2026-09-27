import type { ChamberView, ChatMessage, ReactionValue } from "@/lib/types";

export interface ApplicationPersistence {
  loadChambers(): ChamberView[];
  saveChamber(chamber: ChamberView): void;
  loadMessages(chamberId: string): ChatMessage[];
  saveMessage(message: ChatMessage): void;
  loadReactions(chamberId: string): ReactionValue[];
  saveReaction(chamberId: string, sessionId: string, reaction: ReactionValue, createdAt: string): void;
  health(): { mode: string; path: string | null };
}
