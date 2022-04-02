/* eslint-disable no-lonely-if */
/* eslint-disable max-classes-per-file */
import ReconnectingWebSocket, { ErrorEvent, CloseEvent } from 'reconnecting-websocket';
import { Connection, Doc, LocalPresence, Presence, types as ShareDBTypes } from 'sharedb/lib/client';
import richText from '@nexteditorjs/nexteditor-core/dist/ot-types/rich-text';
import * as json1 from 'ot-json1';
import { assert, DocBlock, DocBlockDelta, DocObject, genId, getLogger, RemoteUsers, toBase64URL } from '@nexteditorjs/nexteditor-core';
import { ClientError, ErrorType, ShareDBDocOptions, ShareDBError } from './options';
import { NextEditorCustomMessage, NextEditorInitMessage, NextEditorJoinMessage, NextEditorPresenceMessage, NextEditorUser, NextEditorWelcomeMessage } from '../messages';

const console = getLogger('client');

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

  private presence: Presence;

  private localPresence: LocalPresence | null = null;

  private orgMessageHandler: ((event: MessageEvent<unknown>) => void) | null;

  private docUser: NextEditorUser | null = null;

  public remoteUsers: RemoteUsers = new RemoteUsers();

  public clientId = genId();

  doc: Doc;

  constructor(private options: ShareDBDocOptions, private events: ShareDBDocClientEvent) {
    const protocols = JSON.stringify({ token: options.token, clientId: this.clientId });
    this.socket = new ReconnectingWebSocket(`${options.server}/${options.collectionName}/${options.documentId}`, toBase64URL(protocols));
    this.socket.onerror = this.handleSocketError;
    this.socket.onclose = this.handleSocketClose;
    this.connection = new Connection(this.socket as any);
    this.orgMessageHandler = this.socket.onmessage;
    this.socket.onmessage = this.handleWebsocketMessage;
    this.doc = this.connection.get(options.collectionName, options.documentId);
    this.doc.preventCompose = true;
    this.presence = this.connection.getPresence(`${options.collectionName}/${options.documentId}`);
    this.presence.subscribe(this.handleSubscribePresence);
  }

  get data() {
    return this.doc.data;
  }

  get user() {
    assert(this.docUser, 'user have not initialized');
    return this.docUser;
  }

  destroy() {
    this.presence.unsubscribe();
    this.doc.removeAllListeners();
    this.connection.close();
  }

  handleSubscribe = (error: ShareDBError | undefined) => {
    if (error) {
      this.events.onError('Subscribe', error);
    } else {
      this.events.onSubscribe();
      this.sendJoinMessage();
    }
  };

  handleSubscribePresence = (error: unknown) => {
    if (error) {
      this.events.onError('Presence', new Error('failed to subscribe presence'));
    }
    this.presence.on('receive', this.handlePresenceMessage);
  };

  handleSocketError = (error: ErrorEvent) => {
    this.events.onError('WebSocket', error);
  };

  handleSocketClose = (event: CloseEvent) => {
    this.events.onClose(event);
  };

  handleWebsocketMessage = (event: MessageEvent<unknown>): void => {
    if (this.handleCustomMessage(event)) {
      return;
    }
    if (this.orgMessageHandler) {
      this.orgMessageHandler(event);
    }
  };

  handleCustomMessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== 'string') {
      return false;
    }
    //
    try {
      const message = JSON.parse(data) as NextEditorCustomMessage;
      if (typeof message === 'object' && typeof message.nexteditor === 'string') {
        this.handleKnownCustomMessage(message);
        return true;
      }
    } catch (err) {
      console.error(JSON.stringify(err));
    }
    return false;
  };

  handleKnownCustomMessage = (message: NextEditorCustomMessage) => {
    if (message.nexteditor === 'init') {
      this.handleInitMessage(message as NextEditorInitMessage);
    } else if (message.nexteditor === 'welcome') {
      this.handleWelcomeMessage(message as NextEditorWelcomeMessage);
    }
  };

  handleInitMessage = (message: NextEditorInitMessage) => {
    if (this.localPresence) {
      console.debug('reconnected');
      assert(this.docUser, 'user not exists');
      assert(this.docUser.userId === message.user.userId, 'reconnect, user does not match');
      this.docUser = message.user;
      return;
    }
    this.docUser = message.user;
    assert(!this.localPresence, 'local presence has already exists');
    this.localPresence = this.presence.create(this.docUser.clientId);
    this.doc.subscribe(this.handleSubscribe);
    this.doc.on('op', this.events.onOp);
  };

  handleWelcomeMessage = (message: NextEditorWelcomeMessage) => {
    this.remoteUsers.addUsers(message.onlineUsers);
  };

  handlePresenceMessage = (id: string, value: unknown) => {
    const message = value as NextEditorPresenceMessage;
    if (message?.nexteditor === 'join') {
      console.debug(`${message.user.name} [${message.user.clientId}]join`);
      this.remoteUsers.addUser(message.user);
    } else if (message?.nexteditor === 'cursor') {
      this.remoteUsers.setCursor(message);
    } else if (value === null) {
      this.remoteUsers.removeUser(id);
    }
  };

  sendJoinMessage = () => {
    assert(this.localPresence, 'no local presence');
    assert(this.user, 'fault error, not joined');
    console.debug(`send join message, ${this.user.name} [${this.user.clientId}]`);
    const joinMessage: NextEditorJoinMessage = {
      nexteditor: 'join',
      user: this.user,
    };
    this.localPresence.submit(joinMessage);
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

  broadcastClientMessages = (data: NextEditorPresenceMessage): Promise<void> => {
    if (!this.localPresence) {
      return Promise.reject(new Error('not connected'));
    }
    return new Promise((resolve, reject) => {
      assert(this.localPresence);
      this.localPresence.submit(data, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };
}
