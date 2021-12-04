import { ApolloClient } from '@apollo/client';
import { link } from 'fs';
import Debug from 'debug';
import { DENIED_IDS, GLOBAL_ID_CONTAIN, GLOBAL_ID_PACKAGE, GLOBAL_ID_PACKAGE_ACTIVE, GLOBAL_ID_PACKAGE_NAMESPACE, GLOBAL_ID_PACKAGE_VERSION, GLOBAL_ID_TABLE, GLOBAL_ID_TABLE_VALUE, GLOBAL_NAME_CONTAIN, GLOBAL_NAME_PACKAGE, GLOBAL_NAME_TABLE, GLOBAL_NAME_TABLE_VALUE } from './global-ids';
import { deleteMutation, generateMutation, generateSerial, insertMutation, updateMutation } from './gql';
import { generateQuery, generateQueryData } from './gql/query';
import { MinilinksResult, Link, LinkPlain, minilinks } from './minilinks';
import { awaitPromise } from './promise';
import { reserve } from './reserve';
import { DeepClient } from './client';

const debug = Debug('deeplinks:packager');

export interface PackagerPackageIdentifier {
  name: string;
  version?: string;
  uri?: string;
  type?: string;
  options?: any;
  // typeId?: number; TODO
}

export interface PackagerPackage {
  package: PackagerPackageIdentifier;
  data: PackagerPackageItem[];
  dependencies?: { [id: number]: PackagerPackageIdentifier };
  strict?: boolean;
  errors?: PackagerError[];
}

export interface PackagerPackageItem {
  id: number | string;
  type?: number | string;
  from?: number | string;
  to?: number | string;
  value?: PackagerValue;

  package?: { dependencyId: number; containValue: string; };
}

export interface PackagerValue {
  [key: string]: any;
}

export type PackagerError = any;

export interface PackagerImportResult {
  errors?: PackagerError[];
  ids?: number[];
}

export type PackagerMutated = { [index: number]: boolean };

export interface PackagerExportOptions {
  packageLinkId: number;
}

export interface PackagerLink extends Link<any> {
  value?: any;
}

/** Generate inserting order for links and values. */
export function sort(
  pckg: PackagerPackage,
  data: PackagerPackageItem[],
  errors: PackagerError[] = [],
) {
  let sorted = [];
  if (pckg.strict) {
    sorted = data;
  } else {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item.value && !item.type) {
        const max = sorted.reduce((p, l, index) => l.id == item.id ? index : p, 0);
        sorted.splice((max) + 1, 0, item);
      } else if (item.package) {
        sorted.splice(0, 0, item);
      } else {
        // @ts-ignore
        const _ = item?._;
        const firstDependIndex = sorted.findIndex((l, index) => {
          return l.from == item.id || l.to == item.id || (
            // @ts-ignore
            (l.type == item.id) && !l._
          );
        });
        const maxDependIndex = sorted.reduce((p, l, index) => {
          return ((l.id == item.type) && !_) || l.id == item.from || l.id === item.to ? index : p;
        }, 0);
        const _index = (!!~firstDependIndex && firstDependIndex < maxDependIndex ? firstDependIndex : maxDependIndex)
        sorted.splice(_index + 1, 0, item);
      }
    }
  }
  return { sorted };
}

export class Packager<L extends Link<any>> {
  pckg: PackagerPackage;
  client: DeepClient<any>;
  constructor(client: DeepClient<L>) {
    this.client = client;
    // @ts-ignore
    global.packager = this;
  }

  /**
   * Fetch package namespace.
   */
  async fetchPackageNamespaceId(
    name: string,
  ): Promise<{ error: any, namespaceId: number }> {
    try {
      const tables = await this.fetchTableNamesValuedToTypeId([GLOBAL_ID_PACKAGE_NAMESPACE], []);
      const q = await this.client.select({ value: { _eq: name }, }, {
        table: `table${tables[GLOBAL_ID_PACKAGE_NAMESPACE]}`,
        returning: 'id: link_id'
      });
      return { error: false, namespaceId: q?.data?.[0]?.id };
    } catch(error) {
      debug('fetchPackageNamespaceId error');
      return { error, namespaceId: 0 };
    }
    return { error: true, namespaceId: 0 };
  }

  /**
   * Fetch package namespace.
   */
  async fetchDependenciedLinkId(
    pckg: PackagerPackage,
    dependedLink: PackagerPackageItem,
  ): Promise<number> {
    try {
      const tables = await this.fetchTableNamesValuedToTypeId([GLOBAL_ID_CONTAIN, GLOBAL_ID_PACKAGE], []);
      const packageName = pckg?.dependencies?.[dependedLink?.package?.dependencyId]?.name;
      const packageTableName = `table${tables[GLOBAL_ID_PACKAGE]}`;
      const q = await this.client.select({
        value: { _eq: dependedLink?.package?.containValue },
        link: { from: { [packageTableName]: { value: { _eq: packageName } } } },
      }, {
        table: `table${tables[GLOBAL_ID_CONTAIN]}`,
        returning: 'id link { id: to_id }'
      });
      return q?.data?.[0]?.link?.id || 0;
    } catch(error) {
      debug('fetchDependenciedLinkId error');
      console.log(error);
    }
    return 0;
  }

  /**
   * Fetch tables names by type names.
   */
  async fetchTableNamesValuedToTypeId(
    types: number[],
    errors: PackagerError[],
  ): Promise<{ [type: string]: string }> {
    const result = {};
    try {
      const q = await this.client.select({
        type_id: { _eq: GLOBAL_ID_TABLE },
        out: { type_id: { _eq: GLOBAL_ID_TABLE_VALUE }, to_id: { _in: types } },
      }, {
        returning: `id values: out(where: { type_id: { _eq: ${GLOBAL_ID_TABLE_VALUE} } }) { id: to_id }`
      });
      const tables = (q)?.data;
      for (let t = 0; t < tables.length; t++) {
        const table = tables[t];
        for (let i = 0; i < table.values.length; i++) {
          const type = table.values[i].id;
          if (types.includes(type)) result[type] = table.id;
        }
      }
    } catch(error) {
      debug('fetchTableNamesValuedToTypeId error');
      console.log(error);
      errors.push(error);
    }
    return result;
  }

  async insertItem(
    items: PackagerPackageItem[],
    item: PackagerPackageItem,
    errors: PackagerError[],
    mutated: PackagerMutated,
  ) {
    debug('insertItem', item);
    try {
      // insert link section
      if (item.type) {
        const insert = { id: +item.id, type_id: +item.type, from_id: +item.from || 0, to_id: +item.to || 0 };
        const linkInsert = await this.client.insert(insert, { name: 'IMPORT_PACKAGE_LINK' });
        console.log('linkInsert', insert, linkInsert);
        if (linkInsert?.errors) {
          errors.push(linkInsert?.errors);
        }
      }
      debug('insertItem promise', item.id);
      await this.client.await(+item.id);
      debug('insertItem promise awaited', item.id);
      if (item.value && !item.package) {
        debug('insertItem value', item);
        let valueLink
        if (!item.type) {
          valueLink = items.find(i => i.id === item.id && !!i.type);
          debug('insertItem .value', item, valueLink);
        } else {
          valueLink = item;
        }
        if (!valueLink) {
          errors.push(`Link ${JSON.stringify(item)} for value not founded.`);
        }
        else {
          const tables = await this.fetchTableNamesValuedToTypeId([+valueLink.type], errors);
          debug('insertItem tables', tables);
          if (!tables[valueLink.type]) errors.push(`Table for type ${valueLink.type} for link ${valueLink.id} not founded for insert ${JSON.stringify(item)}.`);
          const valueInsert = await this.client.insert({ link_id: valueLink.id, ...item.value }, { table: `table${tables[valueLink.type]}`, name: 'IMPORT_PACKAGE_VALUE' });
          debug('insertItem valueInsert', valueInsert);
          if (valueInsert?.errors) errors.push(valueInsert?.errors);
        }
      }
    } catch(error) {
      debug('insertItem error');
      console.log(error);
      errors.push(error);
    }
    return;
  }

  async insertItems(
    pckg: PackagerPackage,
    data: PackagerPackageItem[],
    counter: number,
    dependedLinks: PackagerPackageItem[],
    errors: PackagerError[] = [],
    mutated: { [index: number]: boolean } = {},
  ): Promise<any> {
    try {
      for (let i = 0; i < dependedLinks.length; i++) {
        const item = dependedLinks[i];
        await this.insertItem(data, item, errors, mutated);
        if (errors.length) return { ids: [] };
      }
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (!item.package) {
          await this.insertItem(data, item, errors, mutated);
          if (errors.length) return { ids: [] };
        }
      }
      return;
    } catch(error) {
      debug('insertItems error');
      console.log(error);
      errors.push(error);
    }
    return;
  }

  async importNamespace() {
    // const result = await this.client.query(generateQuery({
    //   queries: [
    //     generateQueryData({ tableName: 'links', returning: `
    //       id type_id from_id to_id value
    //       type {
    //         id value
    //         contains: in(where: { type_id: { _eq: ${GLOBAL_ID_CONTAIN} }, from: { type_id: { _eq: ${GLOBAL_ID_PACKAGE} } } }) {
    //           id
    //           package: from {
    //             id value
    //           }
    //         }
    //       }
    //       from {
    //         id
    //         contains: in(where: { type_id: { _eq: ${GLOBAL_ID_CONTAIN} }, from: { type_id: { _eq: ${GLOBAL_ID_PACKAGE} } } }) {
    //           id
    //           package: from {
    //             id value
    //           }
    //         }
    //       }
    //       to {
    //         id
    //         contains: in(where: { type_id: { _eq: ${GLOBAL_ID_CONTAIN} }, from: { type_id: { _eq: ${GLOBAL_ID_PACKAGE} } } }) {
    //           id
    //           package: from {
    //             id value
    //           }
    //         }
    //       }
    //     `, variables: { where: {
    //       _or: [
    //         { id: { _eq: options.packageLinkId } },
    //         { type_id: { _eq: GLOBAL_ID_CONTAIN }, from: { id: { _eq: options.packageLinkId } } },
    //         { in: { type_id: { _eq: GLOBAL_ID_CONTAIN }, from: { id: { _eq: options.packageLinkId } } } },
    //       ]
    //     } } }),
    //   ],
    //   name: 'LOAD_PACKAGE_LINKS',
    // }));
  }

  async updateIds(pckg: PackagerPackage, ids: number[], links: PackagerPackageItem[]) {
    let idsIndex = 0;
    for (let l = 0; l < links.length; l++) {
      const item = links[l];
      const oldId = item.id;
      let newId;
      if (item.package) {
        newId = await this.fetchDependenciedLinkId(pckg, item);
        item.id = newId;
      } else {
        newId = ids[idsIndex++];
      }
      if (item.type || item.package) {
        links.filter(i => (
          i.from === oldId
        )).forEach(l => l.from = newId);
        links.filter(i => (
          i.to === oldId
        )).forEach(l => l.to = newId);
        links.filter(i => (
          i.type === oldId && (
            // @ts-ignore
            !i._
        ))).forEach(l => l.type = newId);
        links.filter(i => (
          i.id === oldId
        )).forEach(l => l.id = newId);
      }
    }
  }

  /**
   * Import into system pckg.
   */
  async import(pckg: PackagerPackage): Promise<PackagerImportResult> {
    const errors = [];
    try {
      if (!pckg?.package?.name) throw new Error(`!pckg?.package?.name`);
      if (!pckg?.package?.version) throw new Error(`!pckg?.package?.version`);
      const { data, counter, dependedLinks } = await this.deserialize(pckg, errors);
      if (errors.length) return { errors };
      const { sorted } = sort(pckg, data, errors);
      if (errors.length) return { errors };
      const mutated = {};
      const ids = await this.client.reserve((counter - dependedLinks.length) + 2);
      await this.updateIds(pckg, ids, sorted);
      await this.insertItems(pckg, sorted, counter, dependedLinks, errors, mutated);
      if (errors.length) return { errors };
      await this.importNamespace();
      return { ids, errors };
    } catch(error) {
      debug('insertItems error');
      console.log(error);
      errors.push(error);
    }
    return { ids: [], errors };
  }

  async selectLinks(options: PackagerExportOptions): Promise<MinilinksResult<PackagerLink>> {
    const result = await this.client.select({
      _or: [
        { id: { _eq: options.packageLinkId } },
        { type_id: { _eq: GLOBAL_ID_CONTAIN }, from: { id: { _eq: options.packageLinkId } } },
        { in: { type_id: { _eq: GLOBAL_ID_CONTAIN }, from: { id: { _eq: options.packageLinkId } } } },
      ]
    }, {
      name: 'LOAD_PACKAGE_LINKS',
      returning: `
          id type_id from_id to_id value
          type {
            id value
            contains: in(where: { type_id: { _eq: ${GLOBAL_ID_CONTAIN} }, from: { type_id: { _eq: ${GLOBAL_ID_PACKAGE} } } }) {
              id value
              package: from {
                id value
              }
            }
          }
          from {
            id
            contains: in(where: { type_id: { _eq: ${GLOBAL_ID_CONTAIN} }, from: { type_id: { _eq: ${GLOBAL_ID_PACKAGE} } } }) {
              id value
              package: from {
                id value
              }
            }
          }
          to {
            id
            contains: in(where: { type_id: { _eq: ${GLOBAL_ID_CONTAIN} }, from: { type_id: { _eq: ${GLOBAL_ID_PACKAGE} } } }) {
              id value
              package: from {
                id value
              }
            }
          }
        `
    })
    return minilinks((result)?.data);
  }

  /** Deserialize pckg data to links list with local numerical ids. */
  async deserialize(
    pckg: PackagerPackage,
    errors: PackagerError[] = [],
  ): Promise<{
    data: PackagerPackageItem[];
    errors?: PackagerError[];
    counter: number;
    dependedLinks: PackagerPackageItem[];
  }> {
    // clone for now hert pckg object
    const data: PackagerPackageItem[] = pckg.data.map(l => ({ ...l, value: l.value ? { ...l.value } : undefined }));
    const containsHash: { [key: string]: number } = {};
    let counter = 0;
    const dependedLinks = [];
    // string id field to numeric ids
    for (let l = 0; l < data.length; l++) {
      const item = data[l];
      const local = item.id;
      if (containsHash[local]) item.id = containsHash[local];
      else containsHash[local] = item.id = ++counter;
      if (item.package) dependedLinks.push(item);
    }
    // type, from, to fields to numeric ids
    for (let l = 0; l < data.length; l++) {
      const item = data[l];
      if (item.type) item.type = containsHash[item.type];
      if (item.from) item.from = containsHash[item.from] || 0;
      if (item.to) item.to = containsHash[item.to] || 0;
    }
    const packageId = ++counter;
    data.push({
      id: packageId,
      type: GLOBAL_ID_PACKAGE,
      value: { value: pckg.package.name },
      // @ts-ignore
      _: true,
    });
    // create contains links
    const containsArray = Object.keys(containsHash);
    for (let c = 0; c < containsArray.length; c++) {
      const contain = containsArray[c];
      data.push({
        id: ++counter,
        type: GLOBAL_ID_CONTAIN,
        from: packageId,
        to: containsHash[contain],
        value: { value: contain },
        // @ts-ignore
        _: true,
      });
    }
    const n = await this.fetchPackageNamespaceId(pckg.package.name);
    if (n.error) errors.push(n.error);
    let namespaceId = n.namespaceId;
    if (!namespaceId) {
      namespaceId = ++counter;
      data.push({
        id: namespaceId,
        type: GLOBAL_ID_PACKAGE_NAMESPACE,
        value: { value: pckg.package.name },
        // @ts-ignore
        _: true,
      });
      data.push({
        id: ++counter,
        type: GLOBAL_ID_PACKAGE_ACTIVE,
        to: packageId,
        from: namespaceId,
        // @ts-ignore
        _: true,
      });
    }
    data.push({
      id: ++counter,
      type: GLOBAL_ID_PACKAGE_VERSION,
      to: packageId,
      from: namespaceId,
      value: { value: pckg.package.version },
      // @ts-ignore
      _: true,
    });
    data.push({
      id: ++counter,
      type: GLOBAL_ID_CONTAIN,
      from: namespaceId,
      to: packageId,
      // @ts-ignore
      _: true,
    });
    return { data, errors, counter, dependedLinks };
  }

  async serialize(globalLinks: MinilinksResult<PackagerLink>, options: PackagerExportOptions, pckg: PackagerPackage) {
    let counter = 1;
    let dependenciesCounter = 1;
    const dependencies = {};
    const dependencedPackages = {};
    const handledDepLinks = {};
    const containsByTo = {};
    const links = [];
    for (let l = 0; l < globalLinks.links.length; l++) {
      const link = globalLinks.links[l];
      if (!!link.type_id && !globalLinks.byId[link.type_id] && !(
        // NOT contain in ( package |- contain -> * )
        link?.type_id === GLOBAL_ID_CONTAIN && link?.from?.id === options.packageLinkId
        ) && !(
        // NOT package
        link?.id === options.packageLinkId
      )) {
        const name = link?.type?.contains?.[0]?.package?.value?.value;
        const foundedDep = dependencedPackages[name];
        if (!!name && !foundedDep) {
          const depPack = { name: name };
          const index = dependenciesCounter++;
          dependencies[index] = depPack;
          dependencedPackages[name] = index;
        }
        if (!handledDepLinks[link.type_id]) {
          const containValue = link?.type?.contains?.[0]?.value?.value;
          if (!containValue) pckg.errors.push(`Link contain from package to ${link?.type?.id} does not have value.`);
          links.push({
            id: counter++,
            package: { dependencyId: dependencedPackages[name], containValue },
          });
          handledDepLinks[link.type_id] = true;
        }
      }
      if (!!link.from_id && !globalLinks.byId[link.from_id]) {
        const name = link?.from?.contains?.[0]?.package?.value?.value;
        const foundedDep = dependencedPackages[name];
        if (!!name && !foundedDep) {
          const depPack = { name: name };
          const index = dependenciesCounter++;
          dependencies[index] = depPack;
          dependencedPackages[name] = index;
        }
        if (!handledDepLinks[link.from_id]) {
          const containValue = link?.from?.contains?.[0]?.value?.value;
          if (!containValue) pckg.errors.push(`Link contain from package to ${link?.from?.id} does not have value.`);
          links.push({
            id: counter++,
            package: { dependencyId: dependencedPackages[name], containValue },
          });
          handledDepLinks[link.from_id] = true;
        }
      }
      if (!!link.to_id && !globalLinks.byId[link.to_id]) {
        const name = link?.to?.contains?.[0]?.package?.value?.value;
        const foundedDep = dependencedPackages[name];
        if (!!name && !foundedDep) {
          const depPack = { name: name };
          const index = dependenciesCounter++;
          dependencies[index] = depPack;
          dependencedPackages[name] = index;
        }
        if (!handledDepLinks[link.to_id]) {
          const containValue = link?.to?.contains?.[0]?.value?.value;
          if (!containValue) pckg.errors.push(`Link contain from package to ${link?.to?.id} does not have value.`);
          links.push({
            id: counter++,
            package: { dependencyId: dependencedPackages[name], containValue },
          });
          handledDepLinks[link.to_id] = true;
        }
      }
    }
    pckg.dependencies = dependencies;
    for (let l = 0; l < globalLinks.links.length; l++) {
      const link = globalLinks.links[l];
      if (link.type_id === GLOBAL_ID_CONTAIN) {
        containsByTo[+link.to_id] = link;
      } else if (link.id !== options.packageLinkId) {
        links.push(link);
      }
    }
    for (let l = 0; l < links.length; l++) {
      const link = links[l];
      link._id = link.id;
      if (!link.package) {
        link.id = containsByTo[+link.id]?.value?.value ? containsByTo[+link.id].value.value : counter++;
        for (let li = 0; li < link?.out?.length; li++) {
          const _link = link.out[li];
          _link.from_id = link.id;
        }
        for (let li = 0; li < link?.in?.length; li++) {
          const _link = link.in[li];
          _link.to_id = link.id;
        }
        for (let li = 0; li < link?.typed?.length; li++) {
          const _link = link.typed[li];
          _link.type_id = link.id;
        }
        let value;
        if (link?.value) {
          const { id: __id, link_id: __link_id, ..._value } = link.value;
          value = _value;
        }
        const newLink: PackagerPackageItem = {
          id: link.id,
          type: link.type_id,
        };
        if (link.from) newLink.from = link.from.id;
        if (link.to) newLink.to = link.to.id;
        if (link.package) newLink.package = link.package;
        if (value) newLink.value = value;
        pckg.data.push(newLink);
      } else {
        const newLink: PackagerPackageItem = {
          id: link.id,
          package: link.package,
        };
        pckg.data.push(newLink);
      }
    }
  }

  /**
   * Export from system pckg by package link id.
   */
  async export(options: PackagerExportOptions): Promise<PackagerPackage> {
    const globalLinks = await this.selectLinks(options);
    const packageLink = globalLinks.links?.find(l => l?.type?.value?.value === GLOBAL_NAME_PACKAGE);
    const packageName = packageLink?.value?.value;
    const pckg = {
      package: { name: packageName },
      data: [],
      strict: false,
      errors: [],
    };
    await this.serialize(globalLinks, options, pckg);
    return pckg;
  }
}