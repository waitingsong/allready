import { Observable } from 'rxjs'
import { Filepath } from 'rxwalker'
import { JsonType, ObbRetType, RxRequestInit } from 'rxxfetch'

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
}

export interface TestSuite {
  /** Whether exit with first failure. Default: false */
  bail?: boolean
  /** Default: 'GET' */
  method?: NonNullable<RxRequestInit['method']>
  /** Name of test case */
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

export interface UnitPayload {
  /** args.data will override by TestUnit.data */
  args?: RxRequestInit
  data?: RxRequestInit['data'] | Observable<RxRequestInit['data']>
  callback?: AssertCallback
  expect: JsonType | Observable<JsonType>
  respPluck?: string[]
}

export type AssertCallback = (respData: ObbRetType) => void
export interface RunAssertOpts {
  respData: ObbRetType
  readonly runUnit: RunUnit
}


export interface Config {
  /** Concurrent number of loading files. Default:os.cpu() at least 2 */
  loadConcurrent: number
}
