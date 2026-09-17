/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObject, SavedObjectsClientContract } from '@kbn/core-saved-objects-api-server';
import { DEFAULT_SPACE_ID } from '@kbn/core-spaces-common';
import { ALL_SPACES_ID } from '@kbn/spaces-plugin/common/constants';

export type NamespacedSingleton<T> = T & { spaces: string[] };

export interface NamespacedSingletonRepositoryOptions<T extends object> {
  soType: string;
  objectId: string;
  defaults: T;
  // Other well-known ids of this type. Ignored when resolving this singleton, and
  // used as the exclusion list when falling back to a pre-id (unnamed) document.
  siblingIds?: string[];
  // CCS documents were created without a well-known id. When the named id is
  // missing, pick the newest remaining object of this type (excluding siblings).
  allowUnnamedLegacy?: boolean;
}

const FIND_PER_PAGE = 100;

// The "all spaces" wildcard is mutually exclusive with specific space ids: a saved object
// cannot have both `*` and concrete spaces in its `namespaces`. Collapse here so the wildcard
// always wins when the caller passes both.
const normalizeSharedSpaces = (spaces: string[]): string[] =>
  spaces.includes(ALL_SPACES_ID) ? [ALL_SPACES_ID] : spaces;

const isVisibleInCurrentSpace = (
  namespaces: string[] | undefined,
  currentSpace: string
): boolean => {
  if (!namespaces?.length) {
    return false;
  }
  return namespaces.includes(ALL_SPACES_ID) || namespaces.includes(currentSpace);
};

const selectCanonicalObject = <T extends object>(objects: Array<SavedObject<T>>): SavedObject<T> =>
  [...objects].sort((left, right) => {
    const leftUpdatedAt = left.updated_at ? new Date(left.updated_at).getTime() : 0;
    const rightUpdatedAt = right.updated_at ? new Date(right.updated_at).getTime() : 0;
    return rightUpdatedAt - leftUpdatedAt;
  })[0];

// One named document of a multi-namespace type. Lookups search across all spaces
// and pick that id; saves update it (or create it with the well-known id).
export class NamespacedSingletonRepository<T extends object> {
  private readonly soType: string;
  private readonly objectId: string;
  private readonly defaults: T;
  private readonly siblingIds: Set<string>;
  private readonly allowUnnamedLegacy: boolean;

  constructor(
    private readonly soClient: SavedObjectsClientContract,
    options: NamespacedSingletonRepositoryOptions<T>
  ) {
    this.soType = options.soType;
    this.objectId = options.objectId;
    this.defaults = options.defaults;
    this.siblingIds = new Set(options.siblingIds ?? []);
    this.allowUnnamedLegacy = options.allowUnnamedLegacy ?? false;
  }

  async get(): Promise<NamespacedSingleton<T>> {
    const existing = await this.findExistingObject({ visibleInCurrentSpaceOnly: true });

    if (!existing) {
      return {
        ...this.defaults,
        spaces: [this.currentNamespace()],
      };
    }

    return {
      ...this.applyDefaults(existing.attributes),
      spaces: existing.namespaces ?? [this.currentNamespace()],
    };
  }

  async save(settings: Partial<T>, spaces?: string[]): Promise<NamespacedSingleton<T>> {
    const merged = this.applyDefaults(settings);

    // Search globally so a save from any space updates the existing singleton instead of
    // creating a second document when a space-scoped find would have returned nothing.
    const existing = await this.findExistingObject();

    if (existing) {
      // `update` and `updateObjectsSpaces` both require the saved object to be visible in the
      // current namespace context. When the singleton lives in spaces the caller cannot see,
      // scope the client to one of the SO's existing namespaces so the writes succeed.
      const writeClient = this.scopedWriteClient(existing.namespaces);
      const updated = this.mergeForUpdate(existing.attributes, settings);

      await writeClient.update<T>(this.soType, existing.id, updated);

      const effectiveSpaces = await this.reconcileSpaces(
        writeClient,
        existing.id,
        existing.namespaces ?? [],
        spaces
      );

      return { ...updated, spaces: effectiveSpaces };
    }

    const initialNamespaces = spaces?.length
      ? normalizeSharedSpaces(spaces)
      : [this.currentNamespace()];
    await this.soClient.create<T>(this.soType, merged, {
      id: this.objectId,
      initialNamespaces,
    });
    return { ...merged, spaces: initialNamespaces };
  }

  private async findExistingObject({
    visibleInCurrentSpaceOnly = false,
  }: {
    visibleInCurrentSpaceOnly?: boolean;
  } = {}): Promise<SavedObject<T> | undefined> {
    const response = await this.soClient.find<T>({
      type: this.soType,
      perPage: FIND_PER_PAGE,
      namespaces: [ALL_SPACES_ID],
    });

    let candidates = response.saved_objects;

    if (visibleInCurrentSpaceOnly) {
      const currentSpace = this.currentNamespace();
      candidates = candidates.filter((object) =>
        isVisibleInCurrentSpace(object.namespaces, currentSpace)
      );
    }

    const named = candidates.filter((object) => object.id === this.objectId);
    if (named.length > 0) {
      return selectCanonicalObject(named);
    }

    if (!this.allowUnnamedLegacy) {
      return undefined;
    }

    const unnamed = candidates.filter(
      (object) => object.id !== this.objectId && !this.siblingIds.has(object.id)
    );
    if (unnamed.length === 0) {
      return undefined;
    }

    return selectCanonicalObject(unnamed);
  }

  private async reconcileSpaces(
    soClient: SavedObjectsClientContract,
    id: string,
    currentSpaces: string[],
    requestedSpaces: string[] | undefined
  ): Promise<string[]> {
    if (!requestedSpaces?.length) {
      return currentSpaces;
    }

    const normalizedRequested = normalizeSharedSpaces(requestedSpaces);
    const currentSet = new Set(currentSpaces);
    const requestedSet = new Set(normalizedRequested);
    const spacesToAdd = normalizedRequested.filter((space) => !currentSet.has(space));
    const spacesToRemove = currentSpaces.filter((space) => !requestedSet.has(space));

    if (spacesToAdd.length === 0 && spacesToRemove.length === 0) {
      return currentSpaces;
    }

    await soClient.updateObjectsSpaces([{ id, type: this.soType }], spacesToAdd, spacesToRemove);

    return normalizedRequested;
  }

  private scopedWriteClient(existingNamespaces: string[] | undefined): SavedObjectsClientContract {
    const currentSpace = this.currentNamespace();
    const isVisibleHere =
      existingNamespaces?.includes(ALL_SPACES_ID) || existingNamespaces?.includes(currentSpace);

    if (isVisibleHere || !existingNamespaces?.length) {
      return this.soClient;
    }

    return this.soClient.asScopedToNamespace(existingNamespaces[0]);
  }

  private currentNamespace(): string {
    return this.soClient.getCurrentNamespace() ?? DEFAULT_SPACE_ID;
  }

  private applyDefaults(settings: Partial<T>): T {
    return this.overlayDefined(this.defaults, settings);
  }

  private mergeForUpdate(existing: Partial<T>, incoming: Partial<T>): T {
    return this.overlayDefined(this.applyDefaults(existing), incoming);
  }

  private overlayDefined(base: T, incoming: Partial<T>): T {
    const next = { ...base };
    (Object.keys(this.defaults) as Array<keyof T>).forEach((key) => {
      const value = incoming[key];
      if (value !== undefined) {
        next[key] = value as T[keyof T];
      }
    });
    return next;
  }
}
