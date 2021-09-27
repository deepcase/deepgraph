import express from 'express';
import fkill from 'fkill';
import { call } from '@deepcase/deeplinks/imports/engine';

import { promisify } from 'util';
import { exec } from 'child_process';

const execP = promisify(exec);

process.env['MIGRATIONS_DEEPLINKS_APP_URL'] = 'localhost:3007';
process.env['MIGRATIONS_HASURA_PATH'] = 'localhost:8080';
process.env['MIGRATIONS_HASURA_SSL'] = '0';
process.env['MIGRATIONS_HASURA_SECRET'] = 'myadminsecretkey';

const {
  MIGRATIONS_HASURA_PATH,
  MIGRATIONS_HASURA_SSL,
  MIGRATIONS_HASURA_SECRET,
  MIGRATIONS_DEEPLINKS_APP_URL,
} = process.env;

const envsObj = {
  MIGRATIONS_HASURA_PATH,
  MIGRATIONS_HASURA_SSL,
  MIGRATIONS_HASURA_SECRET,
  MIGRATIONS_DEEPLINKS_APP_URL,
};

const envsKeys = Object.keys(envsObj);
let envs = 'cross-env-shell ';
for (let e = 0; e < envsKeys.length; e++) {
  const en = envsKeys[e];
  envs += `${en}='${envsObj[en]}' `;
}

(async () => {
  const app = express();
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.post('/api/deeplinks', async (req, res) => {
    res.json(await call({ ...req.body, handle: (str) => `${envs} "${str}"` }));
  });
  app.post('/test', async (req, res) => {
    const PATH = `${__dirname}/../../resources/bin`;
    let path = '';
    if (process.platform !== 'win32') path = PATH ? `cross-env-shell PATH=${PATH}:$PATH;` : '';
    res.json(await execP(`${path}${req.body.exec}`));
  });
  app.post('/eval', async (req, res) => {
    res.json({ eval: eval(req.body.eval) });
  });
  await fkill(':3007', { silent: true });
  app.listen(3007, () => {
    console.log(`Example app listening at http://localhost:3007`)
  });
})().catch(console.error);