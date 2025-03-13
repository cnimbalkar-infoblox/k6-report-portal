export const TestMetadata = new Map();

/**
 * Suite decorator to mark a class as a test suite
 * @param {Object} metadata Metadata for the suite
 * @returns {Function} Decorator function
 */
export function Suite(metadata) {
    return function(target) {
        // Store metadata directly on the class prototype
        Object.defineProperty(target.prototype, '_suiteMetadata', {
            value: metadata,
            writable: false,
            enumerable: false
        });
        return target;
    };
}

/**
 * Test decorator to mark a method as a test case
 * @param {Object} metadata Metadata for the test case
 * @returns {Function} Decorator function
 */
export function Test(metadata) {
    return function(target, propertyKey, descriptor) {
        if (!descriptor.value.testMetadata) {
            descriptor.value.testMetadata = metadata;
        }
        return descriptor;
    };
}

/**
 * Setup decorator to mark a method as a setup method
 * @returns {Function} Decorator function
 */
export function Setup() {
    return function(target, propertyKey, descriptor) {
        descriptor.value.isSetup = true;
        return descriptor;
    };
}

/**
 * Teardown decorator to mark a method as a teardown method
 * @returns {Function} Decorator function
 */
export function Teardown() {
    return function(target, propertyKey, descriptor) {
        descriptor.value.isTeardown = true;
        return descriptor;
    };
}