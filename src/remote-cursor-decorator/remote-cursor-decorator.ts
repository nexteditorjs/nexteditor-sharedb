import { assert, DocBlockText, DocInsertion, genId, getTextLength, NextEditor, NextEditorDecorator } from '@nexteditorjs/nexteditor-core';
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
    const cursors = client.remoteUsers.getCursors(blockData.id);
    cursors.forEach((users, offset) => {
      if (offset > length) {
        // eslint-disable-next-line no-param-reassign
        offset = length;
      }
      const insertionsData = users.map((user) => {
        const data = {
          id: genId(),
          type: 'remote-cursor',
          name: user.name,
        };
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
