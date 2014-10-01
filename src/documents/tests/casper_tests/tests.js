var casper = casper || {};
var document_list_url = casper.cli.options['url'];

casper.options.clientScripts.push("../../../static/js/vendor/sinon.js");

function inject_cookies() {
    var m = casper.cli.options['url-base'].match(/https?:\/\/([^:]+)(:\d+)?\//);
    var domain = m ? m[1] : 'localhost';

    for (var key in casper.cli.options) {
        if (key.indexOf('cookie-') === 0) {
            var cn = key.substring('cookie-'.length);
            var c = phantom.addCookie({
                name: cn,
                value: casper.cli.options[key],
                domain: domain
            });
        }
    }
}
inject_cookies();

casper.test.begin('Document list tests', 0, function suite(test) {
    casper.start(document_list_url, function() {
        test.assertTitle('Phase');
        casper.wait(500);
        test.assertSelectorHasText('#display-results', '1 document on 1')
        test.assertElementCount('table#documents tbody tr', 1);
    });

    casper.run(function() {
        test.done();
    });
});

casper.test.begin('Buttons are enabled on checkbox click', 0, function suite(test) {
    casper.start(document_list_url, function() {
        test.assertExists('button#download-button.disabled');
    });

    casper.then(function() {
        casper.click('td.columnselect input[type=checkbox]');
    });

    casper.then(function() {
        test.assertDoesntExist('button#download-button.disabled');
        test.assertExists('button#download-button');
    });

    casper.run(function() {
        test.done();
    });
});
