[![npm](https://img.shields.io/npm/v/@deep-foundation/deeplinks.svg)](https://www.npmjs.com/package/@deep-foundation/deeplinks)
[![Gitpod](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/deep-foundation/deeplinks) 
[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label&color=purple)](https://discord.gg/deep-foundation)

# Documentation

## Container and CLI

```sh
# generate deep. config json
npx -y @deep-foundation/deeplinks --generate
# by default auto detect public ip or gitpod urls (gitpod too)
# manual config
npx -y @deep-foundation/deeplinks --generate --deeplinks="https://links.my-domain.io" --perception="https://peception.my-domain.io"
# update and running all containers empty, without links, available for migrations
прх -y @deep-foundation/deeplinks --up
# apply snapshot generated in gh-actions with basic links and packages
npx -y @deep-foundation/deeplinks --snapshot
# down all containers without removind data from values
npx -y @deep-foundation/deeplinks --down
# down and up with updating docker images in sequence
npx -y @deep-foundation/deeplinks --down --up

# exec js interactive terminal with deep in variables context
npx -y @deep-foundation/deeplinks --exec
> deep # DeepClient
# instead of using snapshot, do manual migration
npx -y @deep-foundation/deeplinks --migrate
# unmigrate
npx -y @deep-foundation/deeplinks --unmigrate
# print all envs
npx -y @deep-foundation/deeplinks --envs
# exec bash script in envs based on deep.config json in deeplinks directory, for example stop all containers
npx -y @deep-foundation/deeplinks --bash="docker compose -p deep down"
```

## Imports

```ts
import {
    useDeep, 
    DeepProvider, 
    useDeepGenerator, 
    DeepClient, 
    DeepContext, 
    DeepNamespaceProvider, 
    DeepNamespaceContext, 
    useDeepNamespaces, 
    useDeepNamespace, 
    useTransparentState, 
    useDebouncedInput, 
    useDeepQuery, 
    useDeepSubscription, 
    useDeepId, 
    useSearch, 
    useAuthNode, 
    useLink, 
    useLinks, 
    random, 
    parseJwt, 
    serializeQuery, 
    serializeWhere, 
    pathToWhere, 
    Handler, 
    Subscription, 
    Observer, 
    DeepClientOptions, 
    DeepClientResult, 
    DeepSearchOptions, 
    DeepClientInstance, 
    DeepClientAuthResult, 
    DeepClientGuestOptions, 
    DeepClientJWTOptions, 
    UseDeepSubscriptionResult, 
    DeepClientPackageSelector, 
    DeepClientPackageContain, 
    DeepClientLinkId, 
    DeepClientStartItem, 
    DeepClientPathItem, 
    SelectTable, 
    InsertTable, 
    UpdateTable, 
    DeleteTable, 
    OperationType, 
    SerialOperationType, 
    Table, 
    ValueForTable, 
    ExpForTable, 
    SerialOperationDetails, 
    SerialOperation, 
    DeepSerialOperation, 
    AsyncSerialParams, 
    INamespaces, 
    Exp, 
    UpdateValue, 
    InsertObjects, 
    Options, 
    ReadOptions, 
    WriteOptions, 
    MinilinksLink, 
    MinilinkCollection, 
    minilinks, 
    MinilinksContext, 
    toPlain, 
    Minilinks, 
    useMinilinksConstruct, 
    useMinilinksFilter, 
    useMinilinksHandle, 
    useMinilinksApply, 
    useMinilinksQuery, 
    useMinilinksSubscription, 
    useMinilinksGenerator, 
    MinilinksProvider, 
    useMinilinks, 
    Links, 
    LinkPlain, 
    LinkRelations, 
    LinkHashFields, 
    Link, 
    MinilinksQueryOptions, 
    MinilinksResult, 
    MinilinksGeneratorOptions, 
    MinilinksInstance, 
    MinilinkError, 
    ApplyReturnOptions, 
    ApplyOptions, 
    MinilinksHookInstance, 
    Id, 
    MinilinksQueryOptionAggregate, 
    MinilinksApplyInput, 
    useTokenController, 
    TokenProvider, 
    QueryLink, 
    QueryLinkReturn, 
    BoolExp, 
    ReturnBoolExp, 
    BoolExpLink, 
    BoolExpValue, 
    BoolExpCan, 
    BoolExpSelector, 
    BoolExpTree, 
    BoolExpHandler, 
    ComparasionExp, 
    MutationInput, 
    MutationInputLinkPlain, 
    MutationInputLink, 
    MutationInputValue, 
    Query, 
    LinkToLinksRelations, 
    ComparasionType, 
    CatchErrors, 
    evalClientHandler, 
    useFindClientHandler, 
    ClientHandler, 
    ClientHandlerRenderer, 
    ClientHandlerRendererProps, 
    ClientHandlerProps, 
} from "@deep-foundation/deeplinks";
```