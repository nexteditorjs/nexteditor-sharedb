/* eslint-disable max-classes-per-file */
import { assert, DocBlock, DocBlockTextActions } from '@nexteditorjs/nexteditor-core';
import cloneDeep from 'lodash.clonedeep';
import { Op } from 'sharedb';
import { ContainerBlockIds } from './block-ids';
import OpBlockDataDelta from './op-block-delta';
// import testJson from './test.json';

export interface OpParserHandler {
  onDeleteBlock: (containerId: string, blockIndex: number, local: boolean) => void;
  onInsertBlock: (containerId: string, blockIndex: number, data: DocBlock, local: boolean) => void;
  onUpdateBlockData: (containerId: string, blockIndex: number, data: OpBlockDataDelta, local: boolean) => void;
  onUpdateBlockText: (containerId: string, blockIndex: number, richTextData: DocBlockTextActions, local: boolean) => void;
  onDeleteContainer: (containerId: string, local: boolean) => void;
  onCreateContainer: (containerId: string, data: DocBlock[], local: boolean) => void;
}

class InternalParser {
  updatingBlockDataDeltaMap = new Map<string, OpBlockDataDelta>();

  blockIds = new ContainerBlockIds();

  constructor(private handler: OpParserHandler, public local: boolean) {
  }

  onDeleteBlock(containerId: string, blockIndex: number): void {
    const blockId = this.blockIds.getBlockId(containerId, blockIndex);
    this.blockIds.onDeleteBlock(containerId, blockIndex);
    const ignoreObjectData = this.updatingBlockDataDeltaMap.get(blockId);
    if (ignoreObjectData) {
      console.debug(`ignore update object data before delete block: ${JSON.stringify(ignoreObjectData)}`);
      this.updatingBlockDataDeltaMap.delete(blockId);
    }
    this.handler.onDeleteBlock(containerId, blockIndex, this.local);
  }

  onInsertBlock(containerId: string, blockIndex: number, data: DocBlock): void {
    this.blockIds.onInsertBlock(containerId, blockIndex);
    this.handler.onInsertBlock(containerId, blockIndex, data, this.local);
  }

  onUpdateBlockText(containerId: string, blockIndex: number, actions: DocBlockTextActions): void {
    this.handler.onUpdateBlockText(containerId, blockIndex, actions, this.local);
  }

  onDeleteBlockData(containerId: string, blockIndex: number, key: string) {
    const blockId = this.blockIds.getBlockId(containerId, blockIndex);
    let delta = this.updatingBlockDataDeltaMap.get(blockId);
    if (!delta) {
      delta = new OpBlockDataDelta();
      this.updatingBlockDataDeltaMap.set(blockId, delta);
    }
    delta.delete(key);
  }

  onInsertBlockData(containerId: string, blockIndex: number, key: string, value: unknown) {
    const blockId = this.blockIds.getBlockId(containerId, blockIndex);
    let delta = this.updatingBlockDataDeltaMap.get(blockId);
    if (!delta) {
      delta = new OpBlockDataDelta();
      this.updatingBlockDataDeltaMap.set(blockId, delta);
    }
    delta.insert(key, value);
  }

  executeUpdateBlockDataActions() {
    Array.from(this.updatingBlockDataDeltaMap.entries()).forEach(([blockId, objectData]) => {
      const { containerId, blockIndex } = this.blockIds.getBlockIndexById(blockId);
      this.handler.onUpdateBlockData(containerId, blockIndex, objectData, this.local);
    });
  }
}

enum ParseType {
  REMOVE = 'remove',
  UPSERT = 'upsert',
}

class DeleteBlockAction {
}

class DeleteBlockDataAction {
  key: string;

  constructor(key: string) {
    this.key = key;
  }
}

function parseInsertBlockOnlyOp(containerId: string, orgOps: Op[], parser: InternalParser) {
  const ops = orgOps.concat();
  const blockIndex = ops[0] as unknown as number;
  if (typeof blockIndex !== 'number') {
    return false;
  }
  ops.shift();
  //
  if (ops.length === 1) {
    return false;
  }
  //
  const firstOp = ops[0] as any;
  if (typeof firstOp !== 'object') {
    return false;
  }
  if (!firstOp.i || Object.keys(firstOp).length !== 1) {
    return false;
  }
  //
  for (let i = 1; i < ops.length; i++) {
    const nextOp = ops[i];
    if (!Array.isArray(nextOp)) {
      return false;
    }
    if (nextOp.length !== 2) {
      return false;
    }
    const key = nextOp[0];
    if (typeof key !== 'string') {
      return false;
    }
    const op = nextOp[1];
    if (typeof op !== 'object') {
      return false;
    }
    if (op.i === undefined || Object.keys(op).length !== 1) {
      return false;
    }
  }
  //
  const blockData: any = firstOp.i;
  assert(blockData.id);
  assert(blockData.type);

  for (let i = 1; i < ops.length; i++) {
    const nextOp = ops[i] as unknown as Array<any>;
    const key = nextOp[0];
    const op = nextOp[1];
    blockData[key] = op.i;
  }
  //
  parser.onInsertBlock(containerId, blockIndex, blockData);
  //
  return true;
}

function parseBlockOp(containerId: string, orgOps: Op[], processType: ParseType, processor: InternalParser): void {
  //
  if (processType === ParseType.UPSERT && parseInsertBlockOnlyOp(containerId, orgOps, processor)) {
    return;
  }
  //
  assert(Array.isArray(orgOps), `invalid block op: ${containerId}, ${JSON.stringify(orgOps)}`);
  //
  const ops = orgOps.concat();
  const blockIndex = ops[0] as unknown as number;
  ops.shift();
  //
  const removeActions = [];
  //
  while (ops.length > 0) {
    //
    const data = ops[0] as any;
    if (data === 'text') {
      // skip text op
      const opData: any = ops[1];
      assert(typeof opData === 'object');
      assert(opData.et === 'rich-text');
      ops.splice(0, 2);
      //
      if (processType === ParseType.UPSERT) {
        //
        const deltaOps = opData.e;
        const richTextData = deltaOps as DocBlockTextActions;
        processor.onUpdateBlockText(containerId, blockIndex, richTextData);
      }
      // no more ops
      assert(ops.length === 0);
    } else if (Array.isArray(data)) { // update block data
      //
      assert(data.length === 2);
      const key = data[0] as string;
      assert(typeof key === 'string');
      //
      const opData: any = data[1];
      //
      if (key === 'text') {
        //
        assert(typeof opData === 'object');
        //
        if (opData.i) {
          if (processType === ParseType.UPSERT) {
            processor.onInsertBlockData(containerId, blockIndex, key, opData.i);
          }
        }
        //
        if (opData.r) {
          if (processType === ParseType.REMOVE) {
            processor.onDeleteBlockData(containerId, blockIndex, key);
          }
        }
        //
        if (opData.et === 'rich-text') {
          if (processType === ParseType.UPSERT) {
            const deltaOps = opData.e;
            const richTextData = deltaOps as DocBlockTextActions;
            processor.onUpdateBlockText(containerId, blockIndex, richTextData);
          }
        }
        //
      } else {
        //
        // update / delete / insert block data
        if (processType === ParseType.REMOVE) {
          if (opData.r) {
            removeActions.push(new DeleteBlockDataAction(key));
          }
        }
        //
        if (processType === ParseType.UPSERT) {
          if (opData.i) {
            processor.onInsertBlockData(containerId, blockIndex, key, opData.i);
          }
        }
        //
      }
      //
      ops.shift();
      //
    } else if (typeof data === 'object') {
      // remove / insert block (block options)
      //
      const opData = data as any;
      if (processType === ParseType.REMOVE) {
        if (opData.r) {
          // remove
          removeActions.push(new DeleteBlockAction());
        }
      }
      //
      if (processType === ParseType.UPSERT) {
        if (opData.i) {
          processor.onInsertBlock(containerId, blockIndex, opData.i);
        }
      }
      //
      ops.shift();
      //
    } else {
      //
      assert(typeof data === 'string');
      assert(data !== 'text');
      assert(ops.length === 2);
      //
      const key = data;
      const opData: any = ops[1];
      // update / delete / insert block data
      if (processType === ParseType.REMOVE) {
        if (opData.r) {
          removeActions.push(new DeleteBlockDataAction(key));
        }
      }
      //
      if (processType === ParseType.UPSERT) {
        if (opData.i) {
          processor.onInsertBlockData(containerId, blockIndex, key, opData.i);
        }
      }
      //
      ops.splice(0, 2);
    }
    //
  }
  //
  removeActions.reverse();
  //
  removeActions.forEach((a) => {
    //
    if (a instanceof DeleteBlockAction) {
      processor.onDeleteBlock(containerId, blockIndex);
    } else if (a instanceof DeleteBlockDataAction) {
      processor.onDeleteBlockData(containerId, blockIndex, a.key);
    } else {
      assert(false, `invalid action type: ${typeof a}, ${JSON.stringify(a)}`);
    }
  });
}

function parseMetaOp(ops: Op[], parseType: ParseType, parser: InternalParser, handler: OpParserHandler) {
  console.warn(`unsupported meta op, ${JSON.stringify(ops)}`);
}

function parseOp(ops: Op[], parseType: ParseType, parser: InternalParser, handler: OpParserHandler) {
  //
  const rootKey = ops[0] as unknown as string;
  if (rootKey === 'meta') {
    // parse meta
    parseMetaOp(ops, parseType, parser, handler);
    return;
  }
  //
  assert(rootKey === 'blocks', `invalid op path: ${JSON.stringify(ops)}`);
  //
  const containerId = ops[1] as unknown as string;
  //
  if (Array.isArray(containerId)) {
    // multi container op
    const subOps = ops.slice(1) as unknown as Op[][];
    subOps.forEach((subOp) => {
      const newOp = [rootKey, ...subOp];
      parseOp(newOp as Op[], parseType, parser, handler);
      //
    });
    //
    return;
  }
  //
  assert(typeof containerId === 'string', `invalid container id: ${JSON.stringify(ops)}`);
  //
  if (Array.isArray(ops[2])) {
    if (parseType === ParseType.REMOVE) {
      ops.slice(2).reverse().forEach((op) => {
        parseBlockOp(containerId, op as unknown as Op[], parseType, parser);
      });
    } else {
      ops.slice(2).forEach((op) => {
        parseBlockOp(containerId, op as unknown as Op[], parseType, parser);
      });
    }
    //
  } else {
    // eslint-disable-next-line no-lonely-if
    if (typeof ops[2] === 'object') {
      // remove container,
      const action = ops[2] as any;
      if (action.r) {
        if (parseType === ParseType.REMOVE) {
          handler.onDeleteContainer(containerId, parser.local);
        }
      }
      if (action.i) {
        if (parseType === ParseType.UPSERT) {
          handler.onCreateContainer(containerId, action.i, parser.local);
        }
      }
    } else {
      assert(typeof ops[2] === 'number');
      parseBlockOp(containerId, ops.slice(2), parseType, parser);
    }
  }
}

export function parseOps(orgOps: Op[], handler: OpParserHandler, local: boolean) {
  //
  const parser = new InternalParser(handler, local);
  //
  for (let i = 0; i < 2; i++) {
    const parseType = i === 0 ? ParseType.REMOVE : ParseType.UPSERT;
    const ops = cloneDeep(orgOps);
    const first = ops[0];
    //
    if (Array.isArray(first)) {
      ops.forEach((op) => {
        parseOp(op as unknown as Op[], parseType, parser, handler);
      });
    } else {
      parseOp(ops, parseType, parser, handler);
    }
  }
  //
  parser.executeUpdateBlockDataActions();
}
