import { cpus } from 'os'

import { Config, TestResult, TestSuite } from './model'


const cpuCount = cpus().length

export const initialConfig: Config = {
  cookies: null,
  loadConcurrent: cpuCount > 2 ? cpuCount : 2,
  urlPrefix: 'http://',
}

export const initialTestSuite: Required<TestSuite> = {
  bail: false,
  method: 'GET',
  name: 'RunUnit Template',
  payload: null,
  status: 'normal',
  timeout: 60 * 1000,
  url: '',
}

export const initialTestResult: TestResult = {
  error:  null,
  filePath: '',
  status: 'unknown',
  suiteName: '',
}
