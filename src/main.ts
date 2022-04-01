/* eslint-disable import/no-extraneous-dependencies */
import { addClass, assert, createEditor, createElement, genId, getLogger, RemoteCursorInsertion } from '@nexteditorjs/nexteditor-core';
import TableBlock from '@nexteditorjs/nexteditor-table-block';
import { MarkdownInputHandler } from '@nexteditorjs/nexteditor-input-handlers';
import './style.css';
import ShareDBDoc from './sharedb-doc';
import { RemoteCursorDecorator, BroadcastCursor } from './remote-cursor-decorator';

const console = getLogger('main');

const app = document.querySelector<HTMLDivElement>('#app');
assert(app, 'app does not exists');
//
const query = new URLSearchParams(document.location.search);
let docId = query.get('doc');
if (!docId) {
  docId = genId();
  const newUrl = `${window.location.origin}${window.location.pathname}?doc=${docId}`;
  document.location.replace(newUrl);
}

ShareDBDoc.load({
  server: 'ws://localhost:4000/sharedb-demo',
  collectionName: 'app-1',
  documentId: docId,
  onDocError: (type, error) => {
    console.error(`type, ${(error as Error).message}`);
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
  //
  doc.client.remoteUsers.on('change', (users) => {
    const parent = document.getElementById('remote-users');
    assert(parent);
    parent.innerHTML = '';
    users.forEach((user) => {
      const span = createElement('span', ['remote-user'], parent, user.name);
      if (user.clientId === doc.client.user.clientId) {
        addClass(span, 'self');
      }
    });
  });
  //
  //
  (window as any).editor = editor;
}).catch((err) => {
  console.error(err.message);
});
