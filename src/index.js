/**
 * Runs the enabled test suites with the provided configuration
 * @param {Object} data Configuration object from k6 setup
 * @returns {Promise<void>}
 */
export async function runTestSuites(data) {
    const {
        logger, // Use existing client
        testSuites,
        enabledSuites
    } = data;

    if (!logger) {
        throw new Error('Reporter client not initialized');
    }

    // Use existing logger for test execution
    for (const suiteName of enabledSuites) {
        const testSuite = testSuites[suiteName];
        if (!testSuite) continue;

        await runSuite(testSuite, suiteName, { ...data, logger });
    }
}

/**
 * Run a single test suite with all its tests
 * @param {Object} testSuite The test suite object
 * @param {string} suiteName Name of the test suite
 * @param {Object} config Configuration for the test run
 * @returns {Promise<void>}
 */
async function runSuite(testSuite, suiteName, config) {
    const suiteMetadata = testSuite._suiteMetadata || {
        name: suiteName,
        description: `Test suite for ${suiteName}`,
        features: []
    };

    console.log("Starting suite: ", suiteMetadata.name);
    const suiteId = config.logger.startSuite(
        suiteMetadata.name,
        suiteMetadata.description,
        { features: suiteMetadata.features }
    );

    // Add suite level logging
    config.logger.info(suiteId, `Starting suite: ${suiteMetadata.name}`);
    config.logger.info(suiteId, `Suite description: ${suiteMetadata.description}`);
    if (suiteMetadata.features?.length > 0) {
        config.logger.info(suiteId, `Suite features: ${suiteMetadata.features.join(', ')}`);
    }

    let suiteError = null;
    let setupSuccess = true;

    try {
        await runSuiteSetup(testSuite, { ...config, testId: suiteId });
    } catch (error) {
        setupSuccess = false;
        suiteError = error;
        config.logger.error(suiteId, `Suite setup failed: ${error.message}`);
    }

    // Only run tests if setup was successful
    if (setupSuccess) {
        try {
            await runTests(testSuite, { ...config, testId: suiteId });
        } catch (error) {
            if (!suiteError) suiteError = error;
            config.logger.error(suiteId, `Tests execution failed: ${error.message}`);
        }
    }

    // Always attempt to run teardown, regardless of previous errors
    try {
        await runSuiteTeardown(testSuite, { ...config, testId: suiteId });
    } catch (error) {
        if (!suiteError) suiteError = error;
        config.logger.error(suiteId, `Suite teardown failed: ${error.message}`);
    }

    if (suiteError) {
        config.logger.error(suiteId, `Suite failed: ${suiteError.message}`);
        config.logger.finishSuite(suiteId, 'failed');
    } else {
        config.logger.info(suiteId, `Suite completed successfully: ${suiteMetadata.name}`);
        config.logger.finishSuite(suiteId);
    }

    // Propagate the error if there was one
    if (suiteError) {
        throw suiteError;
    }
}

/**
 * Run setup method for a test suite if it exists
 * @param {Object} testSuite The test suite object
 * @param {Object} config Configuration for the setup
 * @returns {Promise<void>}
 */
async function runSuiteSetup(testSuite, config) {
    const setupMethod = Object.getOwnPropertyNames(Object.getPrototypeOf(testSuite))
        .find(method => testSuite[method].isSetup);

    if (setupMethod) {
        try {
            config.logger.info(config.testId, 'Starting suite setup');
            await Promise.resolve(testSuite[setupMethod](config));
            config.logger.success(config.testId, 'Suite setup completed');
        } catch (error) {
            const errorMsg = `Suite setup failed: ${error.message}`;
            config.logger.error(config.testId, errorMsg);
            throw error; // Rethrow to be caught by the caller
        }
    }
}

/**
 * Run tests in a test suite
 * @param {Object} testSuite The test suite object
 * @param {Object} config Configuration for the tests
 * @returns {Promise<void>}
 */
async function runTests(testSuite, config) {
    const testMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(testSuite))
        .filter(method => {
            const fn = testSuite[method];
            return typeof fn === 'function' && fn.testMetadata;
        });

    let hasFailedTests = false;
    let firstError = null;

    for (const methodName of testMethods) {
        const testMethod = testSuite[methodName];
        const testMetadata = testMethod.testMetadata;
        const testId = config.logger.startTest(
            testMetadata.name,
            testMetadata.description,
            {
                priority: testMetadata.priority,
                features: testMetadata.features,
                service: testMetadata.service
            },
            config.testId
        );

        try {
            config.logger.info(testId, `Starting test: ${testMetadata.name}`);

            // Handle both sync and async test methods
            const result = testMethod.call(testSuite, { ...config, testId });

            // If the test returns a promise, await it
            if (result && typeof result.then === 'function') {
                await result;
            }

            config.logger.success(testId, `Test completed: ${testMetadata.name}`);
            config.logger.finishTest(testId, 'passed');
        } catch (error) {
            hasFailedTests = true;
            if (!firstError) firstError = error;

            const errorMsg = `Test failed: ${error.message}`;
            config.logger.error(testId, errorMsg);
            config.logger.finishTest(testId, 'failed');
        }
    }

    if (hasFailedTests && firstError) {
        throw firstError;
    }
}

/**
 * Run teardown method for a test suite if it exists
 * @param {Object} testSuite The test suite object
 * @param {Object} config Configuration for the teardown
 * @returns {Promise<void>}
 */
async function runSuiteTeardown(testSuite, config) {
    const teardownMethod = Object.getOwnPropertyNames(Object.getPrototypeOf(testSuite))
        .find(method => testSuite[method].isTeardown);

    if (teardownMethod) {
        try {
            config.logger.info(config.testId, 'Starting suite teardown');
            await Promise.resolve(testSuite[teardownMethod](config));
            config.logger.success(config.testId, 'Suite teardown completed');
        } catch (error) {
            const errorMsg = `Suite teardown failed: ${error.message}`;
            config.logger.error(config.testId, errorMsg);
            throw error; // Rethrow to be caught by the caller
        }
    }
}