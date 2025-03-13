import http from 'k6/http';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

/**
 * Creates API request headers with authorization token
 * @param {string} token - Authentication token
 * @returns {Object} Headers object with content type and authorization
 * @private
 */
export function createHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Log levels supported by Report Portal
 * @enum {string}
 */
export const LogLevel = {
    TRACE: 'TRACE',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
};

/**
 * Test item types in Report Portal
 * @enum {string}
 */
export const ItemType = {
    SUITE: 'SUITE',
    STORY: 'STORY',
    TEST: 'TEST',
    SCENARIO: 'SCENARIO',
    STEP: 'STEP',
    BEFORE_CLASS: 'BEFORE_CLASS',
    BEFORE_GROUPS: 'BEFORE_GROUPS',
    BEFORE_METHOD: 'BEFORE_METHOD',
    BEFORE_SUITE: 'BEFORE_SUITE',
    BEFORE_TEST: 'BEFORE_TEST',
    AFTER_CLASS: 'AFTER_CLASS',
    AFTER_GROUPS: 'AFTER_GROUPS',
    AFTER_METHOD: 'AFTER_METHOD',
    AFTER_SUITE: 'AFTER_SUITE',
    AFTER_TEST: 'AFTER_TEST'
};

/**
 * Launch modes in Report Portal
 * @enum {string}
 */
export const LaunchMode = {
    DEFAULT: 'DEFAULT',
    DEBUG: 'DEBUG'
};


export const DefectType = {
    PRODUCT_BUG: 'PB',
    AUTOMATION_BUG: 'AB',
    SYSTEM_ISSUE: 'SI',
    TO_INVESTIGATE: 'TI',
    NO_DEFECT: 'ND'
};

/**
 * Test status types in Report Portal
 * @enum {string}
 */
export const Status = {
    PASSED: 'PASSED',
    FAILED: 'FAILED',
    SKIPPED: 'SKIPPED',
    STOPPED: 'STOPPED',
    INTERRUPTED: 'INTERRUPTED',
    CANCELLED: 'CANCELLED'
};


/**
 *
 * @param type
 * @param comment
 * @returns {{issueType, comment: string}|null}
 */
function formatIssue(type, comment) {
    if (!type) return null;

    return {
        issueType: type,
        comment: comment || 'No comment provided'
    };
}


/**
 * Formats attributes for Report Portal API
 * @param {Object|Array} attributes - Attributes as object or array
 * @returns {Array<Object>} Formatted attributes array
 * @private
 */
function formatAttributes(attributes) {
    if (!attributes) return [];

    // Handle array format
    if (Array.isArray(attributes)) {
        return attributes;
    }

    // Handle object format
    return Object.entries(attributes).map(([key, value]) => ({
        key,
        value: Array.isArray(value) ? value.join(',') : String(value)
    }));
}

/**
 * Safely parses API response
 * @param {Object} response - HTTP response object
 * @returns {Object} Parsed response body or empty object
 * @private
 */
function parseResponse(response) {
    try {
        return JSON.parse(response.body);
    } catch (e) {
        console.error(`Failed to parse API response: ${e.message}`);
        return {};
    }
}

/**
 * Validation utilities
 * @private
 */
const validate = {
    options(options) {
        const required = ['endpoint', 'project', 'token'];
        const missing = required.filter(field => !options[field]);

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
    },

    notEmpty(value, name) {
        if (!value) {
            throw new Error(`${name} cannot be empty`);
        }
    }
};

/**
 * Handles API errors and provides logging
 * @param {Object} response - HTTP response object
 * @param {string} operation - Name of the operation being performed
 * @returns {boolean} True if successful, false otherwise
 * @private
 */
function handleApiResponse(response, operation) {
    if (response.status >= 200 && response.status < 300) {
        return true;
    }

    console.error(`${operation} failed: Status ${response.status}, ${response.body}`);
    return false;
}

/**
 * Starts a new test launch in Report Portal
 * @param {Object} options - Configuration options for Report Portal
 * @param {string} options.endpoint - Report Portal API endpoint
 * @param {string} options.project - Report Portal project name
 * @param {string} options.launch - Launch name
 * @param {string} options.description - Launch description
 * @param {string} options.token - Authentication token
 * @param {boolean} options.publishResult - Whether to publish results
 * @param {string} [options.mode='DEFAULT'] - Launch mode ('DEFAULT' or 'DEBUG')
 * @param {Array<Object>|Object} [options.attributes] - Launch attributes
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {number} [options.timeout=30000] - Request timeout in milliseconds
 * @returns {string|null} Launch ID if successful, null otherwise
 */
export function startLaunch(options) {
    try {
        validate.options(options);

        if (!options.publishResult) return null;

        const reportPortalUri = `${options.endpoint}/api/v1/${options.project}`;
        const payload = {
            name: options.launch || 'k6 Load Test',
            description: options.description || '',
            startTime: Date.now(),
            mode: options.mode || LaunchMode.DEFAULT,
            attributes: formatAttributes(options.attributes)
        };

        const requestParams = {
            timeout: options.timeout || 30000
        };

        if (options.debug) {
            console.log(`Starting launch: ${JSON.stringify(payload)}`);
        }

        const response = http.post(
            `${reportPortalUri}/launch`,
            JSON.stringify(payload),
            {headers: createHeaders(options.token), ...requestParams}
        );

        if (!handleApiResponse(response, 'startLaunch')) {
            return null;
        }

        const result = parseResponse(response);
        return result.id;
    } catch (error) {
        console.error(`Error starting launch: ${error.message}`);
        return null;
    }
}

/**
 * Finishes a test launch in Report Portal
 * @param {string} launchId - ID of the launch to finish
 * @param {Object} options - Configuration options for Report Portal
 * @param {string} [status=PASSED] - Final launch status
 * @returns {boolean} True if successful, false otherwise
 */
export function finishLaunch(launchId, options, status = Status.PASSED) {
    try {
        if (!options.publishResult || !launchId) return false;

        const reportPortalUri = `${options.endpoint}/api/v1/${options.project}`;
        const payload = {
            endTime: Date.now(),
            status: status
        };

        const requestParams = {
            timeout: options.timeout || 30000
        };

        if (options.debug) {
            console.log(`Finishing launch ${launchId}: ${JSON.stringify(payload)}`);
        }

        const response = http.put(
            `${reportPortalUri}/launch/${launchId}/finish`,
            JSON.stringify(payload),
            {headers: createHeaders(options.token), ...requestParams}
        );

        return handleApiResponse(response, 'finishLaunch');
    } catch (error) {
        console.error(`Error finishing launch: ${error.message}`);
        return false;
    }
}

/**
 * Converts text to highlighted markup
 * @param {string} text - Text to highlight
 * @param {string} [highlightType='highlight'] - Type of highlight style
 * @returns {string} Marked up text for Report Portal
 */
function markupText(text, highlightType = 'highlight') {
    // Report Portal uses Markdown syntax for highlighted logs
    const markupMap = {
        'highlight': `<mark>${text}</mark>`,
        'success': `<span style="color: green">${text}</span>`,
        'error': `<span style="color: red">${text}</span>`,
        'warning': `<span style="color: orange">${text}</span>`,
        'info': `<span style="color: blue">${text}</span>`,
        'bold': `<b>${text}</b>`,
        'italic': `<i>${text}</i>`,
        'code': `<code>${text}</code>`
    };

    return markupMap[highlightType] || markupMap['highlight'];
}

/**
 * Creates a Report Portal client for test reporting
 * @param {string} launchId - ID of the current launch
 * @param {Object} options - Configuration options for Report Portal
 * @returns {Object} Client object with methods for test reporting
 */
export function createClient(launchId, options) {
    validate.options(options);

    const reportPortalUri = `${options.endpoint}/api/v1/${options.project}`;
    const token = options.token;
    const debug = options.debug || false;
    const timeout = options.timeout || 30000;

    /**
     * Internal logging for debug purposes
     * @private
     */
    function debugLog(message, data = null) {
        if (!debug) return;

        if (data) {
            console.log(`[RPClient] ${message}: ${JSON.stringify(data)}`);
        } else {
            console.log(`[RPClient] ${message}`);
        }
    }

    /**
     * Makes an API request to Report Portal
     * @private
     */
    function makeRequest(method, url, data = null) {
        if (!options.publishResult) return {success: false};

        try {
            const requestParams = {
                headers: createHeaders(token),
                timeout: timeout
            };

            let response;
            const fullUrl = `${reportPortalUri}${url}`;

            debugLog(`${method} ${url}`, data);

            if (method === 'GET') {
                response = http.get(fullUrl, requestParams);
            } else if (method === 'POST') {
                response = http.post(fullUrl, JSON.stringify(data), requestParams);
            } else if (method === 'PUT') {
                response = http.put(fullUrl, JSON.stringify(data), requestParams);
            } else if (method === 'DELETE') {
                response = http.del(fullUrl, null, requestParams);
            }

            const success = handleApiResponse(response, `${method} ${url}`);
            const result = parseResponse(response);

            return {success, result};
        } catch (error) {
            console.error(`API request error (${method} ${url}): ${error.message}`);
            return {success: false, error: error.message};
        }
    }

    return {
        /**
         * Starts a test item (suite, test, etc.)
         * @param {Object} params - Item parameters
         * @param {string} params.name - Item name
         * @param {string} params.type - Item type from ItemType enum
         * @param {string} [params.description] - Item description
         * @param {Object|Array} [params.attributes] - Item attributes
         * @param {string} [params.parentId] - Parent item ID (null for root items)
         * @returns {string|null} Item ID if successful, null otherwise
         */
        startItem(params) {
            validate.notEmpty(params.name, 'Item name');
            validate.notEmpty(params.type, 'Item type');

            const payload = {
                name: params.name,
                type: params.type,
                description: params.description || '',
                startTime: Date.now(),
                launchUuid: launchId,
                attributes: formatAttributes(params.attributes)
            };

            let url = '/item';
            if (params.parentId) {
                url = `/item/${params.parentId}`;
            }

            const {success, result} = makeRequest('POST', url, payload);
            return success ? result.id : null;
        },

        /**
         * Starts a test suite
         * @param {string} name - Suite name
         * @param {string} [description] - Suite description
         * @param {Object|Array} [attributes] - Suite attributes
         * @returns {string|null} Suite ID if successful, null otherwise
         */
        startSuite(name, description = '', attributes = {}) {
            return this.startItem({
                name,
                description,
                attributes,
                type: ItemType.SUITE
            });
        },

        /**
         * Starts a test case
         * @param {string} name - Test name
         * @param {string} [description] - Test description
         * @param {Object|Array} [attributes] - Test attributes
         * @param {string} parentId - Parent suite ID
         * @returns {string|null} Test ID if successful, null otherwise
         */
        startTest(name, description = '', attributes = {}, parentId) {
            validate.notEmpty(parentId, 'Parent ID');

            return this.startItem({
                name,
                description,
                attributes,
                type: ItemType.TEST,
                parentId
            });
        },

        /**
         * Starts a test step
         * @param {string} name - Step name
         * @param {string} [description] - Step description
         * @param {string} parentId - Parent test ID
         * @returns {string|null} Step ID if successful, null otherwise
         */
        /**
         * Starts a test step
         * @param {string} testId - Parent test ID
         * @param {string} name - Step name
         * @param {string} description - Step description
         * @returns {string|null} Step ID if successful
         */
        startStep(testId, name, description) {
            validate.notEmpty(testId, 'Test ID');
            validate.notEmpty(name, 'Step name');

            const payload = {
                name,
                description: description || '',
                type: ItemType.STEP,
                startTime: Date.now(),
                launchUuid: launchId,
                hasStats: true
            };

            const {success, result} = makeRequest('POST', `/item/${testId}`, payload);
            return success ? result.id : null;
        },

        /**
         * Finishes a test item (suite, test, step)
         * @param {string} id - Item ID to finish
         * @param {string} [status=PASSED] - Item status from Status enum
         * @returns {boolean} True if successful, false otherwise
         */
        finishItem(id, status = Status.PASSED) {
            validate.notEmpty(id, 'Item ID');

            const payload = {
                endTime: Date.now(),
                status: status,
                launchUuid: launchId
            };

            const {success} = makeRequest('PUT', `/item/${id}`, payload);
            return success;
        },

        /**
         * Finishes a test suite
         * @param {string} id - Suite ID to finish
         * @param {string} [status=PASSED] - Suite status
         * @returns {boolean} True if successful, false otherwise
         */
        finishSuite(id, status = Status.PASSED) {
            return this.finishItem(id, status);
        },

        /**
         * Finishes a test case
         * @param {string} id - Test ID to finish
         * @param {string} [status=PASSED] - Test status
         * @returns {boolean} True if successful, false otherwise
         */
        finishTest(id, status = Status.PASSED) {
            return this.finishItem(id, status);
        },

        /**
         * Finishes a test step with default PASSED status
         * @param {string} stepId - ID of the step to finish
         * @param status - Step status from Status enum
         * @param issueType - Defect type from DefectType enum
         * @param comment - Defect comment
         * @returns {boolean} True if successful, false otherwise
         */
        finishStep(stepId, status = Status.PASSED, issueType, comment) {
            const payload = {
                endTime: Date.now(),
                status: status
            };

            if (issueType) {
                payload.issue = formatIssue(issueType, comment);
            }

            return makeRequest('PUT', `/item/${stepId}`, payload).success;
        },

        /**
         * Logs a message with specified level
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Message to log
         * @param {string} [level=INFO] - Log level from LogLevel enum
         * @returns {boolean} True if successful, false otherwise
         */
        log(itemId, message, level = LogLevel.INFO) {
            validate.notEmpty(itemId, 'Item ID');
            validate.notEmpty(message, 'Message');

            const payload = {
                itemUuid: itemId,
                message,
                time: Date.now(),
                launchUuid: launchId,
                level
            };

            const {success} = makeRequest('POST', '/log', payload);
            return success;
        },

        /**
         * Logs an info message
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Message to log
         * @returns {boolean} True if successful, false otherwise
         */
        info(itemId, message) {
            return this.log(itemId, message, LogLevel.INFO);
        },

        /**
         * Logs a debug message
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Message to log
         * @returns {boolean} True if successful, false otherwise
         */
        debug(itemId, message) {
            return this.log(itemId, message, LogLevel.DEBUG);
        },

        /**
         * Logs a warning message
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Message to log
         * @returns {boolean} True if successful, false otherwise
         */
        warn(itemId, message) {
            return this.log(itemId, message, LogLevel.WARN);
        },

        /**
         * Logs an error message
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Error message to log
         * @returns {boolean} True if successful, false otherwise
         */
        error(itemId, message) {
            return this.log(itemId, message, LogLevel.ERROR);
        },

        /**
         * Logs a fatal error message
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Fatal error message to log
         * @returns {boolean} True if successful, false otherwise
         */
        fatal(itemId, message) {
            return this.log(itemId, message, LogLevel.FATAL);
        },

        /**
         * Logs a success message (as INFO level with special formatting)
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Success message to log
         * @returns {boolean} True if successful, false otherwise
         */
        success(itemId, message) {
            return this.log(itemId, markupText(message, 'success'), LogLevel.INFO);
        },


        /**
         * Reports a defect and finishes the step with FAILED status
         * @param {string} stepId - Step ID
         * @param {string} message - Error message
         * @param {string} [type='AB'] - Defect type (AB, PB, SI, TI)
         * @returns {boolean} True if successful
         */
        defect(stepId, message, type = 'AB') {
            this.error(stepId, message);
            const issueId = `${type}${Math.floor(Math.random()*999).toString().padStart(3, '0')}`;
            return this.finishStep(stepId, 'FAILED', issueId, message);
        },

        /**
         * Highlights text in logs with specified style
         * @param {string} itemId - Item ID to log against
         * @param {string} message - Full message text
         * @param {string} highlightText - Text to highlight within message
         * @param {string} [highlightType='highlight'] - Type of highlight (highlight, success, error, warning, info, bold, italic, code)
         * @param {string} [level=INFO] - Log level
         * @returns {boolean} True if successful, false otherwise
         */
        highlight(itemId, message, highlightText, highlightType = 'highlight', level = LogLevel.INFO) {
            if (!message.includes(highlightText)) {
                return this.log(itemId, message, level);
            }

            const highlightedText = markupText(highlightText, highlightType);
            const formattedMessage = message.replace(highlightText, highlightedText);

            return this.log(itemId, formattedMessage, level);
        },

        /**
         * Logs JSON data as an attachment
         * @param {string} itemId - Item ID to log against
         * @param {Object} jsonData - JSON data to log
         * @param {string} [fileName='attachment.json'] - Filename for the attachment
         * @param {string} [message='JSON Attachment'] - Optional message
         * @returns {boolean} True if successful, false otherwise
         */
        json(itemId, jsonData, fileName = 'attachment.json', message = 'JSON Attachment') {
            validate.notEmpty(itemId, 'Item ID');

            try {
                const jsonString = JSON.stringify(jsonData, null, 2);

                const formData = new FormData();

                // Create JSON payload
                const jsonPayload = {
                    itemUuid: itemId,
                    launchUuid: launchId,
                    level: 'INFO',
                    message: message,
                    time: Date.now(),
                    uuid: generateUUID(),
                    file: { name: fileName }
                };

                // Add JSON payload part
                formData.append('json_request_part', JSON.stringify([jsonPayload]));

                // Add file content part
                formData.append('file', jsonString);

                const url = `${reportPortalUri}/log`;
                const params = createHeaders(token)

                const response = http.post(url, formData.body(), {
                    ...params,
                    headers: {
                        ...params.headers,
                        'Content-Type': `multipart/form-data; boundary=${formData.boundary}`
                    }
                });

                return response.status === 200;
            } catch (error) {
                console.error(`Error creating JSON attachment: ${error.message}`);
                this.error(itemId, `Failed to attach JSON: ${error.message}`);
                return false;
            }
        },
        /**
         * Logs a file attachment
         * @param {string} itemId - Item ID to log against
         * @param {string|Uint8Array} fileContent - File content as string or binary data
         * @param {string} fileName - Name of the file
         * @param {string} contentType - MIME type of the file
         * @param {string} [message='File Attachment'] - Optional message
         * @returns {boolean} True if successful, false otherwise
         */
        attachment(itemId, fileContent, fileName, contentType, message = 'File Attachment') {
            validate.notEmpty(itemId, 'Item ID');
            validate.notEmpty(fileName, 'File name');
            validate.notEmpty(contentType, 'Content type');

            try {
                // Convert to base64 if needed
                const content = typeof fileContent === 'string' ? base64Encode(fileContent) : base64Encode(String.fromCharCode(...new Uint8Array(fileContent)));

                const payload = {
                    itemUuid: itemId,
                    time: Date.now(),
                    launchUuid: launchId,
                    level: LogLevel.INFO,
                    message: message,
                    file: {
                        name: fileName,
                        content: content,
                        contentType: contentType
                    }
                };

                const {success} = makeRequest('POST', '/log', payload);
                return success;
            } catch (error) {
                console.error(`Error creating file attachment: ${error.message}`);
                this.error(itemId, `Failed to attach file: ${error.message}`);
                return false;
            }
        },

        /**
         * Creates a nested structure of tests with steps
         * @param {Object} structure - Test structure definition
         * @param {string} structure.name - Root suite name
         * @param {string} [structure.description] - Root suite description
         * @param {Array} structure.tests - Array of test definitions
         * @returns {Object} IDs of created items
         */
        createTestStructure(structure) {
            const result = {
                suiteId: null,
                tests: {}
            };

            // Start the root suite
            result.suiteId = this.startSuite(structure.name, structure.description);

            if (!result.suiteId) {
                return result;
            }

            // Create each test
            structure.tests.forEach(test => {
                const testId = this.startTest(test.name, test.description, test.attributes, result.suiteId);
                result.tests[test.name] = {id: testId, steps: {}};

                // Create steps if provided
                if (test.steps && Array.isArray(test.steps)) {
                    test.steps.forEach(step => {
                        const stepId = this.startStep(step.name, step.description, testId);
                        result.tests[test.name].steps[step.name] = stepId;
                    });
                }
            });

            return result;
        },

        /**
         * Gets launch status
         * @returns {Object|null} Launch status data or null on failure
         */
        getLaunchStatus() {
            if (!launchId) return null;

            const {success, result} = makeRequest('GET', `/launch/${launchId}`);
            return success ? result : null;
        },

        /**
         * Gets item status
         * @param {string} itemId - ID of the item to check
         * @returns {Object|null} Item status data or null on failure
         */
        getItemStatus(itemId) {
            validate.notEmpty(itemId, 'Item ID');

            const {success, result} = makeRequest('GET', `/item/${itemId}`);
            return success ? result : null;
        }
    };
}


/**
 * Creates a reporter instance with configuration from environment variables
 * @param {Object} [options={}] - Optional configuration overrides
 * @returns {Object} Reporter instance
 */
export function createReporter(options = {}) {
    const config = {...options};
    let launchId = null;
    let client = null;

    return {
        /**
         * Starts reporting
         * @returns {Object} Client instance
         */
        start() {
            launchId = startLaunch(config);
            client = createClient(launchId, config);
            return client;
        },

        /**
         * Finishes reporting
         * @param {string} [status=PASSED] - Final launch status
         */
        finish(status = Status.PASSED) {
            if (launchId) {
                finishLaunch(launchId, config, status);
            }
        },

        /**
         * Gets the current client instance
         * @returns {Object|null} Client instance or null if not started
         */
        getClient() {
            return client;
        },

        /**
         * Gets the current launch ID
         * @returns {string|null} Launch ID or null if not started
         */
        getLaunchId() {
            return launchId;
        }
    };
}


/**
 * Generates a simple UUID v4
 * @returns {string} UUID string
 * @private
 */
function generateUUID() {
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else if (i === 14) {
            uuid += '4';
        } else if (i === 19) {
            uuid += hex[(Math.random() * 4) | 8];
        } else {
            uuid += hex[(Math.random() * 16) | 0];
        }
    }
    return uuid;
}

/**
 * Base64 encodes an utf-8 string
 * @param {string} str String to encode
 * @returns {string} Base64 encoded string
 * @private
 */
function base64Encode(str) {
    // k6 doesn't have btoa, so we need our own implementation
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let i = 0;

    while (i < str.length) {
        const chr1 = str.charCodeAt(i++);
        const chr2 = i < str.length ? str.charCodeAt(i++) : NaN;
        const chr3 = i < str.length ? str.charCodeAt(i++) : NaN;

        const enc1 = chr1 >> 2;
        const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        const enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        const enc4 = chr3 & 63;

        result += chars.charAt(enc1) + chars.charAt(enc2) +
            (isNaN(chr2) ? '=' : chars.charAt(enc3)) +
            (isNaN(chr3) ? '=' : chars.charAt(enc4));
    }

    return result;
}


