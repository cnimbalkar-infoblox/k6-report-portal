# k6-report-portal

A library for k6 that provides integration with Report Portal and test decorators.

## Overview

This library allows you to:
- Integrate k6 tests with Report Portal for result visualization
- Use decorators to organize tests into suites
- Configure test metadata (priority, features, service, etc.)
- Manage test execution with detailed logging

## Usage
- example template of library usage can be found here [k6-report-portal-template](https://github.com/cnimbalkar-infoblox/k6-report-portal-template)

How to use this library in your project:

```bash
npm init
npm install --save-dev @babel/core @babel/cli @babel/preset-env
npm install --save-dev @babel/plugin-proposal-decorators @babel/plugin-proposal-class-properties
```

## Client side project structure
```
├── src/
│   └── config.js     # Load configuration
├── test/
│   └── exampleTest.js  # Test files using decorators
├── .babelrc
├── main.js
└── package.json
```

## Setup

### 1. Configure Babel

Create a `.babelrc` file in your project root:

```json
{
  "presets": ["@babel/preset-env"],
  "plugins": [
    ["@babel/plugin-proposal-decorators", { "legacy": true }],
    ["@babel/plugin-proposal-class-properties"]
  ]
}
```

### 2. Environment Configuration

Create a `.env` file with the following variables:

```
# Report Portal Configuration
RP_ENDPOINT=http://localhost:8080
RP_TOKEN=your_token_here
RP_PROJECT=PLATFORM-FUNCTIONAL-TESTS
RP_LAUNCH=Access Control API Tests
RP_DESCRIPTION=Access Control API Tests
RP_MODE=DEFAULT
RP_COMPONENT=Platform

# Comma separated list of test suites to run
ENABLED_SUITES=exampleTest

# K6 Options
VUS=1
ITERATIONS=1
MAX_DURATION=5m
```

### 3. Configuration Module

Create a `config.js` file in the `src` directory:

```js
export function loadConfig() {
    return {
        baseURL: __ENV.BASE_URL,
        token: __ENV.AUTH_TOKEN,
        reporterConfig: {
            endpoint: __ENV.RP_ENDPOINT,
            token: __ENV.RP_TOKEN,
            project: __ENV.RP_PROJECT,
            launch: __ENV.RP_LAUNCH,
            description: __ENV.RP_DESCRIPTION,
            mode: __ENV.RP_MODE,
            component: __ENV.RP_COMPONENT
        },
        enabledSuites: (__ENV.ENABLED_SUITES || '').split(',')
    };
}
```

## Writing Tests

Create test files in the `test` directory. Here's an example:

```js
import {Suite, Test, Setup, Teardown} from 'https://cdn.jsdelivr.net/npm/k6-report-portal@1.0.4/lib/index.min.js';

@Suite({
    name: 'Example Suite',
    description: 'Test suite description'
})
class ExampleTests {
    @Setup()
    async setup({testId, logger, baseURL}) {
        return {}
    }
    
    @Test({
        name: 'Example Test',
        description: 'Test description',
        priority: 'P1',
        features: ['policies'],
        service: 'AUTHZ'
    })
    async exampleTest(data, {testId, logger}) {
        logger.info(testId, "Test execution");
    }

    @Teardown()
    async setup(data, {testId, logger, baseURL}) {}
}

export default new ExampleTests();
```

## Test Entry Point

Create a `main.js` file in your project root:

```js
import {runSuites, createReporter} from 'https://cdn.jsdelivr.net/npm/k6-report-portal@1.0.4/lib/index.min.js';
import {loadConfig} from './src/config.js';
// !IMPORTANT: Import test suites from the build directory
import exampleTest from './build/test/exampleTest.js';

export function setup() {
    return loadConfig();
}

export default async function (config) {
    let reporter = createReporter(config.reporterConfig);
    let logger = reporter.start();

    if (!logger) {
        throw new Error('Failed to initialize reporter');
    }

    try {
        await runSuites({
            ...config,
            logger,
            testSuites: {
                // !IMPORTANT: Add imported test suites to the testSuites object
                'exampleTest': exampleTest
            }
        });
        reporter.finish();
    } catch (error) {
        reporter.finish('FAILED');
        throw error;
    }
}
```

## Running Tests

Execute your tests with:

```bash
npm run test:local
```

## Available Decorators

- `@Suite`: Defines a test suite with metadata
- `@Test`: Defines a test case with metadata
- `@Setup`: Defines setup code to run before tests
- `@Teardown`: Defines cleanup code to run after tests

## Report Portal Integration

This library automatically:
- Creates a launch in Report Portal
- Creates test suites and test cases
- Reports test results and logs
- Handles test lifecycle events
