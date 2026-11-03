// ==UserScript==
// @name         SMAX notification
// @namespace    https://smax.capitaland.com/
// @version      1.0
// @description  Automatically expand Classification and validate Channel and Business Service before saving.
// @author       Lee Jian Biao
// @match        https://smax.capitaland.com/saw/Request/*/general*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';
    const CONFIG = {
    classificationText: 'Classification',

    channelSelector:
        '[data-aid="withoutResolution_Channel_c"]',

    businessSelector:
        '[data-aid="withoutResolution_RegisteredForActualService"]',

    saveSelector:
        '[data-aid="tool-bar-btn-save"]',

    expandWait: 700
};

let bypassSave = false;
let checking = false;

// ----------------------------------
// Notification
// ----------------------------------

function notify(message, type = 'error') {

    const old = document.getElementById('smax-validation-notice');

    if (old) old.remove();

    const box = document.createElement('div');

    box.id = 'smax-validation-notice';

    box.style.cssText = `
        position: fixed;
        top: 25px;
        right: 25px;
        z-index: 999999;
        padding: 18px 25px;
        min-width: 300px;
        max-width: 450px;
        background: ${type === 'success' ? '#198754' : '#dc3545'};
        color: white;
        font-size: 15px;
        font-weight: bold;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,.3);
        white-space: pre-line;
    `;

    box.textContent = message;

    document.body.appendChild(box);

    setTimeout(() => box.remove(), 6000);
}

// ----------------------------------
// Find Classification header
// ----------------------------------

function getClassificationHeader() {

    const headers = document.querySelectorAll('#collapse-icon');

    for (const header of headers) {

        const text = header.innerText.trim();

        if (text.includes(CONFIG.classificationText)) {
            return header;
        }
    }

    return null;
}

// ----------------------------------
// Check whether Classification
// is expanded
// ----------------------------------

function isClassificationExpanded(header) {

    // Check aria-expanded first.
    const aria = header.getAttribute('aria-expanded');

    if (aria !== null) {
        return aria === 'true';
    }

    // Check arrow icon.
    const arrow = header.querySelector(
        '.icon-arrow-med-down, .icon-arrow-med-right, .icon-arrow-med-up'
    );

    if (arrow) {

        if (arrow.classList.contains('icon-arrow-med-down')) {
            return true;
        }

        if (arrow.classList.contains('icon-arrow-med-right')) {
            return false;
        }

        if (arrow.classList.contains('icon-arrow-med-up')) {
            return true;
        }
    }

    // Check nearby content visibility.
    let parent = header.parentElement;

    for (let i = 0; i < 4 && parent; i++) {

        const content = parent.querySelector(
            '.pl-entity-page-component-content, .pl-entity-page-component-body'
        );

        if (content) {
            return content.offsetHeight > 0 &&
                getComputedStyle(content).display !== 'none' &&
                getComputedStyle(content).visibility !== 'hidden';
        }

        parent = parent.parentElement;
    }

    // Unknown state.
    return null;
}

// ----------------------------------
// Expand Classification if needed
// ----------------------------------

async function expandClassification() {

    const header = getClassificationHeader();

    if (!header) {
        console.warn('SMAX: Classification header not found.');
        return false;
    }

    const expanded = isClassificationExpanded(header);

    if (expanded === true) {

        console.log('SMAX: Classification already expanded.');

        return true;
    }

    if (expanded === false) {

        console.log('SMAX: Classification collapsed. Expanding...');

        header.click();

        await new Promise(resolve =>
            setTimeout(resolve, CONFIG.expandWait)
        );

        return isClassificationExpanded(header) !== false;
    }

    // State cannot be determined reliably.
    // Do not blindly click because that may collapse the section.
    console.warn(
        'SMAX: Cannot determine Classification expansion state.'
    );

    return false;
}

// ----------------------------------
// Validate Channel
// ----------------------------------

function checkChannel() {

    const container = document.querySelector(
        CONFIG.channelSelector
    );

    if (!container) {
        console.warn('SMAX: Channel field not found.');
        return false;
    }

    const selected = container.querySelector(
        '.select2-chosen'
    );

    if (!selected) return false;

    const value = selected.textContent.trim();

    console.log('SMAX Channel:', value);

    return value !== '' &&
        value !== '-- Select an item --' &&
        !value.toLowerCase().includes('select an item');
}

// ----------------------------------
// Validate Business Service
// ----------------------------------

function checkBusinessService() {

    const container = document.querySelector(
        CONFIG.businessSelector
    );

    if (!container) {
        console.warn('SMAX: Business Service field not found.');
        return false;
    }

    // Check selected input values.
    const inputs = container.querySelectorAll(
        'input:not([type="button"]):not([type="submit"])'
    );

    for (const input of inputs) {

        const value = (input.value || '').trim();

        if (
            value &&
            value !== input.placeholder &&
            !value.toLowerCase().includes('search') &&
            !value.toLowerCase().includes('select')
        ) {
            console.log('SMAX Business Service:', value);
            return true;
        }
    }

    // Check visible selected entity text.
    const elements = container.querySelectorAll(
        'a, span, div[title], [aria-label]'
    );

    const ignored = [
        '',
        'search',
        'select',
        'select an item',
        'business service',
        'add',
        '...'
    ];

    for (const element of elements) {

        if (element.children.length > 0) continue;

        if (element.offsetWidth === 0 &&
            element.offsetHeight === 0) continue;

        const value = (
            element.innerText ||
            element.getAttribute('title') ||
            element.getAttribute('aria-label') ||
            ''
        ).trim();

        if (
            value &&
            !ignored.includes(value.toLowerCase()) &&
            !value.toLowerCase().includes('search') &&
            !value.toLowerCase().includes('select')
        ) {

            console.log('SMAX Business Service:', value);

            return true;
        }
    }

    // Check container text as a fallback.
    const text = (container.innerText || '').trim();

    console.log('SMAX Business Service container:', text);

    return false;
}

// ----------------------------------
// Main validation
// ----------------------------------

async function validateBeforeSave(saveButton) {

    if (checking) return;

    checking = true;

    try {

        console.log('========== SMAX VALIDATION ==========');

        console.log('Request URL:', location.href);

        // Step 1: Expand Classification.
        const expanded = await expandClassification();

        if (!expanded) {

            notify(
                'Cannot confirm Classification is expanded.\n' +
                'Please check the Classification section.'
            );

            return;
        }

        // Allow Angular to finish rendering.
        await new Promise(resolve =>
            setTimeout(resolve, 400)
        );

        // Step 2: Validate fields.
        const channelOK = checkChannel();

        const businessOK = checkBusinessService();

        const missing = [];

        if (!channelOK) {
            missing.push('• Channel');
        }

        if (!businessOK) {
            missing.push('• Business Service');
        }

        // Step 3: Stop save if fields are empty.
        if (missing.length > 0) {

            notify(
                'SAVE CANCELLED!\n\n' +
                'Please complete the following fields:\n\n' +
                missing.join('\n')
            );

            console.warn(
                'SMAX Save blocked. Missing:', missing
            );

            return;
        }

        // Step 4: Both fields are completed.
        console.log('SMAX: All validation passed.');

        notify(
            'Validation successful!\n' +
            'Channel: OK\n' +
            'Business Service: OK\n\n' +
            'Saving request...',
            'success'
        );

        // Re-trigger the original Save button.
        bypassSave = true;

        saveButton.click();

    } catch (error) {

        console.error('SMAX Validation Error:', error);

        notify('Validation error. Save was not performed.');

    } finally {

        bypassSave = false;
        checking = false;
    }
}

// ----------------------------------
// Intercept Save button
// ----------------------------------

document.addEventListener('click', function (event) {

    const button = event.target.closest(CONFIG.saveSelector);

    if (!button) return;

    if (bypassSave) return;

    event.preventDefault();

    event.stopPropagation();

    event.stopImmediatePropagation();

    validateBeforeSave(button);

}, true);

// ----------------------------------
// Intercept Ctrl + S
// ----------------------------------

document.addEventListener('keydown', function (event) {

    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's'
    ) {

        const saveButton = document.querySelector(
            CONFIG.saveSelector
        );

        if (!saveButton) return;

        event.preventDefault();

        event.stopPropagation();

        event.stopImmediatePropagation();

        if (!checking) {
            validateBeforeSave(saveButton);
        }
    }

}, true);

console.log('SMAX Validation Script Loaded.');

    // Your code here...
})();
