import { NextEditorUser } from './user';

export interface NextEditorInitMessage {
  nexteditor: 'init';
  user: NextEditorUser;
}

export interface NextEditorWelcomeMessage {
  nexteditor: 'welcome';
  onlineUsers: NextEditorUser[];
}

export type NextEditorCustomMessage = NextEditorInitMessage | NextEditorWelcomeMessage;
