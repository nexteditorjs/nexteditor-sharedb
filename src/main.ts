/* eslint-disable import/no-extraneous-dependencies */
import { assert, createEditor, RemoteCursorInsertion } from '@nexteditorjs/nexteditor-core';
import TableBlock from '@nexteditorjs/nexteditor-table-block';
import { MarkdownInputHandler } from '@nexteditorjs/nexteditor-input-handlers';
import './style.css';
import ShareDBDoc from './sharedb-doc';
import { RemoteCursorDecorator, BroadcastCursor } from './remote-cursor-decorator';

const app = document.querySelector<HTMLDivElement>('#app');
assert(app, 'app does not exists');

ShareDBDoc.load({
  server: 'ws://localhost:4000/sharedb-demo',
  collectionName: 'app-1',
  documentId: 'doc-14',
  onDocError: (type, error) => {
    console.error(type, error);
  },
}).then((doc) => {
  const editor = createEditor(app, doc, {
    components: {
      blocks: [TableBlock],
      insertions: [RemoteCursorInsertion],
      decorators: [new RemoteCursorDecorator()],
    },
  });
  editor.registerCallback(new BroadcastCursor(editor));
  editor.input.addHandler(new MarkdownInputHandler());
  (window as any).editor = editor;
}).catch((err) => {
  console.error(err);
});
