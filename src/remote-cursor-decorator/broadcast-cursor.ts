import { NextEditor } from '@nexteditorjs/nexteditor-core';
import debounce from 'lodash.debounce';
import { NextEditorClientSelectionMessage } from '../messages';
import ShareDBDoc from '../sharedb-doc';

export class BroadcastCursor {
  lastUpdateTextTime = 0;

  constructor(private editor: NextEditor) {
    editor.doc.registerCallback(this);
    editor.addListener('selectionChanged', this.handleSelectionChange);
  }

  destroy(): void {
    this.editor.doc.unregisterCallback(this);
    this.editor.removeListener('selectionChanged', this.handleSelectionChange);
  }

  handleSelectionChange = (): void => {
    this.broadcastCursor();
  };

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
