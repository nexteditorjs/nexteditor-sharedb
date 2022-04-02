import { NextEditorDocRange } from '@nexteditorjs/nexteditor-core';
import { NextEditorUser } from './user';

export interface NextEditorJoinMessage {
  nexteditor: 'join';
  user: NextEditorUser,
}

export interface NextEditorClientCursorMessage {
  nexteditor: 'cursor';
  user: NextEditorUser,
  range: NextEditorDocRange;
  time: number;
}

export type NextEditorPresenceMessage = NextEditorJoinMessage | NextEditorClientCursorMessage;
