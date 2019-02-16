/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

'use strict';

function loadVals() {

    const popupcolor = localStorage['popupcolor'];
    for (let i = 0; i < document.optform.popupcolor.length; i++) {
        if (document.optform.popupcolor[i].value === popupcolor) {
            document.optform.popupcolor[i].selected = true;
            break;
        }
    }

    if (localStorage['tonecolors'] === 'no') {
        document.optform.tonecolors[1].selected = true;
    } else {
        document.optform.tonecolors[0].selected = true;
    }

    if (localStorage['fontSize'] === 'large') {
        document.optform.fontSize[1].selected = true;
    } else {
        document.optform.fontSize[0].selected = true;
    }

    if (localStorage['skritterTLD'] === 'cn') {
        document.optform.skritterTLD[1].selected = true;
    } else {
        document.optform.skritterTLD[0].selected = true;
    }

    if (localStorage['zhuyin'] === 'yes') {
        document.optform.zhuyin[1].selected = true;
    } else {
        document.optform.zhuyin[0].selected = true;
    }

    if (localStorage['grammar'] === 'no') {
        document.optform.grammar[1].selected = true;
    } else {
        document.optform.grammar[0].selected = true;
    }

    if (localStorage['simpTrad'] === 'auto') {
        document.optform.simpTrad[1].selected = true;
    } else {
        document.optform.simpTrad[0].selected = true;
    }
}

function storeVals() {

    const backgroundPage = chrome.extension.getBackgroundPage();

    localStorage['popupcolor'] = document.optform.popupcolor.value;
    backgroundPage.zhongwenOptions.css = localStorage['popupcolor'];

    localStorage['tonecolors'] = document.optform.tonecolors.value;
    backgroundPage.zhongwenOptions.tonecolors = localStorage['tonecolors'];

    localStorage['fontSize'] = document.optform.fontSize.value;
    backgroundPage.zhongwenOptions.fontSize = localStorage['fontSize'];

    localStorage['skritterTLD'] = document.optform.skritterTLD.value;
    backgroundPage.zhongwenOptions.skritterTLD = localStorage['skritterTLD'];

    localStorage['zhuyin'] = document.optform.zhuyin.value;
    backgroundPage.zhongwenOptions.zhuyin = localStorage['zhuyin'];

    localStorage['grammar'] = document.optform.grammar.value;
    backgroundPage.zhongwenOptions.grammar = localStorage['grammar'];

    localStorage['simpTrad'] = document.optform.simpTrad.value;
    backgroundPage.zhongwenOptions.simpTrad = localStorage['simpTrad'];
}

$(function () {
    $('#save').click(storeVals);
});

window.onload = loadVals;
