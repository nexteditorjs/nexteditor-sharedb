import { NextEditorClientSelection, NextEditorUser } from '@nexteditorjs/nexteditor-core';

export interface NextEditorJoinMessage {
  nexteditor: 'join';
  user: NextEditorUser,
}

export type NextEditorClientSelectionMessage = NextEditorClientSelection;

export type NextEditorPresenceMessage = NextEditorJoinMessage | NextEditorClientSelectionMessage;
