/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

/* global globalThis */

'use strict';

let config = globalThis.defaultConfig;

chrome.storage.local.get(null, storedConfig => {
    if (storedConfig) {
        Object.entries(storedConfig).forEach(e => config[e[0]] = e[1]);
    }

    loadVals();
});

function loadVals() {

    document.querySelector(`input[name="background"][value="${config.background}"]`).checked = true;

    if (!config.toneColors) {
        document.querySelector('#toneColorsNone').checked = true;
    } else {
        document.querySelector(`input[name="toneColors"][value="${config.toneColorScheme}"]`).checked = true;
    }

    document.querySelector(`input[name="fontSize"][value="${config.fontSize}"]`).checked = true;

    document.querySelector(`input[name="simpTrad"][value="${config.simpTrad}"]`).checked = true;

    document.querySelector('#zhuyin').checked = config.zhuyin;

    document.querySelector('#grammar').checked = config.grammar;

    document.querySelector('#vocab').checked = config.vocab;

    document.querySelector(`input[name="saveToWordList"][value="${config.saveToWordList}"]`).checked = true;

    document.querySelector(`input[name="skritterTLD"][value="${config.skritterTLD}"]`).checked = true;
}

function setPopupColor(popupColor) {
    setOption('background', popupColor);
}

function setToneColorScheme(toneColorScheme) {
    if (toneColorScheme === 'none') {
        setOption('toneColors', false);
    } else {
        setOption('toneColors', true);
        setOption('toneColorScheme', toneColorScheme);
    }
}

function setOption(option, value) {
    chrome.storage.local.set({[option]: value});
}

window.addEventListener('load', () => {

    document.querySelectorAll('input[name="background"]').forEach((input) => {
        input.addEventListener('change',
            () => setPopupColor(input.getAttribute('value')));
    });

    document.querySelectorAll('input[name="toneColors"]').forEach((input) => {
        input.addEventListener('change',
            () => setToneColorScheme(input.getAttribute('value')));
    });

    document.querySelectorAll('input[name="fontSize"]').forEach((input) => {
        input.addEventListener('change',
            () => setOption('fontSize', input.getAttribute('value')));
    });

    document.querySelectorAll('input[name="simpTrad"]').forEach((input) => {
        input.addEventListener('change',
            () => setOption('simpTrad', input.getAttribute('value')));
    });

    document.querySelector('#zhuyin').addEventListener('change',
        (event) => setOption('zhuyin', event.target.checked));

    document.querySelector('#grammar').addEventListener('change',
        (event) => setOption('grammar', event.target.checked));

    document.querySelector('#vocab').addEventListener('change',
        (event) => setOption('vocab', event.target.checked));

    document.querySelectorAll('input[name="saveToWordList"]').forEach((input) => {
        input.addEventListener('change',
            () => setOption('saveToWordList', input.getAttribute('value')));
    });

    document.querySelectorAll('input[name="skritterTLD"]').forEach((input) => {
        input.addEventListener('change',
            () => setOption('skritterTLD', input.getAttribute('value')));
    });
});

