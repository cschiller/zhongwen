/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde

 ---

 Originally based on Rikaikun 0.8
 Copyright (C) 2010 Erek Speed
 http://code.google.com/p/rikaikun/

 ---

 Originally based on Rikaichan 1.07
 by Jonathan Zarate
 http://www.polarcloud.com/

 ---

 Originally based on RikaiXUL 0.4 by Todd Rudick
 http://www.rikai.com/
 http://rikaixul.mozdev.org/

 ---

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

 ---

 Please do not change or remove any of the copyrights or links to web pages
 when modifying any of the files.

 */

'use strict';

let config;

let savedTarget;

let savedRangeNode;

let savedRangeOffset;

let selText;

let clientX;

let clientY;

let selStartDelta;

let selStartIncrement;

let popX = 0;

let popY = 0;

let timer;

let altView = 0;

let savedSearchResults = [];

let savedSelStartOffset = 0;

let savedSelEndList = [];

function enableTab() {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
}

function disableTab() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('keydown', onKeyDown);

    let zhongwenCSS = document.getElementById('zhongwen-css');
    if (zhongwenCSS) {
        zhongwenCSS.parentNode.removeChild(zhongwenCSS);
    }
    let zhongwenWindow = document.getElementById('zhongwen-window');
    if (zhongwenWindow) {
        zhongwenWindow.parentNode.removeChild(zhongwenWindow);
    }

    clearHighlight();
}

function onKeyDown(keyDown) {

    if (keyDown.ctrlKey || keyDown.metaKey) {
        return;
    }

    if (keyDown.altKey && keyDown.key === 'w') {
        chrome.runtime.sendMessage({
            type: 'open',
            tabType: 'wordlist',
            url: '/wordlist.html'
        });
        return;
    }

    if (!isVisible()) {
        if (window.getSelection() && window.getSelection().isCollapsed) {
            return;
        }
    }

    switch (keyDown.key) {

        case "Escape":
            hidePopup();
            break;

        case "a":
            altView = (altView + 1) % 3;
            triggerSearch();
            break;

        case "c":
            copyToClipboard(getTextForClipboard());
            break;

        case "b":
            let offset = selStartDelta;
            for (let i = 0; i < 10; i++) {
                selStartDelta = --offset;
                let ret = triggerSearch();
                if (ret === 0) {
                    break;
                } else if (ret === 2) {
                    savedRangeNode = findPreviousTextNode(savedRangeNode.parentNode, savedRangeNode);
                    savedRangeOffset = 0;
                    offset = savedRangeNode.data.length;
                }
            }
            break;

        case "g":
            if (config.grammar !== 'no' && isVisible() && savedSearchResults.grammar) {
                let sel = encodeURIComponent(window.getSelection().toString());

                // http://resources.allsetlearning.com/chinese/grammar/%E4%B8%AA
                let allset = 'http://resources.allsetlearning.com/chinese/grammar/' + sel;

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: allset
                });
            }
            break;

        case "m":
            selStartIncrement = 1;
        // falls through
        case "n":
            for (let i = 0; i < 10; i++) {
                selStartDelta += selStartIncrement;
                let ret = triggerSearch();
                if (ret === 0) {
                    break;
                } else if (ret === 2) {
                    savedRangeNode = findNextTextNode(savedRangeNode.parentNode, savedRangeNode);
                    savedRangeOffset = 0;
                    selStartDelta = 0;
                    selStartIncrement = 0;
                }
            }
            break;

        case "r":
            let entries = [];
            for (let j = 0; j < savedSearchResults.length; j++) {
                let entry = {
                    simplified: savedSearchResults[j][0],
                    traditional: savedSearchResults[j][1],
                    pinyin: savedSearchResults[j][2],
                    definition: savedSearchResults[j][3]
                };
                entries.push(entry);
            }

            chrome.runtime.sendMessage({
                'type': 'add',
                'entries': entries
            });

            showPopup('Added to word list.<p>Press Alt+W to open word list.', null, -1, -1);
            break;

        case "s":
            if (isVisible()) {

                // http://www.skritter.com/vocab/api/add?from=Chrome&lang=zh&word=浏览&trad=瀏 覽&rdng=liú lǎn&defn=to skim over; to browse

                let skritter = 'http://legacy.skritter.com';
                if (config.skritterTLD === 'cn') {
                    skritter = 'http://legacy.skritter.cn';
                }

                skritter +=
                    '/vocab/api/add?from=Zhongwen&siteref=Zhongwen&lang=zh&word=' +
                    encodeURIComponent(savedSearchResults[0][0]) +
                    '&trad=' + encodeURIComponent(savedSearchResults[0][1]) +
                    '&rdng=' + encodeURIComponent(savedSearchResults[0][4]) +
                    '&defn=' + encodeURIComponent(savedSearchResults[0][3]);

                chrome.runtime.sendMessage({
                    type: 'open',
                    tabType: 'skritter',
                    url: skritter
                });
            }
            break;

        case "t":
            if (isVisible()) {
                let sel = encodeURIComponent(
                    window.getSelection().toString());

                // http://tatoeba.org/eng/sentences/search?from=cmn&to=eng&query=%E8%BF%9B%E8%A1%8C
                let tatoeba = 'http://tatoeba.org/eng/sentences/search?from=cmn&to=eng&query=' + sel;

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: tatoeba
                });
            }
            break;

        case "x":
            altView = 0;
            popY -= 20;
            triggerSearch();
            break;

        case "y":
            altView = 0;
            popY += 20;
            triggerSearch();
            break;

        case "1":
            if (keyDown.altKey) {
                let sel = encodeURIComponent(
                    window.getSelection().toString());

                // https://dict.naver.com/linedict/zhendict/dict.html#/cnen/search?query=%E4%B8%AD%E6%96%87
                let linedict = 'https://dict.naver.com/linedict/zhendict/dict.html#/cnen/search?query=' + sel;

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: linedict
                });
            }
            break;

        // "2" is currenty unused

        case "3":
            if (keyDown.altKey) {
                let sel = encodeURIComponent(
                    window.getSelection().toString());

                // http://dict.cn/%E7%BF%BB%E8%AF%91
                let dictcn = 'http://dict.cn/' + sel;

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: dictcn
                });
            }
            break;

        case "4":
            if (keyDown.altKey) {
                let sel = encodeURIComponent(
                    window.getSelection().toString());

                // http://www.iciba.com/%E4%B8%AD%E9%A4%90
                let iciba = 'http://www.iciba.com/' + sel;

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: iciba
                });
            }
            break;

        case "5":
            if (keyDown.altKey) {
                let sel = encodeURIComponent(
                    window.getSelection().toString());

                // http://www.mdbg.net/chindict/chindict.php?page=worddict&wdrst=0&wdqb=%E6%B0%B4
                let mdbg = 'http://www.mdbg.net/chindict/chindict.php?page=worddict&wdrst=0&wdqb=' + sel;

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: mdbg
                });
            }
            break;

        case "6":
            if (keyDown.altKey) {
                let sel = encodeURIComponent(
                    window.getSelection().toString());

                // http://jukuu.com/show-%E8%AF%8D%E5%85%B8-0.html
                let jukuu = 'http://jukuu.com/show-' + sel + '-0.html';

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: jukuu
                });
            }
            break;

        case "7":
            if (keyDown.altKey) {
                let sel = encodeURIComponent(
                    window.getSelection().toString());

                // https://www.moedict.tw/~%E4%B8%AD%E6%96%87
                let moedict = 'https://www.moedict.tw/~' + sel;

                chrome.runtime.sendMessage({
                    type: 'open',
                    url: moedict
                });
            }
            break;

        default:
            return;
    }
}

function onMouseMove(mouseMove) {
    if (mouseMove.target.nodeName === 'TEXTAREA' || mouseMove.target.nodeName === 'INPUT'
        || mouseMove.target.nodeName === 'DIV') {

        let div = document.getElementById('zhongwenDiv');

        if (mouseMove.altKey) {

            if (!div && (mouseMove.target.nodeName === 'TEXTAREA' || mouseMove.target.nodeName === 'INPUT')) {

                div = makeDiv(mouseMove.target);
                document.body.appendChild(div);
                div.scrollTop = mouseMove.target.scrollTop;
                div.scrollLeft = mouseMove.target.scrollLeft;
            }
        } else {
            if (div) {
                document.body.removeChild(div);
            }
        }
    }

    if (clientX && clientY) {
        if (mouseMove.clientX === clientX && mouseMove.clientY === clientY) {
            return;
        }
    }
    clientX = mouseMove.clientX;
    clientY = mouseMove.clientY;

    let range;
    let rangeNode;
    let rangeOffset;

    // Handle Chrome and Firefox
    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(mouseMove.clientX, mouseMove.clientY);
        if (range == null) {
            return;
        }
        rangeNode = range.startContainer;
        rangeOffset = range.startOffset;
    } else if (document.caretPositionFromPoint) {
        range = document.caretPositionFromPoint(mouseMove.clientX, mouseMove.clientY);
        if (range == null) {
            return;
        }
        rangeNode = range.offsetNode;
        rangeOffset = range.offset;
    }

    if (mouseMove.target === savedTarget) {
        if (rangeNode === savedRangeNode && rangeOffset === savedRangeOffset) {
            return;
        }
    }

    if (timer) {
        clearTimeout(timer);
        timer = null;
    }

    if (rangeNode.data && rangeOffset === rangeNode.data.length) {
        rangeNode = findNextTextNode(rangeNode.parentNode, rangeNode);
        rangeOffset = 0;
    }

    if (!rangeNode || rangeNode.parentNode !== mouseMove.target) {
        rangeNode = null;
        rangeOffset = -1;
    }

    savedTarget = mouseMove.target;
    savedRangeNode = rangeNode;
    savedRangeOffset = rangeOffset;

    selStartDelta = 0;
    selStartIncrement = 1;

    if (rangeNode && rangeNode.data && rangeOffset < rangeNode.data.length) {
        popX = mouseMove.clientX;
        popY = mouseMove.clientY;
        timer = setTimeout(() => triggerSearch(), 50);
        return;
    }

    // Don't close just because we moved from a valid pop-up slightly over to a place with nothing.
    let dx = popX - mouseMove.clientX;
    let dy = popY - mouseMove.clientY;
    let distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 4) {
        clearHighlight();
        hidePopup();
    }
}

function triggerSearch() {

    let rangeNode = savedRangeNode;
    let selStartOffset = savedRangeOffset + selStartDelta;

    selStartIncrement = 1;

    if (!rangeNode) {
        clearHighlight();
        hidePopup();
        return 1;
    }

    if (selStartOffset < 0 || rangeNode.data.length <= selStartOffset) {
        clearHighlight();
        hidePopup();
        return 2;
    }

    let u = rangeNode.data.charCodeAt(selStartOffset);

    // not a Chinese character
    if (isNaN(u) ||
        (u !== 0x25CB &&
        (u < 0x3400 || 0x9FFF < u) &&
        (u < 0xF900 || 0xFAFF < u) &&
        (u < 0xFF21 || 0xFF3A < u) &&
        (u < 0xFF41 || 0xFF5A < u))) {
        clearHighlight();
        hidePopup();
        return 3;
    }

    let selEndList = [];
    let text = getText(rangeNode, selStartOffset, selEndList, 30 /*maxlength*/);

    savedSelStartOffset = selStartOffset;
    savedSelEndList = selEndList;

    chrome.runtime.sendMessage({
            'type': 'search',
            'text': text
        },
        processSearchResult
    );

    return 0;
}

function processSearchResult(result) {

    let selStartOffset = savedSelStartOffset;
    let selEndList = savedSelEndList;

    if (!result) {
        hidePopup();
        clearHighlight();
        return;
    }

    if (!result.matchLen) {
        result.matchLen = 1;
    }
    selStartIncrement = result.matchLen;
    selStartDelta = (selStartOffset - savedRangeOffset);

    let rangeNode = savedRangeNode;
    // don't try to highlight form elements
    if (!('form' in savedTarget)) {
        let doc = rangeNode.ownerDocument;
        if (!doc) {
            clearHighlight();
            hidePopup();
            return;
        }
        highlightMatch(doc, rangeNode, selStartOffset, result.matchLen, selEndList);
    }

    showPopup(makeHtml(result, config.tonecolors !== 'no'), savedTarget, popX, popY, false);
}

// modifies selEndList as a side-effect
function getText(startNode, offset, selEndList, maxLength) {
    let text = '';
    let endIndex;

    if (startNode.nodeType !== Node.TEXT_NODE) {
        return '';
    }

    endIndex = Math.min(startNode.data.length, offset + maxLength);
    text += startNode.data.substring(offset, endIndex);
    selEndList.push({
        node: startNode,
        offset: endIndex
    });

    let nextNode = startNode;
    while ((text.length < maxLength) && ((nextNode = findNextTextNode(nextNode.parentNode, nextNode)) !== null)) {
        text += getTextFromSingleNode(nextNode, selEndList, maxLength - text.length);
    }

    return text;
}

// modifies selEndList as a side-effect
function getTextFromSingleNode(node, selEndList, maxLength) {
    let endIndex;

    if (node.nodeName === '#text') {
        endIndex = Math.min(maxLength, node.data.length);
        selEndList.push({
            node: node,
            offset: endIndex
        });
        return node.data.substring(0, endIndex);
    } else {
        return '';
    }
}

function showPopup(html, elem, x, y, looseWidth) {

    if (!x || !y) {
        x = y = 0;
    }

    let popup = document.getElementById('zhongwen-window');

    if (!popup) {

        let css = document.createElement('link');
        css.setAttribute('id', 'zhongwen-css');
        css.setAttribute('rel', 'stylesheet');
        css.setAttribute('type', 'text/css');
        let theme = config.css;
        css.setAttribute('href', chrome.runtime.getURL('css/popup-' +
            theme + '.css'));
        document.getElementsByTagName('head')[0].appendChild(css);

        popup = document.createElement('div');
        popup.setAttribute('id', 'zhongwen-window');
        document.documentElement.appendChild(popup);
    }

    popup.style.width = 'auto';
    popup.style.height = 'auto';
    popup.style.maxWidth = (looseWidth ? '' : '600px');

    $(popup).html(html);

    if (elem) {
        popup.style.top = '-1000px';
        popup.style.left = '0px';
        popup.style.display = '';

        let pW = popup.offsetWidth;
        let pH = popup.offsetHeight;

        if (pW <= 0) {
            pW = 200;
        }
        if (pH <= 0) {
            pH = 0;
            let j = 0;
            while ((j = html.indexOf('<br/>', j)) !== -1) {
                j += 5;
                pH += 22;
            }
            pH += 25;
        }

        if (altView === 1) {
            x = window.scrollX;
            y = window.scrollY;
        } else if (altView === 2) {
            x = (window.innerWidth - (pW + 20)) + window.scrollX;
            y = (window.innerHeight - (pH + 20)) + window.scrollY;
        } else if (elem instanceof window.HTMLOptionElement) {

            x = 0;
            y = 0;

            let p = elem;
            while (p) {
                x += p.offsetLeft;
                y += p.offsetTop;
                p = p.offsetParent;
            }

            if (elem.offsetTop > elem.parentNode.clientHeight) {
                y -= elem.offsetTop;
            }

            if (x + popup.offsetWidth > window.innerWidth) {
                // too much to the right, go left
                x -= popup.offsetWidth + 5;
                if (x < 0) {
                    x = 0;
                }
            } else {
                // use SELECT's width
                x += elem.parentNode.offsetWidth + 5;
            }
        } else {
            // go left if necessary
            if (x + pW > window.innerWidth - 20) {
                x = (window.innerWidth - pW) - 20;
                if (x < 0) {
                    x = 0;
                }
            }

            // below the mouse
            let v = 25;

            // go up if necessary
            if (y + v + pH > window.innerHeight) {
                let t = y - pH - 30;
                if (t >= 0) {
                    y = t;
                }
            }
            else y += v;

            x += window.scrollX;
            y += window.scrollY;
        }
    } else {
        x += window.scrollX;
        y += window.scrollY;
    }

    // (-1, -1) indicates: leave position unchanged
    if (x !== -1 && y !== -1) {
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        popup.style.display = '';
    }
}

function hidePopup() {
    let popup = document.getElementById('zhongwen-window');
    if (popup) {
        popup.style.display = 'none';
        popup.textContent = '';
    }
}

function highlightMatch(doc, rangeStartNode, rangeStartOffset, matchLen, selEndList) {
    if (!selEndList || selEndList.length === 0) return;

    let selEnd;
    let offset = rangeStartOffset + matchLen;

    for (let i = 0, len = selEndList.length; i < len; i++) {
        selEnd = selEndList[i];
        if (offset <= selEnd.offset) {
            break;
        }
        offset -= selEnd.offset;
    }

    let range = doc.createRange();
    range.setStart(rangeStartNode, rangeStartOffset);
    range.setEnd(selEnd.node, offset);

    let sel = window.getSelection();
    if (!sel.isCollapsed && selText !== sel.toString())
        return;
    sel.empty();
    sel.addRange(range);
    selText = sel.toString();
}

function clearHighlight() {

    if (selText === null) {
        return;
    }

    let selection = window.getSelection();
    if (selection.isCollapsed || selText === selection.toString()) {
        selection.empty();
    }
    selText = null;
}

function isVisible() {
    let popup = document.getElementById('zhongwen-window');
    return popup && popup.style.display !== 'none';
}

function getTextForClipboard() {
    let result = '';
    for (let i = 0; i < savedSearchResults.length; i++) {
        result += savedSearchResults[i].slice(0, -1).join('\t');
        result += '\n';
    }
    return result;
}

function makeDiv(input) {
    let div = document.createElement('div');

    div.id = 'zhongwenDiv';

    let text;
    if (input.value) {
        text = input.value;
    } else {
        text = '';
    }
    div.innerText = text;

    div.style.cssText = window.getComputedStyle(input, '').cssText;
    div.scrollTop = input.scrollTop;
    div.scrollLeft = input.scrollLeft;
    div.style.position = 'absolute';
    div.style.zIndex = 7000;
    $(div).offset({
        top: $(input).offset().top,
        left: $(input).offset().left
    });

    return div;
}

function findNextTextNode(root, previous) {
    if (root === null) {
        return null;
    }
    let nodeIterator = document.createNodeIterator(root, NodeFilter.SHOW_TEXT, null);
    let node = nodeIterator.nextNode();
    while (node !== previous) {
        node = nodeIterator.nextNode();
        if (node === null) {
            return findNextTextNode(root.parentNode, previous);
        }
    }
    let result = nodeIterator.nextNode();
    if (result !== null) {
        return result;
    } else {
        return findNextTextNode(root.parentNode, previous);
    }
}

function findPreviousTextNode(root, previous) {
    if (root === null) {
        return null;
    }
    let nodeIterator = document.createNodeIterator(root, NodeFilter.SHOW_TEXT, null);
    let node = nodeIterator.nextNode();
    while (node !== previous) {
        node = nodeIterator.nextNode();
        if (node === null) {
            return findPreviousTextNode(root.parentNode, previous);
        }
    }
    nodeIterator.previousNode();
    let result = nodeIterator.previousNode();
    if (result !== null) {
        return result;
    } else {
        return findPreviousTextNode(root.parentNode, previous);
    }
}

function copyToClipboard(data) {
    chrome.runtime.sendMessage({
        'type': 'copy',
        'data': data
    });

    showPopup('Copied to clipboard', null, -1, -1);
}

function makeHtml(result, showToneColors) {

    let entry;
    let html = '';
    let texts = [];
    let hanziClass;

    if (result === null) return '';

    for (let i = 0; i < result.data.length; ++i) {
        entry = result.data[i][0].match(/^([^\s]+?)\s+([^\s]+?)\s+\[(.*?)\]?\s*\/(.+)\//);
        if (!entry) continue;

        // Hanzi

        if (config.simpTrad === 'auto') {

            let word = result.data[i][1];

            hanziClass = 'w-hanzi';
            if (config.fontSize === 'small') {
                hanziClass += '-small';
            }
            html += '<span class="' + hanziClass + '">' + word + '</span>&nbsp;';

        } else {

            hanziClass = 'w-hanzi';
            if (config.fontSize === 'small') {
                hanziClass += '-small';
            }
            html += '<span class="' + hanziClass + '">' + entry[2] + '</span>&nbsp;';
            if (entry[1] !== entry[2]) {
                html += '<span class="' + hanziClass + '">' + entry[1] + '</span>&nbsp;';
            }

        }

        // Pinyin

        let pinyinClass = 'w-pinyin';
        if (config.fontSize === 'small') {
            pinyinClass += '-small';
        }
        let p = pinyinAndZhuyin(entry[3], showToneColors, pinyinClass);
        html += p[0];

        // Zhuyin

        if (config.zhuyin === 'yes') {
            html += '<br>' + p[2];
        }

        // Definition

        let defClass = 'w-def';
        if (config.fontSize === 'small') {
            defClass += '-small';
        }
        let translation = entry[4].replace(/\//g, '; ');
        html += '<br><span class="' + defClass + '">' + translation + '</span><br>';

        // Grammar
        if (config.grammar !== 'no' && result.grammar && result.grammar.index === i) {
            html += '<br><span class="grammar">Press "g" for grammar and usage notes.</span><br><br>'
        }

        texts[i] = [entry[2], entry[1], p[1], translation, entry[3]];
    }
    if (result.more) {
        html += '&hellip;<br/>';
    }

    savedSearchResults = texts;
    savedSearchResults.grammar = result.grammar;

    return html;
}

let tones = {
    1: '&#772;',
    2: '&#769;',
    3: '&#780;',
    4: '&#768;',
    5: ''
};

let utones = {
    1: '\u0304',
    2: '\u0301',
    3: '\u030C',
    4: '\u0300',
    5: ''
};

function parse(s) {
    return s.match(/([^AEIOU:aeiou]*)([AEIOUaeiou:]+)([^aeiou:]*)([1-5])/);
}

function tonify(vowels, tone) {
    let html = '';
    let text = '';

    if (vowels === 'ou') {
        html = 'o' + tones[tone] + 'u';
        text = 'o' + utones[tone] + 'u'
    } else {
        let tonified = false;
        for (let i = 0; i < vowels.length; i++) {
            let c = vowels.charAt(i);
            html += c;
            text += c;
            if (c === 'a' || c === 'e') {
                html += tones[tone];
                text += utones[tone];
                tonified = true;
            } else if (i === vowels.length - 1 && !tonified) {
                html += tones[tone];
                text += utones[tone];
                tonified = true;
            }
        }
        html = html.replace(/u:/, '&uuml;');
        text = text.replace(/u:/, '\u00FC');
    }

    return [html, text];
}

function pinyinAndZhuyin(syllables, showToneColors, pinyinClass) {
    let text = '';
    let html = '';
    let zhuyin = '';
    let a = syllables.split(/[\s·]+/);
    for (let i = 0; i < a.length; i++) {
        let syllable = a[i];

        // ',' in pinyin
        if (syllable === ',') {
            html += ' ,';
            text += ' ,';
            continue;
        }

        if (i > 0) {
            html += '&nbsp;';
            text += ' ';
            zhuyin += '&nbsp;'
        }
        if (syllable === 'r5') {
            if (showToneColors) {
                html += '<span class="' + pinyinClass + ' tone5">r</span>';
            } else {
                html += '<span class="' + pinyinClass + '">r</span>';
            }
            text += 'r';
            continue;
        }
        if (syllable === 'xx5') {
            if (showToneColors) {
                html += '<span class="' + pinyinClass + ' tone5">??</span>';
            } else {
                html += '<span class="' + pinyinClass + '">??</span>';
            }
            text += '??';
            continue;
        }
        let m = parse(syllable);
        if (showToneColors) {
            html += '<span class="' + pinyinClass + ' tone' + m[4] + '">';
        } else {
            html += '<span class="' + pinyinClass + '">';
        }
        let t = tonify(m[2], m[4]);
        html += m[1] + t[0] + m[3];
        html += '</span>';
        text += m[1] + t[1] + m[3];

        let zhuyinClass = 'w-zhuyin';
        if (config.fontSize === 'small') {
            zhuyinClass += '-small';
        }

        zhuyin += '<span class="tone' + m[4] + ' ' + zhuyinClass + '">'
            + zhuyinMap[syllable.substring(0, syllable.length - 1).toLowerCase()]
            + zhuyinTones[syllable[syllable.length - 1]] + '</span>'
    }
    return [html, text, zhuyin]
}

let zhuyinTones = ['?', '', '\u02CA', '\u02C7', '\u02CB', '\u30FB'];

let zhuyinMap = {
    'a': '\u311a',
    'ai': '\u311e',
    'an': '\u3122',
    'ang': '\u3124',
    'ao': '\u3120',
    'ba': '\u3105\u311a',
    'bai': '\u3105\u311e',
    'ban': '\u3105\u3122',
    'bang': '\u3105\u3124',
    'bao': '\u3105\u3120',
    'bei': '\u3105\u311f',
    'ben': '\u3105\u3123',
    'beng': '\u3105\u3125',
    'bi': '\u3105\u3127',
    'bian': '\u3105\u3127\u3122',
    'biao': '\u3105\u3127\u3120',
    'bie': '\u3105\u3127\u311d',
    'bin': '\u3105\u3127\u3123',
    'bing': '\u3105\u3127\u3125',
    'bo': '\u3105\u311b',
    'bu': '\u3105\u3128',
    'ca': '\u3118\u311a',
    'cai': '\u3118\u311e',
    'can': '\u3118\u3122',
    'cang': '\u3118\u3124',
    'cao': '\u3118\u3120',
    'ce': '\u3118\u311c',
    'cen': '\u3118\u3123',
    'ceng': '\u3118\u3125',
    'cha': '\u3114\u311a',
    'chai': '\u3114\u311e',
    'chan': '\u3114\u3122',
    'chang': '\u3114\u3124',
    'chao': '\u3114\u3120',
    'che': '\u3114\u311c',
    'chen': '\u3114\u3123',
    'cheng': '\u3114\u3125',
    'chi': '\u3114',
    'chong': '\u3114\u3128\u3125',
    'chou': '\u3114\u3121',
    'chu': '\u3114\u3128',
    'chua': '\u3114\u3128\u311a',
    'chuai': '\u3114\u3128\u311e',
    'chuan': '\u3114\u3128\u3122',
    'chuang': '\u3114\u3128\u3124',
    'chui': '\u3114\u3128\u311f',
    'chun': '\u3114\u3128\u3123',
    'chuo': '\u3114\u3128\u311b',
    'ci': '\u3118',
    'cong': '\u3118\u3128\u3125',
    'cou': '\u3118\u3121',
    'cu': '\u3118\u3128',
    'cuan': '\u3118\u3128\u3122',
    'cui': '\u3118\u3128\u311f',
    'cun': '\u3118\u3128\u3123',
    'cuo': '\u3118\u3128\u311b',
    'da': '\u3109\u311a',
    'dai': '\u3109\u311e',
    'dan': '\u3109\u3122',
    'dang': '\u3109\u3124',
    'dao': '\u3109\u3120',
    'de': '\u3109\u311c',
    'dei': '\u3109\u311f',
    'den': '\u3109\u3123',
    'deng': '\u3109\u3125',
    'di': '\u3109\u3127',
    'dian': '\u3109\u3127\u3122',
    'diang': '\u3109\u3127\u3124',
    'diao': '\u3109\u3127\u3120',
    'die': '\u3109\u3127\u311d',
    'ding': '\u3109\u3127\u3125',
    'diu': '\u3109\u3127\u3121',
    'dong': '\u3109\u3128\u3125',
    'dou': '\u3109\u3121',
    'du': '\u3109\u3128',
    'duan': '\u3109\u3128\u3122',
    'dui': '\u3109\u3128\u311f',
    'dun': '\u3109\u3128\u3123',
    'duo': '\u3109\u3128\u311b',
    'e': '\u311c',
    'ei': '\u311f',
    'en': '\u3123',
    'er': '\u3126',
    'fa': '\u3108\u311a',
    'fan': '\u3108\u3122',
    'fang': '\u3108\u3124',
    'fei': '\u3108\u311f',
    'fen': '\u3108\u3123',
    'feng': '\u3108\u3125',
    'fo': '\u3108\u311b',
    'fou': '\u3108\u3121',
    'fu': '\u3108\u3128',
    'ga': '\u310d\u311a',
    'gai': '\u310d\u311e',
    'gan': '\u310d\u3122',
    'gang': '\u310d\u3124',
    'gao': '\u310d\u3120',
    'ge': '\u310d\u311c',
    'gei': '\u310d\u311f',
    'gen': '\u310d\u3123',
    'geng': '\u310d\u3125',
    'gong': '\u310d\u3128\u3125',
    'gou': '\u310d\u3121',
    'gu': '\u310d\u3128',
    'gua': '\u310d\u3128\u311a',
    'guai': '\u310d\u3128\u311e',
    'guan': '\u310d\u3128\u3122',
    'guang': '\u310d\u3128\u3124',
    'gui': '\u310d\u3128\u311f',
    'gun': '\u310d\u3128\u3123',
    'guo': '\u310d\u3128\u311b',
    'ha': '\u310f\u311a',
    'hai': '\u310f\u311e',
    'han': '\u310f\u3122',
    'hang': '\u310f\u3124',
    'hao': '\u310f\u3120',
    'he': '\u310f\u311c',
    'hei': '\u310f\u311f',
    'hen': '\u310f\u3123',
    'heng': '\u310f\u3125',
    'hong': '\u310f\u3128\u3125',
    'hou': '\u310f\u3121',
    'hu': '\u310f\u3128',
    'hua': '\u310f\u3128\u311a',
    'huai': '\u310f\u3128\u311e',
    'huan': '\u310f\u3128\u3122',
    'huang': '\u310f\u3128\u3124',
    'hui': '\u310f\u3128\u311f',
    'hun': '\u310f\u3128\u3123',
    'huo': '\u310f\u3128\u311b',
    'ji': '\u3110\u3127',
    'jia': '\u3110\u3127\u311a',
    'jian': '\u3110\u3127\u3122',
    'jiang': '\u3110\u3127\u3124',
    'jiao': '\u3110\u3127\u3120',
    'jie': '\u3110\u3127\u311d',
    'jin': '\u3110\u3127\u3123',
    'jing': '\u3110\u3127\u3125',
    'jiong': '\u3110\u3129\u3125',
    'jiu': '\u3110\u3127\u3121',
    'ju': '\u3110\u3129',
    'juan': '\u3110\u3129\u3122',
    'jue': '\u3110\u3129\u311d',
    'jun': '\u3110\u3129\u3123',
    'ka': '\u310e\u311a',
    'kai': '\u310e\u311e',
    'kan': '\u310e\u3122',
    'kang': '\u310e\u3124',
    'kao': '\u310e\u3120',
    'ke': '\u310e\u311c',
    'ken': '\u310e\u3123',
    'keng': '\u310e\u3125',
    'kong': '\u310e\u3128\u3125',
    'kou': '\u310e\u3121',
    'ku': '\u310e\u3128',
    'kua': '\u310e\u3128\u311a',
    'kuai': '\u310e\u3128\u311e',
    'kuan': '\u310e\u3128\u3122',
    'kuang': '\u310e\u3128\u3124',
    'kui': '\u310e\u3128\u311f',
    'kun': '\u310e\u3128\u3123',
    'kuo': '\u310e\u3128\u311b',
    'la': '\u310c\u311a',
    'lai': '\u310c\u311e',
    'lan': '\u310c\u3122',
    'lang': '\u310c\u3124',
    'lao': '\u310c\u3120',
    'le': '\u310c\u311c',
    'lei': '\u310c\u311f',
    'leng': '\u310c\u3125',
    'li': '\u310c\u3127',
    'lia': '\u310c\u3127\u311a',
    'lian': '\u310c\u3127\u3122',
    'liang': '\u310c\u3127\u3124',
    'liao': '\u310c\u3127\u3120',
    'lie': '\u310c\u3127\u311d',
    'lin': '\u310c\u3127\u3123',
    'ling': '\u310c\u3127\u3125',
    'liu': '\u310c\u3127\u3121',
    'lo': '\u310c\u311b',
    'long': '\u310c\u3128\u3125',
    'lou': '\u310c\u3121',
    'lu': '\u310c\u3128',
    'lu:': '\u310c\u3129',
    'luan': '\u310c\u3128\u3123',
    'lu:e': '\u310c\u3129\u311d',
    'lun': '\u310c\u3129',
    'lu:n': '\u310c\u3129\u3123',
    'luo': '\u310c\u3129\u3123',
    'ma': '\u3107\u311a',
    'mai': '\u3107\u311e',
    'man': '\u3107\u3122',
    'mang': '\u3107\u3124',
    'mao': '\u3107\u3120',
    'me': '\u3107\u311c',
    'mei': '\u3107\u311f',
    'men': '\u3107\u3123',
    'meng': '\u3107\u3125',
    'mi': '\u3107\u3127',
    'mian': '\u3107\u3127\u3122',
    'miao': '\u3107\u3127\u3120',
    'mie': '\u3107\u3127\u311d',
    'min': '\u3107\u3127\u3123',
    'ming': '\u3107\u3127\u3125',
    'miu': '\u3107\u3127\u3121',
    'mo': '\u3107\u311b',
    'mou': '\u3107\u3121',
    'mu': '\u3107\u3128',
    'na': '\u310b\u311a',
    'nai': '\u310b\u311e',
    'nan': '\u310b\u3122',
    'nang': '\u310b\u3124',
    'nao': '\u310b\u3120',
    'ne': '\u310b\u311c',
    'nei': '\u310b\u311f',
    'nen': '\u310b\u3123',
    'neng': '\u310b\u3125',
    'ni': '\u310b\u3127',
    'nia': '\u310b\u3127\u311a',
    'nian': '\u310b\u3127\u3122',
    'niang': '\u310b\u3127\u3124',
    'niao': '\u310b\u3127\u3120',
    'nie': '\u310b\u3127\u311d',
    'nin': '\u310b\u3127\u3123',
    'ning': '\u310b\u3127\u3125',
    'niu': '\u310b\u3127\u3121',
    'nong': '\u310b\u3128\u3125',
    'nou': '\u310b\u3121',
    'nu': '\u310b\u3128',
    'nu:': '\u310b\u3129',
    'nuan': '\u310b\u3128\u3123',
    'nu:e': '\u310b\u3129\u311d',
    'nun': '\u310b\u3129',
    'nuo': '\u310b\u3129\u311d',
    'ou': '\u3121',
    'pa': '\u3106\u311a',
    'pai': '\u3106\u311e',
    'pan': '\u3106\u3122',
    'pang': '\u3106\u3124',
    'pao': '\u3106\u3120',
    'pei': '\u3106\u311f',
    'pen': '\u3106\u3123',
    'peng': '\u3106\u3125',
    'pi': '\u3106\u3127',
    'pian': '\u3106\u3127\u3122',
    'piao': '\u3106\u3127\u3120',
    'pie': '\u3106\u3127\u311d',
    'pin': '\u3106\u3127\u3123',
    'ping': '\u3106\u3127\u3125',
    'po': '\u3106\u311b',
    'pou': '\u3106\u3121',
    'pu': '\u3106\u3128',
    'qi': '\u3111\u3127',
    'qia': '\u3111\u3127\u311a',
    'qian': '\u3111\u3127\u3122',
    'qiang': '\u3111\u3127\u3124',
    'qiao': '\u3111\u3127\u3120',
    'qie': '\u3111\u3127\u311d',
    'qin': '\u3111\u3127\u3123',
    'qing': '\u3111\u3127\u3125',
    'qiong': '\u3111\u3129\u3125',
    'qiu': '\u3111\u3127\u3121',
    'qu': '\u3111\u3129',
    'quan': '\u3111\u3129\u3122',
    'que': '\u3111\u3129\u311d',
    'qun': '\u3111\u3129\u3123',
    'ran': '\u3116\u3122',
    'rang': '\u3116\u3124',
    'rao': '\u3116\u3120',
    're': '\u3116\u311c',
    'ren': '\u3116\u3123',
    'reng': '\u3116\u3125',
    'ri': '\u3116',
    'rong': '\u3116\u3128\u3125',
    'rou': '\u3116\u3121',
    'ru': '\u3116\u3128',
    'ruan': '\u3116\u3128\u3122',
    'rui': '\u3116\u3128\u311f',
    'run': '\u3116\u3128\u3123',
    'ruo': '\u3116\u3128\u311b',
    'sa': '\u3119\u311a',
    'sai': '\u3119\u311e',
    'san': '\u3119\u3122',
    'sang': '\u3119\u3124',
    'sao': '\u3119\u3120',
    'se': '\u3119\u311c',
    'sei': '\u3119\u311f',
    'sen': '\u3119\u3123',
    'seng': '\u3119\u3125',
    'sha': '\u3115\u311a',
    'shai': '\u3115\u311e',
    'shan': '\u3115\u3122',
    'shang': '\u3115\u3124',
    'shao': '\u3115\u3120',
    'she': '\u3115\u311c',
    'shei': '\u3115\u311f',
    'shen': '\u3115\u3123',
    'sheng': '\u3115\u3125',
    'shi': '\u3115',
    'shong': '\u3115\u3128\u3125',
    'shou': '\u3115\u3121',
    'shu': '\u3115\u3128',
    'shua': '\u3115\u3128\u311a',
    'shuai': '\u3115\u3128\u311e',
    'shuan': '\u3115\u3128\u3122',
    'shuang': '\u3115\u3128\u3124',
    'shui': '\u3115\u3128\u311f',
    'shun': '\u3115\u3128\u3123',
    'shuo': '\u3115\u3128\u311b',
    'si': '\u3119',
    'song': '\u3119\u3128\u3125',
    'sou': '\u3119\u3121',
    'su': '\u3119\u3128',
    'suan': '\u3119\u3128\u3122',
    'sui': '\u3119\u3128\u311f',
    'sun': '\u3119\u3128\u3123',
    'suo': '\u3119\u3128\u311b',
    'ta': '\u310a\u311a',
    'tai': '\u310a\u311e',
    'tan': '\u310a\u3122',
    'tang': '\u310a\u3124',
    'tao': '\u310a\u3120',
    'te': '\u310a\u311c',
    'teng': '\u310a\u3125',
    'ti': '\u310a\u3127',
    'tian': '\u310a\u3127\u3122',
    'tiao': '\u310a\u3127\u3120',
    'tie': '\u310a\u3127\u311d',
    'ting': '\u310a\u3127\u3125',
    'tong': '\u310a\u3128\u3125',
    'tou': '\u310a\u3121',
    'tu': '\u310a\u3128',
    'tuan': '\u310a\u3128\u3122',
    'tui': '\u310a\u3128\u311f',
    'tun': '\u310a\u3128\u3123',
    'tuo': '\u310a\u3128\u311b',
    'wa': '\u3128\u311a',
    'wai': '\u3128\u311e',
    'wan': '\u3128\u3122',
    'wang': '\u3128\u3124',
    'wei': '\u3128\u311f',
    'wen': '\u3128\u3123',
    'weng': '\u3128\u3125',
    'wo': '\u3128\u311b',
    'wu': '\u3128',
    'xi': '\u3112\u3127',
    'xia': '\u3112\u3127\u311a',
    'xian': '\u3112\u3127\u3122',
    'xiang': '\u3112\u3127\u3124',
    'xiao': '\u3112\u3127\u3120',
    'xie': '\u3112\u3127\u311d',
    'xin': '\u3112\u3127\u3123',
    'xing': '\u3112\u3127\u3125',
    'xiong': '\u3112\u3129\u3125',
    'xiu': '\u3112\u3127\u3121',
    'xu': '\u3112\u3129',
    'xuan': '\u3112\u3129\u3122',
    'xue': '\u3112\u3129\u311d',
    'xun': '\u3112\u3129\u3123',
    'ya': '\u3127\u311a',
    'yan': '\u3127\u3122',
    'yang': '\u3127\u3124',
    'yao': '\u3127\u3120',
    'ye': '\u3127\u311d',
    'yi': '\u3127',
    'yin': '\u3127\u3123',
    'ying': '\u3127\u3125',
    'yong': '\u3129\u3125',
    'you': '\u3127\u3121',
    'yu': '\u3129',
    'yuan': '\u3129\u3122',
    'yue': '\u3129\u311d',
    'yun': '\u3129\u3123',
    'za': '\u3117\u311a',
    'zai': '\u3117\u311e',
    'zan': '\u3117\u3122',
    'zang': '\u3117\u3124',
    'zao': '\u3117\u3120',
    'ze': '\u3117\u311c',
    'zei': '\u3117\u311f',
    'zen': '\u3117\u3123',
    'zeng': '\u3117\u3125',
    'zha': '\u3113\u311a',
    'zhai': '\u3113\u311e',
    'zhan': '\u3113\u3122',
    'zhang': '\u3113\u3124',
    'zhao': '\u3113\u3120',
    'zhe': '\u3113\u311c',
    'zhei': '\u3113\u311f',
    'zhen': '\u3113\u3123',
    'zheng': '\u3113\u3125',
    'zhi': '\u3113',
    'zhong': '\u3113\u3128\u3125',
    'zhou': '\u3113\u3121',
    'zhu': '\u3113\u3128',
    'zhua': '\u3113\u3128\u311a',
    'zhuai': '\u3113\u3128\u311e',
    'zhuan': '\u3113\u3128\u3122',
    'zhuang': '\u3113\u3128\u3124',
    'zhui': '\u3113\u3128\u311f',
    'zhun': '\u3113\u3128\u3123',
    'zhuo': '\u3113\u3128\u311b',
    'zi': '\u3117',
    'zong': '\u3117\u3128\u3125',
    'zou': '\u3117\u3121',
    'zu': '\u3117\u3128',
    'zuan': '\u3117\u3128\u3122',
    'zui': '\u3117\u3128\u311f',
    'zun': '\u3117\u3128\u3123',
    'zuo': '\u3117\u3128\u311b'
};

let miniHelp = `
    <span style="font-weight: bold;">Zhongwen Chinese-English Dictionary</span><br><br>
    <p>Keyboard shortcuts:<p>
    <table style="margin: 10px;" cellspacing=5 cellpadding=5>
    <tr><td><b>n&nbsp;:</b></td><td>&nbsp;Next word</td></tr>
    <tr><td><b>b&nbsp;:</b></td><td>&nbsp;Previous character</td></tr>
    <tr><td><b>m&nbsp;:</b></td><td>&nbsp;Next character</td></tr>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    <tr><td><b>a&nbsp;:</b></td><td>&nbsp;Alternate pop-up location</td></tr>
    <tr><td><b>y&nbsp;:</b></td><td>&nbsp;Move pop-up location down</td></tr>
    <tr><td><b>x&nbsp;:</b></td><td>&nbsp;Move pop-up location up</td></tr>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    <tr><td><b>c&nbsp;:</b></td><td>&nbsp;Copy translation to clipboard</td></tr>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    <tr><td><b>r&nbsp;:</b></td><td>&nbsp;Remember word by adding it to the built-in word list</td></tr>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    <tr><td><b>Alt w&nbsp;:</b></td><td>&nbsp;Show the built-in word list in a new tab</td></tr>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    <tr><td><b>s&nbsp;:</b></td><td>&nbsp;Add word to Skritter queue</td></tr>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    </table>
    Look up selected text in online resources:
    <table style="margin: 10px;" cellspacing=5 cellpadding=5>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    <tr><td><b>Alt + 1&nbsp;:</b></td><td>&nbsp;LINE Dict</td></tr>
    <tr><td><b>Alt + 3&nbsp;:</b></td><td>&nbsp;Dict.cn</td></tr>
    <tr><td><b>Alt + 4&nbsp;:</b></td><td>&nbsp;iCIBA</td></tr>
    <tr><td><b>Alt + 5&nbsp;:</b></td><td>&nbsp;MDBG</td></tr>
    <tr><td><b>Alt + 6&nbsp;:</b></td><td>&nbsp;JuKuu</td></tr>
    <tr><td><b>&nbsp;</b></td><td>&nbsp;</td></tr>
    <tr><td><b>t&nbsp;:</b></td><td>&nbsp;Tatoeba</td></tr>
    </table>`;

// event listener
chrome.runtime.onMessage.addListener(
    function (request) {
        switch (request.type) {
            case 'enable':
                enableTab();
                config = request.config;
                break;
            case 'disable':
                disableTab();
                break;
            case 'showPopup':
                if (!request.isHelp || window === window.top) {
                    showPopup(request.text);
                }
                break;
            case 'showHelp':
                showPopup(miniHelp);
                break;
            default:
        }
    }
);
