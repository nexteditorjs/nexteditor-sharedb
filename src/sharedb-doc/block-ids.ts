/* eslint-disable max-classes-per-file */

import { assert, genId, getLogger } from '@nexteditorjs/nexteditor-core';

const logger = getLogger('block-ids');

class BlockIds {
  private ids = new Map<number, string>();

  onInsertBlock(blockIndex: number) {
    const indexes = Array.from(this.ids.keys()).sort((n1, n2) => n2 - n1);
    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i];
      if (index >= blockIndex) {
        const oldId = this.ids.get(index);
        assert(logger, oldId !== undefined, 'old id is not exists');
        this.ids.delete(index);
        this.ids.set(index + 1, oldId);
      }
    }
    const newId = genId();
    this.ids.set(blockIndex, newId);
  }

  onDeleteBlock(blockIndex: number) {
    this.ids.delete(blockIndex);
    //
    const indexes = Array.from(this.ids.keys()).sort((n1, n2) => n1 - n2);
    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i];
      if (index > blockIndex) {
        const oldId = this.ids.get(index);
        assert(logger, oldId !== undefined, 'old id is not exists');
        this.ids.delete(index);
        this.ids.set(index - 1, oldId);
      }
    }
  }

  getId(blockIndex: number) {
    let id = this.ids.get(blockIndex);
    if (!id) {
      id = genId();
      this.ids.set(blockIndex, id);
    }
    return id;
  }

  getById(id: string) {
    return Array.from(this.ids.entries()).find(([, value]) => value === id);
  }
}

export class ContainerBlockIds {
  private ids = new Map<string, BlockIds>();

  private getContainerIds(containerId: string) {
    let ret = this.ids.get(containerId);
    if (!ret) {
      ret = new BlockIds();
      this.ids.set(containerId, ret);
    }
    return ret;
  }

  onInsertBlock(containerId: string, blockIndex: number) {
    this.getContainerIds(containerId).onInsertBlock(blockIndex);
  }

  onDeleteBlock(containerId: string, blockIndex: number) {
    this.getContainerIds(containerId).onDeleteBlock(blockIndex);
  }

  getBlockId(containerId: string, blockIndex: number) {
    return this.getContainerIds(containerId).getId(blockIndex);
  }

  getBlockIndexById(id: string) {
    const entries = Array.from(this.ids.entries());
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const ret = entry[1].getById(id);
      if (ret) {
        return {
          containerId: entry[0],
          blockIndex: ret[0],
        };
      }
    }
    assert(logger, false, 'fault error: failed to get block index');
    return { containerId: 'error', blockIndex: -1 };
  }
}
