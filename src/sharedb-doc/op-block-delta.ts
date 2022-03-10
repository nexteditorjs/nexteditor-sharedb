import { DocBlockAttributes, DocBlockDelta } from '@nexteditorjs/nexteditor-core';

export default class OpBlockDataDelta {
  constructor(
    private deletedKeys = new Set<string>(),
    private insertedValues = new Map<string, unknown>(),
  ) {}

  insert(key: string, value: unknown) {
    this.insertedValues.set(key, value);
  }

  delete(key: string) {
    this.deletedKeys.add(key);
  }

  toDocBlockDelta(): DocBlockDelta {
    //
    const insert: DocBlockAttributes = {};
    this.insertedValues.forEach((value, key) => {
      insert[key] = value;
    });
    //
    return {
      insert,
      delete: Array.from(this.deletedKeys),
    };
  }
}
