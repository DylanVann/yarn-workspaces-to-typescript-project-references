import yargs from 'yargs'
import fs from 'fs-extra'
import execa from 'execa'
import pkgDir from 'pkg-dir'
import path from 'path'
import isEqual from 'lodash.isequal'
import prettier from 'prettier'
import stringify from 'json-stable-stringify'

interface WorkSpaceInfo {
  [key: string]: {
    location: string
    workspaceDependencies: string[]
  }
}

function isNotUndefined<T>(x: T | undefined): x is T {
  return x !== undefined
}

const run = async ({ mode }: { mode: 'check' | 'write' }) => {
  const root = await pkgDir(process.cwd())
  if (!root) {
    throw new Error('Could not find workspace root.')
  }
  const rootTSConfigPath = path.join(root, 'tsconfig.json')
  const { stdout: raw } = await execa('yarn', [
    '--silent',
    'workspaces',
    'info',
    '--json',
  ])
  const workspaceInfo: WorkSpaceInfo = JSON.parse(raw)
  const packageNames = Object.keys(workspaceInfo)

  const getPackageInfo = async (name: string) => {
    const info = workspaceInfo[name]
    const tsConfigPath = path.join(root, info.location, 'tsconfig.json')
    const tsConfigExists = await fs.pathExists(tsConfigPath)
    return {
      tsConfigPath: tsConfigExists ? tsConfigPath : undefined,
      name,
    }
  }

  const idk: {
    tsConfigPath: string | undefined
    name: string
  }[] = await Promise.all(
    packageNames.map(async (name) => getPackageInfo(name)),
  )

  const nameToConfigPath: {
    [name: string]: string | undefined
  } = idk.reduce(
    (acc: any, next) => ({ ...acc, [next.name]: next.tsConfigPath }),
    {},
  )

  const processPackage = async (
    name: string,
  ): Promise<{ wasOutOfSync: boolean; wasWritten: boolean } | {}> => {
    const info = workspaceInfo[name]
    const tsConfigPath = nameToConfigPath[name]
    if (tsConfigPath) {
      const location = path.join(root, info.location)
      const expectedReferences = info.workspaceDependencies
        .map((v) => nameToConfigPath[v])
        .filter(isNotUndefined)
        .map((v) => path.relative(location, v))
      const tsConfig = await fs.readJSON(tsConfigPath)
      const references = expectedReferences.map((path) => ({ path }))

      if (mode === 'write') {
        if (!isEqual(references, tsConfig.references)) {
          tsConfig.references = references
          const text = stringify(tsConfig, { space: 2 })
          const prettierOptions = await prettier.resolveConfig(tsConfigPath)
          const formatted = prettier.format(text, {
            ...prettierOptions,
            parser: 'json',
          })
          await fs.writeFile(tsConfigPath, formatted)
          return { wasOutOfSync: true, wasWritten: true }
        } else {
          return { wasOutOfSync: false, wasWritten: false }
        }
      }

      if (mode === 'check') {
        if (!isEqual(references, tsConfig.references)) {
          return { wasOutOfSync: true, wasWritten: false }
        } else {
          return { wasOutOfSync: false, wasWritten: false }
        }
      }

      throw new Error(`Invalid mode: ${mode}`)
    }
    return {}
  }

  const roots = idk
    .map((v) => v.tsConfigPath)
    .filter(isNotUndefined)
    .map((v) => path.relative(root, v))

  const infoAboutPackages: any[] = []
  await Promise.all(
    packageNames.map(async (name) => {
      const i = await processPackage(name)
      infoAboutPackages.push(i)
    }),
  )

  const rootTSConfigTarget = {
    files: [],
    references: roots.map((v) => ({ path: v })),
  }
  const rootTSConfigPrettierOptions = await prettier.resolveConfig(
    rootTSConfigPath,
  )
  const rootTSConfigFormatted = prettier.format(
    JSON.stringify(rootTSConfigTarget),
    {
      ...rootTSConfigPrettierOptions,
      parser: 'json',
    },
  )
  const rootTSConfig = await fs.readJSON(rootTSConfigPath, { encoding: 'utf8' })
  const rootIsSynced = isEqual(rootTSConfig, rootTSConfigTarget)

  if (mode === 'check') {
    if (infoAboutPackages.some((v) => v.wasOutOfSync) || !rootIsSynced) {
      console.error('Project references are not in sync with dependencies.')
      process.exit(1)
    }
  } else {
    if (infoAboutPackages.some((v) => v.wasOutOfSync) || !rootIsSynced) {
      await fs.writeFile(rootTSConfigPath, rootTSConfigFormatted)
      console.log('Project references were synced with dependencies.')
      process.exit(0)
    } else {
      console.log('Project references are in sync with dependencies.')
      process.exit(0)
    }
  }
}

yargs
  .command(
    'check',
    'Check that the tsconfig file project references are synced with dependencies.',
    (v: any) => v,
    async () => {
      await run({ mode: 'check' })
    },
  )
  .command(
    'write',
    'Write the dependencies to tsconfig file project references.',
    (v: any) => v,
    async () => {
      await run({ mode: 'write' })
    },
  )
  .parse()
