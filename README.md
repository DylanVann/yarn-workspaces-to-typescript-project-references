# yarn-workspaces-to-typescript-project-references

[![npm](https://img.shields.io/npm/v/yarn-workspaces-to-typescript-project-references)](https://www.npmjs.com/package/yarn-workspaces-to-typescript-project-references)

Sync [Yarn workspaces](https://classic.yarnpkg.com/en/docs/workspaces/) dependencies in `package.json` files with [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) in `tsconfig.json` files.

This project may be deprecated when this is resolved: https://github.com/microsoft/TypeScript/issues/25376

**Features:**

- [x] `check` project references, to be run on CI.
- [x] `write` project references, to be run locally to update them.
- [ ] Detect `test.tsconfig.json` files in packages and correct references.
- [ ] Write `tsconfig.json` solutions file to the repo root.

## Usage

**Install this package:**

```
yarn add -D yarn-workspaces-to-typescript-project-references
```

**Check that references are synced with dependencies:**

```
yarn yarn-workspaces-to-typescript-project-references check
```

**Sync references with dependencies:**

```
yarn yarn-workspaces-to-typescript-project-references write
```
