import { NextEditor, NextEditorCallbacks } from '@nexteditorjs/nexteditor-core';
import debounce from 'lodash.debounce';
import { NextEditorClientCursorMessage } from '../messages';
import ShareDBDoc from '../sharedb-doc';

export class BroadcastCursor implements NextEditorCallbacks {
  constructor(private editor: NextEditor) {}

  handleSelectionChange(): void {
    this.broadcastCursor();
  }

  broadcastCursor = debounce(() => {
    //
    const client = (this.editor.doc.externalDoc as ShareDBDoc).client;
    const range = this.editor.selection.range.toDocRange();
    const message: NextEditorClientCursorMessage = {
      nexteditor: 'cursor',
      user: client.user,
      range,
    };

    (this.editor.doc.externalDoc as ShareDBDoc).client.broadcastClientMessages(message);
  }, 300);
}
