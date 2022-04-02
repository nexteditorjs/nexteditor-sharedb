import { NextEditor, NextEditorCallbacks } from '@nexteditorjs/nexteditor-core';
import debounce from 'lodash.debounce';
import { NextEditorClientSelectionMessage } from '../messages';
import ShareDBDoc from '../sharedb-doc';

export class BroadcastCursor implements NextEditorCallbacks {
  lastUpdateTextTime = 0;

  constructor(private editor: NextEditor) {
    editor.doc.registerCallback(this);
  }

  destroy(): void {
    this.editor.doc.unregisterCallback(this);
  }

  handleSelectionChange(): void {
    this.broadcastCursor();
  }

  onUpdateBlockText(containerId: string, blockIndex: number, actions: unknown, local: boolean): void {
    if (local) {
      this.lastUpdateTextTime = Date.now();
    }
  }

  broadcastCursor = debounce(() => {
    //
    const client = (this.editor.doc.externalDoc as ShareDBDoc).client;
    const range = this.editor.selection.range.toDocRange();
    const message: NextEditorClientSelectionMessage = {
      nexteditor: 'cursor',
      user: client.user,
      range,
      time: this.lastUpdateTextTime,
    };

    (this.editor.doc.externalDoc as ShareDBDoc).client.broadcastClientMessages(message);
  }, 100);
}
