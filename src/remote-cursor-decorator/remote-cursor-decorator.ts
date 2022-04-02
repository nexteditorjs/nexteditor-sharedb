import { assert, DocBlockText, DocInsertion, findInsertionById, genId, getTextLength, NextEditor, NextEditorDecorator, removeClass } from '@nexteditorjs/nexteditor-core';
import ShareDBDoc from '../sharedb-doc';

export class RemoteCursorDecorator implements NextEditorDecorator {
  decorateText(editor: NextEditor, containerId: string, blockIndex: number, blockText: DocBlockText): { insertions?: Map<number, DocInsertion[]>, text?: DocBlockText } {
    //
    const externDoc = editor.doc.externalDoc;
    assert(externDoc instanceof ShareDBDoc, 'invalid doc type');
    //
    const insertions = new Map<number, DocInsertion[]>();
    //
    const client = externDoc.client;
    const blockData = editor.doc.getBlockData(containerId, blockIndex);
    const length = getTextLength(blockText);
    const cursorMessages = client.remoteUsers.getSimpleCursors(blockData.id);
    //
    const activeCursors = new Set<string>();
    const now = Date.now();
    //
    cursorMessages.forEach((messages, offset) => {
      if (offset > length) {
        // eslint-disable-next-line no-param-reassign
        offset = length;
      }
      const insertionsData = messages.map((message) => {
        const data = {
          id: genId(),
          type: 'remote-cursor',
          name: message.user.name,
          time: message.time,
          rainbowIndex: message.user.rainbowIndex,
        };
        //
        if (now - message.time < 5 * 1000) {
          activeCursors.add(data.id);
        }
        //
        return data;
      });
      const exists = insertions.get(offset);
      if (exists) {
        exists.push(...insertionsData);
      } else {
        insertions.set(offset, insertionsData);
      }
    });
    //
    return {
      insertions,
    };
    //
  }
}
