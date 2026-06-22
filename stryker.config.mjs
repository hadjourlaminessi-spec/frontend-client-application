/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: [
    'src/lib/cart.tsx',
    'src/lib/config.ts',
    'src/lib/http.ts',
  ],
  testRunner: 'jest',
  jest: {
    projectType: 'create-react-app',
  },
  checkers: ['typescript'],
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  concurrency: 4,
  timeoutMS: 30000,
  mutator: {
    excludedMutations: [
      'OptionalChaining',
      'StringLiteral',
    ],
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 60,
  },
};
