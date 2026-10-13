(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TradeCosts=api;})(typeof window==='object'?window:globalThis,function(){
    const DEFAULTS=Object.freeze({feePct:0.1,minimumFee:3,clearingPct:0.03,stampPer1000:1});
    function oneSide(notional,options={}) {
        if(!(notional>0))return 0;
        const config={...DEFAULTS,...options};
        if(!Number.isFinite(notional)||Object.values(config).some(value=>typeof value==='number'&&(!Number.isFinite(value)||value<0)))throw Error('Invalid transaction cost assumption');
        return Math.max(config.minimumFee,notional*config.feePct/100)+notional*config.clearingPct/100+Math.ceil(notional/1000)*config.stampPer1000;
    }
    function roundTripCost(buyNotional,sellNotional,options={}) {return oneSide(buyNotional,options)+oneSide(sellNotional,options);}
    function applySlippage(price,slipPct,side) {return price*(1+(side==='buy'?1:-1)*slipPct/100);}
    function unitsFor(allocation,entryPrice,lotSize=100) {return entryPrice>0&&lotSize>0?Math.floor(allocation/entryPrice/lotSize)*lotSize:0;}
    return {DEFAULTS,oneSide,roundTripCost,applySlippage,unitsFor};
});
