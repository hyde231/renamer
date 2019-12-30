import {copyFile, exists, readdir, readFile, stat, unlink, writeFile} from 'fs'
import {extname, join} from 'path'
//import rimraf from 'rimraf'

import {promisify} from 'util'

export const existsAsync = promisify(exists)
export const statAsync = promisify(stat)
export const unlinkAsync = promisify(unlink)
export const readdirAsync = promisify(readdir)
export const readFileAsync = promisify(readFile)
export const writeFileAsync = promisify(writeFile)
export const copyFileAsync = promisify(copyFile)
//export const rimrafAsync = promisify(rimraf)

export default async function walk(
  dir: string,
  exts = [] as string[],
  cb: (file: string) => Promise<void>
) {
  const folderStack = [] as string[]
  folderStack.push(dir)

  while (folderStack.length) {
    const top = folderStack.pop()
    if (!top) break

    const filesInDir = await readdirAsync(top)

    for (const file of filesInDir) {
      const path = join(top, file)
      const stat = await statAsync(path)

      if (stat.isDirectory()) {
        folderStack.push(path)
      } else if (exts.includes(extname(file))) {
        await cb(path)
      }
    }
  }
}
