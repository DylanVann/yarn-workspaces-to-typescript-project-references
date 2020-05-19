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

const run = async ({ mode }: { mode: 'check' | 'write' }) => {
  const root = await pkgDir(process.cwd())
  if (!root) {
    throw new Error('Could not find workspace root.')
  }
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
    }
  }

  const nameToConfigPath: { [name: string]: string | undefined } = {}
  for (const name of packageNames) {
    const info = await getPackageInfo(name)
    nameToConfigPath[name] = info.tsConfigPath
  }

  function notUndefined<T>(x: T | undefined): x is T {
    return x !== undefined
  }

  const processPackage = async (
    name: string,
  ): Promise<{ wasOutOfSync: boolean; wasWritten: boolean } | {}> => {
    const info = workspaceInfo[name]
    const tsConfigPath = nameToConfigPath[name]
    if (tsConfigPath) {
      const location = path.join(root, info.location)
      const expectedReferences = info.workspaceDependencies
        .map((v) => nameToConfigPath[v])
        .filter(notUndefined)
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

  const idk: any[] = []
  for (const name of packageNames) {
    const i = await processPackage(name)
    idk.push(i)
  }

  if (mode === 'check') {
    if (idk.some((v) => v.wasOutOfSync)) {
      console.error('Project references are not in sync with dependencies.')
      process.exit(0)
    }
  } else {
    if (idk.some((v) => v.wasOutOfSync)) {
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
    (v) => v,
    async () => {
      await run({ mode: 'check' })
    },
  )
  .command(
    'write',
    'Write the dependencies to tsconfig file project references.',
    (v) => v,
    async () => {
      await run({ mode: 'write' })
    },
  )
  .parse()
