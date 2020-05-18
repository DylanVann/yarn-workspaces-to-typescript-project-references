import yargs from 'yargs'
import fs from 'fs-extra'
import execa from 'execa'
import pkgDir from 'pkg-dir'
import path from 'path'
import isEqual from 'lodash.isequal'

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

  const processPackage = async (name: string) => {
    const info = workspaceInfo[name]
    const tsConfigPath = nameToConfigPath[name]
    if (tsConfigPath) {
      const location = path.join(root, info.location)
      const expectedReferences = info.workspaceDependencies
        .map(v => nameToConfigPath[v])
        .filter(notUndefined)
        .map(v => path.relative(location, v))
      const tsConfig = await fs.readJSON(tsConfigPath)
      const references = expectedReferences.map(path => ({ path }))

      if (mode === 'write') {
        tsConfig.references = references
        await fs.writeJSON(tsConfigPath, tsConfig)
      }

      if (mode === 'check') {
        if (!isEqual(references, tsConfig.references)) {
          throw new Error(
            'Project references are not in sync with dependencies.',
          )
        }
      }
    }
  }

  for (const name of packageNames) {
    await processPackage(name)
  }
}

yargs
  .command(
    'check',
    'Check that the tsconfig file project references are synced with dependencies.',
    v => v,
    async () => {
      await run({ mode: 'check' })
    },
  )
  .command(
    'write',
    'Write the dependencies to tsconfig file project references.',
    v => v,
    async () => {
      await run({ mode: 'write' })
    },
  )
  .help()
  .parse()
