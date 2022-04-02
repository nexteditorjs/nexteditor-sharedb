import { DocBlock, DocBlockTextActions, NextEditorDocSimpleBlockPos, RichText, isSimpleRange, isCollapsedRange } from '@nexteditorjs/nexteditor-core';
import events from 'events';
import { NextEditorClientCursorMessage, NextEditorUser } from '../messages';

declare interface RemoteUsers {
  on(event: 'change', listener: (users: NextEditorUser[]) => void): this;
  on(event: 'remote-cursor-change', listener: (blockIds: string[]) => void): this;

  off(event: 'change', listener: (users: NextEditorUser[]) => void): this;
  off(event: 'remote-cursor-change', listener: (blockIds: string[]) => void): this;

  once(event: 'change', listener: (users: NextEditorUser[]) => void): this;
  once(event: 'remote-cursor-change', listener: (blockIds: string[]) => void): this;

  addEventListener(event: 'change', listener: (users: NextEditorUser[]) => void): this;
  addEventListener(event: 'remote-cursor-change', listener: (blockIds: string[]) => void): this;

  removeEventListener(event: 'change', listener: (users: NextEditorUser[]) => void): this;
  removeEventListener(event: 'remote-cursor-change', listener: (blockIds: string[]) => void): this;
}

class RemoteUsers extends events.EventEmitter {
  private users = new Map<string, NextEditorUser>();

  private cursors = new Map<string, NextEditorClientCursorMessage>();

  private addingUser = false;

  setCursor(message: NextEditorClientCursorMessage) {
    this.addUser(message.user);
    const old = this.cursors.get(message.user.clientId);
    this.cursors.set(message.user.clientId, message);
    const newBlocks = new Set([message.range.start.blockId, message.range.end.blockId]);
    const changes = new Set<string>(newBlocks);
    if (old) {
      const oldBlocks = new Set([old.range.start.blockId, old.range.end.blockId]);
      oldBlocks.forEach((oldBlockId) => {
        if (!newBlocks.has(oldBlockId)) {
          changes.add(oldBlockId);
          // this.emit('remote-cursor-change', oldBlockId);
        }
      });
    }
    this.emit('remote-cursor-change', [...changes]);
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

  getSimpleCursors(blockId: string): Map<number, NextEditorClientCursorMessage[]> {
    const ret = new Map<number, NextEditorClientCursorMessage[]>();
    Array.from(this.cursors.values()).filter((message) => {
      const ret = message.range.start.blockId === blockId && isSimpleRange(message.range) && isCollapsedRange(message.range);
      return ret;
    }).forEach((message) => {
      const offset = (message.range.start as NextEditorDocSimpleBlockPos).offset;
      let users = ret.get(offset);
      if (!users) {
        users = [];
        ret.set(offset, users);
      }
      users.push(message);
    });
    return ret;
  }

  getCursors(blockId: string): NextEditorClientCursorMessage[] {
    return Array.from(this.cursors.values()).filter((message) => {
      const ret = message.range.start.blockId === blockId || message.range.end.blockId === blockId;
      return ret;
    });
  }

  onUpdateBlockText(blockData: DocBlock, actions: DocBlockTextActions, local: boolean): void {
    //
    const text = blockData.text;
    if (!text) {
      return;
    }
    //
    const cursors = this.getCursors(blockData.id);
    cursors.forEach((cursor) => {
      if (isSimpleRange(cursor.range)) {
        //
        const { start, end } = cursor.range;
        if (start.blockId === blockData.id) {
          start.offset = RichText.transformCursor(start.offset, actions, local);
        }
        if (end.blockId === blockData.id) {
          end.offset = RichText.transformCursor(end.offset, actions, local);
        }
      }
    });
  }
}

export default RemoteUsers;
