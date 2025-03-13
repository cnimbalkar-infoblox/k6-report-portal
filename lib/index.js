// lib/index.js
import {runTestSuites} from "../src/index.js";
import {createReporter} from "../src/report-portal-client.js";
import {Suite, Test, Setup, Teardown} from "../src/decorators.js";

/**
 * Run all test suites
 * @param {Object} data Configuration from k6 setup
 * @returns {Promise<void>}
 */
export async function runSuites(data) {
    // Use the existing rpClient from data instead of creating new one
    await runTestSuites(data);
}

export {
    createReporter,
    Suite,
    Test,
    Setup,
    Teardown
}
