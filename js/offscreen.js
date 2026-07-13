'use strict';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== 'offscreen') {
        return;
    }

    if (message.type === 'readLegacyStorage') {
        let legacyStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            legacyStorage[key] = localStorage.getItem(key);
        }
        sendResponse({legacyStorage});
    } else if (message.type === 'copy') {
        let textarea = document.createElement('textarea');
        textarea.value = message.data;
        document.body.appendChild(textarea);
        textarea.select();
        let success = document.execCommand('copy');
        textarea.remove();
        sendResponse({success});
    }
});
