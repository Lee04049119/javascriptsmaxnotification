// ==UserScript==
// @name         SMAX - Complete Status Solution Validation
// @namespace    https://smax.capitaland.com/
// @version      1.1
// @description  Validate Solution before saving when Status is Complete
// @author       Lee Jian Biao
// @match        https://smax.capitaland.com/saw/Request/*/general*
// @updateURL    https://raw.githubusercontent.com/Lee04049119/javascriptsmaxnotification/main/smaxverificationresolution.js
// @downloadURL  https://raw.githubusercontent.com/Lee04049119/javascriptsmaxnotification/main/smaxverificationresolution.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('[SMAX Validation] Script loaded');

    // Get current Status
    function getStatus() {
        const statusElement = document.querySelector(
            '[data-aid="withoutResolution_Status"] .select2-chosen'
        );

        return statusElement
            ? statusElement.innerText.trim()
            : '';
    }

    // Get Solution editor
    function getSolution() {
        const editor = document.querySelector(
            '.cke_wysiwyg_div[contenteditable="true"][aria-label="Solution"]'
        );

        if (!editor) {
            return '';
        }

        // Extract actual text, ignoring empty HTML elements
        return editor.innerText
            .replace(/\u00a0/g, ' ')
            .trim();
    }

    // Validate before Save
    function validateSave(event) {
        const status = getStatus();

        // Only validate when Status = Complete
        if (status.toLowerCase() !== 'complete') {
            return true;
        }

        const solution = getSolution();

        // Solution is empty
        if (!solution) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            alert(
                'SMAX Validation Error\n\n' +
                'Status is Complete, but Solution is empty.\n\n' +
                'Please enter the Solution before saving.'
            );

            console.warn('[SMAX Validation] Save blocked: Empty Solution');

            return false;
        }

        console.log('[SMAX Validation] Passed', {
            status: status,
            solution: solution
        });

        return true;
    }

    // Monitor Save button clicks
    document.addEventListener('click', function (event) {
        const saveButton = event.target.closest(
            '[data-aid="tool-bar-btn-save"]'
        );

        if (!saveButton) {
            return;
        }

        validateSave(event);

    }, true);

    // Also validate Ctrl+S
    document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === 's') {

            validateSave(event);
        }
    }, true);

})();

