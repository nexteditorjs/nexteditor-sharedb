import { DocObject } from '@nexteditorjs/nexteditor-core';
import { ErrorEvent } from 'reconnecting-websocket';
import { Error as ShareDBError } from 'sharedb/lib/client';

export { ShareDBError };

export type ErrorType = 'WebSocket' | 'Subscribe' | 'Presence';

export type ClientError = Error | ErrorEvent | ShareDBError;

export type ShareDBDocOptions = {
  server: string;
  collectionName: string;
  documentId: string;
  token: string;
  docTemplate?: DocObject;
  onDocError: (type: ErrorType, error: unknown) => void;
};
