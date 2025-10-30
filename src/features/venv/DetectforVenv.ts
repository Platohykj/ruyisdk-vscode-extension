// SPDX-License-Identifier: Apache-2.0
/**
 * RuyiSDK VS Code Extension - Venv Module - Venv Detection Utility
 *
 * Provides helpers used by the commands layer:
 * - detectVenv(): Detect Ruyi venvs in the current workspace
 * Iterates through 1st and 2nd level subdirectories to find venvs
 * If a subdirectory contains a "bin" subdirectory
 * which contains a "ruyi-activate" file,
 * it is considered a Ruyi venv.
 * Under this circumstance, we will record the relative path,
 * as well as the $1 of the "RUYI_VENV_PROMPT=$1" line in the "ruyi-activate" file.
 * We can return multiple venvs if found.
 */

import * as fs from 'fs'
import * as path from 'path'

import { getWorkspaceFolderPath } from '../../common/helpers'

export function detectVenv(): string[][] {
  const foundVenvs: string[][] = []

  try {
    const workspacePath = getWorkspaceFolderPath()

    const subdirectories = fs.readdirSync(workspacePath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    const subSubdirectories = subdirectories.flatMap((subdir) => {
      try {
        const subdirPath = path.join(workspacePath, subdir)
        return fs.readdirSync(subdirPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => `${subdir}/${dirent.name}`)
      }
      catch (e) {
        console.warn(`[Warning] Failed to read ${subdir}: ${e}`)
        return []
      }
    })
    const allDirsToCheck = [...subdirectories, ...subSubdirectories]

    // Add security check to prevent path traversal
    const isPathSafe = (pathSegment: string): boolean => {
      if (!pathSegment || pathSegment.length === 0) return false
      if (pathSegment.includes('..') || pathSegment.includes('\0')) return false
      if (pathSegment === '.' || pathSegment.startsWith('/')) return false
      return true
    }

    for (const dir of allDirsToCheck) {
      const segments = dir.split('/')
      if (!segments.every(isPathSafe)) {
        console.warn(`Skipping unsafe path: ${dir}`)
        continue
      }

      const binPath = path.join(workspacePath, dir, 'bin')
      const activatePath = path.join(binPath, 'ruyi-activate')
      if (fs.existsSync(activatePath)) {
        // Read the ruyi-activate file to find the RUYI_VENV_PROMPT line
        const activateContent = fs.readFileSync(activatePath, 'utf-8')
        const promptLine = activateContent.split('\n')
          .find(line => line.includes('RUYI_VENV_PROMPT='))
        if (promptLine) {
          foundVenvs.push([dir, promptLine.split('=')[1].trim()])
        }
      }
    }
  }
  catch (e) {
    console.error(`[Error] Failed to detect venvs: ${e}`)
  }

  return foundVenvs
}
