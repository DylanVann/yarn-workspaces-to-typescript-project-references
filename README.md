# yarn-workspaces-to-typescript-project-references

Sync [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) dependencies in `package.json` files with [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files.

## Usage

**Install this package:**

```
yarn add -D yarn-workspaces-to-typescript-project-references
```

**Check that references are synced with dependencies:**

```
yan-workspaces-to-typescript-project-references --check
```

**Sync references with dependencies:**

```
yan-workspaces-to-typescript-project-references --write
```
