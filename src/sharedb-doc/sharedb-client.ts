/* eslint-disable no-lonely-if */
/* eslint-disable max-classes-per-file */
import isEqual from 'lodash.isequal';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { Connection, Doc, Error as ShareDBError, types as ShareDBTypes } from 'sharedb/lib/client';
import richText from '@nexteditorjs/nexteditor-core/dist/ot-types/rich-text';
import * as json1 from 'ot-json1';
import { ShareDBDocOptions } from './options';

const JSON1_TYPE_NAME = 'ot-json1';

json1.type.registerSubtype(richText.type);
json1.type.name = JSON1_TYPE_NAME;
ShareDBTypes.register(json1.type);

export { ShareDBError };

interface ShareDBDocClientEvent {
  onSubscribe: (err: ShareDBError) => void;
  onOp: (ops: any[], source: any, clientId: string) => void;
}

export default class ShareDBDocClient {
  private socket: ReconnectingWebSocket;

  private connection: Connection;

  doc: Doc;

  constructor(private options: ShareDBDocOptions, private events: ShareDBDocClientEvent) {
    this.socket = new ReconnectingWebSocket(options.server);
    this.connection = new Connection(this.socket as any);
    this.doc = this.connection.get(options.collectionName, options.documentId);
    this.doc.subscribe(this.events.onSubscribe);
    this.doc.on('op', this.events.onOp);
  }

  get data() {
    return this.doc.data;
  }

  submitOp = async (ops: any) => new Promise<void>((resolve, reject) => {
    this.doc.submitOp(ops, {}, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  createDoc = async (data: unknown) => new Promise<void>((resolve, reject) => {
    this.doc.create(data, JSON1_TYPE_NAME, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  insertObject = async (rootObjectName: string, index: number, obj: unknown) => {
    const ops = [rootObjectName, index, { i: obj }];
    return this.submitOp(ops);
  };

  deleteObject = async (rootObjectName: string, index: number) => {
    const ops = [rootObjectName, index, { r: true }];
    return this.submitOp(ops);
  };

  replaceObject = async (rootObjectName: string, index: number, obj: unknown) => {
    const ops = [rootObjectName, index, { r: true, i: obj }];
    return this.submitOp(ops);
  };

  updateObject = async (rootObjectName: string, index: number, obj: { [index: string]: unknown }) => {
    const oldData = this.data[rootObjectName][index];
    const ops: (string | number | (string | object)[])[] = [rootObjectName, index];
    Object.entries(obj).forEach(([key, newValue]) => {
      if (isEqual(oldData[key], newValue)) {
        // skip
      } else {
        //
        if (oldData[key] === undefined) {
          // old not exist, try insert (if needed)
          if (newValue === undefined || newValue === null) {
            //
          } else {
            const op = { i: newValue };
            ops.push([key, op]);
          }
        } else {
          // old exists, remove & insert (if needed)
          if (newValue === undefined || newValue === null) {
            const op = { r: true };
            ops.push([key, op]);
          } else {
            const op = { r: true, i: newValue };
            ops.push([key, op]);
          }
        }
      }
    });
    //
    Object.entries(oldData).forEach(([key, value]) => {
      // set key to undefined or null to delete key
      if (obj[key] === undefined || obj[key] === null) {
        if (value !== undefined) {
          const op = { r: true };
          ops.push([key, op]);
        }
      }
    });
    if (ops.length <= 2) {
      return Promise.resolve();
    }
    return this.submitOp(ops);
  };

  updateRichText = async (rootObjectName: string, index: number, ops: any[]) => {
    const op = [rootObjectName, index, 'text', { e: ops, et: 'rich-text' }];
    return this.submitOp(op);
  };
}
