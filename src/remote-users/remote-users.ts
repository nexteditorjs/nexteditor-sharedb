import { NextEditorDocSimpleBlockPos } from '@nexteditorjs/nexteditor-core';
import { NextEditorClientCursorMessage, NextEditorUser } from '../messages';

export default class RemoteUsers {
  private users = new Map<string, NextEditorUser>();

  private cursors = new Map<string, NextEditorClientCursorMessage>();

  setCursor(message: NextEditorClientCursorMessage) {
    this.addUser(message.user);
    this.cursors.set(message.user.clientId, message);
  }

  addUsers(users: NextEditorUser[]) {
    users.forEach((user) => this.addUser(user));
  }

  addUser(user: NextEditorUser) {
    this.users.set(user.clientId, user);
  }

  removeUser(clientId: string) {
    this.users.delete(clientId);
    this.cursors.delete(clientId);
  }

  getCursors(blockId: string) {
    const ret = new Map<number, NextEditorUser[]>();
    Array.from(this.cursors.values()).filter((message) => {
      const ret = message.range.start.blockId === blockId && typeof (message.range.start as NextEditorDocSimpleBlockPos).offset === 'number';
      return ret;
    }).forEach((message) => {
      const offset = (message.range.start as NextEditorDocSimpleBlockPos).offset;
      let users = ret.get(offset);
      if (!users) {
        users = [];
        ret.set(offset, users);
      }
      users.push(message.user);
    });
    return ret;
  }
}
