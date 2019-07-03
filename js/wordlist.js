/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

const wordList = localStorage['wordlist'];

let entries;
if (wordList) {
    entries = JSON.parse(wordList);
} else {
    entries = [];
}

function disableButtons(table) {
    if (table.rows({ selected: true }).data().length === 0) {
        $('.selection-only').prop('disabled', true);
    }
}

$(document).ready(function () {
    const table = $('#words').DataTable({
        data: entries,
        columns: [
            { data: 'simplified' },
            { data: 'traditional' },
            { data: 'pinyin' },
            { data: 'definition' },
        ],
        language: {
            emptyTable: 'You haven\'t saved any words yet. <br /> <small>You can save words by using the <kbd>R</kbd> key on the keyboard when the pop-up translation is being displayed.</small>'
        },
        select: {
            style: 'multi+shift'
        }
    });
    disableButtons(table);

    table.on('select', () => {
        $('.selection-only').prop('disabled', false);
    });

    table.on('deselect', () => {
        disableButtons(table);
    });

    $('#savebutton').click(function () {
        const selected = table.rows({ selected: true }).data();

        if (!selected) {
            return;
        }

        let content = '';
        for (let i = 0; i < selected.length; i++) {
            const entry = selected[i];
            content += entry.simplified;
            content += '\t';
            content += entry.traditional;
            content += '\t';
            content += entry.pinyin;
            content += '\t';
            content += entry.definition;
            content += '\r\n';
        }

        const saveBlob = new Blob([content], { "type": "text/plain" });
        const a = document.getElementById('savelink');
        // Handle Chrome and Firefox
        a.href = (window.webkitURL || window.URL).createObjectURL(saveBlob);
        a.click();
    });

    $('#delete').click(function () {
        table.rows({ selected: true }).remove().draw();
        const entries = table.rows().data().toArray();
        localStorage['wordlist'] = JSON.stringify(entries);
        disableButtons(table);
    });

    $('#selectall').click(function () {
        table.rows({
            search: 'applied'
        }).select();
    });

    $('#deselectall').click(function () {
        table.rows({
            search: 'applied'
        }).deselect();
    });
});
