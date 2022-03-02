import {
  DocBlock, DocBlockText, NextEditorDoc, assert, DocBlockTextActions, DocObject, NextEditorDocCallbacks, genId,
} from '@nexteditorjs/nexteditor-core';
import { OpBlockData, OpParserHandler, parseOps } from './op-parser';
import { ShareDBDocOptions } from './options';
import ShareDBDocClient, { ShareDBError } from './sharedb-client';

export default class ShareDBDoc implements NextEditorDoc, OpParserHandler {
  callbacks: NextEditorDocCallbacks | null = null;

  client: ShareDBDocClient;

  private constructor(options: ShareDBDocOptions, onSubscribe: (err: ShareDBError) => void) {
    this.client = new ShareDBDocClient(options, {
      onSubscribe,
      onOp: this.handleOp,
    });
  }

  static load(options: ShareDBDocOptions): Promise<ShareDBDoc> {
    return new Promise((resolve, reject) => {
      const doc = new ShareDBDoc(options, async (err) => {
        if (err) {
          reject(err);
        } else {
          //
          if (!doc.client.doc.type) {
            try {
              await doc.client.createDoc({ blocks: [{
                type: 'text',
                id: genId(),
                text: [],
              }],
              comments: {},
              meta: {} });
            } catch (err) {
              reject(err);
            }
          }
          //
          resolve(doc);
        }
      });
    });
  }

  private get data() {
    return this.client.data;
  }

  registerCallbacks(callbacks: NextEditorDocCallbacks): void {
    this.callbacks = callbacks;
  }

  toJSON(): DocObject {
    return this.data;
  }

  getContainerBlocks(containerId: string): DocBlock[] {
    const blocks = this.data[containerId];
    return blocks;
  }

  getBlockData(containerId: string, blockIndex: number): DocBlock {
    const blocks = this.getContainerBlocks(containerId);
    assert(blocks, `no container data: ${containerId}`);
    const blockData = blocks[blockIndex];
    assert(blockData, `no block data: ${blockIndex}`);
    return blockData;
  }

  localInsertBlock(containerId: string, blockIndex: number, data: DocBlock): DocBlock {
    this.client.insertObject(containerId, blockIndex, data);
    return this.getBlockData(containerId, blockIndex);
  }

  localDeleteBlock(containerId: string, blockIndex: number): DocBlock {
    const oldData = this.getBlockData(containerId, blockIndex);
    this.client.deleteObject(containerId, blockIndex);
    return oldData;
  }

  localUpdateBlockText(containerId: string, blockIndex: number, actions: DocBlockTextActions): DocBlockText {
    const oldBlockData = this.getBlockData(containerId, blockIndex);
    assert(oldBlockData.text, 'no block text');
    this.client.updateRichText(containerId, blockIndex, actions);
    const newText = this.getBlockData(containerId, blockIndex).text;
    assert(newText, 'no block text');
    return newText;
  }

  private handleOp = (ops: any[], source: any, clientId: any) => {
    const local = !!source;
    parseOps(ops, this, local);
  };

  onDeleteBlock(containerId: string, blockIndex: number, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    this.callbacks.onDeleteBlock(containerId, blockIndex, local);
  }

  onInsertBlock(containerId: string, blockIndex: number, data: DocBlock, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    this.callbacks.onInsertBlock(containerId, blockIndex, data, local);
  }

  onUpdateBlockData(containerId: string, blockIndex: number, data: OpBlockData, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    // this.callbacks.onUpdateBlockData(containerId, blockIndex, data, local);
  }

  onUpdateBlockText(containerId: string, blockIndex: number, actions: DocBlockTextActions, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    this.callbacks.onUpdateBlockText(containerId, blockIndex, actions, local);
  }

  onDeleteContainer(containerId: string, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
  }

  onCreateContainer(containerId: string, data: DocBlock[], local: boolean): void {
    assert(this.callbacks, 'no callbacks');
  }
}
