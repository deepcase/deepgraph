import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import internalIp from 'internal-ip';
import axios from 'axios';
import Debug from 'debug';
// @ts-ignore
import fixPath from 'fix-path';

const debug = Debug('deeplinks:engine');
const log = debug.extend('log');
const error = debug.extend('error');
// Force enable this file errors output
const namespaces = Debug.disable();
const platform = process?.platform;
Debug.enable(`${namespaces ? `${namespaces},` : ``}${error.namespace}`);

const execP = promisify(exec);
const DOCKER = process.env.DOCKER || '0';
const DEEPLINKS_PUBLIC_URL = process.env.DEEPLINKS_PUBLIC_URL || 'http://localhost:3006';
export interface ICallOptions {
  operation: 'run' | 'sleep' | 'reset';
  envs: { [key: string]: string; };
}

interface ICheckDeeplinksStatusReturn {
  result?: 1 | 0 | undefined;
  error?: any;
}
interface IGetComposeReturn {
  result?: string;
  error?: any;
}
interface IExecEngineReturn {
  result?: {
    stdout: string;
    stderr: string;
  };
  error?: any;
}

interface IGenerateEngineStrOptions {
  operation: string;
  composeVersion: string;
  isDeeplinksDocker: 0 | 1 | undefined;
  envs: any;
}
interface IGenerateEnvsOptions {
  isDeeplinksDocker: 0 | 1 | undefined;
  composeVersion: string;
  envs: any;
}


const _hasura = path.normalize(`${__dirname}/../../hasura`);
const _deepcase = path.normalize(`${__dirname}/../../deepcase`);
const _deeplinks = path.normalize(`${__dirname}/../`);

const handleEnvWindows = (k, envs) => ` set ${k}=${envs[k]}&&`;
const handleEnvUnix = (k, envs) => ` export ${k}=${envs[k]} &&`;
const handleEnv = platform === "win32" ? handleEnvWindows : handleEnvUnix;

const _generateEnvs = ({ envs, isDeeplinksDocker, composeVersion }: IGenerateEnvsOptions): string => {
  let envsStr = '';
  const isGitpod = !!process.env['GITPOD_GIT_USER_EMAIL'] && !!process.env['GITPOD_TASKS'];
  const hasuraPort = 8080;
  const deeplinksPort = 3006;
  const deepcasePort = 3007;

  envs['npm_config_yes'] = envs['npm_config_yes'] ? envs['npm_config_yes'] : 'true';
  envs['NEXT_PUBLIC_HIDEPATH'] = envs['NEXT_PUBLIC_HIDEPATH'] ? envs['NEXT_PUBLIC_HIDEPATH'] : '1';
  envs['JWT_SECRET'] = envs['JWT_SECRET'] ? envs['JWT_SECRET'] : `${platform !== "win32" ? "'" : ''}{"type":"HS256","key":"3EK6FD+o0+c7tzBNVfjpMkNDi2yARAAKzQlk8O2IKoxQu4nF7EdAh8s3TwpHwrdWT6R"}${platform !== "win32" ? "'" : ''}`;
  envs['MIGRATIONS_ID_TYPE_SQL'] = envs['MIGRATIONS_ID_TYPE_SQL'] ? envs['MIGRATIONS_ID_TYPE_SQL'] : 'bigint';
  envs['MIGRATIONS_ID_TYPE_GQL'] = envs['MIGRATIONS_ID_TYPE_GQL'] ? envs['MIGRATIONS_ID_TYPE_GQL'] : 'bigint';
  envs['MIGRATIONS_HASURA_SECRET'] = envs['MIGRATIONS_HASURA_SECRET'] ? envs['MIGRATIONS_HASURA_SECRET'] : 'myadminsecretkey';
  envs['DEEPLINKS_HASURA_SECRET'] = envs['DEEPLINKS_HASURA_SECRET'] ? envs['DEEPLINKS_HASURA_SECRET'] : 'myadminsecretkey';
  // DL may be not in docker, when DC in docker, so we use host.docker.internal instead of docker-network link deep_links_1
  envs['DOCKER_DEEPLINKS_URL'] = envs['DOCKER_DEEPLINKS_URL'] ? envs['DOCKER_DEEPLINKS_URL'] : `http://host.docker.internal:${deeplinksPort}`;
  envs['MIGRATIONS_DIR'] = envs['MIGRATIONS_DIR'] ? envs['MIGRATIONS_DIR'] : platform === "win32" ? '.migrate' : '/tmp/.deep-migrate';
  if (isGitpod) {
    envs['MIGRATIONS_HASURA_PATH'] = envs['MIGRATIONS_HASURA_PATH'] ? envs['MIGRATIONS_HASURA_PATH'] : +DOCKER ? `deep${composeVersion == '1' ? '_' : '-'}graphql-engine${composeVersion == '1' ? '_' : '-'}1:${hasuraPort}` : `$(gp url ${hasuraPort})`;
    envs['DEEPLINKS_HASURA_PATH'] = envs['DEEPLINKS_HASURA_PATH'] ? envs['DEEPLINKS_HASURA_PATH'] : isDeeplinksDocker === 0 ? `$(echo $(gp url ${hasuraPort}) | awk -F[/:] '{print $4}')` : `deep${composeVersion == '1' ? '_' : '-'}graphql-engine${composeVersion == '1' ? '_' : '-'}1:${hasuraPort}`;
    envs['MIGRATIONS_HASURA_SSL'] = envs['MIGRATIONS_HASURA_SSL'] ? envs['MIGRATIONS_HASURA_SSL'] : +DOCKER ? '0' : '1';
    envs['DEEPLINKS_HASURA_SSL'] = envs['DEEPLINKS_HASURA_SSL'] ? envs['DEEPLINKS_HASURA_SSL'] : isDeeplinksDocker === 0 ? '1' : '0';
    envs['NEXT_PUBLIC_GQL_SSL'] = envs['NEXT_PUBLIC_GQL_SSL'] ? envs['NEXT_PUBLIC_GQL_SSL'] : '1';
    envs['NEXT_PUBLIC_DEEPLINKS_SERVER'] = envs['NEXT_PUBLIC_DEEPLINKS_SERVER'] ? envs['NEXT_PUBLIC_DEEPLINKS_SERVER'] : `https://$(echo $(gp url ${deepcasePort}) | awk -F[/:] '{print $4}')`;
    envs['NEXT_PUBLIC_GQL_PATH'] = envs['NEXT_PUBLIC_GQL_PATH'] ? envs['NEXT_PUBLIC_GQL_PATH'] : `$(echo $(gp url ${deeplinksPort}) | awk -F[/:] '{print $4}')/gql`;
    envs['NEXT_PUBLIC_ENGINES'] = envs['NEXT_PUBLIC_ENGINES'] ? envs['NEXT_PUBLIC_ENGINES'] : '1';
  } else {
    envs['MIGRATIONS_HASURA_PATH'] = envs['MIGRATIONS_HASURA_PATH'] ? envs['MIGRATIONS_HASURA_PATH'] : +DOCKER ? `deep${composeVersion == '1' ? '_' : '-'}graphql-engine${composeVersion == '1' ? '_' : '-'}1:${hasuraPort}` : `localhost:${hasuraPort}`;
    envs['DEEPLINKS_HASURA_PATH'] = envs['DEEPLINKS_HASURA_PATH'] ? envs['DEEPLINKS_HASURA_PATH'] : isDeeplinksDocker === 0 ? `localhost:${hasuraPort}` : `deep${composeVersion == '1' ? '_' : '-'}graphql-engine${composeVersion == '1' ? '_' : '-'}1:${hasuraPort}`;
    envs['MIGRATIONS_HASURA_SSL'] = envs['MIGRATIONS_HASURA_SSL'] ? envs['MIGRATIONS_HASURA_SSL'] : '0';
    envs['DEEPLINKS_HASURA_SSL'] = envs['DEEPLINKS_HASURA_SSL'] ? envs['DEEPLINKS_HASURA_SSL'] : '0';
    envs['NEXT_PUBLIC_GQL_SSL'] = envs['NEXT_PUBLIC_GQL_SSL'] ? envs['NEXT_PUBLIC_GQL_SSL'] : '0';
    envs['NEXT_PUBLIC_DEEPLINKS_SERVER'] = envs['NEXT_PUBLIC_DEEPLINKS_SERVER'] ? envs['NEXT_PUBLIC_DEEPLINKS_SERVER'] : `http://localhost:${deepcasePort}`;
    envs['NEXT_PUBLIC_GQL_PATH'] = envs['NEXT_PUBLIC_GQL_PATH'] ? envs['NEXT_PUBLIC_GQL_PATH'] : `localhost:${deeplinksPort}/gql`;
    envs['MIGRATIONS_DEEPLINKS_URL'] = envs['MIGRATIONS_DEEPLINKS_URL'] ? envs['MIGRATIONS_DEEPLINKS_URL'] : isDeeplinksDocker === 0 ? `http://host.docker.internal:${deeplinksPort}` : `http://deep${composeVersion == '1' ? '_' : '-'}links${composeVersion == '1' ? '_' : '-'}1:${deeplinksPort}`;
  }
  //return string for debug without path. Path dont need to be set for debug
  Object.keys(envs).forEach(k => k ==='PATH' && platform === "win32" ? null : envsStr += handleEnv(k, envs));
  return envsStr;
};

const _checkDeeplinksStatus = async (): Promise<ICheckDeeplinksStatusReturn> => {
  let status;
  let err;
  try {
    // DL may be not in docker, when DC in docker, so we use host.docker.internal instead of docker-network link deep_links_1
    status = await axios.get(`${+DOCKER ? 'http://host.docker.internal:3006' : DEEPLINKS_PUBLIC_URL}/api/healthz`, { validateStatus: status => true, timeout: 7000 });
  } catch(e){
    error(e)
    err = e;
  }
  return { result: status?.data?.docker, error: err };
};

const _getCompose = async (PATH: string): Promise<IGetComposeReturn> => {
  try {
    const { stdout } = await execP(`PATH=${PATH} docker-compose version --short`);
    log('_getCompose stdout', stdout)
    return { result: stdout.match(/\d+/)[0] };
  } catch(e){
    error(e);
    return { error: e };
  }
};

const _generateEngineStr = ({ operation, composeVersion, isDeeplinksDocker, envs }: IGenerateEngineStrOptions): string => {
  let str;
  if (![ 'run', 'sleep', 'reset' ].includes(operation)) return ' echo "not valid operation"';
  if (operation === 'run') {
    str = ` cd ${path.normalize(`${_hasura}/local/`)} && npm run docker && npx -q wait-on --timeout 10000 ${+DOCKER ? `http-get://deep${composeVersion == '1' ? '_' : '-'}graphql-engine${composeVersion == '1' ? '_' : '-'}1` : 'tcp'}:8080 && cd ${_deeplinks} ${isDeeplinksDocker===undefined ? `&& ${ platform === "win32" ? 'set COMPOSE_CONVERT_WINDOWS_PATHS=1&& ' : ''} npm run start-deeplinks-docker && npx -q wait-on --timeout 10000 ${+DOCKER ? 'http-get://host.docker.internal:3006'  : DEEPLINKS_PUBLIC_URL}/api/healthz` : ''} && npm run migrate -- -f ${envs['MIGRATIONS_DIR']}`;
  }
  if (operation === 'sleep') {
    if (platform === "win32") {
      str = ` powershell -command docker stop $(docker ps -a --filter name=deep${composeVersion == '1' ? '_' : '-'} -q --format '{{ $a:= false }}{{ $name:= .Names }}{{ range $splited := (split .Names \`"_\`") }}{{ if eq \`"case\`" $splited }}{{$a = true}}{{ end }}{{end}}{{ if eq $a false }}{{ $name }}{{end}}')`;
    } else {
      str = ` docker stop $(docker ps --filter name=deep${composeVersion == '1' ? '_' : '-'} -q --format '{{ $a:= false }}{{ range $splited := (split .Names "_") }}{{ if eq "case" $splited }}{{$a = true}}{{ end }}{{ end }}{{ if eq $a false }}{{.ID}}{{end}}')`;
    }
  }
  if (operation === 'reset') {
    if (platform === "win32") {
      str = ` cd ${_deeplinks} && npx rimraf ${envs['MIGRATIONS_DIR']} && powershell -command docker rm -fv $(docker ps -a --filter name=deep${composeVersion == '1' ? '_' : '-'} -q --format '{{ $a:= false }}{{ $name:= .Names }}{{ range $splited := (split .Names \`"_\`") }}{{ if eq \`"case\`" $splited }}{{$a = true}}{{ end }}{{end}}{{ if eq $a false }}{{ $name }}{{end}}'); docker volume rm $(docker volume ls -q --filter name=deep_)${ !+DOCKER ? `; docker network rm $(docker network ls -q -f name=deep_) ` : ''};`;
    } else {
      str = ` cd ${_deeplinks} && npx rimraf ${envs['MIGRATIONS_DIR']} && (docker rm -fv $(docker ps -a --filter name=deep${composeVersion == '1' ? '_' : '-'} -q --format '{{ $a:= false }}{{ range $splited := (split .Names "_") }}{{ if eq "case" $splited }}{{$a = true}}{{ end }}{{ end }}{{ if eq $a false }}{{.ID}}{{end}}') || true) && (docker volume rm $(docker volume ls -q --filter name=deep_) || true)${ !+DOCKER ? ` && (docker network rm $(docker network ls -q -f name=deep_) || true)` : ''}`;
    }
  }
  return str;
}

const _execEngine = async ({ envs, engineStr }: { envs: any; engineStr: string; } ): Promise<IExecEngineReturn> => {
  try {
    const { stdout, stderr } = await execP(engineStr, { env: { ...envs }});
    return { result: { stdout, stderr } }
  } catch(e) {
    error(e);
    return { error: e };
  }
}

export async function call (options: ICallOptions) {

  const envs = { ...options.envs, DOCKERHOST: await internalIp.v4() };
  if (platform !== "win32"){
    fixPath();
    const PATH = [];
    if (process?.env?.PATH) PATH.push(process?.env?.PATH);
    if (envs['PATH']) PATH.push(process?.env?.PATH);
    envs['PATH'] = PATH.join(':');
  } else {
    envs['PATH'] = process?.env?.['Path'];
  }
  log({options});
  const isDeeplinksDocker = await _checkDeeplinksStatus();
  log({isDeeplinksDocker});
  const composeVersion = await _getCompose(envs['PATH']);
  log({composeVersion});
  if (composeVersion?.error) return { ...options, envs, error: composeVersion.error };
  const envsStr = _generateEnvs({ envs, isDeeplinksDocker: isDeeplinksDocker.result, composeVersion: composeVersion.result});
  log({envs});
  const engineStr = _generateEngineStr({ operation: options.operation, composeVersion: composeVersion.result, isDeeplinksDocker: isDeeplinksDocker.result, envs} )
  log({engineStr});
  const engine = await _execEngine({ envs, engineStr }) ;
  log({engine});

  return { ...options, platform, isDeeplinksDocker, composeVersion, envs, engineStr, fullStr: `${envsStr} ${engineStr}`, ...engine };
}