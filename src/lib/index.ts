import * as assert_ from 'assert'
import nodefetch, { Headers } from 'node-fetch'
import { empty, from as ofrom, isObservable, of, throwError, Observable } from 'rxjs'
import { catchError, concatMap, map, pluck } from 'rxjs/operators'
import { fetch, setGloalRequestInit, JsonType, ObbRetType, RxRequestInit } from 'rxxfetch'

import { initialConfig, initialTestResult } from './config'
import { Config, RunAssertOpts, RunSuite, RunUnit, TestResult, UnitStatus } from './model'
import { loadDirOrFile, parseInput } from './util'


const assert = assert_

if (typeof global === 'object') {
  setGloalRequestInit(<RxRequestInit> {
    fetchModule: nodefetch,
    headersInitClass: Headers,
  })
}


/** Start a test from a file or all files under the folder */
export function start(path: string) {
  const ret$ = loadDirOrFile(path).pipe(
    concatMap(startSuite),
  )
  return ret$
}


/** Start a TestSuite */
export function startSuite(mod: RunSuite) {
  const { payload } = mod

  if (Array.isArray(payload)) {
    const ret$ = ofrom(payload).pipe(
      map(row => {
        return <RunUnit> {
          ...mod,
          payload: row,
        }
      }),
      concatMap(startUnit),
    )
    return ret$
  }
  else if (typeof payload === 'object') {
    return startUnit(<RunUnit> mod)
  }
  else {
    throw new Error('invalid payload. suite name:' + mod.name)
  }
}


/** Start a test case */
export function startUnit(runUnit: RunUnit) {
  assert(runUnit.name)
  assert(runUnit.url)
  assert(runUnit.payload)
  if (!runUnit.payload) {
    return empty()
  }

  const req$ = sendRequest(runUnit)
  const ret$ = req$.pipe(
    map(respData => {
      return <RunAssertOpts> {
        respData,
        runUnit,
      }
    }),
    concatMap(runAssert),
    map(res => handleResult(res)),
    catchError(err => of(handleResult(runUnit, err))),
  )

  return ret$
}


/** Return copy of Config */
export function getConfig(): Config {
  return { ...initialConfig }
}


/** Set Config and return copy of Config */
export function setConfig(config: Partial<Config>): Config {
  for (const [key, value] of Object.entries(config)) {
    Object.defineProperty(initialConfig, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    })
  }
  return getConfig()
}


function sendRequest(runUnit: RunUnit): Observable<ObbRetType> {
  const config = getConfig()
  const { url, method, payload } = runUnit
  const { data, respPluck } = payload
  const reqData$ = parseInput(data)
  const args: RxRequestInit = { method, ...payload.args }
  const reqUrl = config.urlPrefix ? config.urlPrefix + url : url

  let req$ = reqData$.pipe(
    concatMap(res => {
      args.data = res
      return fetch<ObbRetType>(reqUrl, args)
    }),
  )

  if (respPluck) {
    req$ = req$.pipe(
      pluck(...respPluck),
    )
  }

  return req$
}


/** Generate Result Object */
function handleResult(unit: RunUnit, error: TestResult['error'] = null): TestResult {
  const status: TestResult['status'] = error
    ? 'failed'
    : (unit.runStatus === UnitStatus.skip ? 'skipped' : 'succeed')

  const ret: TestResult = {
    ...initialTestResult,
    error,
    status,
    filePath: unit.filePath,
    suiteName: unit.name,
  }

  return ret
}


function runAssert(options: RunAssertOpts): Observable<RunUnit> {
  const { respData, runUnit } = options
  const { expect, callback } = runUnit.payload

  if (typeof callback === 'function') {
    callback(respData)
  }

  const ret$ = expect && isObservable(expect)
    ? expectObservable(respData, expect)
    : expectNormal(respData, expect)

  return ret$.pipe(
    map(() => runUnit),
  )
}


function expectObservable(respData: ObbRetType, expect: Observable<JsonType>): Observable<void> {
  if (expect && isObservable(expect)) {
    const ret$ = expect.pipe(
      concatMap(res => expectNormal(respData, res)),
    )
    return ret$
  }
  else {
    throw TypeError('"expect" not valid Observable')
  }
}


function expectNormal(respData: ObbRetType, expect: any) {
  if (typeof expect === 'undefined') {
    return of(void 0)
  }

  if (respData === expect) {
    return of(void 0)
  }

  try {
    assert.deepStrictEqual(respData, expect)
    return of(void 0)
  }
  catch (ex) {
    return throwError(ex)
  }
}
