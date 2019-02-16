/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

let wordList = localStorage['wordlist'];

let entries;
if (wordList) {
    entries = JSON.parse(wordList);
} else {
    entries = [];
}

$(document).ready(function () {

    let wordsElement = $('#words');
    let table = wordsElement.DataTable({
        data: entries,
        columns: [
            {data: 'simplified'},
            {data: 'traditional'},
            {data: 'pinyin'},
            {data: 'definition'},
        ]
    });

    wordsElement.find('tbody').on('click', 'tr', function () {
        $(this).toggleClass('bg-info');
    });

    $('#savebutton').click(function () {
        let selected = table.rows('.bg-info').data();

        if (!selected) {
            return;
        }

        let content = '';
        for (let i = 0; i < selected.length; i++) {
            let entry = selected[i]
            content += entry.simplified;
            content += '\t';
            content += entry.traditional;
            content += '\t';
            content += entry.pinyin;
            content += '\t';
            content += entry.definition;
            content += '\r\n';
        }

        let saveBlob = new Blob([content], {"type": "text/plain"});
        let a = document.getElementById('savelink');
        // Handle Chrome and Firefox
        a.href = (window.webkitURL || window.URL).createObjectURL(saveBlob);
        a.click();
    });

    let deleteButton = $('#delete');
    deleteButton.click(function () {
        table.rows('.bg-info').remove();

        let entries = table.rows().data().draw(true);

        let toKeep = [];
        for (let i = 0; i < entries.length; i++) {
            toKeep.push(entries[i]);
        }

        localStorage['wordlist'] = JSON.stringify(toKeep);

        // location.reload(true);
    });

    $('#selectall').click(function () {
        $('#words').find('tbody tr').addClass('bg-info');
    });

    $('#deselectall').click(function () {
        $('#words').find('tbody tr').removeClass('bg-info');
    });

    if (entries.length > 0) {
        $('#nodata').hide();
        $('#save').show();
        deleteButton.show();
    } else {
        $('#nodata').show();
        $('#save').hide();
        deleteButton.hide();
    }
});
