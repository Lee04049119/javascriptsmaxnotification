// ==UserScript==
// @name         Outlook Broadcast Approval Checker
// @namespace    https://outlook.cloud.microsoft/
// @version      1.0
// @description  Check broadcast recipients and attachment only when Send is clicked
// @match        https://outlook.cloud.microsoft/mail/*
// @match        https://outlook.office.com/mail/*
// @match        about:blank
// @updateURL    https://raw.githubusercontent.com/Lee04049119/javascriptsmaxnotification/main/outlooknotification.js
// @downloadURL  https://raw.githubusercontent.com/Lee04049119/javascriptsmaxnotification/main/outlooknotification.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const REQUIRED_RECIPIENTS = [
        { name: 'SUMANTH Krishna', email: 'krishna.sumanth@capitaland.com' },
        { name: 'LIM Elaine', email: 'elaine.lim@capitaland.com' },
        { name: 'HAW Mavis', email: 'mavis.haw@capitaland.com' },
        { name: 'NG Alvin', email: 'alvin.ng@capitaland.com' }
    ];

    const KEYWORDS = [
        'broadcast approval',
        'broadcast',
        'notification'
    ];

    const processing = new WeakSet();
    const bypassSend = new WeakSet();

    function normalize(value) {
        return (value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function isTargetSubject(subject) {
        const value = normalize(subject);

        return KEYWORDS.some(keyword =>
            value.includes(normalize(keyword))
        );
    }

    function getSubjectElements() {
        return [...document.querySelectorAll(
            'input[aria-label="Subject"],' +
            'input[placeholder="Add a subject"]'
        )];
    }

    function getComposeRoot(subject) {
        let el = subject;

        for (let i = 0; i < 18 && el; i++) {
            if (el.querySelectorAll) {
                const buttons = [...el.querySelectorAll('button')];

                if (buttons.some(isSendButton)) {
                    return el;
                }
            }

            el = el.parentElement;
        }

        return subject.closest('[role="dialog"]') ||
               subject.parentElement;
    }

    function isSendButton(button) {
        const label = (
            (button.getAttribute('aria-label') || '') + ' ' +
            (button.getAttribute('title') || '') + ' ' +
            (button.innerText || '')
        ).trim().toLowerCase();

        return /\bsend\b/.test(label);
    }

    // Read visible text and recipient-related attributes.
    function getRecipientContent(root) {
        let content = root.innerText || '';

        root.querySelectorAll(
            '[aria-label], [title], input, [data-value]'
        ).forEach(el => {
            content += ' ' +
                (el.getAttribute('aria-label') || '') + ' ' +
                (el.getAttribute('title') || '') + ' ' +
                (el.value || '') + ' ' +
                (el.getAttribute('data-value') || '');
        });

        return content.toLowerCase();
    }

    function getMissingRecipients(root) {
        const content = getRecipientContent(root);

        return REQUIRED_RECIPIENTS.filter(recipient =>
            !content.includes(recipient.email.toLowerCase())
        );
    }

    function findRecipientField(root, field) {
        const elements = [
            ...root.querySelectorAll(
                'input, [contenteditable="true"], [role="textbox"]'
            )
        ];

        return elements.find(el => {
            const label = (
                (el.getAttribute('aria-label') || '') + ' ' +
                (el.getAttribute('placeholder') || '') + ' ' +
                (el.getAttribute('data-placeholder') || '')
            ).toLowerCase().trim();

            if (field === 'to') {
                return /\bto\b/.test(label) ||
                       label.includes('add recipients');
            }

            if (field === 'cc') {
                return /\bcc\b/.test(label) ||
                       label.includes('carbon copy');
            }

            if (field === 'bcc') {
                return /\bbcc\b/.test(label) ||
                       label.includes('blind carbon copy');
            }

            return false;
        });
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function openRecipientField(root, field) {
        if (field === 'to') return;

        const buttons = [...root.querySelectorAll('button')];

        const btn = buttons.find(b => {
            const label = (
                (b.getAttribute('aria-label') || '') + ' ' +
                (b.getAttribute('title') || '') + ' ' +
                (b.innerText || '')
            ).toLowerCase().trim();

            return label === field ||
                   label.includes('show ' + field) ||
                   label === 'add ' + field;
        });

        if (btn) btn.click();
    }

    function setInputValue(input, value) {
        if (input.isContentEditable) {
            input.focus();
            document.execCommand('insertText', false, value);
            input.dispatchEvent(new Event('input', {
                bubbles: true
            }));
            return;
        }

        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        ).set;

        setter.call(input, value);

        input.dispatchEvent(new Event('input', {
            bubbles: true
        }));

        input.dispatchEvent(new Event('change', {
            bubbles: true
        }));
    }

    // Add missing recipients using semicolon separators.
    async function addRecipients(root, recipients, field) {
        openRecipientField(root, field);
        await wait(600);

        const input = findRecipientField(root, field);

        if (!input) {
            alert(
                'Cannot find the ' + field.toUpperCase() +
                ' recipient input.\n\n' +
                'Please open the recipient field manually.'
            );
            return false;
        }

        input.focus();

        // Outlook supports semicolon-separated recipient entries.
        const emailList = recipients
            .map(r => r.email)
            .join('; ') + ';';

        setInputValue(input, emailList);

        await wait(500);

        // Ask Outlook to commit the recipient entries.
        input.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
        }));

        input.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
        }));

        await wait(1500);

        return true;
    }

    // Check attachments.
    function hasAttachment(root) {
        const fileInputs = [
            ...root.querySelectorAll('input[type="file"]')
        ];

        if (fileInputs.some(input =>
            input.files && input.files.length > 0
        )) {
            return true;
        }

        const elements = root.querySelectorAll(
            '[aria-label], [title], [data-testid], ' +
            '[role="listitem"], [class*="attachment"], ' +
            '[class*="Attachment"]'
        );

        for (const el of elements) {
            const label = (
                (el.getAttribute('aria-label') || '') + ' ' +
                (el.getAttribute('title') || '') + ' ' +
                (el.getAttribute('data-testid') || '')
            ).toLowerCase();

            if (
                /remove attachment|delete attachment|attachment item|attached file/.test(label)
            ) {
                return true;
            }
        }

        return false;
    }

    // Ask the user which recipient field to use.
    function selectRecipientField() {
        const selection = prompt(
            'SELECT WHERE TO ADD MISSING RECIPIENTS\n\n' +
            '1 = TO\n' +
            '2 = CC\n' +
            '3 = BCC\n\n' +
            'Enter 1, 2 or 3:'
        );

        return {
            '1': 'to',
            '2': 'cc',
            '3': 'bcc'
        }[selection] || null;
    }

    // Main sending validation.
    async function validateBeforeSend(button, subject, root) {

        // 1. Check required recipients.
        let missing = getMissingRecipients(root);

        if (missing.length > 0) {
            const list = missing.map(r =>
                r.name + '\n' + r.email
            ).join('\n\n');

            const add = confirm(
                '⚠ BROADCAST EMAIL - MISSING RECIPIENTS\n\n' +
                'The following recipients are missing:\n\n' +
                list +
                '\n\nDo you want to add them?'
            );

            if (add) {
                const field = selectRecipientField();

                if (!field) {
                    alert('Invalid selection. Sending cancelled.');
                    return false;
                }

                const success = await addRecipients(root, missing, field);

                if (!success) return false;

                // Verify recipients after insertion.
                await wait(700);

                missing = getMissingRecipients(root);

                if (missing.length > 0) {
                    alert(
                        '⚠ RECIPIENT VERIFICATION FAILED\n\n' +
                        'The following addresses were not detected:\n\n' +
                        missing.map(r => r.email).join('\n') +
                        '\n\nPlease check the recipient chips manually. ' +
                        'Sending has been stopped.'
                    );

                    return false;
                }

                alert(
                    'All required recipients verified in ' +
                    field.toUpperCase() + '.'
                );
            }
        }

        // 2. Check attachment.
        if (!hasAttachment(root)) {
            const allow = confirm(
                '⚠ BROADCAST EMAIL - NO ATTACHMENT DETECTED!\n\n' +
                'Subject: ' + subject.value + '\n\n' +
                'No attachment was detected.\n\n' +
                'Do you still want to send this email?\n\n' +
                'YES = SEND ANYWAY\n' +
                'NO = CANCEL SENDING'
            );

            if (!allow) {
                console.log('[Broadcast Checker] User cancelled sending.');
                return false;
            }
        }

        return true;
    }

    // Intercept Send button.
    async function interceptSend(event) {
        const button = event.target.closest('button');

        if (!button || !isSendButton(button)) return;

        // Allow the one-time approved Send click.
        if (bypassSend.has(button)) {
            bypassSend.delete(button);
            return;
        }

        const compose = getSubjectElements()
            .map(subject => ({
                subject,
                root: getComposeRoot(subject)
            }))
            .find(item =>
                item.root &&
                item.root.contains(button) &&
                isTargetSubject(item.subject.value)
            );

        if (!compose) return;

        // Prevent duplicate processing.
        if (processing.has(button)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        // Stop Outlook from sending until validation completes.
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        processing.add(button);

        try {
            const approved = await validateBeforeSend(
                button,
                compose.subject,
                compose.root
            );

            if (approved && button.isConnected && !button.disabled) {
                bypassSend.add(button);

                // Resume normal Outlook sending.
                button.click();

                setTimeout(() => {
                    bypassSend.delete(button);
                }, 3000);
            }

        } catch (error) {
            console.error('[Broadcast Checker]', error);

            alert(
                'An error occurred during email validation.\n\n' +
                'Sending has been stopped.'
            );

        } finally {
            processing.delete(button);
        }
    }

    // Monitor Send clicks only.
    document.addEventListener(
        'click',
        interceptSend,
        true
    );

    console.log(
        '[Broadcast Checker] Version 2.2 loaded. ' +
        'Validation runs only when Send is clicked.'
    );

})();

