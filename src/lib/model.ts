import { Observable } from 'rxjs'
import { Filepath } from 'rxwalker'
import { Args, ObbRetType, RxRequestInit } from 'rxxfetch'


export const enum UnitStatus {
  'normal', 'skip', 'only',
}

export const enum RetStatus {
  'succeed', 'failed', 'skipped', 'unknown',
}

export interface TestResult {
  error: Error | null
  filePath: RunUnit['filePath']
  status: keyof typeof RetStatus
  suiteName: RunUnit['name']
  unitName: NonNullable<UnitPayload['name']>
}

export interface TestSuite {
  /** Whether exit with first failure. Default: false */
  bail?: boolean

  /** Default: 'GET' */
  method?: NonNullable<RxRequestInit['method']>

  /** Name of test suite */
  readonly name: string

  /** URL of remote API */
  readonly url: string

  payload: UnitPayload | UnitPayload[] | null

  /** Whether skip this suite or only this suite. Default:normal */
  status?: keyof typeof UnitStatus

  /** Default: 60*1000ms */
  timeout?: number
}

export interface RunSuite extends Required<TestSuite> {
  filePath: Filepath
  runStatus: UnitStatus
}

export interface RunUnit extends RunSuite {
  payload: UnitPayload
}

export interface UnitPayload <T = any> {
  /** args.data will override by TestUnit.data */
  args?: RxRequestInit
  data?: Args['data'] | Observable<Args['data']>
  callback?: AssertCallback<T>
  expect?: T | Observable<T>
  /** Name of test case. be string of index of payload if omit */
  name?: string
  respPluck?: string[]
}

export type AssertCallback <T> = (respData: T) => void | Observable<void>

export interface RunAssertOpts {
  respData: ObbRetType
  readonly runUnit: RunUnit
}


export interface Config {
  /** Append to every request */
  cookies: Args['cookies']

  /** Concurrent number of loading files. Default:os.cpu() at least 2 */
  loadConcurrent: number

  /** Prefix for TestSuite['url']. Default:http:// */
  urlPrefix: string
}
