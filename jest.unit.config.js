module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'apps/**/*.ts',
    'libs/**/*.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.spec.ts',
    '!**/index.ts',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    './apps/collector/src/threshold/threshold.evaluator.ts': {
      lines: 80,
      branches: 70,
    },
    './apps/collector/src/outbox/outbox-relay.service.ts': {
      lines: 70,
      branches: 60,
    },
    './apps/processor/src/alerts/alerts.service.ts': {
      lines: 80,
      branches: 60,
    },
    './apps/processor/src/alerts/alerts.controller.ts': {
      lines: 80,
      branches: 70,
    },
    './libs/config/src/env.validation.ts': {
      lines: 70,
      branches: 60,
    },
    './libs/rabbitmq/src/consumer-failure.util.ts': {
      lines: 80,
      branches: 70,
    },
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/', '<rootDir>/libs/'],
  moduleNameMapper: {
    '^@app/common(|/.*)$': '<rootDir>/libs/common/src/$1',
    '^@app/config(|/.*)$': '<rootDir>/libs/config/src/$1',
    '^@app/logger(|/.*)$': '<rootDir>/libs/logger/src/$1',
    '^@app/rabbitmq(|/.*)$': '<rootDir>/libs/rabbitmq/src/$1',
  },
};
