import { NextEditorDocSimpleBlockPos } from '@nexteditorjs/nexteditor-core';
import events from 'events';
import { NextEditorClientCursorMessage, NextEditorUser } from '../messages';

declare interface RemoteUsers {
  on(event: 'change', listener: (users: NextEditorUser[]) => void): this;
}

class RemoteUsers extends events.EventEmitter {
  private users = new Map<string, NextEditorUser>();

  private cursors = new Map<string, NextEditorClientCursorMessage>();

  private addingUser = false;

  setCursor(message: NextEditorClientCursorMessage) {
    this.addUser(message.user);
    this.cursors.set(message.user.clientId, message);
  }

  addUsers(users: NextEditorUser[]) {
    this.addingUser = true;
    users.forEach((user) => this.addUser(user));
    this.addingUser = false;
    this.emit('change', Array.from(this.users.values()));
  }

  addUser(user: NextEditorUser) {
    this.users.set(user.clientId, user);
    if (!this.addingUser) {
      this.emit('change', Array.from(this.users.values()));
    }
  }

  removeUser(clientId: string) {
    this.users.delete(clientId);
    this.cursors.delete(clientId);
    this.emit('change', Array.from(this.users.values()));
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

export default RemoteUsers;
