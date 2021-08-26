import Binance from 'node-binance-api';
import fetch from 'node-fetch';

class Client {
    client;
    subscribed;
    klines;

    constructor() {
        this.client = new Binance().options();
        this.subscribed = [];
        this.klines = {};
	this.debug = true;
        this.limiter = false;
        this.floodRate = 50;
        this.floodProtect = []
    }

    setDebug(value) {
	console.log('### setDebug # ' + value + ' #');
        this.debug = value == false ? false : true;
    }

    setFloodRate(value) {
        console.log('### setFloodRate # ' + value + ' #');
        this.floodRate = value;
    }

    FloodProtectOff(symbol) {
	if(this.debug) console.log('floodProtectOff', symbol)
        this.floodProtect.splice(this.floodProtect.indexOf(symbol),1);
    }
    FloodProtectOn(symbol) {
        if(this.debug) console.log('floodProtectOn', symbol)
        this.floodProtect.push(symbol);
    }

    subscribe(symbol, interval) {
        if (!this.subscribed.find(e => e === symbol + interval)) {

            this.subscribed.push(symbol + interval);
            this.client.websockets.chart(symbol, interval, (symbol, interval, chart) => {
                let timeDiff = Math.abs(Object.keys(chart)[0] - Object.keys(chart)[1]);
                let newFrames = [];
                for (let openTime of Object.keys(chart)) {
                    let item = chart[openTime];
                    openTime = parseInt(openTime);
                    let closeTime = openTime + timeDiff - 1;
                    let quoteAssetVolume = parseFloat(item.volume) / ((parseFloat(item.open) + parseFloat(item.close)) / 2);
                    const frame = [
                        openTime,
                        item.open,
                        item.high,
                        item.low,
                        item.close,
                        item.volume,
                        closeTime,
                        quoteAssetVolume.toString(),
                        100,
                        (quoteAssetVolume / 2).toString(),
                        (quoteAssetVolume / 2).toString(),
                        "1.1"];
                    newFrames.push(frame);
                }
                this.klines[symbol + interval] = newFrames;
            }, 1000);
        }
    }
    async getCandles(symbol, interval) {
	let debug = this.debug;
        let data = this.klines[symbol + interval];
        if (!data) {
            this.subscribe(symbol, interval);
            while (!data || data.length === 0) {
                await new Promise(r => setTimeout(r, 100));
                data = this.klines[symbol + interval];
            }
        }
        if (!data[data.length - 1] || data[data.length - 1][6] <= Date.now()) {
            if(this.limiter == false) this.limiter = Date.now();

	    let since_last = Date.now() - this.limiter;
            if(since_last > this.floodRate) {
                    if(debug) console.log('[0] now:' + Date.now() + ' this.limiter' + this.limiter + ' since_last: ' + since_last);
                    this.limiter = Date.now();
	            return fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}`).then(resp => resp.json());
            } else {
                 if(this.floodProtect.indexOf(symbol) == -1) {
		    this.FloodProtectOn(symbol);
                    this.limiter = this.limiter + this.floodRate;
	            let flood_protect = (since_last * -1)  + this.floodRate;
		    await new Promise(resolve => setTimeout(resolve, flood_protect));
              	    if(debug) console.log('[x] now:' + Date.now() + ' this.limiter: ' + this.limiter + ' flood protect: ' + flood_protect);
		    this.FloodProtectOff(symbol);
                    return fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}`).then(resp => resp.json());

		}
                    //this.limiter = Date.now() + flood_protect;
            }
        }
        return this.klines[symbol + interval];
    }
}


export default new Client();
