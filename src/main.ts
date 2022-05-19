/* eslint-disable import/no-extraneous-dependencies */
import { addClass, assert, createEditor, createElement, genId, getLogger, RemoteCursorInsertion } from '@nexteditorjs/nexteditor-core';
import TableBlock from '@nexteditorjs/nexteditor-table-block';
import ListBlock from '@nexteditorjs/nexteditor-list-block';
import { MarkdownInputHandler } from '@nexteditorjs/nexteditor-input-handlers';
import './style.css';
import ShareDBDoc from './sharedb-doc';
import { RemoteCursorDecorator, BroadcastCursor } from './remote-cursor-decorator';

const logger = getLogger('main');

const COLLECTION_ID = 'collection-1';

const names = [
  'James',
  'Robert',
  'John',
  'Michael',
  'William',
  'David',
  'Richard',
  'Joseph',
  'Thomas',
  'Charles',
  'Christopher',
  'Daniel',
  'Matthew',
  'Anthony',
  'Mark',
  'Donald',
  'Steven',
  'Paul',
  'Andrew',
  'Joshua',
  'Mary',
  'Patricia',
  'Jennifer',
  'Linda',
  'Elizabeth',
  'Barbara',
  'Susan',
  'Jessica',
  'Sarah',
  'Karen',
  'Nancy',
  'Lisa',
  'Betty',
  'Margaret',
  'Sandra',
  'Ashley',
  'Kimberly',
  'Emily',
  'Donna',
  'Michelle',
];

const users = names.map((name, index) => ({
  userId: `user-${index}`,
  name,
  avatarUrl: `https://picsum.photos/seed/${name.toLocaleLowerCase()}/72/72`,
  rainbowIndex: index,
}));

const user = users[Date.now() % users.length];

const app = document.querySelector<HTMLDivElement>('#app');
assert(logger, app, 'app does not exists');
//
const query = new URLSearchParams(document.location.search);
let docId = query.get('doc');
if (!docId) {
  docId = genId();
  const newUrl = `${window.location.origin}${window.location.pathname}?doc=${docId}`;
  document.location.replace(newUrl);
}

// test only, this code should used in server
async function requestFakeToken(docId: string) {
  const url = `/fake/${COLLECTION_ID}/${docId}/token?permission=w&userId=${user.userId}&name=${encodeURIComponent(user.name)}&avatarUrl=${encodeURIComponent(user.avatarUrl)}`;
  const ret = await fetch(url);
  const data = await ret.json();
  return data.token as string;
}

async function startEdit() {
  assert(logger, docId, 'no doc id');
  const token = await requestFakeToken(docId);
  const doc = await ShareDBDoc.load({
    server: 'ws://localhost:4000/sharedb-demo',
    collectionName: COLLECTION_ID,
    token,
    documentId: docId,
    onDocError: (type, error) => {
      logger.error(`${type} error, ${(error as Error).message}`);
    },
  });

  assert(logger, app, 'app does not exists');
  const editor = createEditor(app, doc, {
    components: {
      blocks: [TableBlock, ListBlock],
      insertions: [RemoteCursorInsertion],
      decorators: [new RemoteCursorDecorator()],
    },
  });
  const cursorBroadcaster = new BroadcastCursor(editor);
  editor.input.addHandler(new MarkdownInputHandler());
  //
  editor.on('destroy', () => {
    cursorBroadcaster.destroy();
  });
  //
  doc.client.remoteUsers.on('change', (users) => {
    const parent = document.getElementById('remote-users');
    assert(logger, parent, 'no parent');
    parent.innerHTML = '';
    users.forEach((user) => {
      const span = createElement('span', ['remote-user'], parent, user.name);
      if (user.clientId === doc.client.user.clientId) {
        addClass(span, 'self');
      }
    });
  });

  //
  doc.client.remoteUsers.on('remote-cursor-change', (blockIds) => {
    blockIds.forEach((blockId) => {
      const block = editor.findBlockById(blockId);
      if (block) {
        editor.reloadBlock(block);
      }
    });
  });
  //
  //
  (window as any).editor = editor;
}

startEdit().catch((err) => {
  logger.error(err.message);
});
