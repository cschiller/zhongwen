/* global globalThis */

'use strict';

globalThis.normalizeSearchText = function (text) {
    return text.replace(/\u200c/g, '');
};

globalThis.getHighlightLength = function (originalText, matchLength) {
    let index = 0;

    for (let matched = 0; matched < matchLength && index < originalText.length; matched++) {
        while (originalText[index] === '\u200c') {
            index++;
        }
        index++;
    }

    while (originalText[index] === '\u200c') {
        index++;
    }

    return index;
};
