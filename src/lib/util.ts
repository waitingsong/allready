import { statSync } from 'fs'
import { from as ofrom, of, Observable } from 'rxjs'
import { filter, map, mergeMap, reduce, tap } from 'rxjs/operators'
import { walk, EntryType, Filepath, WalkEvent } from 'rxwalker'
import { JsonType, RxRequestInit } from 'rxxfetch'

import { basename, normalize, pathResolve } from '../shared/index'

import { initialTestSuite, initConfig } from './config'
import { RunSuite, TestSuite, UnitPayload, UnitStatus } from './model'


/** Load a directory or a file */
export function loadDirOrFile(path: string): Observable<RunSuite> {
  const stats = statSync(path)
  let ret$: Observable<RunSuite>
  let hasOnly = false

  if (stats.isFile()) {
    ret$ = of(loadSuite(path))
  }
  else {
    ret$ = gatherSuites(path).pipe(
      // mergeMap(list => ofrom(list)),
      mergeMap(file => {
        return of(loadSuite(file)).pipe(
          tap(mod => {
            // scan has only?
            if (! hasOnly && mod.status === 'only') {
              hasOnly = true
            }
          }),
        )
      }, initConfig.loadConcurrent),
      reduce((acc: Set<RunSuite>, curr: RunSuite) => {
        acc.add(curr)
        return acc
      }, new Set()),
      mergeMap(list => ofrom(list)),
    )
  }

  const queue$ = ret$.pipe(
    map(suite => {
      let runStatus: UnitStatus = UnitStatus.normal
      if (hasOnly) {
        if (suite.status !== 'only') {
          runStatus = UnitStatus.skip
        }
      }
      const ret: RunSuite = { ...suite, runStatus }
      return ret
    }),
  )

  return queue$
}


export function gatherSuites(dir: string): Observable<Filepath> {
  const ret$ = walkDirForSuiteFile(dir).pipe(
    // without extension
    map(data => {
      const path = normalize(data.path)
      return path.slice(0, -3)
    }),
  )

  return ret$
}


/**
 * Walk directory, emit suite files
 */
export function walkDirForSuiteFile(dir: string): Observable<WalkEvent> {
  const ret$ = walk(dir).pipe(
    filter(data => {
      if (data.type === EntryType.file) {
        const name = basename(data.path)
        const suffix = name.slice(-8)

        if (suffix === '.test.js' || suffix === '.test.ts') {
          return true
        }
      }
      return false
    }),
  )

  return ret$
}


export function loadSuite(path: Filepath): RunSuite {
  const mod = loadFile(path)
  const suite: RunSuite = {
    ...initialTestSuite,
    ...mod,
    filePath: path,
    runStatus: UnitStatus.normal,
  }
  return suite
}


/**
 * Note that `loadFile` relies on Node's `require` to execute
 * the test interface functions and will be subject to the
 * cache - if the files are already in the `require` cache,
 * they will effectively be skipped. Therefore, to run tests
 * multiple times or to run tests in files that are already
 * in the `require` cache, make sure to clear them from the
 * cache first in whichever manner best suits your needs.
 */
export function loadFile(file: Filepath): TestSuite {
  const mod = require(pathResolve(file))
  return <TestSuite> mod.default
}


export function parseInput(data?: UnitPayload['data']): Observable<RxRequestInit['data']> {
  if (!data) {
    return of(void 0)
  }
  // observable
  // @ts-ignore
  else if (typeof data.pipe === 'function' && typeof data.subscribe === 'function') {
    return <Observable<JsonType>> data
  }
  // object
  else {
    return of(<NonNullable<RxRequestInit['data']>> data)
  }
}
