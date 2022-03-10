/* eslint-disable import/no-extraneous-dependencies */
import { assert, createEditor, editorBlocks } from '@nexteditorjs/nexteditor-core';
import TableBlock from '@nexteditorjs/nexteditor-table-block';
import './style.css';
import ShareDBDoc from './sharedb-doc';

editorBlocks.registerComplexBlockClass(TableBlock);

const app = document.querySelector<HTMLDivElement>('#app');
assert(app, 'app does not exists');

ShareDBDoc.load({
  server: 'ws://localhost:4000/sharedb-demo',
  collectionName: 'app-1',
  documentId: 'doc-12',
}).then((doc) => {
  console.log(doc);
  const editor = createEditor(app, doc);
  (window as any).editor = editor;
}).catch((err) => {
  console.error(err);
});
