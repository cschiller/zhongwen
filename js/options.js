/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

'use strict';

function loadVals() {
    switch (localStorage['popupcolor']) {
        case 'blue':
            document.querySelector('#popupColorBlue').checked = true;
            break;
        case 'lightblue':
            document.querySelector('#popupColorLightBlue').checked = true;
            break;
        case 'black':
            document.querySelector('#popupColorBlack').checked = true;
            break;
        case 'yellow':
        // Yellow is the default value
        // eslint-disable-next-line no-fallthrough
        default:
            document.querySelector('#popupColorYellow').checked = true;
            break;
    }

    if (localStorage['tonecolors'] === 'no') {
        document.querySelector('#toneColorsNone').checked = true;
    } else {
        switch (localStorage['toneColorScheme']) {
            case 'pleco':
                document.querySelector('#toneColorsPleco').checked = true;
                break;
            case 'hanping':
                document.querySelector('#toneColorsHanping').checked = true;
                break;
            case 'standard':
            // Standard is the default value
            // eslint-disable-next-line no-fallthrough
            default:
                document.querySelector('#toneColorsStandard').checked = true;
                break;
        }
    }

    if (localStorage['fontSize'] === 'large') {
        document.querySelector('#fontSizeLarge').checked = true;
    } else {
        document.querySelector('#fontSizeSmall').checked = true;
    }

    if (localStorage['simpTrad'] === 'auto') {
        document.querySelector('#simpTradAuto').checked = true;
    } else {
        document.querySelector('#simpTradClassic').checked = true;
    }

    if (localStorage['zhuyin'] === 'yes') {
        document.querySelector('#zhuyin').checked = true;
    }

    if (localStorage['grammar'] !== 'no') {
        document.querySelector('#grammar').checked = true;
    }

    if (localStorage['saveToWordList'] === 'firstEntryOnly') {
        document.querySelector('#saveToWordListFirstEntryOnly').checked = true;
    } else {
        document.querySelector('#saveToWordListAllEntries').checked = true;
    }

    if (localStorage['skritterTLD'] === 'cn') {
        document.querySelector('#skritterTLDcn').checked = true;
    } else {
        document.querySelector('#skritterTLDcom').checked = true;
    }
}

function setOption(option, value) {
    localStorage[option] = value;
    chrome.extension.getBackgroundPage().zhongwenOptions[option] = value;
}

function setOptionCheck(option, checked) {
    const value = checked ? 'yes' : 'no';
    setOption(option, value);
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

const setters = {
    'popupColorYellow': () => setPopupColor('yellow'),
    'popupColorBlue': () => setPopupColor('blue'),
    'popupColorLightblue': () => setPopupColor('lightblue'),
    'popupColorBlack': () => setPopupColor('black'),
    'toneColorsStandard': () => setToneColorScheme('standard'),
    'toneColorsPleco': () => setToneColorScheme('pleco'),
    'toneColorsHanping': () => setToneColorScheme('hanping'),
    'toneColorsNone': () => setToneColorScheme('none'),
    'fontSizeSmall': () => setOption('fontSize', 'small'),
    'fontSizeLarge': () => setOption('fontSize', 'large'),
    'simpTradClassic': () => setOption('simpTrad', 'classic'),
    'simpTradAuto': () => setOption('simpTrad', 'auto'),
    'zhuyin': (checked) => setOptionCheck('zhuyin', checked),
    'grammar': (checked) => setOptionCheck('grammar', checked),
    'saveToWordListAllEntries': () => setOption('saveToWordList', 'AllEntries'),
    'saveToWordListFirstEntryOnly': () => setOption('saveToWordList', 'FirstEntryOnly'),
    'skritterTLDcom': () => setOption('skritterTLD', 'com'),
    'skritterTLDcn': () => setOption('skritterTLD', 'cn'),
};

function onChange(changeEvent) {
    const input = changeEvent.target;
    const inputId = input.getAttribute('id');
    const setter = setters[inputId];
    if (setter) {
        setter(input.checked);
    }
}

window.addEventListener('load', () => {
    document.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', onChange);
    });
    loadVals();
});
