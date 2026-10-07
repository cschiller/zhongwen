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

import { ZhongwenDictionary } from './dict.js';

let isEnabled = localStorage['enabled'] === '1';

let isActivated = false;

let tabIDs = {};

let dict;

let zhongwenOptions = window.zhongwenOptions = {
    css: localStorage['popupcolor'] || 'yellow',
    tonecolors: localStorage['tonecolors'] || 'yes',
    fontSize: localStorage['fontSize'] || 'small',
    skritterTLD: localStorage['skritterTLD'] || 'com',
    zhuyin: localStorage['zhuyin'] || 'no',
    grammar: localStorage['grammar'] || 'yes',
    vocab: localStorage['vocab'] || 'yes',
    simpTrad: localStorage['simpTrad'] || 'classic',
    toneColorScheme: localStorage['toneColorScheme'] || 'standard',
    tts: localStorage['tts'] || 'yes',
};

function activateExtension(tabId, showHelp) {

    isActivated = true;

    isEnabled = true;
    // values in localStorage are always strings
    localStorage['enabled'] = '1';

    if (!dict) {
        loadDictionary().then(r => dict = r);
    }

    chrome.tabs.sendMessage(tabId, {
        'type': 'enable',
        'config': zhongwenOptions
    });

    if (showHelp) {
        chrome.tabs.sendMessage(tabId, {
            'type': 'showHelp'
        });
    }

    chrome.browserAction.setBadgeBackgroundColor({
        'color': [255, 0, 0, 255]
    });

    chrome.browserAction.setBadgeText({
        'text': 'On'
    });

    chrome.contextMenus.create(
        {
            title: 'Open word list',
            onclick: function () {
                let url = '/wordlist.html';
                let tabID = tabIDs['wordlist'];
                if (tabID) {
                    chrome.tabs.get(tabID, function (tab) {
                        if (tab && tab.url && (tab.url.endsWith('wordlist.html'))) {
                            chrome.tabs.update(tabID, {
                                active: true
                            });
                        } else {
                            chrome.tabs.create({
                                url: url
                            }, function (tab) {
                                tabIDs['wordlist'] = tab.id;
                            });
                        }
                    });
                } else {
                    chrome.tabs.create(
                        { url: url },
                        function (tab) {
                            tabIDs['wordlist'] = tab.id;
                        }
                    );
                }
            }
        }
    );
    chrome.contextMenus.create(
        {
            title: 'Show help in new tab',
            onclick: function () {
                let url = '/help.html';
                let tabID = tabIDs['help'];
                if (tabID) {
                    chrome.tabs.get(tabID, function (tab) {
                        if (tab && (tab.url.endsWith('help.html'))) {
                            chrome.tabs.update(tabID, {
                                active: true
                            });
                        } else {
                            chrome.tabs.create({
                                url: url
                            }, function (tab) {
                                tabIDs['help'] = tab.id;
                            });
                        }
                    });
                } else {
                    chrome.tabs.create(
                        { url: url },
                        function (tab) {
                            tabIDs['help'] = tab.id;
                        }
                    );
                }
            }
        }
    );
}

async function loadDictData() {
    let wordDict = fetch(chrome.runtime.getURL(
        "data/cedict_ts.u8")).then(r => r.text());
    let wordIndex = fetch(chrome.runtime.getURL(
        "data/cedict.idx")).then(r => r.text());
    let grammarKeywords = fetch(chrome.runtime.getURL(
        "data/grammarKeywordsMin.json")).then(r => r.json());
    let vocabKeywords = fetch(chrome.runtime.getURL(
        "data/vocabularyKeywordsMin.json")).then(r => r.json());

    return Promise.all([wordDict, wordIndex, grammarKeywords, vocabKeywords]);
}


async function loadDictionary() {
    let [wordDict, wordIndex, grammarKeywords, vocabKeywords] = await loadDictData();
    return new ZhongwenDictionary(wordDict, wordIndex, grammarKeywords, vocabKeywords);
}

function deactivateExtension() {

    isActivated = false;

    isEnabled = false;
    // values in localStorage are always strings
    localStorage['enabled'] = '0';

    dict = undefined;

    chrome.browserAction.setBadgeBackgroundColor({
        'color': [0, 0, 0, 0]
    });

    chrome.browserAction.setBadgeText({
        'text': ''
    });

    // Send a disable message to all tabs in all windows.
    chrome.windows.getAll(
        { 'populate': true },
        function (windows) {
            for (let i = 0; i < windows.length; ++i) {
                let tabs = windows[i].tabs;
                for (let j = 0; j < tabs.length; ++j) {
                    chrome.tabs.sendMessage(tabs[j].id, {
                        'type': 'disable'
                    });
                }
            }
        }
    );

    chrome.contextMenus.removeAll();
}

function activateExtensionToggle(currentTab) {
    if (isActivated) {
        deactivateExtension();
    } else {
        activateExtension(currentTab.id, true);
    }
}

function enableTab(tabId) {
    if (isEnabled) {

        if (!isActivated) {
            activateExtension(tabId, false);
        }

        chrome.tabs.sendMessage(tabId, {
            'type': 'enable',
            'config': zhongwenOptions
        });
    }
}

function search(text) {

    if (!dict) {
        // dictionary not loaded
        return;
    }

    let entry = dict.wordSearch(text);

    if (entry) {
        for (let i = 0; i < entry.data.length; i++) {
            let word = entry.data[i][1];
            if (dict.hasGrammarKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.grammar = { keyword: word, index: i };
            }
            if (dict.hasVocabKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.vocab = { keyword: word, index: i };
            }
        }
    }

    return entry;
}

chrome.browserAction.onClicked.addListener(activateExtensionToggle);

chrome.tabs.onActivated.addListener(activeInfo => {
    if (activeInfo.tabId === tabIDs['wordlist']) {
        chrome.tabs.reload(activeInfo.tabId);
    } else if (activeInfo.tabId !== tabIDs['help']) {
        enableTab(activeInfo.tabId);
    }
});
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
    if (changeInfo.status === 'complete' && tabId !== tabIDs['help'] && tabId !== tabIDs['wordlist']) {
        enableTab(tabId);
    }
});

function createTab(url, tabType) {
    chrome.tabs.create({ url }, tab => {
        tabIDs[tabType] = tab.id;
    });
}

chrome.runtime.onMessage.addListener(function (request, sender, callback) {

    let tabID;

    switch (request.type) {

        case 'search': {
            let response = search(request.text);
            response.originalText = request.originalText;
            callback(response);
        }
            break;

        case 'open': {
            tabID = tabIDs[request.tabType];
            if (tabID) {
                chrome.tabs.get(tabID, () => {
                    if (!chrome.runtime.lastError) {
                        // activate existing tab
                        chrome.tabs.update(tabID, { active: true, url: request.url });
                    } else {
                        createTab(request.url, request.tabType);
                    }
                });
            } else {
                createTab(request.url, request.tabType);
            }
        }
            break;

        case 'copy': {
            let txt = document.createElement('textarea');
            txt.style.position = "absolute";
            txt.style.left = "-100%";
            txt.value = request.data;
            document.body.appendChild(txt);
            txt.select();
            document.execCommand('copy');
            document.body.removeChild(txt);
        }
            break;

        case 'add': {
            let json = localStorage['wordlist'];

            let saveFirstEntryOnly = localStorage['saveToWordList'] === 'firstEntryOnly';

            let wordlist;
            if (json) {
                wordlist = JSON.parse(json);
            } else {
                wordlist = [];
            }

            for (let i in request.entries) {

                let entry = {};
                entry.timestamp = Date.now();
                entry.simplified = request.entries[i].simplified;
                entry.traditional = request.entries[i].traditional;
                entry.pinyin = request.entries[i].pinyin;
                entry.definition = request.entries[i].definition;

                wordlist.push(entry);

                if (saveFirstEntryOnly) {
                    break;
                }
            }
            localStorage['wordlist'] = JSON.stringify(wordlist);

            tabID = tabIDs['wordlist'];
        }
            break;
        case 'tts': {
            chrome.tts.speak(request.data, {'lang': 'zh-CN', 'rate': 1.0});
        }
            break;
    }
});
