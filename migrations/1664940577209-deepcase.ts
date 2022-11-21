import { generateApolloClient } from '@deep-foundation/hasura/client';
import Debug from 'debug';
import { DeepClient } from '../imports/client';
import { deepcaseSymbolsPckg } from '../imports/deepcase-package';
import { Packager } from '../imports/packager';

const debug = Debug('deeplinks:migrations:deepcase');
const log = debug.extend('log');
const error = debug.extend('error');

const rootClient = generateApolloClient({
  path: `${process.env.MIGRATIONS_HASURA_PATH}/v1/graphql`,
  ssl: !!+(process.env.MIGRATIONS_HASURA_SSL || 0),
  secret: process.env.MIGRATIONS_HASURA_SECRET,
});

const root = new DeepClient({
  apolloClient: rootClient,
});

export const up = async () => {
  log('up');
  const packager = new Packager(root);
  const { errors, packageId, namespaceId } = await packager.import(deepcaseSymbolsPckg);
  if (errors?.length) {
    console.log('deepcase-errors',JSON.stringify(errors, null, 2),JSON.stringify(errors[0]?.graphQLErrors?.[0], null, 2));
    const error = errors[0]?.graphQLErrors?.[0]?.extensions?.internal?.error;
    throw new Error(`Import error: ${String(errors[0]?.graphQLErrors?.[0]?.message || errors?.[0])}${error?.message ? ` ${error?.message} ${error?.request?.method} ${error?.request?.host}:${error?.request?.port}${error?.request?.path}` : ''}`);
  }
  if (packageId) {
    await root.insert([
      {
        type_id: await root.id('@deep-foundation/core', 'Contain'),
        from_id: await root.id('deep', 'admin'),
        to_id: packageId,
      },
      {
        type_id: await root.id('@deep-foundation/core', 'Join'),
        from_id: await root.id('deep', 'admin'),
        to_id: packageId,
      },
    ]);
  }
};

export const down = async () => {
  log('down');
};