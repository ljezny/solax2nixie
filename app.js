import * as https from 'https';
import * as fs from 'fs';

function httpRequest(params, postData) {
    return new Promise(function (resolve, reject) {
        var req = https.request(params, function (res) {            
            if (res.statusCode < 200 || res.statusCode >= 300) {
                console.log(res);
                return reject(new Error('statusCode=' + res.statusCode));
            }
            var body = [];
            res.on('data', function (chunk) {
                body.push(chunk);
            });
            res.on('end', function () {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                    console.log(body);
                } catch (e) {
                    reject(e);
                }
                resolve(body);
            });
        });
        req.on('error', function (err) {
            reject(err);
        });
        if (postData) {
            console.log(postData);
            req.write(postData);
        }
        req.end();
    });
}

async function loginNixie(config) {
    var params = {
        host: 'api.daliborfarny.com',
        port: 443,
        method: 'POST',
        path: '/oauth/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    return await httpRequest(params, "client_id=3rdparty&client_secret=ws7TQHXp5W6444t4&grant_type=password&username=" + encodeURIComponent(config.nixie_username) + "&password=" + encodeURIComponent(config.nixie_password));
}

async function listNixies(access_token) {
    var params = {
        host: 'api.daliborfarny.com',
        port: 443,
        method: 'GET',
        path: '/v1/devices?client_id=3rdparty&access_token=' + access_token + '&client_secret=ws7TQHXp5W6444t4',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    return await httpRequest(params, null);
}

async function showSocNixie(access_token, clockId, soc) {
    //nixie can show data in format _ - not shown, 0-9 for numbers, .:; for colon
    if (soc > 99) {
        soc = 99;
    }

    var text = "___" + (soc < 10 ? "_" + soc : soc) + "%3A__"; //%3A is colon url encoded

    var params = {
        host: 'api.daliborfarny.com',
        port: 443,
        method: 'POST',
        path: '/v1/devices/' + clockId + '/customdata',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    return await httpRequest(params, 'client_id=3rdparty&access_token=' + access_token + '&client_secret=ws7TQHXp5W6444t4&arg=' + text);
}

async function showSocColorNixie(access_token, clockId, soc) {
    //nixie can show data in format _ - not shown, 0-9 for numbers, .:; for colon
    if (soc > 99) {
        soc = 99;
    }

    var color = "255"; 
    if(soc > 80) {
        color = "65280";
    } else if(soc > 30) {
        color = "21247";
    }

    var params = {
        host: 'api.daliborfarny.com',
        port: 443,
        method: 'POST',
        path: '/v1/devices/' + clockId + '/underlightsolidcolor',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    return await httpRequest(params, 'client_id=3rdparty&access_token=' + access_token + '&client_secret=ws7TQHXp5W6444t4&arg=' + color);
}

async function showClocksNixie(access_token, clockId) {
    var params = {
        host: 'api.daliborfarny.com',
        port: 443,
        method: 'POST',
        path: '/v1/devices/' + clockId + '/switchtotimemode',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };
    return await httpRequest(params, 'client_id=3rdparty&access_token=' + access_token + '&client_secret=ws7TQHXp5W6444t4&arg=1');
}

async function solaxData(config) {
    var params = {
        host: 'global.solaxcloud.com',
        port: 443,
        method: 'POST',
        path: '/api/v2/dataAccess/realtimeInfo/get',
        headers: {
            'Content-Type': 'application/json',
            'tokenId': config.solax_token,
        }
    };
    return await httpRequest(params, "{\"wifiSn\":\"" + config.solax_wifi_sn + "\"}");
}

var nixieTokenResponse = null;
var lastNixieTokenMS = 0;
var nixieListResponse = null;
var solaxResponse = null;
var lastSolaxMS = 0;

let config = JSON.parse(fs.readFileSync('config.json'));
console.log(config);


while (true) {
    if (Date.now() - lastNixieTokenMS > 60 * 60 * 1000) {
        nixieTokenResponse = await loginNixie(config);
        nixieListResponse = await listNixies(nixieTokenResponse.data.access_token);
        lastNixieTokenMS = Date.now();
    }

    if (Date.now() - lastSolaxMS > 5 * 60 * 1000) { // 5 minutes
        solaxResponse = await solaxData(config);
        lastSolaxMS = Date.now();
    }
    if (solaxResponse.success) {
        await showSocColorNixie(nixieTokenResponse.data.access_token, nixieListResponse.data[0].id, solaxResponse.result.soc);
        await showSocNixie(nixieTokenResponse.data.access_token, nixieListResponse.data[0].id, solaxResponse.result.soc);
        await new Promise(resolve => setTimeout(resolve, 5 * 1000));
        await showClocksNixie(nixieTokenResponse.data.access_token, nixieListResponse.data[0].id, solaxResponse.result.soc);
    }

    await new Promise(resolve => setTimeout(resolve, 30 * 1000));
}