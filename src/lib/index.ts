import * as assert_ from 'assert'
import nodefetch, { Headers } from 'node-fetch'
import { forkJoin, from as ofrom, isObservable, of, throwError, Observable } from 'rxjs'
import { catchError, concatMap, map, mapTo, pluck } from 'rxjs/operators'
import { fetch, setGloalRequestInit, ObbRetType, RxRequestInit } from 'rxxfetch'

import { initialConfig, initialTestResult } from './config'
import { Config, RunAssertOpts, RunSuite, RunUnit, TestResult, UnitPayload, UnitStatus } from './model'
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
      map((row, index) => {
        if (typeof row.name === 'undefined' || row.name === '') {
          row.name = index + 1 + ''
        }
        const unit: RunUnit = {
          ...mod,
          payload: row,
        }
        return unit
      }),
      concatMap(startUnit),
    )
    return ret$
  }
  else if (typeof payload === 'object' && payload) {
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
    throw new TypeError('Value of payload is void')
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
  const reqUrl = config.urlPrefix ? config.urlPrefix + url : url
  const args: RxRequestInit = {
    method,
    cookies: config.cookies,
    ...payload.args,
  }

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
    unitName: unit.payload.name ? unit.payload.name : Math.random().toString().slice(2),
  }

  return ret
}


function runAssert(options: RunAssertOpts): Observable<RunUnit> {
  const { respData, runUnit } = options
  const { expect, callback } = runUnit.payload

  const cb$ = expectCallback(respData, callback)
  const data$ = expect && isObservable(expect)
    ? expectObservable(respData, expect)
    : expectNormal(respData, expect)

  const ret$ = forkJoin(cb$, data$).pipe(
    mapTo(runUnit),
  )
  return ret$
}


function expectCallback(respData: ObbRetType, callback: UnitPayload['callback']): Observable<void> {
  if (! callback) {
    return of(void 0)
  }
  else if (typeof callback !== 'function') {
    return throwError(new TypeError('callbak not a Function'))
  }

  try {
    const ret = callback(respData)
    return ret && isObservable(ret) ? ret : of(void 0)
  }
  catch (ex) {
    return throwError(ex)
  }
}


function expectObservable(respData: ObbRetType, expect: Observable<any>): Observable<void> {
  if (expect && isObservable(expect)) {
    const ret$ = expect.pipe(
      concatMap((res: any) => expectNormal(respData, res)),
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
