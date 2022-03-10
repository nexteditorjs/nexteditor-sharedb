import {
  DocBlock, DocBlockText, NextEditorDoc, assert, DocBlockTextActions, DocObject, NextEditorDocCallbacks, DocBlockDelta, createEmptyDoc,
} from '@nexteditorjs/nexteditor-core';
import cloneDeep from 'lodash.clonedeep';
import OpBlockDataDelta from './op-block-delta';
import { OpParserHandler, parseOps } from './op-parser';
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
              const emptyDoc = createEmptyDoc();
              console.log('create empty doc', emptyDoc);
              await doc.client.createDoc(emptyDoc);
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

  private get data(): DocObject {
    return this.client.data;
  }

  registerCallbacks(callbacks: NextEditorDocCallbacks): void {
    this.callbacks = callbacks;
  }

  toJSON(): DocObject {
    return this.data;
  }

  getContainerBlocks(containerId: string): DocBlock[] {
    console.log('1');
    const blocks = this.data.blocks[containerId];
    console.log('2', blocks);
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
    this.client.insertBlock(containerId, blockIndex, data);
    return this.getBlockData(containerId, blockIndex);
  }

  localDeleteBlock(containerId: string, blockIndex: number): DocBlock {
    const oldData = this.getBlockData(containerId, blockIndex);
    this.client.deleteBlock(containerId, blockIndex);
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

  localUpdateBlockData(containerId: string, blockIndex: number, delta: DocBlockDelta): DocBlock {
    const oldBlockData = cloneDeep(this.getBlockData(containerId, blockIndex));
    this.client.updateBlockData(containerId, blockIndex, delta);
    return oldBlockData;
  }

  localInsertChildContainer(containerId: string, blocks: DocBlock[]): void {
    this.client.insertChildContainer(containerId, blocks);
  }

  localDeleteChildContainers(containerIds: string[]): void {
    containerIds.forEach((id) => {
      this.client.deleteChildContainer(id);
    });
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

  onUpdateBlockData(containerId: string, blockIndex: number, delta: OpBlockDataDelta, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    this.callbacks.onUpdateBlockData(containerId, blockIndex, delta.toDocBlockDelta(), local);
  }

  onUpdateBlockText(containerId: string, blockIndex: number, actions: DocBlockTextActions, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    this.callbacks.onUpdateBlockText(containerId, blockIndex, actions, local);
  }

  onDeleteContainer(containerId: string, local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    assert(containerId !== 'root', 'should not delete root container in doc');
    this.callbacks.onDeleteChildContainer(containerId, local);
  }

  onCreateContainer(containerId: string, blocks: DocBlock[], local: boolean): void {
    assert(this.callbacks, 'no callbacks');
    assert(containerId !== 'root', 'should not create root container in doc');
    this.callbacks.onInsertChildContainer(containerId, blocks, local);
  }
}
