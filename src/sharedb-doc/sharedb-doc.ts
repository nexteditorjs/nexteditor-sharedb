import {
  DocBlock, DocBlockText, NextEditorDoc, assert, DocBlockTextActions, DocObject, NextEditorDocCallbacks, DocBlockDelta, createEmptyDoc, EventCallbacks, getLogger,
} from '@nexteditorjs/nexteditor-core';
import cloneDeep from 'lodash.clonedeep';
import OpBlockDataDelta from './op-block-delta';
import { OpParserHandler, parseOps } from './op-parser';
import { ClientError, ErrorType, ShareDBDocOptions } from './options';
import ShareDBDocClient from './sharedb-client';

const logger = getLogger('sharedb-doc');

export default class ShareDBDoc extends EventCallbacks<NextEditorDocCallbacks> implements NextEditorDoc, OpParserHandler {
  client: ShareDBDocClient;

  private constructor(options: ShareDBDocOptions, onSubscribe: () => void, onLoadError: (type: ErrorType, error: ClientError) => void) {
    super();
    //
    let loaded = false;
    //
    const errorHandler = (type: ErrorType, error: ClientError) => {
      if (loaded) {
        options.onDocError(type, error);
      } else {
        onLoadError(type, error);
      }
    };
    //
    const subscribeHandler = () => {
      loaded = true;
      onSubscribe();
    };
    //
    this.client = new ShareDBDocClient(options, {
      onSubscribe: subscribeHandler,
      onError: errorHandler,
      onOp: this.handleOp,
      onClose: this.handleSocketClose,
    });
  }

  static load(options: ShareDBDocOptions): Promise<ShareDBDoc> {
    return new Promise((resolve, reject) => {
      const doc = new ShareDBDoc(options, async () => {
        if (!doc.client.doc.type) {
          try {
            const emptyDoc = options.docTemplate ?? createEmptyDoc();
            await doc.client.createDoc(emptyDoc);
          } catch (err) {
            reject(err);
            return;
          }
        }
        resolve(doc);
      }, (type, err) => {
        logger.error(`failed to load document, type: ${type}, error: ${err.message}`);
        const error = new Error(err.message);
        error.code = type;
        (error as any).orgin = err;
        reject(error);
      });
    });
  }

  private handleClientError = () => {

  };

  private handleSocketClose = () => {

  };

  private get data(): DocObject {
    return this.client.data;
  }

  toJSON(): DocObject {
    return this.data;
  }

  getContainerBlocks(containerId: string): DocBlock[] {
    const blocks = this.data.blocks[containerId];
    return blocks;
  }

  getBlockData(containerId: string, blockIndex: number): DocBlock {
    const blocks = this.getContainerBlocks(containerId);
    assert(logger, blocks, `no container data: ${containerId}`);
    const blockData = blocks[blockIndex];
    assert(logger, blockData, `no block data: ${blockIndex}`);
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
    assert(logger, oldBlockData.text, 'no block text');
    this.client.updateRichText(containerId, blockIndex, actions);
    const newText = this.getBlockData(containerId, blockIndex).text;
    assert(logger, newText, 'no block text');
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
    assert(logger, this.callbacks.length > 0, 'no callbacks');
    this.callbacks.forEach((cb) => cb.onDeleteBlock?.(containerId, blockIndex, local));
  }

  onInsertBlock(containerId: string, blockIndex: number, data: DocBlock, local: boolean): void {
    assert(logger, this.callbacks.length > 0, 'no callbacks');
    this.callbacks.forEach((cb) => cb.onInsertBlock?.(containerId, blockIndex, data, local));
  }

  onUpdateBlockData(containerId: string, blockIndex: number, delta: OpBlockDataDelta, local: boolean): void {
    assert(logger, this.callbacks.length > 0, 'no callbacks');
    this.callbacks.forEach((cb) => cb.onUpdateBlockData?.(containerId, blockIndex, delta.toDocBlockDelta(), local));
  }

  onUpdateBlockText(containerId: string, blockIndex: number, actions: DocBlockTextActions, local: boolean): void {
    assert(logger, this.callbacks.length > 0, 'no callbacks');
    this.client.remoteUsers.onUpdateBlockText(this.getBlockData(containerId, blockIndex), actions, local);
    this.callbacks.forEach((cb) => cb.onUpdateBlockText?.(containerId, blockIndex, actions, local));
  }

  onDeleteContainer(containerId: string, local: boolean): void {
    assert(logger, this.callbacks.length > 0, 'no callbacks');
    assert(logger, containerId !== 'root', 'should not delete root container in doc');
    this.callbacks.forEach((cb) => cb.onDeleteChildContainer?.(containerId, local));
  }

  onCreateContainer(containerId: string, blocks: DocBlock[], local: boolean): void {
    assert(logger, this.callbacks.length > 0, 'no callbacks');
    assert(logger, containerId !== 'root', 'should not create root container in doc');
    this.callbacks.forEach((cb) => cb.onInsertChildContainer?.(containerId, blocks, local));
  }

  destroy(): void {
    this.client.destroy();
    this.clearCallbacks();
  }
}
