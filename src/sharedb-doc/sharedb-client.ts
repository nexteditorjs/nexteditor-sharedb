/* eslint-disable no-lonely-if */
/* eslint-disable max-classes-per-file */
import ReconnectingWebSocket, { ErrorEvent, CloseEvent } from 'reconnecting-websocket';
import { Connection, Doc, types as ShareDBTypes } from 'sharedb/lib/client';
import richText from '@nexteditorjs/nexteditor-core/dist/ot-types/rich-text';
import * as json1 from 'ot-json1';
import { DocBlock, DocBlockDelta, DocObject } from '@nexteditorjs/nexteditor-core';
import { ClientError, ErrorType, ShareDBDocOptions, ShareDBError } from './options';

const JSON1_TYPE_NAME = 'ot-json1';

json1.type.registerSubtype(richText.type);
json1.type.name = JSON1_TYPE_NAME;
ShareDBTypes.register(json1.type);

export interface ShareDBDocClientEvent {
  onSubscribe: () => void;
  onOp: (ops: any[], source: any, clientId: string) => void;
  onError: (errorType: ErrorType, error: ClientError) => void;
  onClose: (event: CloseEvent) => void;
}

export default class ShareDBDocClient {
  private socket: ReconnectingWebSocket;

  private connection: Connection;

  doc: Doc;

  constructor(private options: ShareDBDocOptions, private events: ShareDBDocClientEvent) {
    this.socket = new ReconnectingWebSocket(options.server);
    this.socket.onerror = this.handleSocketError;
    this.socket.onclose = this.handleSocketClose;
    this.connection = new Connection(this.socket as any);
    this.doc = this.connection.get(options.collectionName, options.documentId);
    this.doc.preventCompose = true;
    this.doc.subscribe(this.handleSubscribe);
    this.doc.on('op', this.events.onOp);
  }

  get data() {
    return this.doc.data;
  }

  destroy() {
    this.doc.removeAllListeners();
    this.connection.close();
  }

  handleSubscribe = (error: ShareDBError | undefined) => {
    if (error) {
      this.events.onError('Subscribe', error);
    } else {
      this.events.onSubscribe();
    }
  };

  handleSocketError = (error: ErrorEvent) => {
    this.events.onError('WebSocket', error);
  };

  handleSocketClose = (event: CloseEvent) => {
    this.events.onClose(event);
  };

  submitOp = async (ops: any) => new Promise<void>((resolve, reject) => {
    this.doc.submitOp(ops, {}, (err) => {
      if (err) {
        console.error(`invalid op, ${err.message}, ${JSON.stringify(ops)}`);
        reject(err);
      } else {
        resolve();
      }
    });
  });

  createDoc = async (data: DocObject) => new Promise<void>((resolve, reject) => {
    this.doc.create(data, JSON1_TYPE_NAME, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  insertChildContainer = async (containerId: string, blocks: DocBlock[]) => {
    const ops = ['blocks', containerId, { i: blocks }];
    return this.submitOp(ops);
  };

  deleteChildContainer = async (containerId: string) => {
    const ops = ['blocks', containerId, { r: true }];
    return this.submitOp(ops);
  };

  insertBlock = async (containerId: string, index: number, obj: unknown) => {
    const ops = ['blocks', containerId, index, { i: obj }];
    return this.submitOp(ops);
  };

  deleteBlock = async (containerId: string, index: number) => {
    const ops = ['blocks', containerId, index, { r: true }];
    return this.submitOp(ops);
  };

  updateBlockData = async (containerId: string, index: number, delta: DocBlockDelta) => {
    if (delta.delete.length === 0 && Object.keys(delta.insert).length === 0) {
      return Promise.resolve();
    }
    //
    const ops: (string | number | (string | object)[])[] = ['blocks', containerId, index];
    //
    const deletedKeysSet = new Set(delta.delete);
    Object.entries(delta.insert).forEach(([key, value]) => {
      if (deletedKeysSet.has(key)) {
        const op = { r: true, i: value };
        ops.push([key, op]);
      }
    });
    //
    delta.delete.forEach((key) => {
      if (deletedKeysSet.has(key)) return;
      const op = { r: true };
      ops.push([key, op]);
    });
    Object.entries(delta.insert).forEach(([key, value]) => {
      if (deletedKeysSet.has(key)) return;
      const op = { i: value };
      ops.push([key, op]);
    });
    //
    return this.submitOp(ops);
  };

  updateRichText = async (containerId: string, index: number, ops: any[]) => {
    const op = ['blocks', containerId, index, 'text', { e: ops, et: 'rich-text' }];
    return this.submitOp(op);
  };
}
