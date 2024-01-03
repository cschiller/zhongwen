/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

'use strict';

function loadVals() {

    const popupColor = localStorage['popupcolor'] || 'yellow';
    document.querySelector(`input[name="popupColor"][value="${popupColor}"]`).checked = true;

    const toneColors = localStorage['tonecolors'] || 'yes';
    if (toneColors === 'no') {
        document.querySelector('#toneColorsNone').checked = true;
    } else {
        const toneColorScheme = localStorage['toneColorScheme'] || 'standard';
        document.querySelector(`input[name="toneColors"][value="${toneColorScheme}"]`).checked = true;
    }

    const fontSize = localStorage['fontSize'] || 'small';
    document.querySelector(`input[name="fontSize"][value="${fontSize}"]`).checked = true;

    const simpTrad = localStorage['simpTrad'] || 'classic';
    document.querySelector(`input[name="simpTrad"][value="${simpTrad}"]`).checked = true;

    const zhuyin = localStorage['zhuyin'] || 'no';
    document.querySelector('#zhuyin').checked = zhuyin === 'yes';

    const grammar = localStorage['grammar'] || 'yes';
    document.querySelector('#grammar').checked = grammar !== 'no';

    const vocab = localStorage['vocab'] || 'yes';
    document.querySelector('#vocab').checked = vocab !== 'no';

    const saveToWordList = localStorage['saveToWordList'] || 'allEntries';
    document.querySelector(`input[name="saveToWordList"][value="${saveToWordList}"]`).checked = true;

    const skritterTLD = localStorage['skritterTLD'] || 'com';
    document.querySelector(`input[name="skritterTLD"][value="${skritterTLD}"]`).checked = true;

    const tts = localStorage['tts'] || 'yes';
    document.querySelector('#tts').checked = tts !== 'no';
}

function setPopupColor(popupColor) {
    localStorage['popupcolor'] = popupColor;
    chrome.extension.getBackgroundPage().zhongwenOptions.css = popupColor;
}

function setToneColorScheme(toneColorScheme) {
    if (toneColorScheme === 'none') {
        setOption('tonecolors', 'no');
    } else {
        setOption('tonecolors', 'yes');
        setOption('toneColorScheme', toneColorScheme);
    }
}

function setOption(option, value) {
    localStorage[option] = value;
    chrome.extension.getBackgroundPage().zhongwenOptions[option] = value;
}

function setBooleanOption(option, value) {
    let yesNo = value ? 'yes' : 'no';
    setOption(option, yesNo);
}

window.addEventListener('load', () => {

    document.querySelectorAll('input[name="popupColor"]').forEach((input) => {
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
        (event) => setBooleanOption('zhuyin', event.target.checked));

    document.querySelector('#grammar').addEventListener('change',
        (event) => setBooleanOption('grammar', event.target.checked));

    document.querySelector('#vocab').addEventListener('change',
        (event) => setBooleanOption('vocab', event.target.checked));

    document.querySelectorAll('input[name="saveToWordList"]').forEach((input) => {
        input.addEventListener('change',
            () => setOption('saveToWordList', input.getAttribute('value')));
    });

    document.querySelectorAll('input[name="skritterTLD"]').forEach((input) => {
        input.addEventListener('change',
            () => setOption('skritterTLD', input.getAttribute('value')));
    });

    document.querySelector('#tts').addEventListener('change',
        (event) => setBooleanOption('tts', event.target.checked));
});

loadVals();

